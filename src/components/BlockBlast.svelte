<script lang="ts">
  import { onMount } from 'svelte';

  const GRID_SIZE = 8;
  const BLOCK_SIZE = 45;

  const COLORS = [
    '#FF6B6B', // Rouge
    '#4ECDC4', // Cyan
    '#45B7D1', // Bleu
    '#FFA07A', // Orange
    '#98D8C8', // Vert
    '#F7DC6F', // Jaune
    '#BB8FCE'  // Violet
  ];

  // Formes de blocs disponibles pour le drag & drop
  const BLOCK_SHAPES = [
    [[1]], // 1x1
    [[1, 1]], // 1x2
    [[1], [1]], // 2x1
    [[1, 1, 1]], // 1x3
    [[1], [1], [1]], // 3x1
    [[1, 1], [1, 1]], // 2x2
    [[1, 0], [1, 1]], // L
    [[0, 1], [1, 1]], // L inversé
    [[1, 1, 0], [0, 1, 1]], // Z
    [[1, 1, 1], [0, 1, 0]], // T
  ];

  let grid: number[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));
  let score = 0;
  let availableBlocks: Block[] = [];
  let draggedBlock: Block | null = null;
  let draggedBlockIndex: number = -1;
  let gameOver = false;
  let animatingCells: Set<string> = new Set();
  let dragPosition = { x: 0, y: 0 };
  let previewPosition = { row: -1, col: -1 };
  let isDragging = false;
  let gameBoardElement: HTMLElement | null = null;

  // Cache pour analyzeGrid() - optimisation performance
  let gridAnalysisCache: { emptySpaces: number, almostFullLines: number[] } | null = null;
  let gridDirty = true;

  // Support clavier pour accessibilité
  let selectedBlockIndex = -1;
  let keyboardCursorPos = { row: 0, col: 0 };

  // Compteur pour IDs uniques robustes
  let blockIdCounter = 0;

  interface Block {
    shape: number[][];
    color: string;
    id: number;
  }

  // Copie efficace de shape 2D
  function cloneShape(shape: number[][]): number[][] {
    return shape.map(row => [...row]);
  }

  function createRandomBlock(): Block {
    const shape = BLOCK_SHAPES[Math.floor(Math.random() * BLOCK_SHAPES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      shape: cloneShape(shape),
      color,
      id: ++blockIdCounter
    };
  }

  // Optimisé: une seule passe O(n²) au lieu de 3, suppression smallGaps inutilisé
  function analyzeGrid(): { emptySpaces: number, almostFullLines: number[] } {
    let emptySpaces = 0;
    const almostFullLines: number[] = [];
    const rowFilled = new Array(GRID_SIZE).fill(0);
    const colFilled = new Array(GRID_SIZE).fill(0);

    // UNE SEULE PASSE O(n²) pour tout calculer
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col] === 0) {
          emptySpaces++;
        } else {
          rowFilled[row]++;
          colFilled[col]++;
        }
      }
    }

    // Détection lignes/colonnes presque complètes O(n)
    for (let row = 0; row < GRID_SIZE; row++) {
      if (rowFilled[row] >= 6) {
        almostFullLines.push(GRID_SIZE - rowFilled[row]);
      }
    }
    for (let col = 0; col < GRID_SIZE; col++) {
      if (colFilled[col] >= 6) {
        almostFullLines.push(GRID_SIZE - colFilled[col]);
      }
    }

    return { emptySpaces, almostFullLines };
  }

  // Cache wrapper pour éviter recalculs inutiles
  function getCachedAnalysis() {
    if (gridDirty || !gridAnalysisCache) {
      gridAnalysisCache = analyzeGrid();
      gridDirty = false;
    }
    return gridAnalysisCache;
  }

  function createSmartBlock(): Block {
    const analysis = getCachedAnalysis();
    const totalCells = GRID_SIZE * GRID_SIZE;
    const fillRatio = (totalCells - analysis.emptySpaces) / totalCells;

    let priorityShapes: number[][];

    // Si la grille est très pleine (>75%), prioriser les petites formes
    if (fillRatio > 0.75) {
      priorityShapes = [
        [[1]], // 1x1
        [[1, 1]], // 1x2
        [[1], [1]], // 2x1
        [[1, 1, 1]], // 1x3
      ];
    }
    // Si on a des lignes presque complètes, proposer des formes qui peuvent les compléter
    else if (analysis.almostFullLines.length > 0) {
      const gapSize = Math.min(...analysis.almostFullLines);
      if (gapSize === 1) {
        priorityShapes = [[[1]], [[1], [1]]];
      } else if (gapSize === 2) {
        priorityShapes = [[[1, 1]], [[1], [1]], [[1, 1], [1, 1]]];
      } else {
        priorityShapes = [[[1, 1, 1]], [[1], [1], [1]], [[1, 1], [1, 1]]];
      }
    }
    // Sinon, mix de formes avec préférence pour les moyennes
    else {
      priorityShapes = [
        [[1]], // 1x1
        [[1, 1]], // 1x2
        [[1], [1]], // 2x1
        [[1, 1, 1]], // 1x3
        [[1, 1], [1, 1]], // 2x2
        [[1, 0], [1, 1]], // L
        [[0, 1], [1, 1]], // L inversé
      ];
    }

    // 70% du temps, utiliser les formes prioritaires
    const usePriority = Math.random() < 0.7;
    const shapePool = usePriority ? priorityShapes : BLOCK_SHAPES;

    const shape = shapePool[Math.floor(Math.random() * shapePool.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return {
      shape: cloneShape(shape),
      color,
      id: ++blockIdCounter
    };
  }

  function canAnyBlockBePlaced(blocks: Block[]): boolean {
    for (const block of blocks) {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (canPlaceBlock(block, row, col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function generateBlocks() {
    const newBlocks: Block[] = [];

    // Générer 3 blocs intelligents
    for (let i = 0; i < 3; i++) {
      newBlocks.push(createSmartBlock());
    }

    // S'assurer qu'au moins 2 blocs peuvent être placés
    let attempts = 0;
    while (!canAnyBlockBePlaced(newBlocks) && attempts < 10) {
      // Remplacer par des formes plus petites
      newBlocks[0] = {
        shape: [[1]],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        id: ++blockIdCounter
      };
      newBlocks[1] = {
        shape: [[1, 1]],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        id: ++blockIdCounter
      };
      attempts++;
    }

    availableBlocks = newBlocks;
  }

  function initGame() {
    console.log('initGame appelé - avant reset');

    grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

    // Ajouter quelques blocs aléatoires au début (mode facile)
    for (let i = 0; i < 8; i++) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      if (!grid[row][col]) {
        grid[row][col] = Math.floor(Math.random() * COLORS.length) + 1;
      }
    }

    score = 0;
    gameOver = false;

    draggedBlock = null;
    draggedBlockIndex = -1;
    isDragging = false;
    animatingCells = new Set();
    previewPosition = { row: -1, col: -1 };
    dragPosition = { x: 0, y: 0 };
    selectedBlockIndex = -1;
    keyboardCursorPos = { row: 0, col: 0 };

    gridDirty = true;
    gridAnalysisCache = null;

    generateBlocks();

    console.log('initGame terminé - gameOver:', gameOver, 'availableBlocks:', availableBlocks.length);
  }

  function canPlaceBlock(block: Block, gridRow: number, gridCol: number): boolean {
    for (let row = 0; row < block.shape.length; row++) {
      for (let col = 0; col < block.shape[row].length; col++) {
        if (block.shape[row][col]) {
          const targetRow = gridRow + row;
          const targetCol = gridCol + col;

          if (targetRow < 0 || targetRow >= GRID_SIZE ||
              targetCol < 0 || targetCol >= GRID_SIZE) {
            return false;
          }

          if (grid[targetRow][targetCol]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  function placeBlock(block: Block, gridRow: number, gridCol: number) {
    const colorIndex = COLORS.indexOf(block.color) + 1;

    for (let row = 0; row < block.shape.length; row++) {
      for (let col = 0; col < block.shape[row].length; col++) {
        if (block.shape[row][col]) {
          grid[gridRow + row][gridCol + col] = colorIndex;
        }
      }
    }

    grid = grid; // Trigger reactivity
    gridDirty = true; // Invalider cache après modification
    checkAndClearLines();
  }

  function checkAndClearLines() {
    let cleared = 0;
    const cellsToRemove: Set<string> = new Set();

    // Vérifier les lignes horizontales
    for (let row = 0; row < GRID_SIZE; row++) {
      if (grid[row].every(cell => cell !== 0)) {
        for (let col = 0; col < GRID_SIZE; col++) {
          cellsToRemove.add(`${row}-${col}`);
        }
        cleared++;
      }
    }

    // Vérifier les colonnes verticales
    for (let col = 0; col < GRID_SIZE; col++) {
      let columnFull = true;
      for (let row = 0; row < GRID_SIZE; row++) {
        if (grid[row][col] === 0) {
          columnFull = false;
          break;
        }
      }
      if (columnFull) {
        for (let row = 0; row < GRID_SIZE; row++) {
          cellsToRemove.add(`${row}-${col}`);
        }
        cleared++;
      }
    }

    if (cellsToRemove.size > 0) {
      // Animation
      animatingCells = cellsToRemove;

      setTimeout(() => {
        // Effacer les cellules
        cellsToRemove.forEach(cell => {
          const [row, col] = cell.split('-').map(Number);
          grid[row][col] = 0;
        });
        grid = grid;
        gridDirty = true; // Invalider cache après effacement
        animatingCells = new Set();

        // Score basé sur cellules uniques effacées (évite double comptage aux intersections)
        score += cellsToRemove.size * 10;

        // Vérifier à nouveau pour les combos
        setTimeout(() => checkAndClearLines(), 100);
      }, 300);
    }
  }

  function hasValidMove(): boolean {
    for (const block of availableBlocks) {
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          if (canPlaceBlock(block, row, col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function getGridCellFromPosition(x: number, y: number): { row: number, col: number } {
    if (!gameBoardElement) return { row: -1, col: -1 };

    const rect = gameBoardElement.getBoundingClientRect();
    const relativeX = x - rect.left - 10; // 10px padding
    const relativeY = y - rect.top - 10;

    const cellWithGap = BLOCK_SIZE + 3; // cell + gap
    const col = Math.floor(relativeX / cellWithGap);
    const row = Math.floor(relativeY / cellWithGap);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      return { row, col };
    }
    return { row: -1, col: -1 };
  }

  function handleDragStart(block: Block, index: number) {
    draggedBlock = block;
    draggedBlockIndex = index;
    isDragging = true;
  }

  function handleDrop(row: number, col: number) {
    if (!draggedBlock) return;

    if (canPlaceBlock(draggedBlock, row, col)) {
      placeBlock(draggedBlock, row, col);

      // Retirer le bloc utilisé
      availableBlocks.splice(draggedBlockIndex, 1);
      availableBlocks = availableBlocks;

      // Générer de nouveaux blocs si tous sont utilisés
      if (availableBlocks.length === 0) {
        generateBlocks();
      }

      // Vérifier si le jeu continue
      if (!hasValidMove()) {
        gameOver = true;
      }
    }

    draggedBlock = null;
    draggedBlockIndex = -1;
    isDragging = false;
    previewPosition = { row: -1, col: -1 };
  }

  function handleDragMove(event: DragEvent) {
    if (!draggedBlock) return;

    dragPosition = { x: event.clientX, y: event.clientY };
    const gridPos = getGridCellFromPosition(event.clientX, event.clientY);
    previewPosition = gridPos;
  }

  function handleTouchStart(event: TouchEvent, block: Block, index: number) {
    event.preventDefault();
    handleDragStart(block, index);

    const touch = event.touches[0];
    dragPosition = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();

    if (!draggedBlock) return;

    const touch = event.touches[0];
    dragPosition = { x: touch.clientX, y: touch.clientY };

    const gridPos = getGridCellFromPosition(touch.clientX, touch.clientY);
    previewPosition = gridPos;
  }

  function handleTouchEnd(event: TouchEvent) {
    event.preventDefault();

    if (!draggedBlock) return;

    const touch = event.changedTouches[0];
    const gridPos = getGridCellFromPosition(touch.clientX, touch.clientY);

    if (gridPos.row >= 0 && gridPos.col >= 0) {
      handleDrop(gridPos.row, gridPos.col);
    } else {
      draggedBlock = null;
      draggedBlockIndex = -1;
      isDragging = false;
      previewPosition = { row: -1, col: -1 };
    }
  }

  // Support clavier complet pour accessibilité
  function handleKeyDown(e: KeyboardEvent) {
    if (gameOver) return;

    if (selectedBlockIndex === -1) {
      // Tab pour sélectionner le premier bloc
      if (e.key === 'Tab' && availableBlocks.length > 0) {
        e.preventDefault();
        selectedBlockIndex = 0;
        draggedBlock = availableBlocks[0];
        draggedBlockIndex = 0;
        isDragging = true;
        previewPosition = keyboardCursorPos;
      }
    } else {
      // Bloc sélectionné: navigation avec flèches
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          keyboardCursorPos.row = Math.max(0, keyboardCursorPos.row - 1);
          previewPosition = keyboardCursorPos;
          break;
        case 'ArrowDown':
          e.preventDefault();
          keyboardCursorPos.row = Math.min(GRID_SIZE - 1, keyboardCursorPos.row + 1);
          previewPosition = keyboardCursorPos;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          keyboardCursorPos.col = Math.max(0, keyboardCursorPos.col - 1);
          previewPosition = keyboardCursorPos;
          break;
        case 'ArrowRight':
          e.preventDefault();
          keyboardCursorPos.col = Math.min(GRID_SIZE - 1, keyboardCursorPos.col + 1);
          previewPosition = keyboardCursorPos;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleDrop(keyboardCursorPos.row, keyboardCursorPos.col);
          selectedBlockIndex = -1;
          isDragging = false;
          previewPosition = { row: -1, col: -1 };
          break;
        case 'Escape':
          e.preventDefault();
          selectedBlockIndex = -1;
          draggedBlock = null;
          draggedBlockIndex = -1;
          isDragging = false;
          previewPosition = { row: -1, col: -1 };
          break;
        case 'Tab':
          // Changer de bloc avec Tab
          e.preventDefault();
          selectedBlockIndex = (selectedBlockIndex + 1) % availableBlocks.length;
          draggedBlock = availableBlocks[selectedBlockIndex];
          draggedBlockIndex = selectedBlockIndex;
          previewPosition = keyboardCursorPos;
          break;
      }
    }
  }

  onMount(() => {
    initGame();

    // Attacher touch et keyboard handlers au niveau document
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Cleanup handlers au démontage
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="game-container">
  <div class="game-header">
    <h1>🎯 Block Blast</h1>
    <div class="score-display">
      <span class="label">Score:</span>
      <span class="value">{score}</span>
    </div>
  </div>

  <div
    class="game-board"
    bind:this={gameBoardElement}
    on:dragover|preventDefault={handleDragMove}
    role="grid"
    aria-label="Grille de jeu Block Blast 8 par 8"
  >
    {#each grid as row, rowIndex}
      {#each row as cell, colIndex}
        {@const isPreview = isDragging && draggedBlock &&
          rowIndex >= previewPosition.row &&
          rowIndex < previewPosition.row + draggedBlock.shape.length &&
          colIndex >= previewPosition.col &&
          colIndex < previewPosition.col + draggedBlock.shape[0].length &&
          draggedBlock.shape[rowIndex - previewPosition.row]?.[colIndex - previewPosition.col] === 1}
        {@const canPlace = previewPosition.row >= 0 && previewPosition.col >= 0 &&
          draggedBlock && canPlaceBlock(draggedBlock, previewPosition.row, previewPosition.col)}
        <div
          class="grid-cell"
          class:filled={cell !== 0}
          class:animating={animatingCells.has(`${rowIndex}-${colIndex}`)}
          class:preview={isPreview}
          class:preview-valid={isPreview && canPlace}
          class:preview-invalid={isPreview && !canPlace}
          data-row={rowIndex}
          data-col={colIndex}
          style="background-color: {cell ? COLORS[cell - 1] : '#2a2a4e'}"
          on:drop|preventDefault={() => handleDrop(rowIndex, colIndex)}
          on:dragover|preventDefault
          role="gridcell"
          aria-label="Cellule ligne {rowIndex + 1} colonne {colIndex + 1} {cell ? 'occupée' : 'vide'}"
        />
      {/each}
    {/each}
  </div>

  <div class="available-blocks" role="list" aria-label="Blocs disponibles">
    {#each availableBlocks as block, index (block.id)}
      <div
        class="block-container"
        class:selected={selectedBlockIndex === index}
        draggable="true"
        on:dragstart={() => handleDragStart(block, index)}
        on:touchstart={(e) => handleTouchStart(e, block, index)}
        role="button"
        tabindex="0"
        aria-label="Bloc {index + 1} de {availableBlocks.length} - Utilisez Tab pour sélectionner, flèches pour positionner, Entrée pour placer"
      >
        <div class="block-preview" style="grid-template-columns: repeat({block.shape[0].length}, 35px);">
          {#each block.shape as row}
            {#each row as cell}
              <div
                class="block-cell"
                class:filled={cell === 1}
                style="background-color: {cell ? block.color : 'transparent'}"
              />
            {/each}
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if isDragging && draggedBlock}
    <div
      class="dragging-ghost"
      style="left: {dragPosition.x}px; top: {dragPosition.y}px;"
    >
      <div class="ghost-block" style="grid-template-columns: repeat({draggedBlock.shape[0].length}, 35px);">
        {#each draggedBlock.shape as row}
          {#each row as cell}
            <div
              class="ghost-cell"
              class:filled={cell === 1}
              style="background-color: {cell ? draggedBlock.color : 'transparent'}"
            />
          {/each}
        {/each}
      </div>
    </div>
  {/if}

  {#if gameOver}
    <div class="game-over-overlay">
      <div class="game-over-content">
        <h2>🎊 Partie Terminée!</h2>
        <p class="final-score">Score: {score}</p>
        <button class="restart-btn" on:click={initGame}>
          🔄 Recommencer
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .game-header {
    width: 100%;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: #FFD93D;
    text-shadow: 3px 3px 0px #FF6B6B;
  }

  .score-display {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0.75rem 2rem;
    border-radius: 20px;
    font-size: 1.8rem;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    display: inline-block;
  }

  .label {
    color: #fff;
    font-weight: bold;
  }

  .value {
    color: #FFD93D;
    font-weight: bold;
    margin-left: 0.5rem;
  }

  .game-board {
    display: grid;
    grid-template-columns: repeat(8, 45px);
    grid-template-rows: repeat(8, 45px);
    gap: 3px;
    background: #1a1a2e;
    padding: 10px;
    border-radius: 15px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    border: 4px solid #FFD93D;
  }

  .grid-cell {
    width: 45px;
    height: 45px;
    border-radius: 6px;
    transition: all 0.2s;
    cursor: pointer;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
  }

  .grid-cell.filled {
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }

  .grid-cell.animating {
    animation: pulse 0.3s ease-in-out;
    transform: scale(1.1);
  }

  .grid-cell.preview {
    border: 2px solid rgba(255, 255, 255, 0.5);
    z-index: 10;
  }

  .grid-cell.preview-valid {
    background-color: rgba(152, 216, 200, 0.6) !important;
    border-color: #98D8C8;
    box-shadow: 0 0 15px rgba(152, 216, 200, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3);
  }

  .grid-cell.preview-invalid {
    background-color: rgba(255, 107, 107, 0.4) !important;
    border-color: #FF6B6B;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.6);
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
  }

  .available-blocks {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
    min-height: 120px;
    padding: 1rem;
    background: rgba(26, 26, 46, 0.5);
    border-radius: 20px;
    border: 3px dashed #FFD93D;
  }

  .block-container {
    cursor: grab;
    padding: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: transform 0.2s;
    touch-action: none;
    user-select: none;
  }

  .block-container:active {
    cursor: grabbing;
    transform: scale(1.1);
  }

  .block-preview {
    display: grid;
    gap: 2px;
  }

  .block-cell {
    width: 35px;
    height: 35px;
    border-radius: 5px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .block-cell.filled {
    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
  }

  .game-over-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none;
  }

  .game-over-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 3rem;
    border-radius: 25px;
    text-align: center;
    border: 4px solid #FFD93D;
    box-shadow: 0 10px 50px rgba(0,0,0,0.5);
    pointer-events: auto;
  }

  .game-over-content h2 {
    color: #FFD93D;
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 2rem;
    margin: 1rem 0;
    font-weight: bold;
  }

  .restart-btn {
    font-size: 1.5rem;
    padding: 1rem 2.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 15px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.2s;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .restart-btn:hover {
    transform: scale(1.05);
  }

  .restart-btn:active {
    transform: scale(0.95);
  }

  .dragging-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    opacity: 0.9;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5));
  }

  .ghost-block {
    display: grid;
    gap: 2px;
    animation: float 0.5s ease-in-out infinite alternate;
  }

  @keyframes float {
    from { transform: translateY(0px); }
    to { transform: translateY(-5px); }
  }

  .ghost-cell {
    width: 35px;
    height: 35px;
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .ghost-cell.filled {
    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 2rem;
    }

    .game-board {
      grid-template-columns: repeat(8, 38px);
      grid-template-rows: repeat(8, 38px);
      gap: 2px;
      padding: 8px;
    }

    .grid-cell {
      width: 38px;
      height: 38px;
    }

    .block-cell {
      width: 30px;
      height: 30px;
    }

    .score-display {
      font-size: 1.5rem;
      padding: 0.5rem 1.5rem;
    }

    .ghost-cell {
      width: 30px;
      height: 30px;
    }
  }
</style>

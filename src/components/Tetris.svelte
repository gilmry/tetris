<script lang="ts">
  import { onMount } from 'svelte';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingRequest | null = null;
  let gameRunning = false;
  let score = 0;
  let level = 1;
  let gameSpeed = 800;

  const COLORS = [
    '#FF6B6B', // Rouge
    '#4ECDC4', // Cyan
    '#45B7D1', // Bleu
    '#FFA07A', // Orange
    '#98D8C8', // Vert
    '#F7DC6F', // Jaune
    '#BB8FCE'  // Violet
  ];

  const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]], // Z
    [[1, 0, 0], [1, 1, 1]], // L
    [[0, 0, 1], [1, 1, 1]]  // J
  ];

  let board: number[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  let currentPiece: any = null;
  let gameLoop: any = null;

  interface Piece {
    shape: number[][];
    x: number;
    y: number;
    color: string;
  }

  function createPiece(): Piece {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    return {
      shape: SHAPES[shapeIndex],
      x: Math.floor(COLS / 2) - 1,
      y: 0,
      color: COLORS[shapeIndex]
    };
  }

  function drawBoard() {
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (board[row][col]) {
          ctx.fillStyle = COLORS[board[row][col] - 1];
          ctx.fillRect(
            col * BLOCK_SIZE,
            row * BLOCK_SIZE,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2
          );
        }
      }
    }
  }

  function drawPiece(piece: Piece) {
    if (!ctx) return;

    ctx.fillStyle = piece.color;
    piece.shape.forEach((row, dy) => {
      row.forEach((value, dx) => {
        if (value) {
          ctx!.fillRect(
            (piece.x + dx) * BLOCK_SIZE,
            (piece.y + dy) * BLOCK_SIZE,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2
          );
        }
      });
    });
  }

  function collides(piece: Piece, offsetX = 0, offsetY = 0): boolean {
    for (let dy = 0; dy < piece.shape.length; dy++) {
      for (let dx = 0; dx < piece.shape[dy].length; dx++) {
        if (piece.shape[dy][dx]) {
          const newX = piece.x + dx + offsetX;
          const newY = piece.y + dy + offsetY;

          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }

          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function mergePiece(piece: Piece) {
    piece.shape.forEach((row, dy) => {
      row.forEach((value, dx) => {
        if (value) {
          const boardY = piece.y + dy;
          const boardX = piece.x + dx;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            board[boardY][boardX] = COLORS.indexOf(piece.color) + 1;
          }
        }
      });
    });
  }

  function clearLines() {
    let linesCleared = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row].every(cell => cell !== 0)) {
        board.splice(row, 1);
        board.unshift(Array(COLS).fill(0));
        linesCleared++;
        row++;
      }
    }
    if (linesCleared > 0) {
      score += linesCleared * 100 * level;
      if (score > level * 1000) {
        level++;
        gameSpeed = Math.max(100, gameSpeed - 50);
        clearInterval(gameLoop);
        startGameLoop();
      }
    }
  }

  function moveDown() {
    if (!currentPiece) return;

    if (!collides(currentPiece, 0, 1)) {
      currentPiece.y++;
    } else {
      mergePiece(currentPiece);
      clearLines();
      currentPiece = createPiece();

      if (collides(currentPiece)) {
        gameRunning = false;
        clearInterval(gameLoop);
      }
    }
  }

  function moveLeft() {
    if (!currentPiece || !gameRunning) return;
    if (!collides(currentPiece, -1, 0)) {
      currentPiece.x--;
    }
  }

  function moveRight() {
    if (!currentPiece || !gameRunning) return;
    if (!collides(currentPiece, 1, 0)) {
      currentPiece.x++;
    }
  }

  function rotate() {
    if (!currentPiece || !gameRunning) return;

    const rotated = currentPiece.shape[0].map((_: any, i: number) =>
      currentPiece.shape.map((row: number[]) => row[i]).reverse()
    );

    const originalShape = currentPiece.shape;
    currentPiece.shape = rotated;

    if (collides(currentPiece)) {
      currentPiece.shape = originalShape;
    }
  }

  function drop() {
    if (!currentPiece || !gameRunning) return;
    while (!collides(currentPiece, 0, 1)) {
      currentPiece.y++;
    }
    moveDown();
  }

  function draw() {
    drawBoard();
    if (currentPiece) {
      drawPiece(currentPiece);
    }
  }

  function startGameLoop() {
    gameLoop = setInterval(() => {
      if (gameRunning) {
        moveDown();
        draw();
      }
    }, gameSpeed);
  }

  function startGame() {
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    score = 0;
    level = 1;
    gameSpeed = 800;
    currentPiece = createPiece();
    gameRunning = true;
    clearInterval(gameLoop);
    startGameLoop();
    draw();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!gameRunning) return;

    switch(e.key) {
      case 'ArrowLeft':
        moveLeft();
        break;
      case 'ArrowRight':
        moveRight();
        break;
      case 'ArrowDown':
        moveDown();
        break;
      case 'ArrowUp':
        rotate();
        break;
      case ' ':
        drop();
        break;
    }
    draw();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    draw();

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(gameLoop);
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🎮 Tetris Kids</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">Niveau:</span>
        <span class="value">{level}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={COLS * BLOCK_SIZE}
    height={ROWS * BLOCK_SIZE}
    class="game-canvas"
  />

  {#if !gameRunning}
    <div class="game-over">
      <h2>🎯 {score > 0 ? 'Partie Terminée!' : 'Prêt à Jouer?'}</h2>
      {#if score > 0}
        <p class="final-score">Score Final: {score}</p>
      {/if}
      <button class="start-button" on:click={startGame}>
        {score > 0 ? '🔄 Rejouer' : '▶️ Commencer'}
      </button>
    </div>
  {/if}

  <div class="controls">
    <div class="control-row">
      <button class="control-btn rotate" on:click={rotate}>
        🔄<br><span>Tourner</span>
      </button>
    </div>
    <div class="control-row">
      <button class="control-btn" on:click={moveLeft}>
        ⬅️<br><span>Gauche</span>
      </button>
      <button class="control-btn" on:click={moveDown}>
        ⬇️<br><span>Bas</span>
      </button>
      <button class="control-btn" on:click={moveRight}>
        ➡️<br><span>Droite</span>
      </button>
    </div>
    <div class="control-row">
      <button class="control-btn drop" on:click={drop}>
        ⏬<br><span>Descendre</span>
      </button>
    </div>
  </div>
</div>

<style>
  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .game-info {
    width: 100%;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: #FFD93D;
    text-shadow: 3px 3px 0px #FF6B6B;
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    font-size: 1.5rem;
  }

  .stat {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0.5rem 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
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

  .game-canvas {
    border: 4px solid #FFD93D;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    background: #1a1a2e;
    touch-action: none;
  }

  .game-over {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(26, 26, 46, 0.95);
    padding: 2rem;
    border-radius: 20px;
    text-align: center;
    border: 4px solid #FFD93D;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }

  .game-over h2 {
    color: #FFD93D;
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 1.5rem;
    margin: 1rem 0;
    font-weight: bold;
  }

  .start-button {
    font-size: 1.5rem;
    padding: 1rem 2rem;
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

  .start-button:hover {
    transform: scale(1.05);
  }

  .start-button:active {
    transform: scale(0.95);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 400px;
    margin-top: 1rem;
  }

  .control-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .control-btn {
    flex: 1;
    max-width: 120px;
    min-height: 80px;
    font-size: 1.8rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 15px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.1s;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    user-select: none;
  }

  .control-btn span {
    font-size: 0.8rem;
    margin-top: 0.2rem;
  }

  .control-btn:active {
    transform: scale(0.95);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .control-btn.rotate,
  .control-btn.drop {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 2rem;
    }

    .stats {
      font-size: 1.2rem;
      gap: 1rem;
    }

    .control-btn {
      min-height: 70px;
      font-size: 1.5rem;
    }
  }
</style>

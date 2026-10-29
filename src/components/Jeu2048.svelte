<script lang="ts">
  import { onMount } from 'svelte';

  const SIZE = 4;
  type Dir = 'up' | 'down' | 'left' | 'right';

  let grid: number[][] = [];
  let score = 0;
  let best = 0;
  let gameOver = false;
  let won = false;
  let keepPlaying = false;
  let swipeStart: { x: number; y: number } | null = null;

  function emptyGrid(): number[][] {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function addRandomTile(g: number[][]) {
    const empty: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    g[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function slideRow(row: number[]): { row: number[]; gained: number; moved: boolean } {
    const tiles = row.filter(v => v !== 0);
    const out: number[] = [];
    let gained = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        out.push(tiles[i] * 2);
        gained += tiles[i] * 2;
        i++;
      } else {
        out.push(tiles[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    const moved = out.some((v, i) => v !== row[i]);
    return { row: out, gained, moved };
  }

  function rotate(g: number[][]): number[][] {
    return g[0].map((_, c) => g.map(row => row[c]).reverse());
  }

  function move(dir: Dir) {
    if (gameOver || (won && !keepPlaying)) return;
    let g = grid.map(r => [...r]);
    const turns = dir === 'left' ? 0 : dir === 'down' ? 1 : dir === 'right' ? 2 : 3;
    for (let i = 0; i < turns; i++) g = rotate(g);
    let moved = false;
    let gained = 0;
    g = g.map(row => {
      const res = slideRow(row);
      if (res.moved) moved = true;
      gained += res.gained;
      return res.row;
    });
    for (let i = 0; i < (4 - turns) % 4; i++) g = rotate(g);
    if (!moved) return;
    addRandomTile(g);
    grid = g;
    score += gained;
    if (score > best) best = score;
    if (!won && grid.some(r => r.some(v => v >= 2048))) won = true;
    if (!canMove(grid)) gameOver = true;
  }

  function canMove(g: number[][]): boolean {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return true;
        if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
      }
    }
    return false;
  }

  function newGame() {
    const g = emptyGrid();
    addRandomTile(g);
    addRandomTile(g);
    grid = g;
    score = 0;
    gameOver = false;
    won = false;
    keepPlaying = false;
  }

  function continueGame() {
    keepPlaying = true;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      move(d);
    }
  }

  function handlePointerDown(e: PointerEvent) {
    swipeStart = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: PointerEvent) {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  }

  function tileClass(v: number): string {
    return v === 0 ? 'empty' : `t${Math.min(v, 4096)}`;
  }

  onMount(() => {
    newGame();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🔢 2048</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">Record:</span>
        <span class="value">{best}</span>
      </div>
    </div>
  </div>

  <div
    class="board"
    role="grid"
    aria-label="Grille 2048, score {score}"
    on:pointerdown={handlePointerDown}
    on:pointerup={handlePointerUp}
  >
    {#each grid as row, r}
      {#each row as v, c}
        <div class="tile {tileClass(v)}" role="gridcell" aria-label={v === 0 ? 'vide' : String(v)}>
          {#if v !== 0}{v}{/if}
        </div>
      {/each}
    {/each}
  </div>

  <div class="controls">
    <div class="control-row">
      <button class="control-btn" on:pointerdown={() => move('up')} aria-label="Glisser vers le haut">⬆️</button>
    </div>
    <div class="control-row">
      <button class="control-btn" on:pointerdown={() => move('left')} aria-label="Glisser vers la gauche">⬅️</button>
      <button class="control-btn" on:pointerdown={() => move('down')} aria-label="Glisser vers le bas">⬇️</button>
      <button class="control-btn" on:pointerdown={() => move('right')} aria-label="Glisser vers la droite">➡️</button>
    </div>
  </div>

  <button class="restart-btn" on:click={newGame} aria-label="Recommencer une partie">🔄 Recommencer</button>

  {#if gameOver || (won && !keepPlaying)}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="j2048-status">
        <h2 id="j2048-status">{won && !gameOver ? '🏆 2048 atteint!' : '🧱 Plus de place!'}</h2>
        <p class="final-score">Score: {score}</p>
        {#if won && !gameOver}
          <button class="restart-btn" on:click={continueGame} aria-label="Continuer la partie">▶️ Continuer</button>
        {/if}
        <button class="restart-btn" on:click={newGame} aria-label="Rejouer une partie">🔄 Rejouer</button>
      </div>
    </div>
  {/if}
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
    gap: 1.5rem;
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

  .board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 340px;
    padding: 8px;
    background: #8f7a66;
    border-radius: 16px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .tile {
    aspect-ratio: 1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    font-weight: bold;
    color: #776e65;
    background: #cdc1b4;
    transition: transform 0.1s;
  }

  .tile:not(.empty) {
    animation: appear 0.15s ease-out;
  }

  @keyframes appear {
    from { transform: scale(0.6); }
    to { transform: scale(1); }
  }

  .t2 { background: #eee4da; }
  .t4 { background: #ede0c8; }
  .t8 { background: #f2b179; color: #fff; }
  .t16 { background: #f59563; color: #fff; }
  .t32 { background: #f67c5f; color: #fff; }
  .t64 { background: #f65e3b; color: #fff; }
  .t128 { background: #edcf72; color: #fff; font-size: 1.5rem; }
  .t256 { background: #edcc61; color: #fff; font-size: 1.5rem; }
  .t512 { background: #edc850; color: #fff; font-size: 1.5rem; }
  .t1024 { background: #edc53f; color: #fff; font-size: 1.2rem; }
  .t2048 { background: #edc22e; color: #fff; font-size: 1.2rem; box-shadow: 0 0 20px #FFD93D; }
  .t4096 { background: #3c3a32; color: #fff; font-size: 1.2rem; }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    max-width: 300px;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  .control-row {
    display: flex;
    justify-content: center;
    gap: 0.4rem;
  }

  .control-btn {
    width: 80px;
    height: 56px;
    font-size: 1.7rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 15px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.1s;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .restart-btn {
    font-size: 1.2rem;
    padding: 0.6rem 1.8rem;
    margin: 0.25rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 15px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.2s;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    touch-action: manipulation;
  }

  .restart-btn:active {
    transform: scale(0.95);
  }

  .game-over-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none;
  }

  .game-over-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 2.5rem;
    border-radius: 25px;
    text-align: center;
    border: 4px solid #FFD93D;
    box-shadow: 0 10px 50px rgba(0,0,0,0.5);
    pointer-events: auto;
    max-width: 320px;
  }

  .game-over-content h2 {
    color: #FFD93D;
    font-size: 2.2rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 2rem;
    margin: 0.5rem 0 1rem 0;
    font-weight: bold;
  }

  @media (max-width: 600px) {
    .game-container {
      gap: 0.5rem;
      padding: 0.5rem;
    }

    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.4rem 0;
    }

    .stats {
      font-size: 1rem;
      gap: 0.75rem;
    }

    .stat {
      padding: 0.3rem 1rem;
    }

    .board {
      max-width: min(94vw, 360px);
    }

    .controls {
      max-width: 94vw;
    }

    .control-btn {
      width: 100px;
      height: 60px;
    }
  }
</style>

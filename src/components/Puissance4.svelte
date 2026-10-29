<script lang="ts">
  import { onMount } from 'svelte';

  const COLS = 7;
  const ROWS = 6;
  const HUMAN = 1;
  const CPU = 2;

  type Cell = 0 | 1 | 2;

  let grid: Cell[][] = [];
  let turn: 1 | 2 = HUMAN;
  let winner: 0 | 1 | 2 | 3 = 0;
  let winningCells: Set<string> = new Set();
  let lastDrop: { r: number; c: number } | null = null;
  let humanWins = 0;
  let cpuWins = 0;
  let thinking = false;
  let cpuTimer: number | null = null;

  function emptyGrid(): Cell[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
  }

  function dropRow(g: Cell[][], col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g[r][col] === 0) return r;
    }
    return -1;
  }

  function findWin(g: Cell[][], player: Cell): Set<string> | null {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== player) continue;
        for (const [dr, dc] of dirs) {
          const cells = [`${r},${c}`];
          for (let k = 1; k < 4; k++) {
            const nr = r + dr * k;
            const nc = c + dc * k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || g[nr][nc] !== player) break;
            cells.push(`${nr},${nc}`);
          }
          if (cells.length === 4) return new Set(cells);
        }
      }
    }
    return null;
  }

  function isFull(g: Cell[][]): boolean {
    return g[0].every(v => v !== 0);
  }

  function winsWith(g: Cell[][], col: number, player: Cell): boolean {
    const r = dropRow(g, col);
    if (r < 0) return false;
    g[r][col] = player;
    const won = findWin(g, player) !== null;
    g[r][col] = 0;
    return won;
  }

  function chooseCpuColumn(): number {
    const open = [...Array(COLS).keys()].filter(c => dropRow(grid, c) >= 0);

    for (const c of open) if (winsWith(grid, c, CPU)) return c;
    for (const c of open) if (winsWith(grid, c, HUMAN)) return c;

    const safe = open.filter(c => {
      const r = dropRow(grid, c);
      grid[r][c] = CPU;
      const givesWin = r > 0 && winsWith(grid, c, HUMAN);
      grid[r][c] = 0;
      return !givesWin;
    });
    const pool = safe.length > 0 ? safe : open;

    const weights = pool.map(c => 4 - Math.abs(c - 3) + Math.random() * 2);
    let bestIdx = 0;
    for (let i = 1; i < pool.length; i++) if (weights[i] > weights[bestIdx]) bestIdx = i;
    return pool[bestIdx];
  }

  function place(col: number, player: 1 | 2) {
    const r = dropRow(grid, col);
    if (r < 0) return;
    grid[r][col] = player;
    grid = grid;
    lastDrop = { r, c: col };

    const win = findWin(grid, player);
    if (win) {
      winner = player;
      winningCells = win;
      if (player === HUMAN) humanWins++;
      else cpuWins++;
      return;
    }
    if (isFull(grid)) {
      winner = 3;
      return;
    }
    turn = player === HUMAN ? CPU : HUMAN;
    if (turn === CPU) scheduleCpu();
  }

  function scheduleCpu() {
    thinking = true;
    cpuTimer = window.setTimeout(() => {
      thinking = false;
      cpuTimer = null;
      if (winner === 0) place(chooseCpuColumn(), CPU);
    }, 550);
  }

  function play(col: number) {
    if (winner !== 0 || turn !== HUMAN || thinking) return;
    place(col, HUMAN);
  }

  function newGame(starter: 1 | 2 = HUMAN) {
    if (cpuTimer !== null) clearTimeout(cpuTimer);
    cpuTimer = null;
    thinking = false;
    grid = emptyGrid();
    winner = 0;
    winningCells = new Set();
    lastDrop = null;
    turn = starter;
    if (turn === CPU) scheduleCpu();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLS) play(n - 1);
  }

  onMount(() => {
    newGame();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (cpuTimer !== null) clearTimeout(cpuTimer);
    };
  });

  $: statusText =
    winner !== 0 ? '' :
    turn === HUMAN ? '🔴 À toi de jouer !' :
    '🟡 L\'ordi réfléchit...';
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🔴 Puissance 4</h1>
    <div class="stats">
      <div class="stat player">
        <span class="label">Toi:</span>
        <span class="value">{humanWins}</span>
      </div>
      <div class="stat computer">
        <span class="label">Ordi:</span>
        <span class="value">{cpuWins}</span>
      </div>
    </div>
  </div>

  <p class="status" aria-live="polite">{statusText}&nbsp;</p>

  <div class="board-wrap">
    <div class="board" role="grid" aria-label="Grille de Puissance 4, {COLS} colonnes sur {ROWS} lignes">
      {#each grid as row, r}
        {#each row as cell, c}
          <button
            class="cell"
            class:winning={winningCells.has(`${r},${c}`)}
            class:last={lastDrop?.r === r && lastDrop?.c === c}
            on:click={() => play(c)}
            disabled={winner !== 0 || turn !== HUMAN}
            aria-label={cell === 0 ? `Jouer colonne ${c + 1}` : cell === HUMAN ? 'Jeton rouge' : 'Jeton jaune'}
          >
            {#if cell !== 0}
              <span class="disc" class:red={cell === HUMAN} class:yellow={cell === CPU}></span>
            {/if}
          </button>
        {/each}
      {/each}
    </div>
  </div>

  <button class="restart-btn" on:click={() => newGame()} aria-label="Recommencer une partie">
    🔄 Nouvelle partie
  </button>

  {#if winner !== 0}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="p4-status">
        <h2 id="p4-status">
          {#if winner === HUMAN}🏆 Tu as gagné!{:else if winner === CPU}🤖 L'ordi a gagné!{:else}🤝 Égalité!{/if}
        </h2>
        <p class="final-score">{humanWins} - {cpuWins}</p>
        <button
          class="restart-btn"
          on:click={() => newGame(winner === HUMAN ? CPU : HUMAN)}
          aria-label="Rejouer une partie"
        >
          🔄 Rejouer
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
    padding: 0.5rem 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .stat.player {
    background: linear-gradient(135deg, #FF6B6B 0%, #c0392b 100%);
  }

  .stat.computer {
    background: linear-gradient(135deg, #F7DC6F 0%, #f39c12 100%);
  }

  .label {
    color: #fff;
    font-weight: bold;
  }

  .value {
    color: #fff;
    font-weight: bold;
    margin-left: 0.5rem;
  }

  .status {
    color: #4ECDC4;
    font-size: 1.4rem;
    font-weight: bold;
    margin: 0;
    min-height: 1.6em;
  }

  .board-wrap {
    width: 100%;
    max-width: 380px;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    padding: 8px;
    background: linear-gradient(135deg, #2b3a9e 0%, #1f2a7a 100%);
    border-radius: 20px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }

  .cell {
    aspect-ratio: 1;
    border: none;
    border-radius: 50%;
    background: #0d0d2b;
    padding: 0;
    cursor: pointer;
    box-shadow: inset 0 3px 6px rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cell:disabled {
    cursor: default;
  }

  .disc {
    width: 84%;
    height: 84%;
    border-radius: 50%;
    box-shadow: inset 0 -4px 0 rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.4);
    animation: drop 0.25s ease-out;
  }

  .disc.red {
    background: radial-gradient(circle at 35% 30%, #ff9a9a, #e63946 60%, #b71c1c);
  }

  .disc.yellow {
    background: radial-gradient(circle at 35% 30%, #fff3a0, #FFD93D 60%, #f39c12);
  }

  @keyframes drop {
    from { transform: translateY(-300%); }
    to { transform: translateY(0); }
  }

  .cell.winning .disc {
    animation: glow 0.6s infinite alternate;
  }

  @keyframes glow {
    from { box-shadow: 0 0 4px #fff; }
    to { box-shadow: 0 0 18px #fff, 0 0 30px #FFD93D; }
  }

  .restart-btn {
    font-size: 1.3rem;
    padding: 0.75rem 2rem;
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
      gap: 0.75rem;
      padding: 0.5rem;
    }

    h1 {
      font-size: 1.8rem;
      margin: 0 0 0.5rem 0;
    }

    .stats {
      font-size: 1.1rem;
      gap: 0.75rem;
    }

    .status {
      font-size: 1.2rem;
    }

    .board-wrap {
      max-width: 94vw;
    }
  }
</style>

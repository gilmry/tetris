<script lang="ts">
  import { onMount } from 'svelte';

  const HUMAN = 'X';
  const CPU = 'O';
  type Mark = '' | 'X' | 'O';
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  let cells: Mark[] = Array(9).fill('');
  let turn: 'X' | 'O' = HUMAN;
  let winner: '' | 'X' | 'O' | 'draw' = '';
  let winLine: number[] = [];
  let humanWins = 0;
  let cpuWins = 0;
  let draws = 0;
  let cpuTimer: number | null = null;

  function lineFor(board: Mark[], p: Mark): number[] | null {
    for (const l of LINES) if (l.every(i => board[i] === p)) return l;
    return null;
  }

  function winningMove(board: Mark[], p: Mark): number {
    for (let i = 0; i < 9; i++) {
      if (board[i] !== '') continue;
      board[i] = p;
      const win = lineFor(board, p) !== null;
      board[i] = '';
      if (win) return i;
    }
    return -1;
  }

  function cpuChoice(): number {
    const b = [...cells];
    let m = winningMove(b, CPU);
    if (m >= 0) return m;
    m = winningMove(b, HUMAN);
    if (m >= 0) return m;
    if (b[4] === '' && Math.random() < 0.8) return 4;
    const corners = [0, 2, 6, 8].filter(i => b[i] === '');
    if (corners.length && Math.random() < 0.7) return corners[Math.floor(Math.random() * corners.length)];
    const free = b.map((v, i) => (v === '' ? i : -1)).filter(i => i >= 0);
    return free[Math.floor(Math.random() * free.length)];
  }

  function place(i: number, p: 'X' | 'O') {
    if (cells[i] !== '' || winner !== '') return;
    cells[i] = p;
    cells = cells;
    const line = lineFor(cells, p);
    if (line) {
      winner = p;
      winLine = line;
      if (p === HUMAN) humanWins++;
      else cpuWins++;
      return;
    }
    if (cells.every(c => c !== '')) {
      winner = 'draw';
      draws++;
      return;
    }
    turn = p === HUMAN ? CPU : HUMAN;
    if (turn === CPU) scheduleCpu();
  }

  function scheduleCpu() {
    cpuTimer = window.setTimeout(() => {
      cpuTimer = null;
      if (winner === '') place(cpuChoice(), CPU);
    }, 450);
  }

  function play(i: number) {
    if (turn !== HUMAN) return;
    place(i, HUMAN);
  }

  function newGame(starter: 'X' | 'O' = HUMAN) {
    if (cpuTimer !== null) clearTimeout(cpuTimer);
    cpuTimer = null;
    cells = Array(9).fill('');
    winner = '';
    winLine = [];
    turn = starter;
    if (turn === CPU) scheduleCpu();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) play(n - 1);
  }

  onMount(() => {
    newGame();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (cpuTimer !== null) clearTimeout(cpuTimer);
    };
  });

  $: statusText = winner !== '' ? '' : turn === HUMAN ? '❌ À toi de jouer !' : '⭕ L\'ordi réfléchit...';
</script>

<div class="game-container">
  <div class="game-info">
    <h1>⭕ Morpion</h1>
    <div class="stats">
      <div class="stat player">
        <span class="label">Toi:</span>
        <span class="value">{humanWins}</span>
      </div>
      <div class="stat draw">
        <span class="label">Nul:</span>
        <span class="value">{draws}</span>
      </div>
      <div class="stat computer">
        <span class="label">Ordi:</span>
        <span class="value">{cpuWins}</span>
      </div>
    </div>
  </div>

  <p class="status" aria-live="polite">{statusText}&nbsp;</p>

  <div class="board" role="grid" aria-label="Grille de morpion 3 par 3">
    {#each cells as cell, i}
      <button
        class="cell"
        class:x={cell === 'X'}
        class:o={cell === 'O'}
        class:win={winLine.includes(i)}
        on:click={() => play(i)}
        disabled={cell !== '' || winner !== '' || turn !== HUMAN}
        aria-label={cell === '' ? `Case ${i + 1} libre` : cell === 'X' ? 'Croix' : 'Rond'}
      >
        {#if cell === 'X'}❌{:else if cell === 'O'}⭕{/if}
      </button>
    {/each}
  </div>

  <button class="restart-btn" on:click={() => newGame()} aria-label="Recommencer une partie">🔄 Nouvelle partie</button>

  {#if winner !== ''}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="morpion-status">
        <h2 id="morpion-status">
          {#if winner === HUMAN}🏆 Tu as gagné!{:else if winner === CPU}🤖 L'ordi a gagné!{:else}🤝 Match nul!{/if}
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
    gap: 1rem;
    font-size: 1.3rem;
  }

  .stat {
    padding: 0.5rem 1.2rem;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .stat.player { background: linear-gradient(135deg, #FF6B6B 0%, #c0392b 100%); }
  .stat.draw { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .stat.computer { background: linear-gradient(135deg, #45B7D1 0%, #1f618d 100%); }

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

  .board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: 100%;
    max-width: 330px;
    padding: 12px;
    background: #1a1a2e;
    border-radius: 24px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }

  .cell {
    aspect-ratio: 1;
    border: none;
    border-radius: 18px;
    background: linear-gradient(135deg, #2b3a9e 0%, #1f2a7a 100%);
    font-size: 3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transition: transform 0.1s;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cell:disabled {
    cursor: default;
    color: #fff;
    opacity: 1;
  }

  .cell:not(:disabled):active {
    transform: scale(0.95);
  }

  .cell.win {
    background: linear-gradient(135deg, #FFD93D 0%, #f39c12 100%);
    animation: pulse 0.6s infinite alternate;
  }

  @keyframes pulse {
    from { transform: scale(1); }
    to { transform: scale(1.06); }
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
      font-size: 1rem;
      gap: 0.5rem;
    }

    .stat {
      padding: 0.3rem 0.9rem;
    }

    .status {
      font-size: 1.2rem;
    }

    .board {
      max-width: min(94vw, 340px);
    }
  }
</style>

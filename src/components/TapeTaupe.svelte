<script lang="ts">
  import { onMount } from 'svelte';

  const HOLES = 9;
  const GAME_SECONDS = 30;

  type HoleState = 'empty' | 'mole' | 'star' | 'hit';

  let holes: HoleState[] = Array(HOLES).fill('empty');
  let gameRunning = false;
  let score = 0;
  let timeLeft = GAME_SECONDS;
  let best = 0;
  let hasPlayed = false;
  let spawnTimer: number | null = null;
  let countdown: number | null = null;
  let hideTimers: (number | null)[] = Array(HOLES).fill(null);

  function clearHoleTimer(i: number) {
    const t = hideTimers[i];
    if (t !== null) clearTimeout(t);
    hideTimers[i] = null;
  }

  function popUp() {
    if (!gameRunning) return;

    const free = holes.map((s, i) => (s === 'empty' ? i : -1)).filter(i => i >= 0);
    if (free.length === 0) return;

    const i = free[Math.floor(Math.random() * free.length)];
    holes[i] = Math.random() < 0.15 ? 'star' : 'mole';
    holes = holes;

    const progress = 1 - timeLeft / GAME_SECONDS;
    const visibleMs = Math.max(500, 1300 - progress * 700);
    clearHoleTimer(i);
    hideTimers[i] = window.setTimeout(() => {
      if (holes[i] !== 'hit') {
        holes[i] = 'empty';
        holes = holes;
      }
      hideTimers[i] = null;
    }, visibleMs);
  }

  function scheduleSpawn() {
    if (!gameRunning) return;
    const progress = 1 - timeLeft / GAME_SECONDS;
    const delay = Math.max(350, 900 - progress * 500);
    spawnTimer = window.setTimeout(() => {
      popUp();
      scheduleSpawn();
    }, delay);
  }

  function whack(i: number) {
    if (!gameRunning) return;
    const state = holes[i];
    if (state !== 'mole' && state !== 'star') return;

    score += state === 'star' ? 3 : 1;
    holes[i] = 'hit';
    holes = holes;
    clearHoleTimer(i);
    hideTimers[i] = window.setTimeout(() => {
      holes[i] = 'empty';
      holes = holes;
      hideTimers[i] = null;
    }, 300);
  }

  function stopAll() {
    if (spawnTimer !== null) clearTimeout(spawnTimer);
    if (countdown !== null) clearInterval(countdown);
    spawnTimer = null;
    countdown = null;
    for (let i = 0; i < HOLES; i++) clearHoleTimer(i);
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    stopAll();
    holes = Array(HOLES).fill('empty');
    if (score > best) best = score;
  }

  function startGame() {
    stopAll();
    holes = Array(HOLES).fill('empty');
    score = 0;
    timeLeft = GAME_SECONDS;
    gameRunning = true;

    countdown = window.setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        timeLeft = 0;
        endGame();
      }
    }, 1000);

    scheduleSpawn();
  }

  onMount(() => {
    return () => stopAll();
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🔨 Tape-Taupe</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat time" class:urgent={gameRunning && timeLeft <= 5}>
        <span class="label">⏱️</span>
        <span class="value">{timeLeft}s</span>
      </div>
    </div>
  </div>

  <div class="field" role="grid" aria-label="Pelouse avec {HOLES} trous">
    {#each holes as state, i}
      <button
        class="hole"
        class:up={state === 'mole' || state === 'star'}
        class:hit={state === 'hit'}
        on:pointerdown={() => whack(i)}
        aria-label={state === 'mole' ? 'Taupe ! Tape dessus' : state === 'star' ? 'Taupe dorée ! Tape dessus' : 'Trou vide'}
      >
        <div class="dirt"></div>
        <div class="mole">
          {#if state === 'mole'}🐹{:else if state === 'star'}⭐{:else if state === 'hit'}💫{/if}
        </div>
      </button>
    {/each}
  </div>

  {#if !gameRunning}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="taupe-status">
        <h2 id="taupe-status">{hasPlayed ? '⏰ Temps écoulé!' : '🔨 Prêt à Taper?'}</h2>
        {#if hasPlayed}
          <p class="final-score">Score: {score}</p>
          <p class="hint">Record: {best}</p>
        {:else}
          <p class="hint">Tape sur les taupes pendant {GAME_SECONDS} secondes !<br>⭐ = 3 points</p>
        {/if}
        <button
          class="start-button"
          on:click={startGame}
          aria-label={hasPlayed ? 'Rejouer une partie' : 'Commencer une partie'}
        >
          {hasPlayed ? '🔄 Rejouer' : '▶️ Commencer'}
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

  .stat.urgent {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
    animation: pulse 0.5s infinite alternate;
  }

  @keyframes pulse {
    from { transform: scale(1); }
    to { transform: scale(1.08); }
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

  .field {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    width: 100%;
    max-width: 360px;
    padding: 1rem;
    background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%);
    border-radius: 25px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }

  .hole {
    position: relative;
    aspect-ratio: 1;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }

  .dirt {
    position: absolute;
    left: 10%;
    right: 10%;
    bottom: 8%;
    height: 35%;
    background: radial-gradient(ellipse at center, #3e2723 0%, #5d4037 70%);
    border-radius: 50%;
    box-shadow: inset 0 4px 8px rgba(0,0,0,0.5);
  }

  .mole {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 15%;
    font-size: 3rem;
    line-height: 1;
    text-align: center;
    transform: translateY(120%);
    transition: transform 0.15s ease-out;
  }

  .hole.up .mole {
    transform: translateY(0);
  }

  .hole.hit .mole {
    transform: translateY(0) scale(1.2);
  }

  .hole:active .mole {
    transform: translateY(0) scale(0.9);
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
    margin: 0.5rem 0;
    font-weight: bold;
  }

  .hint {
    color: #fff;
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    line-height: 1.5;
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
    touch-action: manipulation;
  }

  .start-button:active {
    transform: scale(0.95);
  }

  @media (max-width: 600px) {
    .game-container {
      gap: 1rem;
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

    .field {
      max-width: 330px;
      gap: 0.5rem;
    }

    .mole {
      font-size: 2.5rem;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  const MAX_LIVES = 3;

  interface Balloon { id: number; x: number; y: number; size: number; color: string; bomb: boolean; popped: boolean; wobble: number; speed: number }

  let area: HTMLElement;
  let balloons: Balloon[] = [];
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let best = 0;
  let lives = MAX_LIVES;
  let frameId: number | null = null;
  let frame = 0;
  let nextId = 0;
  let spawnIn = 0;

  function areaHeight(): number {
    return area ? area.clientHeight : 400;
  }

  function spawn() {
    const difficulty = Math.min(score / 60, 1);
    const size = 48 + Math.random() * 22 - difficulty * 10;
    balloons = [...balloons, {
      id: ++nextId,
      x: 8 + Math.random() * (84 - size / 4),
      y: areaHeight() + size,
      size,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      bomb: score > 5 && Math.random() < 0.12 + difficulty * 0.1,
      popped: false,
      wobble: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.5 + difficulty * 1.1
    }];
  }

  function update() {
    frame++;
    spawnIn--;
    if (spawnIn <= 0) {
      spawn();
      const difficulty = Math.min(score / 60, 1);
      spawnIn = 55 - difficulty * 30 + Math.random() * 20;
    }

    let escaped = 0;
    for (const b of balloons) {
      if (b.popped) continue;
      b.y -= b.speed;
      b.x += Math.sin(frame / 25 + b.wobble) * 0.15;
      if (b.y < -b.size * 1.5) {
        b.popped = true;
        if (!b.bomb) escaped++;
      }
    }
    balloons = balloons.filter(b => !b.popped || b.y > -200);

    if (escaped > 0) {
      lives -= escaped;
      if (lives <= 0) {
        lives = 0;
        endGame();
      }
    }
  }

  function pop(b: Balloon) {
    if (!gameRunning || b.popped) return;
    b.popped = true;
    if (b.bomb) {
      lives--;
      if (lives <= 0) { lives = 0; endGame(); }
    } else {
      score++;
    }
    balloons = balloons;
    setTimeout(() => {
      balloons = balloons.filter(x => x.id !== b.id);
    }, 250);
  }

  function loop() {
    if (!gameRunning) return;
    update();
    if (gameRunning) frameId = requestAnimationFrame(loop);
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    if (score > best) best = score;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  function startGame() {
    score = 0;
    lives = MAX_LIVES;
    frame = 0;
    spawnIn = 10;
    balloons = [];
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  onMount(() => {
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🎈 Ballons</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">Vies:</span>
        <span class="value">{'❤️'.repeat(lives) || '💔'}</span>
      </div>
    </div>
  </div>

  <div class="area" bind:this={area} role="group" aria-label="Ciel avec des ballons à éclater">
    <div class="cloud c1" aria-hidden="true"></div>
    <div class="cloud c2" aria-hidden="true"></div>
    {#each balloons as b (b.id)}
      <button
        class="balloon"
        class:bomb={b.bomb}
        class:popped={b.popped}
        style="left: {b.x}%; top: {b.y}px; width: {b.size}px; height: {b.size * 1.2}px; --c: {b.color};"
        on:pointerdown={() => pop(b)}
        aria-label={b.bomb ? 'Bombe, ne pas toucher' : 'Ballon à éclater'}
      >
        {#if b.popped}
          <span class="burst">💥</span>
        {:else if b.bomb}
          <span class="bomb-face">💣</span>
        {:else}
          <span class="shine"></span>
          <span class="string"></span>
        {/if}
      </button>
    {/each}
  </div>

  {#if !gameRunning}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="ballons-status">
        <h2 id="ballons-status">{hasPlayed ? '💔 Terminé!' : '🎈 Prêt à Éclater?'}</h2>
        {#if hasPlayed}
          <p class="final-score">Score: {score}</p>
          <p class="hint">Record: {best}</p>
        {:else}
          <p class="hint">Tape sur les ballons avant qu'ils<br>s'envolent, mais pas sur les bombes !</p>
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
    gap: 1rem;
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    width: 100%;
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

  .area {
    position: relative;
    width: 100%;
    max-width: 400px;
    height: 480px;
    overflow: hidden;
    background: linear-gradient(180deg, #5bc0eb 0%, #c9f0ff 100%);
    border-radius: 20px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    touch-action: none;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .cloud {
    position: absolute;
    width: 90px;
    height: 36px;
    background: rgba(255,255,255,0.85);
    border-radius: 40px;
    box-shadow: 30px -14px 0 -4px rgba(255,255,255,0.85), -25px -8px 0 -6px rgba(255,255,255,0.85);
  }

  .cloud.c1 { top: 12%; left: 10%; }
  .cloud.c2 { top: 45%; right: 8%; transform: scale(0.8); }

  .balloon {
    position: absolute;
    border: none;
    padding: 0;
    background-color: var(--c);
    background-image:
      radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(255,255,255,0) 45%),
      radial-gradient(circle at 70% 85%, rgba(0,0,0,0.28), rgba(0,0,0,0) 55%);
    border-radius: 50% 50% 50% 50% / 45% 45% 55% 55%;
    cursor: pointer;
    box-shadow: 0 6px 14px rgba(0,0,0,0.25);
    transform: translate(-50%, 0);
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }

  .balloon.bomb {
    background: radial-gradient(circle at 35% 30%, #777, #222 70%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bomb-face {
    font-size: 1.8rem;
  }

  .shine {
    position: absolute;
    top: 14%;
    left: 22%;
    width: 22%;
    height: 28%;
    background: rgba(255,255,255,0.55);
    border-radius: 50%;
    transform: rotate(-25deg);
  }

  .string {
    position: absolute;
    left: 50%;
    bottom: -26px;
    width: 2px;
    height: 26px;
    background: rgba(0,0,0,0.35);
  }

  .balloon.popped {
    background: transparent;
    box-shadow: none;
    pointer-events: none;
  }

  .burst {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.4rem;
    animation: burst 0.25s ease-out forwards;
  }

  @keyframes burst {
    from { transform: scale(0.5); opacity: 1; }
    to { transform: scale(1.6); opacity: 0; }
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
      gap: 0.5rem;
      padding: 0.5rem;
    }

    h1 {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
    }

    .stats {
      font-size: 1rem;
      gap: 0.75rem;
    }

    .stat {
      padding: 0.3rem 1rem;
    }

    .area {
      max-width: 94vw;
      height: calc(100vh - 230px);
      height: calc(100dvh - 230px);
    }
  }
</style>

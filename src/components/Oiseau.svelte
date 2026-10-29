<script lang="ts">
  import { onMount } from 'svelte';
  import { createLoop } from '../lib/gameloop';

  const WIDTH = 300;
  const HEIGHT = 400;
  const BIRD_X = 80;
  const BIRD_SIZE = 30;
  const GRAVITY = 0.32;
  const FLAP_VY = -5.6;
  const PIPE_WIDTH = 52;
  const PIPE_GAP = 125;
  const PIPE_SPACING = 190;
  const SCROLL_SPEED = 1.8;
  const GROUND_H = 30;

  interface Pipe { x: number; gapY: number; passed: boolean }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let best = 0;
  let birdY = HEIGHT / 2;
  let birdVY = 0;
  let pipes: Pipe[] = [];
  const ticker = createLoop(() => update(), () => draw());
  let frame = 0;

  function spawnPipe(x: number) {
    const margin = 60;
    const gapY = margin + Math.random() * (HEIGHT - GROUND_H - margin * 2 - PIPE_GAP);
    pipes.push({ x, gapY, passed: false });
  }

  function flap() {
    if (!gameRunning) return;
    birdVY = FLAP_VY;
  }

  function update() {
    frame++;
    birdVY += GRAVITY;
    if (birdVY > 8) birdVY = 8;
    birdY += birdVY;
    if (birdY - BIRD_SIZE / 2 < 0) {
      birdY = BIRD_SIZE / 2;
      birdVY = 0;
    }

    for (const p of pipes) p.x -= SCROLL_SPEED;
    if (pipes.length === 0 || pipes[pipes.length - 1].x < WIDTH - PIPE_SPACING) {
      spawnPipe(WIDTH + 20);
    }
    pipes = pipes.filter(p => p.x + PIPE_WIDTH > -10);

    const bx = BIRD_X - BIRD_SIZE / 2 + 4;
    const by = birdY - BIRD_SIZE / 2 + 4;
    const bs = BIRD_SIZE - 8;

    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
        p.passed = true;
        score++;
      }
      const overlapX = bx + bs > p.x && bx < p.x + PIPE_WIDTH;
      if (overlapX && (by < p.gapY || by + bs > p.gapY + PIPE_GAP)) {
        endGame();
        return;
      }
    }

    if (birdY + BIRD_SIZE / 2 >= HEIGHT - GROUND_H) {
      endGame();
    }
  }

  function draw() {
    if (!ctx) return;

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#5bc0eb');
    sky.addColorStop(1, '#c9f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 140 - frame * 0.4) % (WIDTH + 100) + WIDTH + 100) % (WIDTH + 100) - 50;
      const cy = 50 + (i % 2) * 60;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx + 16, cy - 6, 18, 0, Math.PI * 2);
      ctx.arc(cx + 34, cy, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of pipes) {
      ctx.fillStyle = '#3cb371';
      ctx.fillRect(p.x, 0, PIPE_WIDTH, p.gapY);
      ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_WIDTH, HEIGHT - GROUND_H - p.gapY - PIPE_GAP);
      ctx.fillStyle = '#2e8b57';
      ctx.fillRect(p.x - 4, p.gapY - 16, PIPE_WIDTH + 8, 16);
      ctx.fillRect(p.x - 4, p.gapY + PIPE_GAP, PIPE_WIDTH + 8, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(p.x + 6, 0, 8, p.gapY - 16);
      ctx.fillRect(p.x + 6, p.gapY + PIPE_GAP + 16, 8, HEIGHT - GROUND_H - p.gapY - PIPE_GAP - 16);
    }

    ctx.fillStyle = '#8d5524';
    ctx.fillRect(0, HEIGHT - GROUND_H, WIDTH, GROUND_H);
    ctx.fillStyle = '#7bc96f';
    ctx.fillRect(0, HEIGHT - GROUND_H, WIDTH, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = -((frame * SCROLL_SPEED) % 24); x < WIDTH; x += 24) {
      ctx.fillRect(x, HEIGHT - GROUND_H + 14, 12, 5);
    }

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.translate(BIRD_X, birdY);
    ctx.rotate(Math.max(-0.5, Math.min(0.9, birdVY * 0.08)));
    ctx.font = `${BIRD_SIZE}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.scale(-1, 1);
    ctx.fillText('🐤', 0, 0);
    ctx.restore();

    if (gameRunning) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 4;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeText(String(score), WIDTH / 2, 14);
      ctx.fillText(String(score), WIDTH / 2, 14);
    }
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    if (score > best) best = score;
    ticker.stop();
    draw();
  }

  function startGame() {
    score = 0;
    frame = 0;
    birdY = HEIGHT / 2;
    birdVY = FLAP_VY;
    pipes = [];
    spawnPipe(WIDTH + 120);
    gameRunning = true;
    ticker.start();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      flap();
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    draw();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ticker.stop();
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🐤 Oiseau</h1>
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

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Ciel avec tuyaux - Score {score}"
    on:pointerdown={flap}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="oiseau-status">
      <h2 id="oiseau-status">{hasPlayed ? '💥 Oups!' : '🐤 Prêt à Voler?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Touche l'écran pour battre des ailes<br>et passe entre les tuyaux !</p>
      {/if}
      <button
        class="start-button"
        on:click={startGame}
        aria-label={hasPlayed ? 'Rejouer une partie' : 'Commencer une partie'}
      >
        {hasPlayed ? '🔄 Rejouer' : '▶️ Commencer'}
      </button>
    </div>
  {/if}

  <div class="controls">
    <button class="control-btn flap" on:pointerdown={flap} aria-label="Battre des ailes">
      🪶<br><span>Voler</span>
    </button>
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
    position: relative;
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

  .game-canvas {
    border: 4px solid #FFD93D;
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    touch-action: none;
    max-width: 100%;
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
    z-index: 10;
    max-width: 300px;
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

  .hint {
    color: #fff;
    font-size: 1rem;
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

  .controls {
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: 400px;
  }

  .control-btn {
    flex: 1;
    max-width: 260px;
    min-height: 80px;
    font-size: 1.8rem;
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .control-btn span {
    font-size: 0.8rem;
    margin-top: 0.2rem;
  }

  .control-btn:active {
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

    .game-canvas {
      width: min(94vw, calc((100vh - 260px) * 0.75));
      width: min(94vw, calc((100dvh - 260px) * 0.75));
      height: auto;
    }

    .controls {
      max-width: 94vw;
    }

    .control-btn {
      max-width: none;
      min-height: 90px;
      font-size: 2rem;
    }

    .control-btn span {
      font-size: 0.95rem;
    }
  }
</style>

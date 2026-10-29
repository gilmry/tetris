<script lang="ts">
  import { onMount } from 'svelte';

  const WIDTH = 300;
  const HEIGHT = 400;
  const PADDLE_WIDTH = 70;
  const PADDLE_HEIGHT = 12;
  const PADDLE_Y = HEIGHT - 28;
  const BALL_RADIUS = 7;
  const PLAYER_SPEED = 5;
  const COLS = 6;
  const ROWS = 5;
  const BRICK_W = 44;
  const BRICK_H = 18;
  const BRICK_GAP = 4;
  const BRICK_TOP = 50;
  const BRICK_LEFT = (WIDTH - (COLS * BRICK_W + (COLS - 1) * BRICK_GAP)) / 2;
  const ROW_COLORS = ['#FF6B6B', '#FFA07A', '#F7DC6F', '#98D8C8', '#45B7D1'];
  const MAX_LIVES = 3;

  interface Brick { x: number; y: number; alive: boolean; color: string }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let level = 1;
  let lives = MAX_LIVES;
  let paddleX = WIDTH / 2;
  let ballX = WIDTH / 2;
  let ballY = PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS;
  let ballVX = 0;
  let ballVY = 0;
  let ballStuck = true;
  let bricks: Brick[] = [];
  let moveDir = 0;
  let frameId: number | null = null;

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          alive: true,
          color: ROW_COLORS[r % ROW_COLORS.length]
        });
      }
    }
  }

  function clampPaddle(x: number): number {
    return Math.max(PADDLE_WIDTH / 2, Math.min(WIDTH - PADDLE_WIDTH / 2, x));
  }

  function ballSpeed(): number {
    return Math.min(3.2 + (level - 1) * 0.4, 5.5);
  }

  function launch() {
    if (!gameRunning || !ballStuck) return;
    ballStuck = false;
    const angle = (Math.random() - 0.5) * (Math.PI / 4);
    const s = ballSpeed();
    ballVX = Math.sin(angle) * s;
    ballVY = -Math.cos(angle) * s;
  }

  function stickBall() {
    ballStuck = true;
    ballVX = 0;
    ballVY = 0;
    ballX = paddleX;
    ballY = PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS;
  }

  function update() {
    paddleX = clampPaddle(paddleX + moveDir * PLAYER_SPEED);

    if (ballStuck) {
      ballX = paddleX;
      return;
    }

    ballX += ballVX;
    ballY += ballVY;

    if (ballX - BALL_RADIUS <= 0) { ballX = BALL_RADIUS; ballVX = Math.abs(ballVX); }
    if (ballX + BALL_RADIUS >= WIDTH) { ballX = WIDTH - BALL_RADIUS; ballVX = -Math.abs(ballVX); }
    if (ballY - BALL_RADIUS <= 0) { ballY = BALL_RADIUS; ballVY = Math.abs(ballVY); }

    if (
      ballVY > 0 &&
      ballY + BALL_RADIUS >= PADDLE_Y - PADDLE_HEIGHT / 2 &&
      ballY - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT / 2 &&
      Math.abs(ballX - paddleX) <= PADDLE_WIDTH / 2 + BALL_RADIUS
    ) {
      ballY = PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS;
      const offset = (ballX - paddleX) / (PADDLE_WIDTH / 2);
      const angle = offset * (Math.PI / 3);
      const s = ballSpeed();
      ballVX = Math.sin(angle) * s;
      ballVY = -Math.cos(angle) * s;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (
        ballX + BALL_RADIUS > b.x && ballX - BALL_RADIUS < b.x + BRICK_W &&
        ballY + BALL_RADIUS > b.y && ballY - BALL_RADIUS < b.y + BRICK_H
      ) {
        b.alive = false;
        score += 10 * level;
        const overlapX = Math.min(ballX + BALL_RADIUS - b.x, b.x + BRICK_W - (ballX - BALL_RADIUS));
        const overlapY = Math.min(ballY + BALL_RADIUS - b.y, b.y + BRICK_H - (ballY - BALL_RADIUS));
        if (overlapX < overlapY) ballVX = -ballVX;
        else ballVY = -ballVY;
        break;
      }
    }

    if (bricks.every(b => !b.alive)) {
      level++;
      buildBricks();
      stickBall();
      return;
    }

    if (ballY - BALL_RADIUS > HEIGHT) {
      lives--;
      if (lives <= 0) {
        endGame();
        return;
      }
      stickBall();
    }
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 3, b.y + 3, BRICK_W - 6, 4);
    }

    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath();
    ctx.roundRect(paddleX - PADDLE_WIDTH / 2, PADDLE_Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    ctx.fill();

    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = '16px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), 8, 8);

    if (ballStuck && gameRunning) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Touche pour lancer !', WIDTH / 2, HEIGHT / 2);
    }
  }

  function loop() {
    if (!gameRunning) return;
    update();
    draw();
    if (gameRunning) frameId = requestAnimationFrame(loop);
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    draw();
  }

  function startGame() {
    score = 0;
    level = 1;
    lives = MAX_LIVES;
    paddleX = WIDTH / 2;
    moveDir = 0;
    buildBricks();
    stickBall();
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function handleCanvasPointer(event: PointerEvent) {
    if (!gameRunning) return;
    if (event.type === 'pointerdown') launch();
    if (event.type === 'pointerdown' || event.buttons > 0) {
      const rect = canvas.getBoundingClientRect();
      paddleX = clampPaddle(((event.clientX - rect.left) / rect.width) * WIDTH);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') moveDir = -1;
    else if (e.key === 'ArrowRight') moveDir = 1;
    else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); launch(); }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) moveDir = 0;
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    buildBricks();
    draw();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🧱 Casse-Briques</h1>
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
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Mur de briques - Score {score} - Niveau {level} - {lives} vies"
    on:pointerdown={handleCanvasPointer}
    on:pointermove={handleCanvasPointer}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="briques-status">
      <h2 id="briques-status">{hasPlayed ? '💔 Partie Terminée!' : '🧱 Prêt à Casser?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Renvoie la balle avec la raquette<br>et détruis toutes les briques !</p>
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
    <button
      class="control-btn"
      on:pointerdown={() => { moveDir = -1; }}
      on:pointerup={() => { if (moveDir === -1) moveDir = 0; }}
      on:pointerleave={() => { if (moveDir === -1) moveDir = 0; }}
      on:pointercancel={() => { if (moveDir === -1) moveDir = 0; }}
      aria-label="Déplacer la raquette à gauche"
    >
      ⬅️<br><span>Gauche</span>
    </button>
    <button class="control-btn fire" on:click={launch} aria-label="Lancer la balle">
      🚀<br><span>Lancer</span>
    </button>
    <button
      class="control-btn"
      on:pointerdown={() => { moveDir = 1; }}
      on:pointerup={() => { if (moveDir === 1) moveDir = 0; }}
      on:pointerleave={() => { if (moveDir === 1) moveDir = 0; }}
      on:pointercancel={() => { if (moveDir === 1) moveDir = 0; }}
      aria-label="Déplacer la raquette à droite"
    >
      ➡️<br><span>Droite</span>
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
    background: #1a1a2e;
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
    gap: 0.5rem;
    width: 100%;
    max-width: 400px;
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

  .control-btn.fire {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
    touch-action: manipulation;
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
      gap: 0.4rem;
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

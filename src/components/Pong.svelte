<script lang="ts">
  import { onMount } from 'svelte';
  import { touchpad, type PadState } from '../lib/touchpad';

  const WIDTH = 300;
  const HEIGHT = 400;
  const PADDLE_WIDTH = 70;
  const PADDLE_HEIGHT = 12;
  const BALL_RADIUS = 8;
  const PLAYER_SPEED = 5;
  const COMPUTER_SPEED = 2.2;
  const WIN_SCORE = 5;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let playerScore = 0;
  let computerScore = 0;
  let playerX = WIDTH / 2;
  let computerX = WIDTH / 2;
  let ballX = WIDTH / 2;
  let ballY = HEIGHT / 2;
  let ballVX = 0;
  let ballVY = 0;
  let moveDir = 0;
  let frameId: number | null = null;
  let winner: 'player' | 'computer' | null = null;

  const PLAYER_Y = HEIGHT - 30;
  const COMPUTER_Y = 30;

  function resetBall(towardPlayer: boolean) {
    ballX = WIDTH / 2;
    ballY = HEIGHT / 2;
    const angle = (Math.random() - 0.5) * (Math.PI / 3);
    const speed = 3.5;
    ballVX = Math.sin(angle) * speed;
    ballVY = Math.cos(angle) * speed * (towardPlayer ? 1 : -1);
  }

  function clampPaddle(x: number): number {
    return Math.max(PADDLE_WIDTH / 2, Math.min(WIDTH - PADDLE_WIDTH / 2, x));
  }

  function bounceOffPaddle(paddleX: number, upward: boolean) {
    const offset = (ballX - paddleX) / (PADDLE_WIDTH / 2);
    const speed = Math.min(Math.hypot(ballVX, ballVY) + 0.2, 7);
    const angle = offset * (Math.PI / 3);
    ballVX = Math.sin(angle) * speed;
    ballVY = Math.cos(angle) * speed * (upward ? -1 : 1);
  }

  function update() {
    playerX = clampPaddle(playerX + moveDir * PLAYER_SPEED);

    const target = ballVY < 0 ? ballX : WIDTH / 2;
    const diff = target - computerX;
    computerX = clampPaddle(computerX + Math.sign(diff) * Math.min(Math.abs(diff), COMPUTER_SPEED));

    ballX += ballVX;
    ballY += ballVY;

    if (ballX - BALL_RADIUS <= 0 || ballX + BALL_RADIUS >= WIDTH) {
      ballVX = -ballVX;
      ballX = Math.max(BALL_RADIUS, Math.min(WIDTH - BALL_RADIUS, ballX));
    }

    if (
      ballVY > 0 &&
      ballY + BALL_RADIUS >= PLAYER_Y - PADDLE_HEIGHT / 2 &&
      ballY - BALL_RADIUS <= PLAYER_Y + PADDLE_HEIGHT / 2 &&
      Math.abs(ballX - playerX) <= PADDLE_WIDTH / 2 + BALL_RADIUS
    ) {
      ballY = PLAYER_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS;
      bounceOffPaddle(playerX, true);
    }

    if (
      ballVY < 0 &&
      ballY - BALL_RADIUS <= COMPUTER_Y + PADDLE_HEIGHT / 2 &&
      ballY + BALL_RADIUS >= COMPUTER_Y - PADDLE_HEIGHT / 2 &&
      Math.abs(ballX - computerX) <= PADDLE_WIDTH / 2 + BALL_RADIUS
    ) {
      ballY = COMPUTER_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS;
      bounceOffPaddle(computerX, false);
    }

    if (ballY > HEIGHT + BALL_RADIUS) {
      computerScore++;
      if (computerScore >= WIN_SCORE) return endGame('computer');
      resetBall(false);
    } else if (ballY < -BALL_RADIUS) {
      playerScore++;
      if (playerScore >= WIN_SCORE) return endGame('player');
      resetBall(true);
    }
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT / 2);
    ctx.lineTo(WIDTH, HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FF6B6B';
    roundRect(computerX - PADDLE_WIDTH / 2, COMPUTER_Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = '#4ECDC4';
    roundRect(playerX - PADDLE_WIDTH / 2, PLAYER_Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x: number, y: number, w: number, h: number) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
  }

  function loop() {
    if (!gameRunning) return;
    update();
    draw();
    if (gameRunning) frameId = requestAnimationFrame(loop);
  }

  function endGame(who: 'player' | 'computer') {
    winner = who;
    gameRunning = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    draw();
  }

  function startGame() {
    playerScore = 0;
    computerScore = 0;
    winner = null;
    playerX = WIDTH / 2;
    computerX = WIDTH / 2;
    moveDir = 0;
    resetBall(true);
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  let held: Set<string> = new Set();

  function applyHeld() {
    moveDir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  }

  function onPad({ pressed }: PadState) {
    held = pressed;
    applyHeld();
  }

  function mouseDown(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    held = new Set(held).add(action);
    applyHeld();
  }

  function mouseUp(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch' || !held.has(action)) return;
    held = new Set(held);
    held.delete(action);
    applyHeld();
  }

  function handleCanvasPointer(event: PointerEvent) {
    if (!gameRunning) return;
    if (event.type === 'pointerdown' || event.buttons > 0) {
      const rect = canvas.getBoundingClientRect();
      playerX = clampPaddle(((event.clientX - rect.left) / rect.width) * WIDTH);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') moveDir = -1;
    else if (e.key === 'ArrowRight') moveDir = 1;
  }

  function handleKeyUp(e: KeyboardEvent) {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) {
      moveDir = 0;
    }
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
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
    <h1>🏓 Pong</h1>
    <div class="stats">
      <div class="stat player">
        <span class="label">Toi:</span>
        <span class="value">{playerScore}</span>
      </div>
      <div class="stat computer">
        <span class="label">Ordi:</span>
        <span class="value">{computerScore}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Terrain de Pong - Toi {playerScore} - Ordinateur {computerScore}"
    on:pointerdown={handleCanvasPointer}
    on:pointermove={handleCanvasPointer}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="pong-status">
      <h2 id="pong-status">
        {#if winner === 'player'}
          🏆 Tu as gagné!
        {:else if winner === 'computer'}
          🤖 L'ordi a gagné!
        {:else}
          🏓 Prêt à Jouer?
        {/if}
      </h2>
      {#if winner}
        <p class="final-score">{playerScore} - {computerScore}</p>
      {:else}
        <p class="hint">Premier à {WIN_SCORE} points !</p>
      {/if}
      <button
        class="start-button"
        on:click={startGame}
        aria-label={winner ? 'Rejouer une partie' : 'Commencer une partie'}
      >
        {winner ? '🔄 Rejouer' : '▶️ Commencer'}
      </button>
    </div>
  {/if}

  <div class="controls" use:touchpad={onPad}>
    <button
      class="control-btn"
      class:pressed={held.has('left')}
      data-action="left"
      on:pointerdown={(e) => mouseDown('left', e)}
      on:pointerup={(e) => mouseUp('left', e)}
      on:pointerleave={(e) => mouseUp('left', e)}
      on:pointercancel={(e) => mouseUp('left', e)}
      aria-label="Déplacer la raquette à gauche"
    >
      ⬅️<br><span>Gauche</span>
    </button>
    <button
      class="control-btn"
      class:pressed={held.has('right')}
      data-action="right"
      on:pointerdown={(e) => mouseDown('right', e)}
      on:pointerup={(e) => mouseUp('right', e)}
      on:pointerleave={(e) => mouseUp('right', e)}
      on:pointercancel={(e) => mouseUp('right', e)}
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
    gap: 2rem;
    font-size: 1.5rem;
  }

  .stat {
    padding: 0.5rem 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .stat.player {
    background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  }

  .stat.computer {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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
    min-width: 220px;
  }

  .game-over h2 {
    color: #FFD93D;
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 2rem;
    margin: 1rem 0;
    font-weight: bold;
  }

  .hint {
    color: #fff;
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
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
    gap: 0.75rem;
    width: 100%;
    max-width: 400px;
    touch-action: none;
    -webkit-touch-callout: none;
  }

  .control-btn {
    flex: 1;
    max-width: 140px;
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

  .control-btn:active,
  .control-btn.pressed {
    transform: scale(0.95);
    filter: brightness(1.15);
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
      gap: 0.5rem;
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

<script lang="ts">
  import { onMount } from 'svelte';
  import { touchpad, type PadState } from '../lib/touchpad';

  const WIDTH = 300;
  const HEIGHT = 400;
  const PLAYER = 30;
  const GRAVITY = 0.28;
  const BOUNCE_VY = -9.5;
  const RUN_SPEED = 3.2;
  const CLOUD_W = 62;
  const CLOUD_H = 14;

  interface Cloud { x: number; y: number; moving: boolean; dir: number; speed: number }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let best = 0;
  let frameId: number | null = null;
  let frame = 0;

  let px = WIDTH / 2;
  let py = HEIGHT - 60;
  let vy = 0;
  let facing = 1;
  let moveDir = 0;
  let clouds: Cloud[] = [];
  let climbed = 0;
  let topY = 0;
  let held: Set<string> = new Set();

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function addCloud(y: number) {
    const difficulty = Math.min(climbed / 4000, 1);
    clouds.push({
      x: rand(CLOUD_W / 2 + 4, WIDTH - CLOUD_W / 2 - 4),
      y,
      moving: climbed > 600 && Math.random() < 0.25 + difficulty * 0.3,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: rand(0.6, 1.2 + difficulty)
    });
  }

  function ensureClouds() {
    const difficulty = Math.min(climbed / 4000, 1);
    while (topY > -HEIGHT) {
      topY -= rand(48, 70 + difficulty * 35);
      addCloud(topY);
    }
    clouds = clouds.filter(c => c.y < HEIGHT + 40);
  }

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

  function update() {
    frame++;

    if (moveDir !== 0) facing = moveDir;
    px += moveDir * RUN_SPEED;
    if (px < -PLAYER / 2) px = WIDTH + PLAYER / 2;
    if (px > WIDTH + PLAYER / 2) px = -PLAYER / 2;

    const prevBottom = py + PLAYER / 2;
    vy += GRAVITY;
    py += vy;

    for (const c of clouds) {
      if (c.moving) {
        c.x += c.dir * c.speed;
        if (c.x < CLOUD_W / 2) { c.x = CLOUD_W / 2; c.dir = 1; }
        if (c.x > WIDTH - CLOUD_W / 2) { c.x = WIDTH - CLOUD_W / 2; c.dir = -1; }
      }
      if (vy > 0) {
        const top = c.y - CLOUD_H / 2;
        const bottom = py + PLAYER / 2;
        if (prevBottom <= top + 2 && bottom >= top && Math.abs(px - c.x) < CLOUD_W / 2 + PLAYER / 4) {
          py = top - PLAYER / 2;
          vy = BOUNCE_VY;
        }
      }
    }

    if (py < HEIGHT * 0.45) {
      const shift = HEIGHT * 0.45 - py;
      py += shift;
      topY += shift;
      climbed += shift;
      for (const c of clouds) c.y += shift;
      ensureClouds();
    }

    score = Math.floor(climbed / 10);

    if (py - PLAYER / 2 > HEIGHT + 10) {
      endGame();
    }
  }

  function drawCloud(c: Cloud) {
    if (!ctx) return;
    ctx.fillStyle = c.moving ? '#ffe9a8' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(c.x - CLOUD_W / 2, c.y - CLOUD_H / 2, CLOUD_W, CLOUD_H, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x - 18, c.y - 4, 11, 0, Math.PI * 2);
    ctx.arc(c.x + 2, c.y - 8, 14, 0, Math.PI * 2);
    ctx.arc(c.x + 20, c.y - 4, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    const t = Math.min(climbed / 6000, 1);
    sky.addColorStop(0, t < 0.5 ? '#5bc0eb' : '#2b4c8c');
    sky.addColorStop(1, '#c9f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (t > 0.3) {
      ctx.fillStyle = `rgba(255,255,255,${(t - 0.3) * 0.9})`;
      for (let i = 0; i < 25; i++) {
        const sx = (i * 97) % WIDTH;
        const sy = ((i * 53) + climbed * 0.2) % HEIGHT;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    for (const c of clouds) drawCloud(c);

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = `${PLAYER}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(px, py);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.fillText('🐰', 0, 2);
    ctx.restore();
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
    if (score > best) best = score;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    draw();
  }

  function startGame() {
    score = 0;
    frame = 0;
    climbed = 0;
    px = WIDTH / 2;
    py = HEIGHT - 60;
    vy = BOUNCE_VY;
    facing = 1;
    moveDir = 0;
    clouds = [{ x: WIDTH / 2, y: HEIGHT - 30, moving: false, dir: 1, speed: 0 }];
    topY = HEIGHT - 30;
    ensureClouds();
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') moveDir = -1;
    else if (e.key === 'ArrowRight') moveDir = 1;
  }

  function handleKeyUp(e: KeyboardEvent) {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) moveDir = 0;
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    clouds = [{ x: WIDTH / 2, y: HEIGHT - 30, moving: false, dir: 1, speed: 0 }];
    topY = HEIGHT - 30;
    ensureClouds();
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
    <h1>☁️ Saute-Nuages</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Hauteur:</span>
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
    aria-label="Ciel avec nuages - Hauteur {score}"
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="nuages-status">
      <h2 id="nuages-status">{hasPlayed ? '🪂 Tombé!' : '☁️ Prêt à Sauter?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Hauteur: {score}</p>
      {:else}
        <p class="hint">Rebondis de nuage en nuage<br>et monte le plus haut possible !</p>
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

  <div class="controls" use:touchpad={onPad}>
    <button
      class="control-btn"
      class:pressed={held.has('left')}
      data-action="left"
      on:pointerdown={(e) => mouseDown('left', e)}
      on:pointerup={(e) => mouseUp('left', e)}
      on:pointerleave={(e) => mouseUp('left', e)}
      on:pointercancel={(e) => mouseUp('left', e)}
      aria-label="Aller à gauche"
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
      aria-label="Aller à droite"
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

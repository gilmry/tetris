<script lang="ts">
  import { onMount } from 'svelte';
  import { touchpad, type PadState } from '../lib/touchpad';

  const WIDTH = 300;
  const HEIGHT = 400;
  const GROUND_Y = HEIGHT - 40;
  const HERO = 28;
  const ENEMY = 26;
  const GRAVITY = 0.45;
  const JUMP_VY = -9.2;
  const RUN_SPEED = 2.4;
  const MAX_LIVES = 3;
  const CAMERA_LEAD = 90;

  interface Block { x: number; w: number; y: number; floating: boolean }
  interface Coin { x: number; y: number; taken: boolean }
  interface Enemy { x: number; y: number; minX: number; maxX: number; dir: number; alive: boolean }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let coins = 0;
  let lives = MAX_LIVES;
  let frameId: number | null = null;
  let frame = 0;

  let hero = { x: 40, y: GROUND_Y - HERO, vx: 0, vy: 0, onGround: false, facing: 1, invincible: 0 };
  let moveDir = 0;
  let jumpHeld = false;
  let jumpQueued = false;
  let cameraX = 0;
  let blocks: Block[] = [];
  let coinList: Coin[] = [];
  let enemies: Enemy[] = [];
  let genX = 0;
  let lastSafeX = 40;
  let farthest = 0;

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function generateChunk() {
    const difficulty = Math.min(genX / 2500, 1);
    const w = Math.round(rand(110, 240));
    blocks.push({ x: genX, w, y: GROUND_Y, floating: false });

    if (genX > 300 && Math.random() < 0.55) {
      const px = genX + rand(10, Math.max(20, w - 90));
      const pw = Math.round(rand(60, 90));
      const py = GROUND_Y - Math.round(rand(80, 125));
      blocks.push({ x: px, w: pw, y: py, floating: true });
      for (let cx = px + 14; cx < px + pw - 8; cx += 22) {
        coinList.push({ x: cx, y: py - 22, taken: false });
      }
    } else if (genX > 150) {
      const n = Math.floor(rand(2, 5));
      const start = genX + rand(10, Math.max(20, w - n * 22 - 10));
      for (let i = 0; i < n; i++) {
        coinList.push({ x: start + i * 22, y: GROUND_Y - 34 - (Math.random() < 0.3 ? 40 : 0), taken: false });
      }
    }

    if (genX > 450 && w >= 130 && Math.random() < 0.35 + difficulty * 0.3) {
      enemies.push({
        x: genX + w / 2,
        y: GROUND_Y - ENEMY,
        minX: genX + 8,
        maxX: genX + w - ENEMY - 8,
        dir: Math.random() < 0.5 ? -1 : 1,
        alive: true
      });
    }

    genX += w;
    if (genX > 350) {
      genX += Math.round(rand(45, 60 + difficulty * 25));
    }
  }

  function ensureLevel() {
    while (genX < cameraX + WIDTH + 300) generateChunk();
    const cutoff = cameraX - 200;
    blocks = blocks.filter(b => b.x + b.w > cutoff);
    coinList = coinList.filter(c => c.x > cutoff);
    enemies = enemies.filter(e => e.maxX > cutoff);
  }

  function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    hero.x = lastSafeX;
    hero.y = GROUND_Y - HERO - 40;
    hero.vx = 0;
    hero.vy = 0;
    hero.invincible = 90;
  }

  function update() {
    frame++;
    if (hero.invincible > 0) hero.invincible--;

    hero.vx = moveDir * RUN_SPEED;
    if (moveDir !== 0) hero.facing = moveDir;

    if (jumpQueued && hero.onGround) {
      hero.vy = JUMP_VY;
      hero.onGround = false;
    }
    jumpQueued = false;
    if (!jumpHeld && hero.vy < -3) hero.vy = -3;

    hero.vy += GRAVITY;
    if (hero.vy > 10) hero.vy = 10;

    const prevBottom = hero.y + HERO;
    hero.x += hero.vx;
    if (hero.x < cameraX + 2) hero.x = cameraX + 2;

    for (const b of blocks) {
      if (b.floating) continue;
      if (overlaps(hero.x, hero.y, HERO, HERO, b.x, b.y, b.w, HEIGHT) && hero.y + HERO > b.y + 10) {
        if (hero.vx > 0) hero.x = b.x - HERO;
        else if (hero.vx < 0) hero.x = b.x + b.w;
      }
    }

    hero.y += hero.vy;
    hero.onGround = false;
    if (hero.vy >= 0) {
      for (const b of blocks) {
        const top = b.y;
        if (hero.x + HERO > b.x + 2 && hero.x < b.x + b.w - 2 && prevBottom <= top + 1 && hero.y + HERO >= top) {
          hero.y = top - HERO;
          hero.vy = 0;
          hero.onGround = true;
          if (!b.floating) lastSafeX = Math.max(b.x + 4, Math.min(hero.x, b.x + b.w - HERO - 4));
        }
      }
    }

    for (const c of coinList) {
      if (!c.taken && overlaps(hero.x, hero.y, HERO, HERO, c.x - 8, c.y - 8, 16, 16)) {
        c.taken = true;
        coins++;
      }
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      e.x += e.dir * 0.8;
      if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
      if (e.x >= e.maxX) { e.x = e.maxX; e.dir = -1; }

      if (overlaps(hero.x + 4, hero.y, HERO - 8, HERO, e.x + 2, e.y, ENEMY - 4, ENEMY)) {
        const stomp = hero.vy > 0 && prevBottom <= e.y + 10;
        if (stomp) {
          e.alive = false;
          hero.vy = -6;
          score += 5;
        } else if (hero.invincible === 0) {
          loseLife();
          return;
        }
      }
    }

    if (hero.y > HEIGHT + 20) {
      loseLife();
      return;
    }

    const targetCam = hero.x - CAMERA_LEAD;
    if (targetCam > cameraX) cameraX = targetCam;

    if (hero.x > farthest) {
      farthest = hero.x;
    }
    score = coins * 10 + Math.floor(farthest / 40) + enemies.filter(e => !e.alive).length * 5;

    ensureLevel();
  }

  function drawEmoji(emoji: string, size: number, x: number, y: number, flip = false) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.fillText(emoji, 0, 0);
    } else {
      ctx.fillText(emoji, x, y);
    }
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#5bc0eb');
    sky.addColorStop(1, '#c9f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 157 - cameraX * 0.3) % (WIDTH + 120) + WIDTH + 120) % (WIDTH + 120) - 60;
      const cy = 40 + (i % 3) * 45;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 6, 20, 0, Math.PI * 2);
      ctx.arc(cx + 38, cy, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#7bc96f';
    for (let i = 0; i < 5; i++) {
      const hx = ((i * 211 - cameraX * 0.5) % (WIDTH + 200) + WIDTH + 200) % (WIDTH + 200) - 100;
      ctx.beginPath();
      ctx.arc(hx, GROUND_Y + 10, 90, Math.PI, 0);
      ctx.fill();
    }

    for (const b of blocks) {
      const sx = b.x - cameraX;
      if (sx > WIDTH || sx + b.w < 0) continue;
      if (b.floating) {
        ctx.fillStyle = '#b5651d';
        ctx.beginPath();
        ctx.roundRect(sx, b.y, b.w, 14, 5);
        ctx.fill();
        ctx.fillStyle = '#58d68d';
        ctx.fillRect(sx + 2, b.y, b.w - 4, 5);
      } else {
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(sx, b.y, b.w, HEIGHT - b.y);
        ctx.fillStyle = '#3cb371';
        ctx.fillRect(sx, b.y, b.w, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = sx + 10; x < sx + b.w - 5; x += 24) {
          ctx.fillRect(x, b.y + 18, 12, 6);
          ctx.fillRect(x + 6, b.y + 32, 12, 6);
        }
      }
    }

    for (const c of coinList) {
      if (c.taken) continue;
      const sx = c.x - cameraX;
      if (sx < -10 || sx > WIDTH + 10) continue;
      const bob = Math.sin(frame / 10 + c.x) * 2;
      ctx.fillStyle = '#FFD93D';
      ctx.beginPath();
      ctx.ellipse(sx, c.y + bob, 6 + Math.abs(Math.sin(frame / 12 + c.x)) * 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.ellipse(sx, c.y + bob, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      const sx = e.x - cameraX;
      if (sx < -30 || sx > WIDTH + 30) continue;
      drawEmoji('🐢', ENEMY, sx + ENEMY / 2, e.y + ENEMY / 2 + 1, e.dir > 0);
    }

    if (hero.invincible === 0 || Math.floor(frame / 5) % 2 === 0) {
      drawEmoji('🦸', HERO + 2, hero.x - cameraX + HERO / 2, hero.y + HERO / 2, hero.facing < 0);
    }

    ctx.fillStyle = '#000';
    ctx.font = '18px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), 8, 8);
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
    coins = 0;
    lives = MAX_LIVES;
    frame = 0;
    cameraX = 0;
    genX = 0;
    farthest = 0;
    lastSafeX = 40;
    blocks = [];
    coinList = [];
    enemies = [];
    hero = { x: 40, y: GROUND_Y - HERO, vx: 0, vy: 0, onGround: false, facing: 1, invincible: 0 };
    moveDir = 0;
    jumpHeld = false;
    jumpQueued = false;
    ensureLevel();
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function jumpDown() {
    if (!gameRunning) return;
    jumpHeld = true;
    jumpQueued = true;
  }

  function jumpUp() {
    jumpHeld = false;
  }

  let held: Set<string> = new Set();

  function applyHeld() {
    moveDir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    jumpHeld = held.has('jump');
  }

  function onPad({ pressed, justPressed }: PadState) {
    held = pressed;
    applyHeld();
    if (justPressed.includes('jump') && gameRunning) jumpQueued = true;
  }

  function mouseDown(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    held = new Set(held).add(action);
    applyHeld();
    if (action === 'jump' && gameRunning) jumpQueued = true;
  }

  function mouseUp(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch' || !held.has(action)) return;
    held = new Set(held);
    held.delete(action);
    applyHeld();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') moveDir = -1;
    else if (e.key === 'ArrowRight') moveDir = 1;
    else if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!jumpHeld) jumpDown();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) moveDir = 0;
    if (e.key === ' ' || e.key === 'ArrowUp') jumpUp();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    ensureLevel();
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
    <h1>🦸 Plateforme</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">🪙</span>
        <span class="value">{coins}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Niveau de plateforme - Score {score} - {coins} pièces - {lives} vies"
    on:pointerdown={jumpDown}
    on:pointerup={jumpUp}
    on:pointercancel={jumpUp}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="plat-status">
      <h2 id="plat-status">{hasPlayed ? '💔 Partie Terminée!' : '🦸 Prêt à Sauter?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Cours, saute sur les plateformes,<br>ramasse les pièces et écrase les tortues !</p>
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
      aria-label="Courir à gauche"
    >
      ⬅️<br><span>Gauche</span>
    </button>
    <button
      class="control-btn jump"
      class:pressed={held.has('jump')}
      data-action="jump"
      on:pointerdown={(e) => mouseDown('jump', e)}
      on:pointerup={(e) => mouseUp('jump', e)}
      on:pointerleave={(e) => mouseUp('jump', e)}
      on:pointercancel={(e) => mouseUp('jump', e)}
      aria-label="Sauter"
    >
      ⬆️<br><span>Sauter</span>
    </button>
    <button
      class="control-btn"
      class:pressed={held.has('right')}
      data-action="right"
      on:pointerdown={(e) => mouseDown('right', e)}
      on:pointerup={(e) => mouseUp('right', e)}
      on:pointerleave={(e) => mouseUp('right', e)}
      on:pointercancel={(e) => mouseUp('right', e)}
      aria-label="Courir à droite"
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
    gap: 0.5rem;
    width: 100%;
    max-width: 400px;
    touch-action: none;
    -webkit-touch-callout: none;
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

  .control-btn:active,
  .control-btn.pressed {
    transform: scale(0.95);
    filter: brightness(1.15);
  }

  .control-btn.jump {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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

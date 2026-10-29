<script lang="ts">
  import { onMount } from 'svelte';

  const CELL = 30;
  const COLS = 10;
  const ROWS = 13;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;
  const GOAL_ROW = 0;
  const RIVER_ROWS = [1, 2, 3, 4, 5];
  const ROAD_ROWS = [7, 8, 9, 10, 11];
  const START_ROW = 12;
  const PAD_COLS = [1, 3, 5, 7, 9];
  const MAX_LIVES = 3;
  const CAR_EMOJIS = ['🚗', '🚙', '🚕', '🚌', '🚓'];

  interface Lane { row: number; dir: number; speed: number; items: { x: number; w: number; emoji?: string }[] }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let level = 1;
  let lives = MAX_LIVES;
  let frameId: number | null = null;
  let frame = 0;
  let frog = { x: 0, y: 0, row: START_ROW };
  let maxRow = START_ROW;
  let pads: boolean[] = [];
  let lanes: Lane[] = [];
  let pauseUntil = 0;
  let swipeStart: { x: number; y: number } | null = null;

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function buildLanes() {
    lanes = [];
    const speedBoost = (level - 1) * 0.25;
    ROAD_ROWS.forEach((row, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const count = 2 + (i % 2);
      const items = [];
      for (let k = 0; k < count; k++) {
        items.push({ x: (k * WIDTH) / count + rand(0, 40), w: CELL - 4, emoji: CAR_EMOJIS[(i + k) % CAR_EMOJIS.length] });
      }
      lanes.push({ row, dir, speed: 0.8 + i * 0.18 + speedBoost, items });
    });
    RIVER_ROWS.forEach((row, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      const count = 2 + (i % 2 === 0 ? 1 : 0);
      const w = i % 2 === 0 ? CELL * 2.6 : CELL * 3.6;
      const items = [];
      for (let k = 0; k < count; k++) {
        items.push({ x: (k * WIDTH) / count, w });
      }
      lanes.push({ row, dir, speed: 0.7 + i * 0.15 + speedBoost * 0.8, items });
    });
  }

  function resetFrog() {
    frog = { x: WIDTH / 2, y: START_ROW * CELL + CELL / 2, row: START_ROW };
    maxRow = START_ROW;
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    resetFrog();
    pauseUntil = frame + 45;
  }

  function move(dx: number, dy: number) {
    if (!gameRunning || frame < pauseUntil) return;
    const nx = frog.x + dx * CELL;
    const ny = frog.row + dy;
    if (nx < CELL / 2 || nx > WIDTH - CELL / 2 || ny < 0 || ny > START_ROW) return;
    frog.x = nx;
    frog.row = ny;
    frog.y = ny * CELL + CELL / 2;
    if (ny < maxRow) {
      maxRow = ny;
      score += 10;
    }
  }

  function update() {
    frame++;
    if (frame < pauseUntil) return;

    for (const lane of lanes) {
      for (const it of lane.items) {
        it.x += lane.dir * lane.speed;
        if (lane.dir > 0 && it.x - it.w / 2 > WIDTH) it.x = -it.w / 2;
        if (lane.dir < 0 && it.x + it.w / 2 < 0) it.x = WIDTH + it.w / 2;
      }
    }

    const lane = lanes.find(l => l.row === frog.row);
    if (lane) {
      if (ROAD_ROWS.includes(frog.row)) {
        const hit = lane.items.some(it => Math.abs(it.x - frog.x) < it.w / 2 + CELL * 0.35);
        if (hit) { loseLife(); return; }
      } else {
        const log = lane.items.find(it => Math.abs(it.x - frog.x) < it.w / 2 + 2);
        if (!log) { loseLife(); return; }
        frog.x += lane.dir * lane.speed;
        if (frog.x < 0 || frog.x > WIDTH) { loseLife(); return; }
      }
    }

    if (frog.row === GOAL_ROW) {
      const col = Math.floor(frog.x / CELL);
      const idx = PAD_COLS.indexOf(col);
      if (idx >= 0 && !pads[idx]) {
        pads[idx] = true;
        score += 200;
        if (pads.every(Boolean)) {
          level++;
          score += 500;
          pads = PAD_COLS.map(() => false);
          buildLanes();
        }
        resetFrog();
        pauseUntil = frame + 30;
      } else {
        loseLife();
      }
    }
  }

  function drawEmoji(emoji: string, size: number, x: number, y: number, flip = false) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.fillText(emoji, 0, 1);
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#1e6fb5';
    ctx.fillRect(0, RIVER_ROWS[0] * CELL, WIDTH, RIVER_ROWS.length * CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 12; i++) {
      const wx = ((i * 61 + frame * 0.5) % (WIDTH + 30)) - 15;
      const wy = RIVER_ROWS[0] * CELL + ((i * 37) % (RIVER_ROWS.length * CELL));
      ctx.fillRect(wx, wy, 14, 2);
    }

    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, ROAD_ROWS[0] * CELL, WIDTH, ROAD_ROWS.length * CELL);
    ctx.fillStyle = '#ffffff';
    for (let i = 1; i < ROAD_ROWS.length; i++) {
      const y = (ROAD_ROWS[0] + i) * CELL - 1;
      for (let x = 0; x < WIDTH; x += 24) ctx.fillRect(x, y, 12, 2);
    }

    ctx.fillStyle = '#1b4332';
    ctx.fillRect(0, GOAL_ROW * CELL, WIDTH, CELL);
    PAD_COLS.forEach((c, i) => {
      ctx!.fillStyle = '#1e6fb5';
      ctx!.fillRect(c * CELL + 2, 2, CELL - 4, CELL - 4);
      if (pads[i]) drawEmoji('🐸', CELL - 6, c * CELL + CELL / 2, CELL / 2);
      else drawEmoji('🪷', CELL - 8, c * CELL + CELL / 2, CELL / 2);
    });

    for (const lane of lanes) {
      const y = lane.row * CELL + CELL / 2;
      for (const it of lane.items) {
        if (it.emoji) {
          drawEmoji(it.emoji, CELL - 4, it.x, y, lane.dir > 0);
        } else {
          ctx.fillStyle = '#8d5524';
          ctx.beginPath();
          ctx.roundRect(it.x - it.w / 2, y - CELL / 2 + 5, it.w, CELL - 10, 8);
          ctx.fill();
          ctx.fillStyle = '#b5651d';
          ctx.fillRect(it.x - it.w / 2 + 6, y - 2, it.w - 12, 3);
        }
      }
    }

    const blink = frame < pauseUntil && Math.floor(frame / 5) % 2 === 0;
    if (!blink) drawEmoji('🐸', CELL - 4, frog.x, frog.y);

    ctx.fillStyle = '#000';
    ctx.font = '14px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), 4, 6 * CELL + CELL / 2);
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
    frame = 0;
    pads = PAD_COLS.map(() => false);
    buildLanes();
    resetFrog();
    pauseUntil = 0;
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function handleKeyDown(e: KeyboardEvent) {
    const map: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const m = map[e.key];
    if (m) {
      e.preventDefault();
      move(m[0], m[1]);
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
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { move(0, -1); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    pads = PAD_COLS.map(() => false);
    buildLanes();
    resetFrog();
    draw();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🐸 Grenouille</h1>
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
    aria-label="Route et rivière à traverser - Score {score} - Niveau {level} - {lives} vies"
    on:pointerdown={handlePointerDown}
    on:pointerup={handlePointerUp}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="grenouille-status">
      <h2 id="grenouille-status">{hasPlayed ? '💦 Splash!' : '🐸 Prête à Sauter?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Traverse la route entre les voitures,<br>puis la rivière sur les troncs,<br>jusqu'aux nénuphars !</p>
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
    <div class="control-row">
      <button class="control-btn" on:pointerdown={() => move(0, -1)} aria-label="Sauter en haut">⬆️</button>
    </div>
    <div class="control-row">
      <button class="control-btn" on:pointerdown={() => move(-1, 0)} aria-label="Sauter à gauche">⬅️</button>
      <button class="control-btn" on:pointerdown={() => move(0, 1)} aria-label="Sauter en bas">⬇️</button>
      <button class="control-btn" on:pointerdown={() => move(1, 0)} aria-label="Sauter à droite">➡️</button>
    </div>
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
    height: 60px;
    font-size: 1.8rem;
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

  @media (max-width: 600px) {
    .game-container {
      gap: 0.4rem;
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

    .game-canvas {
      width: min(94vw, calc((100vh - 300px) * 0.77));
      width: min(94vw, calc((100dvh - 300px) * 0.77));
      height: auto;
    }

    .controls {
      max-width: 94vw;
    }

    .control-btn {
      width: 100px;
      height: 68px;
      font-size: 1.9rem;
    }
  }
</style>

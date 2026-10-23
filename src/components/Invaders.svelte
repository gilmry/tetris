<script lang="ts">
  import { onMount } from 'svelte';

  const WIDTH = 300;
  const HEIGHT = 400;
  const SHIP_SIZE = 32;
  const MONSTER_SIZE = 28;
  const BULLET_SPEED = 5;
  const SHIP_SPEED = 3;
  const MONSTERS_PER_ROW = 5;
  const FIRE_COOLDOWN_MS = 300;

  const MONSTER_EMOJIS = ['👾', '👽', '🛸', '🐙', '🤖'];

  interface Bullet {
    x: number;
    y: number;
  }

  interface Monster {
    x: number;
    y: number;
    baseX: number;
    emoji: string;
    wobble: number;
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let score = 0;
  let wave = 1;
  let shipX = WIDTH / 2;
  let bullets: Bullet[] = [];
  let monsters: Monster[] = [];
  let monsterSpeed = 0.25;
  let moveDir = 0;
  let lastShot = 0;
  let frameId: number | null = null;
  let frame = 0;

  function spawnWave() {
    monsters = [];
    const rows = Math.min(1 + Math.floor((wave - 1) / 2), 3);
    const spacing = WIDTH / (MONSTERS_PER_ROW + 1);
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < MONSTERS_PER_ROW; i++) {
        const x = spacing * (i + 1);
        monsters.push({
          x,
          baseX: x,
          y: -MONSTER_SIZE - row * (MONSTER_SIZE + 12),
          emoji: MONSTER_EMOJIS[(row + i) % MONSTER_EMOJIS.length],
          wobble: Math.random() * Math.PI * 2
        });
      }
    }
  }

  function shoot() {
    if (!gameRunning) return;
    const now = performance.now();
    if (now - lastShot < FIRE_COOLDOWN_MS) return;
    lastShot = now;
    bullets = [...bullets, { x: shipX, y: HEIGHT - SHIP_SIZE - 10 }];
  }

  function update() {
    frame++;

    shipX = Math.max(SHIP_SIZE / 2, Math.min(WIDTH - SHIP_SIZE / 2, shipX + moveDir * SHIP_SPEED));

    bullets = bullets
      .map(b => ({ x: b.x, y: b.y - BULLET_SPEED }))
      .filter(b => b.y > -10);

    for (const m of monsters) {
      m.y += monsterSpeed;
      m.x = m.baseX + Math.sin(frame / 40 + m.wobble) * 12;
    }

    const survivors: Monster[] = [];
    for (const m of monsters) {
      const hitIndex = bullets.findIndex(b =>
        Math.abs(b.x - m.x) < MONSTER_SIZE / 2 && Math.abs(b.y - m.y) < MONSTER_SIZE / 2
      );
      if (hitIndex !== -1) {
        bullets.splice(hitIndex, 1);
        score += 10 * wave;
      } else {
        survivors.push(m);
      }
    }
    monsters = survivors;

    if (monsters.some(m => m.y + MONSTER_SIZE / 2 >= HEIGHT - SHIP_SIZE)) {
      endGame();
      return;
    }

    if (monsters.length === 0) {
      wave++;
      monsterSpeed = Math.min(0.25 + (wave - 1) * 0.08, 1.2);
      spawnWave();
    }
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 20; i++) {
      const sx = (i * 73) % WIDTH;
      const sy = ((i * 131) + frame * 0.3) % HEIGHT;
      ctx.fillRect(sx, sy, 2, 2);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `${MONSTER_SIZE}px serif`;
    for (const m of monsters) {
      ctx.fillText(m.emoji, m.x, m.y);
    }

    ctx.fillStyle = '#FFD93D';
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `${SHIP_SIZE}px serif`;
    ctx.fillText('🚀', shipX, HEIGHT - SHIP_SIZE / 2 - 4);
  }

  function loop() {
    if (!gameRunning) return;
    update();
    draw();
    frameId = requestAnimationFrame(loop);
  }

  function endGame() {
    gameRunning = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    draw();
  }

  function startGame() {
    score = 0;
    wave = 1;
    monsterSpeed = 0.25;
    shipX = WIDTH / 2;
    bullets = [];
    moveDir = 0;
    frame = 0;
    spawnWave();
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function startMove(dir: number) {
    moveDir = dir;
  }

  function stopMove() {
    moveDir = 0;
  }

  function canvasX(clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * WIDTH;
  }

  function handleCanvasPointer(event: PointerEvent) {
    if (!gameRunning) return;
    if (event.type === 'pointerdown' || event.buttons > 0) {
      shipX = canvasX(event.clientX);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!gameRunning) return;
    switch (e.key) {
      case 'ArrowLeft':
        moveDir = -1;
        break;
      case 'ArrowRight':
        moveDir = 1;
        break;
      case ' ':
      case 'ArrowUp':
        e.preventDefault();
        shoot();
        break;
    }
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
    <h1>🚀 Envahisseurs</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">Vague:</span>
        <span class="value">{wave}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Espace de jeu Envahisseurs - Score {score} - Vague {wave}"
    on:pointerdown={handleCanvasPointer}
    on:pointermove={handleCanvasPointer}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="invaders-status">
      <h2 id="invaders-status">{score > 0 ? '💥 Partie Terminée!' : '🛸 Prêt à Jouer?'}</h2>
      {#if score > 0}
        <p class="final-score">Score Final: {score}</p>
      {/if}
      <button
        class="start-button"
        on:click={startGame}
        aria-label={score > 0 ? 'Rejouer une partie' : 'Commencer une partie'}
      >
        {score > 0 ? '🔄 Rejouer' : '▶️ Commencer'}
      </button>
    </div>
  {/if}

  <div class="controls">
    <button
      class="control-btn"
      on:pointerdown={() => startMove(-1)}
      on:pointerup={stopMove}
      on:pointerleave={stopMove}
      on:pointercancel={stopMove}
      aria-label="Déplacer la navette à gauche"
    >
      ⬅️<br><span>Gauche</span>
    </button>
    <button
      class="control-btn fire"
      on:click={shoot}
      aria-label="Tirer"
    >
      💥<br><span>Tirer</span>
    </button>
    <button
      class="control-btn"
      on:pointerdown={() => startMove(1)}
      on:pointerup={stopMove}
      on:pointerleave={stopMove}
      on:pointercancel={stopMove}
      aria-label="Déplacer la navette à droite"
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

  .start-button:hover {
    transform: scale(1.05);
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
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .control-btn.fire {
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
      width: 270px;
      height: 360px;
    }

    .control-btn {
      min-height: 60px;
      font-size: 1.3rem;
      max-width: 100px;
    }

    .controls {
      gap: 0.3rem;
    }
  }
</style>

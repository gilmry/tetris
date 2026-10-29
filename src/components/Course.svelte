<script lang="ts">
  import { onMount } from 'svelte';
  import { createLoop } from '../lib/gameloop';

  const WIDTH = 300;
  const HEIGHT = 400;
  const LANES = 3;
  const ROAD_LEFT = 30;
  const ROAD_WIDTH = WIDTH - ROAD_LEFT * 2;
  const LANE_WIDTH = ROAD_WIDTH / LANES;
  const CAR_SIZE = 36;
  const CAR_Y = HEIGHT - CAR_SIZE - 10;
  const OBSTACLE_EMOJIS = ['🚙', '🚕', '🛻', '🚧', '🌵', '🪨'];
  const START_SPEED = 1.3;
  const MAX_SPEED = 3.8;

  interface Obstacle {
    lane: number;
    y: number;
    emoji: string;
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let score = 0;
  let distance = 0;
  let lane = 1;
  let carX = laneCenter(1);
  let obstacles: Obstacle[] = [];
  let speed = START_SPEED;
  let roadOffset = 0;
  let spawnTimer = 0;
  const ticker = createLoop(() => update(), () => draw());

  function laneCenter(l: number): number {
    return ROAD_LEFT + LANE_WIDTH * l + LANE_WIDTH / 2;
  }

  function spawnObstacle() {
    const openLanes = [0, 1, 2].filter(l =>
      !obstacles.some(o => o.lane === l && o.y < CAR_SIZE * 3)
    );
    if (openLanes.length <= 1) return;
    const l = openLanes[Math.floor(Math.random() * openLanes.length)];
    obstacles.push({
      lane: l,
      y: -CAR_SIZE,
      emoji: OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)]
    });
  }

  function update() {
    distance += speed;
    score = Math.floor(distance / 10);
    speed = Math.min(START_SPEED + distance / 6000, MAX_SPEED);
    roadOffset = (roadOffset + speed) % 40;

    carX += (laneCenter(lane) - carX) * 0.25;

    spawnTimer -= speed;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 120 + Math.random() * 80;
    }

    for (const o of obstacles) {
      o.y += speed;
    }
    obstacles = obstacles.filter(o => o.y < HEIGHT + CAR_SIZE);

    const hit = obstacles.some(o =>
      o.lane === lane &&
      Math.abs(o.y - CAR_Y) < CAR_SIZE * 0.8 &&
      Math.abs(laneCenter(o.lane) - carX) < LANE_WIDTH / 2
    );
    if (hit) endGame();
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, HEIGHT);

    ctx.fillStyle = '#FFD93D';
    ctx.fillRect(ROAD_LEFT - 4, 0, 4, HEIGHT);
    ctx.fillRect(ROAD_LEFT + ROAD_WIDTH, 0, 4, HEIGHT);

    ctx.fillStyle = '#ffffff';
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_LEFT + LANE_WIDTH * l - 2;
      for (let y = -40 + roadOffset; y < HEIGHT; y += 40) {
        ctx.fillRect(x, y, 4, 20);
      }
    }

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${CAR_SIZE}px serif`;

    for (const o of obstacles) {
      ctx.fillText(o.emoji, laneCenter(o.lane), o.y);
    }

    ctx.fillText('🚗', carX, CAR_Y);
  }

  function endGame() {
    gameRunning = false;
    ticker.stop();
    draw();
  }

  function startGame() {
    score = 0;
    distance = 0;
    speed = START_SPEED;
    lane = 1;
    carX = laneCenter(1);
    obstacles = [];
    roadOffset = 0;
    spawnTimer = 60;
    gameRunning = true;
    ticker.start();
  }

  function moveLeft() {
    if (gameRunning && lane > 0) lane--;
  }

  function moveRight() {
    if (gameRunning && lane < LANES - 1) lane++;
  }

  function handleCanvasTap(event: PointerEvent) {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX - rect.left < rect.width / 2) moveLeft();
    else moveRight();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') moveLeft();
    else if (e.key === 'ArrowRight') moveRight();
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
    <h1>🚗 Course</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Route de course - Score {score}"
    on:pointerdown={handleCanvasTap}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="course-status">
      <h2 id="course-status">{score > 0 ? '💥 Accident!' : '🏁 Prêt à Rouler?'}</h2>
      {#if score > 0}
        <p class="final-score">Score Final: {score}</p>
      {/if}
      <button
        class="start-button"
        on:click={startGame}
        aria-label={score > 0 ? 'Rejouer une partie' : 'Commencer une partie'}
      >
        {score > 0 ? '🔄 Rejouer' : '▶️ Démarrer'}
      </button>
    </div>
  {/if}

  <div class="controls">
    <button class="control-btn" on:click={moveLeft} aria-label="Aller à gauche">
      ⬅️<br><span>Gauche</span>
    </button>
    <button class="control-btn" on:click={moveRight} aria-label="Aller à droite">
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

  .start-button:active {
    transform: scale(0.95);
  }

  .controls {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 400px;
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
    touch-action: manipulation;
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

<script lang="ts">
  import { onMount } from 'svelte';

  const COLS = 15;
  const ROWS = 20;
  const CELL = 20;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;
  const FOODS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍉'];

  interface Point {
    x: number;
    y: number;
  }

  type Dir = 'up' | 'down' | 'left' | 'right';

  const DIRS: Record<Dir, Point> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let snake: Point[] = [];
  let dir: Dir = 'up';
  let nextDir: Dir = 'up';
  let food: Point = { x: 7, y: 5 };
  let foodEmoji = FOODS[0];
  const START_TICK_MS = 280;
  const MIN_TICK_MS = 140;
  let tickMs = START_TICK_MS;
  let timer: number | null = null;
  let swipeStart: Point | null = null;

  function isOpposite(a: Dir, b: Dir): boolean {
    return DIRS[a].x + DIRS[b].x === 0 && DIRS[a].y + DIRS[b].y === 0;
  }

  function setDir(d: Dir) {
    if (!gameRunning) return;
    if (isOpposite(d, dir)) return;
    nextDir = d;
  }

  function placeFood() {
    let p: Point;
    do {
      p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === p.x && s.y === p.y));
    food = p;
    foodEmoji = FOODS[Math.floor(Math.random() * FOODS.length)];
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const next = { x: head.x + DIRS[dir].x, y: head.y + DIRS[dir].y };

    const hitWall = next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS;
    const hitSelf = snake.some(s => s.x === next.x && s.y === next.y);
    if (hitWall || hitSelf) {
      endGame();
      return;
    }

    snake = [next, ...snake];

    if (next.x === food.x && next.y === food.y) {
      score++;
      placeFood();
      if (tickMs > MIN_TICK_MS) {
        tickMs -= 4;
        restartTimer();
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < ROWS; y++) {
      for (let x = (y % 2); x < COLS; x += 2) {
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 217, 61, 0.18)';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${CELL + 2}px serif`;
    ctx.fillText(foodEmoji, food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1);

    snake.forEach((s, i) => {
      ctx!.fillStyle = i === 0 ? '#FFD93D' : (i % 2 === 0 ? '#4ECDC4' : '#45B7D1');
      ctx!.beginPath();
      ctx!.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5);
      ctx!.fill();
    });

    const head = snake[0];
    if (head) {
      ctx.fillStyle = '#1a1a2e';
      const d = DIRS[dir];
      const ex = head.x * CELL + CELL / 2 + d.x * 4;
      const ey = head.y * CELL + CELL / 2 + d.y * 4;
      const ox = d.y !== 0 ? 4 : 0;
      const oy = d.x !== 0 ? 4 : 0;
      ctx.beginPath();
      ctx.arc(ex - ox, ey - oy, 2, 0, Math.PI * 2);
      ctx.arc(ex + ox, ey + oy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function restartTimer() {
    if (timer !== null) clearInterval(timer);
    timer = window.setInterval(step, tickMs);
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    if (timer !== null) clearInterval(timer);
    timer = null;
    draw();
  }

  function startGame() {
    score = 0;
    tickMs = START_TICK_MS;
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [{ x: cx, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy + 2 }];
    dir = 'up';
    nextDir = 'up';
    placeFood();
    gameRunning = true;
    draw();
    restartTimer();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const map: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right'
    };
    const d = map[e.key];
    if (d) {
      e.preventDefault();
      setDir(d);
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
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    snake = [{ x: 7, y: 10 }, { x: 7, y: 11 }, { x: 7, y: 12 }];
    draw();
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer !== null) clearInterval(timer);
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🐍 Serpent</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Fruits:</span>
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
    aria-label="Terrain du serpent - {score} fruits mangés"
    on:pointerdown={handlePointerDown}
    on:pointerup={handlePointerUp}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="serpent-status">
      <h2 id="serpent-status">{hasPlayed ? '💫 Aïe!' : '🐍 Prêt à Jouer?'}</h2>
      {#if hasPlayed}
        <p class="final-score">{score} fruit{score > 1 ? 's' : ''} mangé{score > 1 ? 's' : ''}</p>
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
      <button class="control-btn" on:click={() => setDir('up')} aria-label="Aller en haut">⬆️</button>
    </div>
    <div class="control-row">
      <button class="control-btn" on:click={() => setDir('left')} aria-label="Aller à gauche">⬅️</button>
      <button class="control-btn" on:click={() => setDir('down')} aria-label="Aller en bas">⬇️</button>
      <button class="control-btn" on:click={() => setDir('right')} aria-label="Aller à droite">➡️</button>
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

  .start-button:active {
    transform: scale(0.95);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    width: 100%;
    max-width: 300px;
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
    touch-action: manipulation;
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
    }

    .stat {
      padding: 0.3rem 1rem;
    }

    .game-canvas {
      width: 255px;
      height: 340px;
    }

    .control-btn {
      width: 70px;
      height: 50px;
      font-size: 1.4rem;
    }
  }
</style>

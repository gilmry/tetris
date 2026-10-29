<script lang="ts">
  import { onMount } from 'svelte';

  const CELL = 20;
  const MAZE = [
    '###############',
    '#......#......#',
    '#o###.#.#.###o#',
    '#.............#',
    '#.#.#######.#.#',
    '#.#.........#.#',
    '#.###.#.#.###.#',
    '#.....#-#.....#',
    '###.##GGG##.###',
    '###.#######.###',
    '#.............#',
    '#.###.###.###.#',
    '#.#.#.....#.#.#',
    '#.#.#.###.#.#.#',
    '#...#..P..#...#',
    '#.###.###.###.#',
    '#o...........o#',
    '#.#.#######.#.#',
    '#.............#',
    '###############'
  ];
  const COLS = MAZE[0].length;
  const ROWS = MAZE.length;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;
  const MAX_LIVES = 3;
  const GHOST_COLORS = ['#FF6B6B', '#FFB6C1', '#4ECDC4'];

  type Dir = 'up' | 'down' | 'left' | 'right' | 'none';
  const VEC: Record<Dir, { x: number; y: number }> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, none: { x: 0, y: 0 }
  };
  const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left', none: 'none' };

  interface Mover { x: number; y: number; dir: Dir; next: Dir; speed: number }
  interface Ghost extends Mover { color: string; home: { x: number; y: number }; state: 'home' | 'out' | 'eaten'; wait: number }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let level = 1;
  let lives = MAX_LIVES;
  let dots: boolean[][] = [];
  let power: boolean[][] = [];
  let dotsLeft = 0;
  let pac: Mover = { x: 0, y: 0, dir: 'none', next: 'none', speed: 1.6 };
  let ghosts: Ghost[] = [];
  let frightened = 0;
  let frameId: number | null = null;
  let frame = 0;
  let pauseUntil = 0;
  let swipeStart: { x: number; y: number } | null = null;

  function cellAt(col: number, row: number): string {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return '#';
    return MAZE[row][col];
  }

  function isOpen(col: number, row: number, ghost = false): boolean {
    const c = cellAt(col, row);
    if (c === '#') return false;
    if (c === '-') return ghost;
    return true;
  }

  function center(col: number, row: number) {
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  function colOf(x: number) { return Math.floor(x / CELL); }
  function rowOf(y: number) { return Math.floor(y / CELL); }

  function atCenter(m: Mover): boolean {
    const c = center(colOf(m.x), rowOf(m.y));
    return Math.abs(m.x - c.x) < m.speed / 2 + 0.01 && Math.abs(m.y - c.y) < m.speed / 2 + 0.01;
  }

  function canGo(m: Mover, d: Dir, ghost = false): boolean {
    if (d === 'none') return false;
    return isOpen(colOf(m.x) + VEC[d].x, rowOf(m.y) + VEC[d].y, ghost);
  }

  function step(m: Mover, ghost = false) {
    if (atCenter(m)) {
      const c = center(colOf(m.x), rowOf(m.y));
      m.x = c.x;
      m.y = c.y;
      if (m.next !== 'none' && canGo(m, m.next, ghost)) m.dir = m.next;
      if (!canGo(m, m.dir, ghost)) m.dir = 'none';
    } else if (m.next !== 'none' && m.next === OPPOSITE[m.dir]) {
      m.dir = m.next;
    }
    m.x += VEC[m.dir].x * m.speed;
    m.y += VEC[m.dir].y * m.speed;
  }

  function resetBoard() {
    dots = [];
    power = [];
    dotsLeft = 0;
    for (let r = 0; r < ROWS; r++) {
      dots[r] = [];
      power[r] = [];
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        dots[r][c] = ch === '.';
        power[r][c] = ch === 'o';
        if (ch === '.' || ch === 'o') dotsLeft++;
      }
    }
  }

  function resetPositions() {
    ghosts = [];
    let gi = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        if (ch === 'P') {
          const p = center(c, r);
          pac = { x: p.x, y: p.y, dir: 'none', next: 'none', speed: 1.6 };
        } else if (ch === 'G') {
          const p = center(c, r);
          ghosts.push({
            x: p.x, y: p.y, dir: 'up', next: 'none',
            speed: 1.0 + (level - 1) * 0.12,
            color: GHOST_COLORS[gi % GHOST_COLORS.length],
            home: { x: p.x, y: p.y },
            state: 'home',
            wait: 60 + gi * 120
          });
          gi++;
        }
      }
    }
    frightened = 0;
  }

  function chooseGhostDir(g: Ghost) {
    const options = (['up', 'down', 'left', 'right'] as Dir[]).filter(d => canGo(g, d, true) && d !== OPPOSITE[g.dir]);
    if (options.length === 0) {
      g.dir = OPPOSITE[g.dir];
      return;
    }
    const chase = frightened > 0 ? Math.random() < 0.15 : Math.random() < 0.55;
    if (chase || frightened > 0) {
      let bestDir = options[0];
      let bestDist = frightened > 0 ? -1 : Infinity;
      for (const d of options) {
        const nx = g.x + VEC[d].x * CELL;
        const ny = g.y + VEC[d].y * CELL;
        const dist = Math.hypot(pac.x - nx, pac.y - ny);
        const better = frightened > 0 ? dist > bestDist : dist < bestDist;
        if (better) { bestDist = dist; bestDir = d; }
      }
      g.dir = chase ? bestDir : options[Math.floor(Math.random() * options.length)];
    } else {
      g.dir = options[Math.floor(Math.random() * options.length)];
    }
  }

  function loseLife() {
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    resetPositions();
    pauseUntil = frame + 60;
  }

  function update() {
    frame++;
    if (frame < pauseUntil) return;

    step(pac);

    const pc = colOf(pac.x);
    const pr = rowOf(pac.y);
    if (atCenter(pac)) {
      if (dots[pr][pc]) {
        dots[pr][pc] = false;
        dotsLeft--;
        score += 10;
      } else if (power[pr][pc]) {
        power[pr][pc] = false;
        dotsLeft--;
        score += 50;
        frightened = 420;
      }
    }

    if (frightened > 0) frightened--;

    for (const g of ghosts) {
      if (g.state === 'home') {
        if (g.wait > 0) { g.wait--; continue; }
        g.dir = 'up';
        g.state = 'out';
      }
      if (g.state === 'eaten') {
        g.x = g.home.x;
        g.y = g.home.y;
        if (g.wait > 0) { g.wait--; continue; }
        g.state = 'out';
        g.dir = 'up';
      }
      const base = 1.0 + (level - 1) * 0.12;
      g.speed = frightened > 0 ? base * 0.6 : base;
      if (atCenter(g)) {
        const c = center(colOf(g.x), rowOf(g.y));
        g.x = c.x;
        g.y = c.y;
        chooseGhostDir(g);
      }
      g.x += VEC[g.dir].x * g.speed;
      g.y += VEC[g.dir].y * g.speed;

      if (Math.hypot(g.x - pac.x, g.y - pac.y) < CELL * 0.7) {
        if (frightened > 0) {
          g.state = 'eaten';
          g.wait = 150;
          score += 200;
        } else {
          loseLife();
          return;
        }
      }
    }

    if (dotsLeft === 0) {
      level++;
      resetBoard();
      resetPositions();
      pauseUntil = frame + 60;
    }
  }

  function drawGhost(g: Ghost) {
    if (!ctx) return;
    const r = CELL / 2 - 2;
    const blink = frightened > 0 && frightened < 90 && Math.floor(frame / 8) % 2 === 0;
    ctx.fillStyle = frightened > 0 ? (blink ? '#ffffff' : '#3b4cca') : g.color;
    ctx.beginPath();
    ctx.arc(g.x, g.y - 1, r, Math.PI, 0);
    ctx.lineTo(g.x + r, g.y + r - 2);
    for (let i = 0; i < 3; i++) {
      const wx = g.x + r - (i * 2 + 1) * (r / 3);
      ctx.lineTo(wx, g.y + r - 6 + (Math.floor(frame / 6) % 2 === i % 2 ? 2 : -2));
      ctx.lineTo(wx - r / 3, g.y + r - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(g.x - 3, g.y - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(g.x + 3, g.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    const v = VEC[g.dir];
    ctx.beginPath();
    ctx.arc(g.x - 3 + v.x, g.y - 2 + v.y, 1.2, 0, Math.PI * 2);
    ctx.arc(g.x + 3 + v.x, g.y - 2 + v.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;

    ctx.fillStyle = '#0d0d2b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        if (ch === '#') {
          ctx.fillStyle = '#2b3a9e';
          ctx.beginPath();
          ctx.roundRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2, 4);
          ctx.fill();
        } else if (ch === '-') {
          ctx.fillStyle = '#ffb6c1';
          ctx.fillRect(c * CELL, r * CELL + CELL / 2 - 2, CELL, 4);
        } else if (dots[r]?.[c]) {
          ctx.fillStyle = '#FFD93D';
          ctx.beginPath();
          ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (power[r]?.[c]) {
          ctx.fillStyle = '#FFD93D';
          ctx.beginPath();
          ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, 5 + Math.sin(frame / 6) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const g of ghosts) drawGhost(g);

    const mouth = pac.dir === 'none' ? 0.15 : Math.abs(Math.sin(frame / 5)) * 0.45 + 0.05;
    const angle = pac.dir === 'right' ? 0 : pac.dir === 'down' ? Math.PI / 2 : pac.dir === 'left' ? Math.PI : pac.dir === 'up' ? -Math.PI / 2 : 0;
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.moveTo(pac.x, pac.y);
    ctx.arc(pac.x, pac.y, CELL / 2 - 1.5, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = '14px serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), WIDTH - 4, 2);
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
    resetBoard();
    resetPositions();
    pauseUntil = 30;
    gameRunning = true;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function setDir(d: Dir) {
    if (!gameRunning) return;
    pac.next = d;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
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
    resetBoard();
    resetPositions();
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
    <h1>👻 Labyrinthe</h1>
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
    aria-label="Labyrinthe - Score {score} - Niveau {level} - {lives} vies"
    on:pointerdown={handlePointerDown}
    on:pointerup={handlePointerUp}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="laby-status">
      <h2 id="laby-status">{hasPlayed ? '👻 Attrapé!' : '👻 Prêt à Jouer?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Mange tous les points en évitant<br>les fantômes. Les grosses pastilles<br>te permettent de les chasser !</p>
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
      <button class="control-btn" on:pointerdown={() => setDir('up')} aria-label="Aller en haut">⬆️</button>
    </div>
    <div class="control-row">
      <button class="control-btn" on:pointerdown={() => setDir('left')} aria-label="Aller à gauche">⬅️</button>
      <button class="control-btn" on:pointerdown={() => setDir('down')} aria-label="Aller en bas">⬇️</button>
      <button class="control-btn" on:pointerdown={() => setDir('right')} aria-label="Aller à droite">➡️</button>
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
    background: #0d0d2b;
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
      width: min(94vw, calc((100vh - 300px) * 0.75));
      width: min(94vw, calc((100dvh - 300px) * 0.75));
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

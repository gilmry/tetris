<script lang="ts">
  import { onMount } from 'svelte';
  import { createLoop } from '../lib/gameloop';
  import { touchpad, type PadState } from '../lib/touchpad';

  const WIDTH = 300;
  const HEIGHT = 400;
  const HERO = 30;
  const HERO_X = 80;
  const GRAVITY = 0.45;
  const JUMP_VY = -12;
  const JUMP_CUT_VY = -6;
  const SPRING_VY = -15;
  const BASE_SPEED = 2.6;
  const MAX_SPEED = 7;
  const ROLL_FRAMES = 40;
  const ROLL_COOLDOWN = 15;
  const MAX_LIVES = 3;
  const GROUND_BASE = 300;

  interface Point { x: number; y: number | null }
  interface Ring { x: number; y: number; taken: boolean }
  interface Enemy { x: number; y: number; kind: 'crab' | 'bee'; minX: number; maxX: number; dir: number; alive: boolean; wobble: number }
  interface Spring { x: number; y: number; bounce: number }
  interface Spike { x: number; y: number }
  interface Particle { x: number; y: number; vx: number; vy: number; life: number }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let gameRunning = false;
  let hasPlayed = false;
  let score = 0;
  let rings = 0;
  let lives = MAX_LIVES;
  const ticker = createLoop(() => update(), () => draw());
  let frame = 0;

  let heroX = 0;
  let heroY = 0;
  let vx = BASE_SPEED;
  let vy = 0;
  let onGround = true;
  let rolling = 0;
  let rollCooldown = 0;
  let invincible = 0;
  let jumpHeld = false;
  let jumpQueued = false;
  let cameraX = 0;
  let distance = 0;
  let kills = 0;
  let lastSafeX = 0;

  let points: Point[] = [];
  let ringList: Ring[] = [];
  let enemies: Enemy[] = [];
  let springs: Spring[] = [];
  let spikes: Spike[] = [];
  let particles: Particle[] = [];
  let genX = 0;
  let held: Set<string> = new Set();

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function groundAt(x: number): number | null {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (x >= a.x && x <= b.x) {
        if (a.y === null || b.y === null) return null;
        const t = (x - a.x) / (b.x - a.x);
        const s = (1 - Math.cos(t * Math.PI)) / 2;
        return a.y + (b.y - a.y) * s;
      }
    }
    return null;
  }

  function lastY(): number {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].y !== null) return points[i].y as number;
    return GROUND_BASE;
  }

  function generateChunk() {
    const difficulty = Math.min(genX / 6000, 1);
    const startY = lastY();
    const roll = Math.random();

    if (genX > 900 && roll < 0.14 + difficulty * 0.1) {
      const gapW = rand(60, 90 + difficulty * 40);
      points.push({ x: genX, y: startY });
      points.push({ x: genX + 1, y: null });
      points.push({ x: genX + gapW - 1, y: null });
      genX += gapW;
      points.push({ x: genX, y: startY });
      return;
    }

    const len = rand(140, 260);
    const target = roll < 0.6
      ? Math.max(230, Math.min(345, startY + rand(-70, 70)))
      : startY;
    points.push({ x: genX, y: startY });
    const midX = genX + len / 2;
    points.push({ x: midX, y: target });
    const endY = Math.max(230, Math.min(345, target + rand(-50, 50)));
    points.push({ x: genX + len, y: endY });

    const g = (x: number) => groundAt(x) ?? GROUND_BASE;

    if (genX > 250) {
      const kind = Math.random();
      if (kind < 0.45) {
        const n = Math.floor(rand(4, 8));
        const sx = genX + rand(10, Math.max(20, len - n * 22 - 10));
        for (let i = 0; i < n; i++) {
          const x = sx + i * 22;
          const arc = Math.sin((i / (n - 1)) * Math.PI) * 45;
          ringList.push({ x, y: g(x) - 30 - arc, taken: false });
        }
      } else if (kind < 0.75) {
        const n = Math.floor(rand(3, 6));
        const sx = genX + rand(10, Math.max(20, len - n * 22 - 10));
        for (let i = 0; i < n; i++) ringList.push({ x: sx + i * 22, y: g(sx + i * 22) - 32, taken: false });
      }
    }

    if (genX > 500 && Math.random() < 0.32 + difficulty * 0.2) {
      const x = genX + rand(40, len - 40);
      const bee = Math.random() < 0.35;
      enemies.push({
        x, y: bee ? g(x) - 70 : g(x) - 14,
        kind: bee ? 'bee' : 'crab',
        minX: x - 30, maxX: x + 30, dir: 1, alive: true,
        wobble: Math.random() * Math.PI * 2
      });
    }

    if (genX > 700 && Math.random() < 0.25) {
      const x = genX + rand(30, len - 60);
      for (let i = 0; i < 3; i++) spikes.push({ x: x + i * 14, y: g(x + i * 14) });
    }

    if (genX > 400 && Math.random() < 0.28) {
      const x = genX + rand(30, len - 30);
      springs.push({ x, y: g(x), bounce: 0 });
    }

    genX += len;
  }

  function ensureLevel() {
    while (genX < cameraX + WIDTH + 400) generateChunk();
    const cutoff = cameraX - 150;
    while (points.length > 2 && points[1].x < cutoff) points.shift();
    ringList = ringList.filter(r => r.x > cutoff);
    enemies = enemies.filter(e => e.maxX > cutoff);
    springs = springs.filter(s => s.x > cutoff);
    spikes = spikes.filter(s => s.x > cutoff);
  }

  function hurt() {
    if (invincible > 0 || rolling > 0) return;
    if (rings > 0) {
      const n = Math.min(rings, 12);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - n / 2) * 0.35;
        particles.push({ x: heroX, y: heroY, vx: Math.cos(a) * rand(2, 4), vy: Math.sin(a) * rand(3, 6), life: 70 });
      }
      rings = 0;
      invincible = 100;
      vx = Math.max(BASE_SPEED, vx * 0.7);
      vy = -4;
      onGround = false;
      return;
    }
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    heroX = lastSafeX;
    heroY = (groundAt(heroX) ?? GROUND_BASE) - HERO / 2;
    vx = BASE_SPEED;
    vy = 0;
    invincible = 110;
  }

  function fall() {
    lives--;
    if (lives <= 0) {
      endGame();
      return;
    }
    heroX = lastSafeX;
    heroY = (groundAt(heroX) ?? GROUND_BASE) - HERO / 2 - 20;
    vx = BASE_SPEED;
    vy = 0;
    invincible = 110;
  }

  function update() {
    frame++;
    if (invincible > 0) invincible--;
    if (rollCooldown > 0) rollCooldown--;
    if (rolling > 0) rolling--;

    const gHere = groundAt(heroX);
    const gAhead = groundAt(heroX + 12);
    const slope = gHere !== null && gAhead !== null ? (gAhead - gHere) / 12 : 0;

    const speedGoal = BASE_SPEED + Math.min(distance / 2500, 2.2) + (rolling > 0 ? 1.4 : 0);
    if (onGround) {
      vx += slope * 0.05;
      vx += (speedGoal - vx) * 0.04;
    }
    vx = Math.max(2.2, Math.min(MAX_SPEED, vx));

    if (jumpQueued && onGround) {
      vy = JUMP_VY;
      onGround = false;
      rolling = 0;
    }
    jumpQueued = false;
    if (!jumpHeld && vy < JUMP_CUT_VY && !onGround) vy = JUMP_CUT_VY;

    heroX += vx;
    distance += vx;

    const groundY = groundAt(heroX);
    if (onGround) {
      if (groundY === null) {
        onGround = false;
        vy = 0;
      } else {
        const targetY = groundY - HERO / 2;
        if (targetY - heroY > 6) {
          onGround = false;
          vy = 0;
        } else {
          heroY = targetY;
        }
      }
    }
    if (!onGround) {
      vy += GRAVITY;
      if (vy > 12) vy = 12;
      heroY += vy;
      if (groundY !== null && vy >= 0 && heroY + HERO / 2 >= groundY) {
        heroY = groundY - HERO / 2;
        vy = 0;
        onGround = true;
      }
    }
    if (onGround && groundY !== null) lastSafeX = heroX;

    if (heroY - HERO / 2 > HEIGHT + 10) {
      fall();
      return;
    }

    for (const r of ringList) {
      if (!r.taken && Math.abs(r.x - heroX) < HERO / 2 + 6 && Math.abs(r.y - heroY) < HERO / 2 + 6) {
        r.taken = true;
        rings++;
        particles.push({ x: r.x, y: r.y, vx: 0, vy: -1.5, life: 18 });
      }
    }

    for (const s of springs) {
      if (s.bounce > 0) s.bounce--;
      if (Math.abs(s.x - heroX) < 16 && heroY + HERO / 2 >= s.y - 10 && heroY + HERO / 2 <= s.y + 6 && vy >= 0) {
        vy = SPRING_VY;
        onGround = false;
        vx = Math.min(MAX_SPEED, vx + 1.2);
        s.bounce = 12;
      }
    }

    for (const s of spikes) {
      if (Math.abs(s.x - heroX) < 10 && heroY + HERO / 2 > s.y - 14 && heroY + HERO / 2 < s.y + 4) {
        if (invincible === 0) {
          const hadRings = rings > 0;
          const prevRoll = rolling;
          rolling = 0;
          hurt();
          if (!hadRings) return;
          if (prevRoll) rolling = 0;
        }
      }
    }

    const ballForm = rolling > 0 || !onGround;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.kind === 'crab') {
        e.x += e.dir * 0.7;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        const gy = groundAt(e.x);
        if (gy !== null) e.y = gy - 14;
      } else {
        e.x += e.dir * 1.1;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        e.y += Math.sin(frame / 10 + e.wobble) * 0.6;
      }
      if (Math.abs(e.x - heroX) < HERO / 2 + 8 && Math.abs(e.y - heroY) < HERO / 2 + 8) {
        if (ballForm) {
          e.alive = false;
          kills++;
          if (!onGround && vy > 0) vy = -6;
          for (let i = 0; i < 6; i++) {
            particles.push({ x: e.x, y: e.y, vx: rand(-3, 3), vy: rand(-4, 1), life: 30 });
          }
        } else if (invincible === 0) {
          hurt();
          return;
        }
      }
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);

    cameraX = heroX - HERO_X;
    score = rings * 10 + Math.floor(distance / 40) + kills * 20;
    ensureLevel();
  }

  function drawEmoji(emoji: string, size: number, x: number, y: number, flip = false, rot = 0) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.fillText(emoji, 0, 1);
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#3fa9f5');
    sky.addColorStop(1, '#bfe9ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 171 - cameraX * 0.2) % (WIDTH + 140) + WIDTH + 140) % (WIDTH + 140) - 70;
      const cy = 40 + (i % 3) * 35;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 7, 19, 0, Math.PI * 2);
      ctx.arc(cx + 38, cy, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5fcf80';
    for (let i = 0; i < 4; i++) {
      const hx = ((i * 230 - cameraX * 0.4) % (WIDTH + 240) + WIDTH + 240) % (WIDTH + 240) - 120;
      ctx.beginPath();
      ctx.arc(hx, 250, 110, Math.PI, 0);
      ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const px = ((i * 190 + 60 - cameraX * 0.55) % (WIDTH + 200) + WIDTH + 200) % (WIDTH + 200) - 100;
      drawEmoji('🌴', 40, px, 215);
    }

    const startX = Math.floor(cameraX / 4) * 4;
    ctx.fillStyle = '#b5651d';
    ctx.beginPath();
    let drawing = false;
    for (let x = startX; x <= cameraX + WIDTH + 4; x += 4) {
      const gy = groundAt(x);
      if (gy === null) {
        if (drawing) {
          ctx.lineTo(x - 4 - cameraX, HEIGHT);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          drawing = false;
        }
        continue;
      }
      if (!drawing) {
        ctx.moveTo(x - cameraX, HEIGHT);
        drawing = true;
      }
      ctx.lineTo(x - cameraX, gy);
    }
    if (drawing) {
      ctx.lineTo(WIDTH + 8, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    drawing = false;
    for (let x = startX; x <= cameraX + WIDTH + 4; x += 4) {
      const gy = groundAt(x);
      if (gy === null) {
        if (drawing) { ctx.lineTo(x - 4 - cameraX, HEIGHT); ctx.closePath(); drawing = false; }
        continue;
      }
      if (!drawing) { ctx.moveTo(x - cameraX, HEIGHT); drawing = true; }
      ctx.lineTo(x - cameraX, gy + 14);
    }
    if (drawing) { ctx.lineTo(WIDTH + 8, HEIGHT); ctx.closePath(); }
    ctx.clip();
    ctx.fillStyle = '#8d4e1b';
    const off = ((cameraX % 32) + 32) % 32;
    for (let y = 200; y < HEIGHT; y += 16) {
      for (let x = -off - 32 + ((y / 16) % 2) * 16; x < WIDTH + 32; x += 32) {
        ctx.fillRect(x, y, 16, 16);
      }
    }
    ctx.restore();

    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    drawing = false;
    for (let x = startX; x <= cameraX + WIDTH + 4; x += 4) {
      const gy = groundAt(x);
      if (gy === null) { drawing = false; continue; }
      if (!drawing) { ctx.moveTo(x - cameraX, gy + 2); drawing = true; }
      else ctx.lineTo(x - cameraX, gy + 2);
    }
    ctx.stroke();

    for (const s of springs) {
      const sx = s.x - cameraX;
      if (sx < -20 || sx > WIDTH + 20) continue;
      const h = s.bounce > 0 ? 8 : 14;
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(sx - 12, s.y - h, 24, h);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(sx - 14, s.y - h - 5, 28, 6);
    }

    for (const s of spikes) {
      const sx = s.x - cameraX;
      if (sx < -10 || sx > WIDTH + 10) continue;
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(sx - 7, s.y + 1);
      ctx.lineTo(sx, s.y - 16);
      ctx.lineTo(sx + 7, s.y + 1);
      ctx.closePath();
      ctx.fill();
    }

    for (const r of ringList) {
      if (r.taken) continue;
      const rx = r.x - cameraX;
      if (rx < -10 || rx > WIDTH + 10) continue;
      ctx.strokeStyle = '#FFD93D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(rx, r.y, 3 + Math.abs(Math.sin(frame / 8 + r.x / 30)) * 4, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x - cameraX;
      if (ex < -30 || ex > WIDTH + 30) continue;
      drawEmoji(e.kind === 'crab' ? '🦀' : '🐝', 26, ex, e.y, e.dir < 0);
    }

    for (const p of particles) {
      ctx.fillStyle = p.life > 20 ? '#FFD93D' : 'rgba(255,217,61,0.6)';
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const hx = heroX - cameraX;
    const visible = invincible === 0 || Math.floor(frame / 4) % 2 === 0;
    if (visible) {
      if (rolling > 0 || !onGround) {
        ctx.save();
        ctx.translate(hx, heroY);
        ctx.rotate(frame * 0.35);
        ctx.fillStyle = '#1e6fd9';
        ctx.beginPath();
        ctx.arc(0, 0, HERO / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b4aa8';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.lineTo(Math.cos(a + 0.4) * (HERO / 2), Math.sin(a + 0.4) * (HERO / 2));
          ctx.lineTo(Math.cos(a + 0.9) * 8, Math.sin(a + 0.9) * 8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else {
        const bob = Math.sin(frame * 0.5) * 1.5;
        drawEmoji('🦔', HERO + 4, hx, heroY + bob, true, Math.atan(slopeAt(heroX)) * 0.5);
      }
      if (onGround && vx > 4.5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(hx - 20 - i * 9, heroY - 6 + i * 6);
          ctx.lineTo(hx - 32 - i * 9, heroY - 6 + i * 6);
          ctx.stroke();
        }
      }
    }

    ctx.fillStyle = '#000';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    const ringText = `💍 ${rings}`;
    ctx.strokeText(ringText, 8, 8);
    ctx.fillText(ringText, 8, 8);
    ctx.fillStyle = '#000';
    ctx.font = '15px serif';
    ctx.textAlign = 'right';
    ctx.fillText('❤️'.repeat(Math.max(0, lives)), WIDTH - 8, 8);
  }

  function slopeAt(x: number): number {
    const a = groundAt(x - 8);
    const b = groundAt(x + 8);
    if (a === null || b === null) return 0;
    return (b - a) / 16;
  }

  function endGame() {
    gameRunning = false;
    hasPlayed = true;
    ticker.stop();
    draw();
  }

  function resetWorld() {
    points = [{ x: -200, y: GROUND_BASE }, { x: 300, y: GROUND_BASE }];
    genX = 300;
    ringList = [];
    enemies = [];
    springs = [];
    spikes = [];
    particles = [];
    heroX = 40;
    heroY = GROUND_BASE - HERO / 2;
    vx = BASE_SPEED;
    vy = 0;
    onGround = true;
    rolling = 0;
    rollCooldown = 0;
    invincible = 0;
    cameraX = heroX - HERO_X;
    distance = 0;
    kills = 0;
    lastSafeX = 40;
    ensureLevel();
  }

  function startGame() {
    score = 0;
    rings = 0;
    lives = MAX_LIVES;
    frame = 0;
    jumpHeld = false;
    jumpQueued = false;
    resetWorld();
    gameRunning = true;
    ticker.start();
  }

  function startRoll() {
    if (!gameRunning || !onGround || rolling > 0 || rollCooldown > 0) return;
    rolling = ROLL_FRAMES;
    rollCooldown = ROLL_FRAMES + ROLL_COOLDOWN;
  }

  function applyHeld() {
    jumpHeld = held.has('jump');
  }

  function onPad({ pressed, justPressed }: PadState) {
    held = pressed;
    applyHeld();
    if (justPressed.includes('jump') && gameRunning) jumpQueued = true;
    if (justPressed.includes('roll')) startRoll();
  }

  function mouseDown(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    held = new Set(held).add(action);
    applyHeld();
    if (action === 'jump' && gameRunning) jumpQueued = true;
    if (action === 'roll') startRoll();
  }

  function mouseUp(action: string, e: PointerEvent) {
    if (e.pointerType === 'touch' || !held.has(action)) return;
    held = new Set(held);
    held.delete(action);
    applyHeld();
  }

  function canvasDown() {
    if (!gameRunning) return;
    jumpHeld = true;
    jumpQueued = true;
  }

  function canvasUp() {
    if (!held.has('jump')) jumpHeld = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!jumpHeld) { jumpHeld = true; if (gameRunning) jumpQueued = true; }
    } else if (e.key === 'ArrowDown' || e.key === 'Shift') {
      e.preventDefault();
      startRoll();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'ArrowUp') jumpHeld = held.has('jump');
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    resetWorld();
    draw();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      ticker.stop();
    };
  });
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🦔 Hérisson</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Score:</span>
        <span class="value">{score}</span>
      </div>
      <div class="stat">
        <span class="label">💍</span>
        <span class="value">{rings}</span>
      </div>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    width={WIDTH}
    height={HEIGHT}
    class="game-canvas"
    role="img"
    aria-label="Collines vertes - Score {score} - {rings} anneaux - {lives} vies"
    on:pointerdown={canvasDown}
    on:pointerup={canvasUp}
    on:pointercancel={canvasUp}
  />

  {#if !gameRunning}
    <div class="game-over" role="dialog" aria-labelledby="herisson-status">
      <h2 id="herisson-status">{hasPlayed ? '💫 Partie Terminée!' : '🦔 Prêt à Foncer?'}</h2>
      {#if hasPlayed}
        <p class="final-score">Score: {score}</p>
      {:else}
        <p class="hint">Le hérisson court tout seul !<br>Saute, roule en boule pour écraser<br>les ennemis et ramasse les anneaux.</p>
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
      class="control-btn roll"
      class:pressed={held.has('roll')}
      data-action="roll"
      on:pointerdown={(e) => mouseDown('roll', e)}
      on:pointerup={(e) => mouseUp('roll', e)}
      on:pointerleave={(e) => mouseUp('roll', e)}
      on:pointercancel={(e) => mouseUp('roll', e)}
      aria-label="Rouler en boule"
    >
      🌀<br><span>Rouler</span>
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
    max-width: 160px;
    min-height: 80px;
    font-size: 1.8rem;
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

  .control-btn.roll {
    background: linear-gradient(135deg, #45B7D1 0%, #1e6fd9 100%);
  }

  .control-btn.jump {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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

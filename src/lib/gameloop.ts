const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100;

// Fixed-timestep loop: game logic always advances in 1/60 s steps, so speed
// is the same on 60 Hz and 120 Hz screens and stays steady when frames drop.
export function createLoop(update: () => void, draw: () => void) {
  let id: number | null = null;
  let last = 0;
  let acc = 0;

  function frame(now: number) {
    if (id === null) return;
    if (last === 0) last = now;
    acc += Math.min(now - last, MAX_FRAME_MS);
    last = now;
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      update();
      if (id === null) return;
    }
    draw();
    id = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (id !== null) cancelAnimationFrame(id);
      last = 0;
      acc = 0;
      id = requestAnimationFrame(frame);
    },
    stop() {
      if (id !== null) cancelAnimationFrame(id);
      id = null;
    }
  };
}

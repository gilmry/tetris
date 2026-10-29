export interface PadState {
  pressed: Set<string>;
  justPressed: string[];
}

// Multi-touch "gamepad": derives the set of held buttons (elements with a
// data-action attribute inside `node`) from every active finger, so several
// buttons can be held at once and a finger can slide from one to another.
export function touchpad(node: HTMLElement, handler: (state: PadState) => void) {
  let prev = new Set<string>();

  function handle(e: TouchEvent) {
    e.preventDefault();
    const pressed = new Set<string>();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const btn = el?.closest<HTMLElement>('[data-action]');
      if (btn && node.contains(btn) && btn.dataset.action) pressed.add(btn.dataset.action);
    }
    const justPressed = [...pressed].filter(a => !prev.has(a));
    prev = pressed;
    handler({ pressed, justPressed });
  }

  function prevent(e: Event) {
    e.preventDefault();
  }

  const opts: AddEventListenerOptions = { passive: false };
  node.addEventListener('touchstart', handle, opts);
  node.addEventListener('touchmove', handle, opts);
  node.addEventListener('touchend', handle, opts);
  node.addEventListener('touchcancel', handle, opts);
  node.addEventListener('contextmenu', prevent);

  return {
    update(next: (state: PadState) => void) {
      handler = next;
    },
    destroy() {
      node.removeEventListener('touchstart', handle);
      node.removeEventListener('touchmove', handle);
      node.removeEventListener('touchend', handle);
      node.removeEventListener('touchcancel', handle);
      node.removeEventListener('contextmenu', prevent);
    }
  };
}

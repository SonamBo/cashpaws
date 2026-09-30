/**
 * Coach marks for a first-time tutorial. The shell owns them because a tip
 * may point at the shell's own header (the progress bar) as well as at the
 * game's board. A game drives them through host.coach.
 *
 *   tip({ at, text, hand })        a bubble by an element, never blocking play;
 *                                  `hand` is one element or [from, to] to tap
 *   spotlight({ at, text, ok })    dims everything but one element, waits for
 *                                  the button; resolves when dismissed
 *   clear()                        takes down whatever is showing
 *
 * `at` is an element, or 'progress' for the shared progress bar.
 */

const HAND = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
  <path d="M18 23V9.5a3.5 3.5 0 0 1 7 0V21l.4-2.3a3.3 3.3 0 0 1 6.5 1V22l.3-1.2a3.2 3.2 0 0 1 6.3 1.4v8.3
    c0 7-4.7 12-11.5 12h-2.3c-3.7 0-6.3-1.4-8.6-4.2l-6-7.5a3.2 3.2 0 0 1 4.8-4.2Z"
    fill="#fff" stroke="#3f3a37" stroke-width="2.6" stroke-linejoin="round"/></svg>`;

export function createCoach(app) {
  const layer = document.createElement('div');
  layer.className = 'coach';
  app.appendChild(layer);
  let timer = null;

  // 'progress' is the bar and the lines under it: what grows, by how much, and to what.
  const resolveAt = (at) => (at === 'progress'
    ? ['[data-bar]', '[data-figure]', '[data-sub]'].map((q) => app.querySelector(q)).filter((e) => e && e.offsetHeight)
    : at);

  /** Where an element sits within the app, in pixels. */
  function box(el) {
    const a = app.getBoundingClientRect();
    const rs = [].concat(el).map((e) => e.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const r = Math.max(...rs.map((q) => q.right)), b = Math.max(...rs.map((q) => q.bottom));
    return { x: l - a.left, y: t - a.top, w: r - l, h: b - t };
  }

  function clear() {
    clearInterval(timer);
    timer = null;
    layer.innerHTML = '';
    layer.classList.remove('blocking');
  }

  /** Bubble above or below the target, whichever side has room, kept on screen. */
  function place(bubble, target) {
    const t = box(target);
    const H = app.clientHeight;
    const W = app.clientWidth;
    const bw = Math.min(300, W - 32);
    bubble.style.width = `${bw}px`;
    bubble.style.left = `${Math.max(16, Math.min(W - bw - 16, t.x + t.w / 2 - bw / 2))}px`;
    const below = t.y + t.h + 14;
    const bh = bubble.offsetHeight;
    if (below + bh < H - 16) { bubble.style.top = `${below}px`; bubble.dataset.side = 'below'; }
    else { bubble.style.top = `${Math.max(16, t.y - bh - 14)}px`; bubble.dataset.side = 'above'; }
  }

  function tip({ at, text, hand = null }) {
    clear();
    const target = resolveAt(at);
    if (!target) return;
    layer.innerHTML = `<div class="coach-bubble">${text}</div>`;
    place(layer.firstElementChild, target);
    if (hand) {
      const stops = [].concat(hand).filter(Boolean);
      const h = document.createElement('div');
      h.className = 'coach-hand';
      h.innerHTML = HAND;
      layer.appendChild(h);
      let i = 0;
      const go = () => {
        const b = box(stops[i % stops.length]);
        h.style.left = `${b.x + b.w / 2 - 8}px`;
        h.style.top = `${b.y + b.h * 0.55}px`;
        h.classList.remove('tap');
        void h.offsetWidth;                 // restart the tap animation
        h.classList.add('tap');
        i++;
      };
      go();
      if (stops.length > 1) timer = setInterval(go, 1100);
    }
  }

  function spotlight({ at, text, ok = 'Got it' }) {
    clear();
    const target = resolveAt(at);
    if (!target || (Array.isArray(target) && !target.length)) return Promise.resolve();
    const t = box(target);
    const pad = 8;
    layer.classList.add('blocking');
    layer.innerHTML = `
      <div class="coach-hole" style="left:${t.x - pad}px;top:${t.y - pad}px;width:${t.w + pad * 2}px;height:${t.h + pad * 2}px"></div>
      <div class="coach-bubble">${text}<button class="ovl-btn primary coach-ok">${ok}</button></div>`;
    place(layer.querySelector('.coach-bubble'), layer.querySelector('.coach-hole'));
    return new Promise((resolve) => {
      layer.querySelector('.coach-ok').addEventListener('click', () => { clear(); resolve(); }, { once: true });
    });
  }

  return { tip, spotlight, clear };
}

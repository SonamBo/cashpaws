/**
 * Coach marks for a first-time tutorial. The shell owns them because a tip
 * may point at the shell's own header (the progress bar) as well as at the
 * game's board. A game drives them through host.coach.
 *
 *   tip({ at, text, hand, onSkip })  a bubble by an element, never blocking play;
 *                                  with onSkip, a "Skip tutorial" button in it;
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
    // On screen sizes vs. the app's own pixels: they differ when the page
    // scales the app up (the web build on a large window). 1 on a phone.
    const s = a.width / (app.offsetWidth || a.width) || 1;
    const rs = [].concat(el).map((e) => e.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const r = Math.max(...rs.map((q) => q.right)), b = Math.max(...rs.map((q) => q.bottom));
    return { x: (l - a.left) / s, y: (t - a.top) / s, w: (r - l) / s, h: (b - t) / s };
  }

  function clear() {
    clearInterval(timer);
    timer = null;
    layer.innerHTML = '';
    layer.classList.remove('blocking');
  }

  /**
   * Bubble below the target, else above, else beside it: the first place that
   * fits on screen and covers none of the app's buttons (Undo, Sort, the
   * header). In a wide window that is usually beside the board.
   */
  function place(bubble, target) {
    // Measure what's drawn, not the container: a full-width row of tubes is
    // only as wide as its tubes.
    const kids = [...(target.children || [])].filter((el) => el.offsetParent !== null).map((el) => box(el));
    const t = kids.length ? kids.reduce((u, r) => {
      const x = Math.min(u.x, r.x), y = Math.min(u.y, r.y);
      return { x, y, w: Math.max(u.x + u.w, r.x + r.w) - x, h: Math.max(u.y + u.h, r.y + r.h) - y };
    }) : box(target);
    const H = app.clientHeight;
    const W = app.clientWidth;
    const visible = (sel) => [...app.querySelectorAll(sel)]
      .filter((el) => el.offsetParent !== null && !layer.contains(el) && !(target.contains && target.contains(el)))
      .map((el) => box(el));
    const buttons = visible('button, [data-menu]');                    // never cover these if avoidable
    const header = visible('[data-title], [data-bar], [data-figure]'); // nor these, if there's a better spot
    // Each spot sets its own width (beside the board the gap may be
    // narrower), measures the bubble's height at that width, and scores it.
    const fullW = Math.min(300, W - 32);
    const candidates = [];
    const tryAt = (side, width) => {
      if (width < 180) return;
      bubble.style.width = `${width}px`;
      const bh = bubble.offsetHeight;
      const midX = Math.max(16, Math.min(W - width - 16, t.x + t.w / 2 - width / 2));
      const midY = Math.max(16, Math.min(H - bh - 16, t.y + t.h / 2 - bh / 2));
      const [x, y] = { below: [midX, t.y + t.h + 14], above: [midX, t.y - bh - 14],
        right: [t.x + t.w + 18, midY], left: [t.x - width - 18, midY] }[side];
      if (x < 8 || y < 8 || x + width > W - 8 || y + bh > H - 8) return;
      const hits = (rs) => rs.filter((r) => x < r.x + r.w && x + width > r.x && y < r.y + r.h && y + bh > r.y).length;
      candidates.push({ side, x, y, width, cost: hits(buttons) * 10 + hits(header) });
    };
    tryAt('below', fullW);
    tryAt('right', Math.min(fullW, W - (t.x + t.w) - 26));
    tryAt('left', Math.min(fullW, t.x - 26));
    tryAt('above', fullW);
    const best = candidates.reduce((a, c) => (!a || c.cost < a.cost ? c : a), null)
      || { side: 'above', x: Math.max(16, t.x + t.w / 2 - fullW / 2), y: 16, width: fullW };
    const { side, x, y } = best;
    bubble.style.width = `${best.width}px`;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.dataset.side = side;
  }

  function tip({ at, text, hand = null, onSkip = null }) {
    clear();
    const target = resolveAt(at);
    if (!target) return;
    layer.innerHTML = `<div class="coach-bubble">${text}${onSkip ? '<button class="coach-skip" type="button">Skip tutorial</button>' : ''}</div>`;
    if (onSkip) layer.querySelector('.coach-skip').addEventListener('click', () => { clear(); onSkip(); }, { once: true });
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

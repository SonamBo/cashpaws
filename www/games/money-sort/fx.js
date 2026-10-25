/**
 * Coin flights: every coin that moves travels through the air instead of
 * sliding. A high arc, the coin flipping as it flies, a glowing trail in its
 * own colour, sparkles shed along the way, a squash-and-bounce as it lands, a
 * clink that climbs in pitch coin after coin, and a light tap of vibration.
 *
 *   const fx = createFx(root, host)
 *   fx.snapshot(tubes)                 where every coin is now
 *   await fx.fly(pairs, opts)          clones fly from old rects to new chips
 *   fx.burst(x, y, colour)             a puff of sparkles
 *
 * The real coins are already in place underneath (the board has repainted);
 * they're hidden until their clone lands on them, so nothing can go out of
 * step with the game. Reduced-motion players get the old instant moves.
 */

/** Trail and sparkle colour per coin: Mint set, Paper set, specials. */
// Vivid, so they read on the cream room: silver trails icy blue, not grey.
const COLOURS = {
  a: { 1: '#2f7dff', 5: '#5aa9ff', 10: '#ff7a1a', 20: '#1fb85a', 50: '#9b4dff' },
  b: { 1: '#2f7dff', 5: '#14b39a', 10: '#ff5c8f', 20: '#f2a900', 50: '#5aa9ff' },
};
const GOLD = '#ffb300';

export function colourOf(chip) {
  const v = Number(chip?.dataset?.v);
  if (!Number.isFinite(v) || v < 0) return '#d8c7b2';
  return COLOURS[chip.dataset.set === 'b' ? 'b' : 'a'][v] || GOLD;
}

const reduced = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function createFx(root, host) {
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  layer.appendChild(canvas);
  root.appendChild(layer);
  const g = canvas.getContext('2d');

  const flights = new Set();
  const sparks = [];
  let raf = 0;
  let lastHaptic = 0;

  /** Board pixels per screen pixel, and the layer's corner, for every frame's maths. */
  function frame() {
    const box = layer.getBoundingClientRect();
    const s = box.width / (layer.offsetWidth || box.width) || 1;
    return { box, s };
  }
  const local = (rect, { box, s }) => ({
    x: (rect.left + rect.width / 2 - box.left) / s,
    y: (rect.top + rect.height / 2 - box.top) / s,
    w: rect.width / s, h: rect.height / s,
  });

  function fitCanvas() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = layer.offsetWidth, h = layer.offsetHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spark(x, y, colour, { speed = 60, life = 420, size = 2.2, n = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life, age: 0,
        size: size * (0.7 + Math.random() * 0.9), colour: Math.random() < 0.45 ? GOLD : colour });
    }
  }

  function star(x, y, r, colour, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = colour;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.38 : r;
      const a = (i * Math.PI) / 4;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  let last = 0;
  function tick(now) {
    const dt = Math.min(48, now - (last || now)) / 1000;
    last = now;
    fitCanvas();
    g.clearRect(0, 0, layer.offsetWidth, layer.offsetHeight);

    for (const f of flights) {
      const t = (now - f.start) / f.dur;
      if (t < 0) continue;
      if (!f.launched) { f.launched = true; f.clone.style.visibility = 'visible'; f.onLaunch?.(); }
      const k = Math.min(1, t);
      // Ease: quick lift, hang at the top, drop in.
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * f.p0.x + 2 * (1 - e) * e * f.c.x + e * e * f.p1.x;
      const y = (1 - e) * (1 - e) * f.p0.y + 2 * (1 - e) * e * f.c.y + e * e * f.p1.y;
      const flip = Math.max(0.18, Math.abs(Math.cos(k * Math.PI * f.turns)));
      const lift = 1 + 0.22 * Math.sin(k * Math.PI);
      f.clone.style.transform = `translate(${x - f.w / 2}px, ${y - f.h / 2}px) scale(${flip * lift}, ${lift}) rotate(${(f.spin * k).toFixed(1)}deg)`;

      // The comet trail: the last few positions, thinning and fading, in the
      // coin's colour with a white core.
      f.trail.push({ x, y });
      if (f.trail.length > 14) f.trail.shift();
      g.lineCap = 'round';
      for (const [colour, width, alpha] of [[f.colour, 0.5, 0.75], ['#ffffff', 0.16, 0.85]]) {
        for (let i = 1; i < f.trail.length; i++) {
          const a = i / f.trail.length;
          g.globalAlpha = a * a * alpha;
          g.strokeStyle = colour;
          g.lineWidth = Math.max(1, f.w * width * a);
          g.beginPath();
          g.moveTo(f.trail[i - 1].x, f.trail[i - 1].y);
          g.lineTo(f.trail[i].x, f.trail[i].y);
          g.stroke();
        }
      }
      // A soft gold halo behind the coin.
      const glow = g.createRadialGradient(x, y, f.w * 0.2, x, y, f.w * 0.95);
      glow.addColorStop(0, 'rgba(255, 214, 102, .55)');
      glow.addColorStop(1, 'rgba(255, 214, 102, 0)');
      g.globalAlpha = 1;
      g.fillStyle = glow;
      g.fillRect(x - f.w, y - f.w, f.w * 2, f.w * 2);
      if (Math.random() < 0.8) spark(x, y, f.colour, { speed: 34, life: 420, size: 2.4 });

      if (k >= 1) {
        flights.delete(f);
        f.clone.remove();
        f.land();
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt * 1000;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      p.vy += 160 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      star(p.x, p.y, p.size * (1 - p.age / p.life * 0.5), p.colour, 1 - p.age / p.life);
    }
    g.globalAlpha = 1;

    raf = flights.size || sparks.length ? requestAnimationFrame(tick) : 0;
    if (!raf) g.clearRect(0, 0, layer.offsetWidth, layer.offsetHeight);
  }
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };

  function haptic(ms) {
    const now = performance.now();
    if (now - lastHaptic < 45) return;         // a stream of coins is one buzz, not a drill
    lastHaptic = now;
    host.haptic(ms);
  }

  return {
    get on() { return !reduced(); },

    /** Every coin on the board: element, its rect, value, set. */
    snapshot(tubes) {
      return tubes.map((tube) => [...tube.querySelector('.glass').children]
        .map((cell) => cell.firstElementChild).filter(Boolean)
        .map((chip) => ({ chip, rect: chip.getBoundingClientRect(), v: chip.dataset.v, set: chip.dataset.set })));
    },

    /**
     * Fly clones from `from` rects to the `to` chips (already in place, hidden
     * until landed). pairs: [{ from: DOMRect, to: chip, src?: chip }].
     * Resolves when the last coin lands.
     */
    fly(pairs, { dur = 340, stagger = 60, arc = 1, turns = 2, sound = 'land', haptics = 8, launch = null } = {}) {
      if (!pairs.length || reduced()) return Promise.resolve();
      const fr = frame();
      const t0 = performance.now();
      let landed = 0;
      return new Promise((resolve) => {
        pairs.forEach((pr, i) => {
          const to = pr.to;
          const p1 = local(to.getBoundingClientRect(), fr);
          const p0 = local(pr.from, fr);
          if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 3) { if (++landed === pairs.length) resolve(); return; }
          to.style.visibility = 'hidden';
          const clone = to.cloneNode(true);
          clone.className = 'fx-coin';
          clone.removeAttribute('style');
          clone.style.width = p1.w + 'px';
          clone.style.height = p1.h + 'px';
          clone.style.visibility = 'hidden';
          layer.appendChild(clone);
          const dx = Math.abs(p1.x - p0.x);
          const top = Math.min(p0.y, p1.y) - (56 + dx * 0.38) * arc;
          const colour = colourOf(to);
          flights.add({
            clone, colour, p0, p1, w: p1.w, h: p1.h,
            c: { x: (p0.x + p1.x) / 2, y: top },
            start: t0 + i * stagger, dur: dur + Math.min(160, dx * 0.25),
            turns, spin: (p1.x >= p0.x ? 1 : -1) * (8 + Math.random() * 10), trail: [],
            onLaunch: i === 0 ? launch : null,
            land: () => {
              to.style.visibility = '';
              // The bounce replaces the fade-in it would otherwise replay afterwards.
              to.style.animation = 'none';
              void to.offsetWidth;
              to.style.animation = '';
              to.classList.add('land');
              setTimeout(() => { to.style.animation = 'none'; to.classList.remove('land'); }, 360);
              spark(p1.x, p1.y - p1.h * 0.2, colour, { speed: 90, life: 460, size: 2.4, n: 7 });
              if (sound) host.sound(`${sound}${Math.min(landed, 6)}`);
              if (haptics) haptic(haptics);
              if (++landed === pairs.length) resolve();
            },
          });
        });
        run();
      });
    },

    /**
     * Coins that leave the board (a cash-in): clones fly from `from` rects to a
     * point (the progress bar), shrinking and fading in a shower of sparkles.
     */
    collect(items, target, { dur = 520, stagger = 55 } = {}) {
      if (!items.length || reduced()) return Promise.resolve();
      const fr = frame();
      const t0 = performance.now();
      const end = local(target, fr);
      return new Promise((resolve) => {
        let done = 0;
        items.forEach((it, i) => {
          const p0 = local(it.rect, fr);
          const clone = it.chip.cloneNode(true);
          clone.className = 'fx-coin';
          clone.removeAttribute('style');
          clone.style.width = p0.w + 'px'; clone.style.height = p0.h + 'px';
          clone.style.visibility = 'hidden';
          layer.appendChild(clone);
          const colour = colourOf(it.chip);
          flights.add({
            clone, colour, p0, p1: { x: end.x, y: end.y }, w: p0.w, h: p0.h,
            c: { x: (p0.x + end.x) / 2 + (i % 2 ? 30 : -30), y: Math.min(p0.y, end.y) - 40 },
            start: t0 + i * stagger, dur, turns: 3, spin: 20, trail: [],
            land: () => {
              spark(end.x, end.y, colour, { speed: 120, life: 520, size: 2.6, n: 9 });
              host.sound(`chime${Math.min(i, 6)}`);
              if (++done === items.length) resolve();
            },
          });
        });
        run();
      });
    },

    burst(rect, colour = GOLD, n = 18) {
      if (reduced()) return;
      const p = local(rect, frame());
      spark(p.x, p.y, colour, { speed: 150, life: 600, size: 2.8, n });
      run();
    },
  };
}

/** The sounds this effect plays, registered with the shell (manifest `sounds`). */
const STEPS = [0, 2, 4, 7, 9, 12, 14];        // a pentatonic climb: each coin a step higher

export const FX_SOUNDS = Object.fromEntries([
  // Landing: a bright coin clink on a soft wooden knock, rising coin by coin.
  ...STEPS.map((s, i) => [`land${i}`, (t, { tone, clink }) => {
    const p = 2 ** (s / 12);
    clink(t, 0.95 * p, 0.17);
    tone(330 * p, t, 0.06, { type: 'sine', gain: 0.1, slide: 0.55 });
  }]),
  // Cash-in: coins arriving at the bar, a glassy chime per coin.
  ...STEPS.map((s, i) => [`chime${i}`, (t, { tone, N }) => {
    tone(N(s + 12), t, 0.28, { type: 'triangle', gain: 0.11 });
    tone(N(s + 19), t + 0.02, 0.18, { type: 'sine', gain: 0.06 });
  }]),
  // Lift-off: a short airy whoosh.
  ['swoosh', (t, { noise }) => noise(t, 0.2, { gain: 0.06, from: 700, to: 3400, q: 0.8 })],
]);

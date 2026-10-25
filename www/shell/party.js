/**
 * Fireworks and confetti for the big moments (a level beaten), drawn on one
 * canvas over a celebration card. Pointer events pass through it, and it
 * stops itself when the card goes.
 *
 *   const party = startParty(canvas, { onBurst })
 *   party.firework(x, y)          one burst, in canvas pixels (0..1 also fine)
 *   party.confetti(n)             a shower from the top
 *   party.stop()
 */

const PALETTE = ['#ffcf3a', '#ff6fa5', '#5ec8ff', '#7be07b', '#b48bff', '#ff9f3a', '#ffffff'];
const CONFETTI = ['#ffcf3a', '#ff6fa5', '#5ec8ff', '#7be07b', '#b48bff', '#ff9f3a'];

export const reducedMotion = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function startParty(canvas) {
  const g = canvas.getContext('2d');
  const sparks = [];       // firework particles
  const bits = [];         // confetti
  let raf = 0;
  let last = 0;
  let stopped = false;
  let W = 0, H = 0;

  function fit() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function star(x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = rot + (i * Math.PI) / 5;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  function tick(now) {
    if (stopped) return;
    const dt = Math.min(40, now - (last || now)) / 1000;
    last = now;
    fit();
    g.clearRect(0, 0, W, H);

    // Fireworks: bright heads with short fading tails, falling slowly.
    g.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 70 * dt;
      const px = p.x, py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.age / p.life;
      g.globalAlpha = k;
      g.strokeStyle = p.c; g.lineWidth = p.w * k + 0.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(px - p.vx * 0.04, py - p.vy * 0.04); g.lineTo(p.x, p.y); g.stroke();
      if (p.star && Math.random() < 0.5) { g.fillStyle = '#fff6c8'; star(p.x, p.y, 2.6 * k + 1, p.age * 6); }
    }
    g.globalCompositeOperation = 'source-over';

    // Confetti: tumbling paper, swaying as it falls.
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.t += dt;
      b.vy = Math.min(b.vy + 220 * dt, 140);
      b.x += (b.vx + Math.sin(b.t * b.sway) * 30) * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.y > H + 20) { bits.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, (H + 20 - b.y) / 80);
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      g.scale(1, Math.abs(Math.cos(b.t * b.flip)) * 0.9 + 0.1);
      g.fillStyle = b.c;
      if (b.round) { g.beginPath(); g.arc(0, 0, b.w / 2, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
    g.globalAlpha = 1;

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
  fit();

  return {
    /** A burst at (x, y): fractions of the canvas, or pixels. */
    firework(x, y, { n = 46, power = 1 } = {}) {
      if (stopped) return;
      fit();
      const cx = x <= 1 ? x * W : x, cy = y <= 1 ? y * H : y;
      const c1 = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const c2 = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const v = (150 + Math.random() * 110) * power;
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0,
          life: 0.9 + Math.random() * 0.5, c: i % 3 ? c1 : c2, w: 2.6, star: i % 4 === 0 });
      }
      // A white flash at the centre.
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ x: cx, y: cy, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, age: 0, life: 0.35, c: '#ffffff', w: 5, star: false });
      }
    },

    /** n pieces of confetti from across the top (and a few from the sides). */
    confetti(n = 60) {
      if (stopped) return;
      fit();
      for (let i = 0; i < n; i++) {
        const side = Math.random() < 0.25;
        const left = Math.random() < 0.5;
        bits.push({
          x: side ? (left ? -10 : W + 10) : Math.random() * W,
          y: side ? H * (0.2 + Math.random() * 0.3) : -20 - Math.random() * H * 0.4,
          vx: side ? (left ? 1 : -1) * (120 + Math.random() * 140) : (Math.random() - 0.5) * 60,
          vy: side ? -160 - Math.random() * 120 : 40 + Math.random() * 60,
          w: 6 + Math.random() * 5, h: 9 + Math.random() * 6, round: Math.random() < 0.18,
          c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
          rot: Math.random() * 6, spin: (Math.random() - 0.5) * 8,
          t: Math.random() * 3, sway: 2 + Math.random() * 3, flip: 3 + Math.random() * 5,
        });
      }
    },

    stop() { stopped = true; cancelAnimationFrame(raf); g.clearRect(0, 0, W, H); },
  };
}

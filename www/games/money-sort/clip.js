/**
 * The Puzzle of the Day as a short portrait video: the board, every move with
 * its coins arcing over, each cash-in, and the solved card at the end.
 *
 * One renderer, two uses:
 *   - the player's share clip, recorded on the phone (recordClip, below);
 *   - the daily solution Short, rendered frame by frame on a server
 *     (tools/daily-short/render.mjs) and uploaded to YouTube.
 * Both draw with drawFrame(), so the Short shows exactly what players see.
 *
 * Pure canvas: art comes in as loaded images, so nothing here touches the
 * shell or the page.
 */

import { applyMove, CAP } from './puzzle.js';

const TIMING = {
  // the player's clip: brisk, it's their own solve
  player: { intro: 1.5, lift: 0.1, fly: 0.38, settle: 0.12, bank: 0.5, outro: 2.8 },
  // the daily Short: time to read the puzzle, and to follow each move
  solution: { intro: 3.2, lift: 0.14, fly: 0.5, settle: 0.2, bank: 0.6, outro: 3.4 },
};

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const money = (n) => '$' + n.toLocaleString('en-US');

/**
 * Lay the solve out in time: each move's start, its coins, the board before,
 * mid (moved, not yet cashed in) and after. Also the sound cues, for the Short.
 */
export function buildTimeline({ board, moves, mode = 'player' }) {
  const T = TIMING[mode];
  const steps = [];
  const cues = [];
  let cols = board.map((c) => [...c]);
  let t = T.intro;
  for (const [from, to] of moves) {
    const r = applyMove(cols, from, to);
    if (!r) break;
    // The board with the coins moved but nothing cashed in yet.
    const mid = cols.map((c) => [...c]);
    for (let k = 0; k < r.count; k++) mid[to].push(mid[from].pop());
    const dur = T.lift + T.fly + T.settle + (r.banked.length ? T.bank : 0);
    steps.push({ t0: t, dur, from, to, count: r.count, value: r.value, before: cols, mid, after: r.cols, banked: r.banked });
    cues.push({ t, sound: 'swoosh' });
    for (let k = 0; k < r.count; k++) cues.push({ t: t + T.lift + T.fly * 0.85 + k * 0.06, sound: `land${Math.min(6, k)}` });
    if (r.banked.length) cues.push({ t: t + T.lift + T.fly + T.settle, sound: 'bank' });
    cols = r.cols;
    t += dur;
  }
  cues.push({ t: t + 0.15, sound: 'fanfare' });
  return { T, steps, end: t, duration: t + T.outro, cues, board, mode };
}

/* ---------------- layout ---------------- */

function layout(W, H, n) {
  const gap = W * 0.026;
  const tubeW = Math.min(W * 0.155, (W * 0.92 - gap * (n - 1)) / n);
  const chip = tubeW * 0.74;
  const step = chip * 0.98;
  const rim = tubeW * 97 / 407, base = tubeW * 150 / 407;
  const tubeH = rim + step * CAP + base;
  const rowW = n * tubeW + (n - 1) * gap;
  const x0 = (W - rowW) / 2;
  const top = H * 0.33;
  const tubes = Array.from({ length: n }, (_, i) => ({ x: x0 + i * (tubeW + gap), y: top, w: tubeW, h: tubeH }));
  // Centre of slot k (0 = bottom) in tube i.
  const slot = (i, k) => ({ x: tubes[i].x + tubeW / 2, y: top + tubeH - base - step * (k + 0.5) });
  return { tubes, chip, slot, tubeW, tubeH, top };
}

/* ---------------- drawing ---------------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** tube.png is 407 wide: a rim of 97, glass walls, a rounded base of 163; the middle stretches. */
function drawTube(ctx, img, x, y, w, h, glow = 0) {
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(105, 203, 103, ${0.85 * glow})`;
    ctx.shadowBlur = w * 0.5 * glow;
  }
  if (img?.width) {
    const sw = img.width, sh = img.height;
    const k = w / sw;
    const rimS = 97, baseS = 163;
    const rimD = rimS * k, baseD = baseS * k;
    ctx.drawImage(img, 0, 0, sw, rimS, x, y, w, rimD);
    ctx.drawImage(img, 0, rimS, sw, sh - rimS - baseS, x, y + rimD, w, h - rimD - baseD);
    ctx.drawImage(img, 0, sh - baseS, sw, baseS, x, y + h - baseD, w, baseD);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    roundRect(ctx, x, y, w, h, w / 2);
    ctx.fill();
  }
  if (glow > 0) ctx.restore();
}

function drawChip(ctx, imgs, value, cx, cy, d, alpha = 1, scale = 1) {
  const img = imgs.chips[value];
  const s = d * scale;
  ctx.globalAlpha = alpha;
  if (img?.width) ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
  else {
    ctx.fillStyle = '#eeb420';
    ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3205';
    ctx.font = `800 ${s * 0.32}px Nunito, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$' + value, cx, cy);
  }
  ctx.globalAlpha = 1;
}

function text(ctx, str, x, y, { size, weight = 900, color = '#54393e', align = 'center', font = 'Nunito', stroke, alpha = 1, max = 0 }) {
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}, ui-rounded, sans-serif`;
  if (max && ctx.measureText(str).width > max) {
    size *= max / ctx.measureText(str).width;
    ctx.font = `${weight} ${size}px ${font}, ui-rounded, sans-serif`;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

function pill(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
}

function background(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fff6e2');
  g.addColorStop(0.55, '#fbecd2');
  g.addColorStop(1, '#f3dcbc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Soft paw prints, scattered the same way every frame.
  ctx.fillStyle = 'rgba(203, 160, 120, .10)';
  for (let i = 0; i < 18; i++) {
    const px = ((i * 397) % 1000) / 1000 * W, py = ((i * 613 + 140) % 1000) / 1000 * H, r = W * 0.018;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.arc(px + (k - 1.5) * r * 0.9, py - r * 1.35 + Math.abs(k - 1.5) * r * 0.35, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Where the board stands at time t: the columns to draw, coins in flight, glows. */
function stateAt(tl, t) {
  const { steps, T } = tl;
  if (!steps.length || t < steps[0].t0) return { cols: tl.board, moved: 0, flying: null, banking: null };
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (t >= s.t0 + s.dur) continue;
    const u = t - s.t0;
    if (u < T.lift) return { cols: s.before, moved: i, lift: { col: s.from, count: s.count, k: u / T.lift } };
    if (u < T.lift + T.fly) {
      const src = s.before.map((c) => [...c]);
      src[s.from] = src[s.from].slice(0, src[s.from].length - s.count);
      return { cols: src, moved: i, flying: { s, k: (u - T.lift) / T.fly } };
    }
    if (u < T.lift + T.fly + T.settle || !s.banked.length) return { cols: s.mid, moved: i + 1, settle: { col: s.to, k: (u - T.lift - T.fly) / T.settle } };
    const k = (u - T.lift - T.fly - T.settle) / T.bank;
    return { cols: s.mid, moved: i + 1, banking: { s, k } };
  }
  return { cols: steps[steps.length - 1].after, moved: steps.length, done: true };
}

/**
 * Draw one frame. `o`: { number, day, par, used (moves taken), mode,
 * imgs: { chips: {1: img, 5: img…}, tube, logo, cat } }.
 */
export function drawFrame(ctx, W, H, tl, t, o) {
  const { imgs } = o;
  const n = tl.board.length;
  const L = layout(W, H, n);
  const st = stateAt(tl, t);
  const solution = tl.mode === 'solution';
  ctx.clearRect(0, 0, W, H);
  background(ctx, W, H);

  // Title block.
  const s = W / 1080;
  text(ctx, 'PUZZLE OF THE DAY', W / 2, H * 0.085, { size: 52 * s, color: '#eb7a29', weight: 900 });
  text(ctx, `#${o.number} · ${o.day}`, W / 2, H * 0.135, { size: 84 * s, color: '#54393e', weight: 1000 });

  const introing = t < tl.T.intro;
  const outro = t >= tl.end;
  const line = introing
    ? (solution ? `Can you clear it in ${o.par} moves?` : `Clear the board in ${o.par} moves`)
    : outro ? '' : (solution ? 'Here’s how:' : 'Watch my solve');
  if (line) text(ctx, line, W / 2, H * 0.19, { size: 50 * s, color: '#785044', weight: 800 });

  // The move counter.
  if (!outro) {
    const used = Math.min(st.moved, tl.steps.length);
    pill(ctx, W / 2, H * 0.26, 480 * s, 108 * s, '#54393e');
    text(ctx, `MOVES  ${used} / ${o.par}`, W / 2, H * 0.26 + 2 * s, { size: 54 * s, color: '#fff', weight: 900, max: 420 * s });
  }

  // In the Short, a pause prompt over the intro.
  if (solution && introing) {
    const a = clamp01((t - 0.6) / 0.3) * clamp01((tl.T.intro - t) / 0.3);
    pill(ctx, W / 2, H * 0.71, 640 * s, 110 * s, `rgba(235,122,41,${0.95 * a})`);
    text(ctx, 'Pause and try it first!', W / 2, H * 0.71 + 2 * s, { size: 50 * s, color: '#fff', alpha: a });
  }

  // The worn cat peeks up from the bottom while the board plays.
  const fade = outro ? 1 - clamp01((t - tl.end) / 0.35) : 1;
  if (imgs.peek?.width && fade > 0) {
    const pw = W * 0.38, ph = pw * imgs.peek.height / imgs.peek.width;
    ctx.globalAlpha = fade;
    ctx.drawImage(imgs.peek, W * 0.5 - pw / 2, H - ph * 0.92, pw, ph);
    ctx.globalAlpha = 1;
  }

  // Tubes and their coins.
  const banked = st.banking ? st.banking.s.banked : [];
  ctx.globalAlpha = fade;
  if (fade > 0) L.tubes.forEach((tb, i) => {
    const lifted = st.lift && st.lift.col === i ? -L.chip * 0.25 * ease(st.lift.k) : 0;
    const glow = banked.includes(i) ? Math.sin(Math.PI * st.banking.k) : 0;
    drawTube(ctx, imgs.tube, tb.x, tb.y + (st.lift?.col === i ? lifted * 0.4 : 0), tb.w, tb.h, glow);
    const col = st.cols[i] || [];
    col.forEach((v, k) => {
      const p = L.slot(i, k);
      let dy = 0, alpha = 1, scale = 1;
      if (st.lift && st.lift.col === i && k >= col.length - st.lift.count) dy = lifted;
      if (banked.includes(i)) {
        // The four coins rise and fade into the counter.
        const u = ease(clamp01(st.banking.k * 1.3 - k * 0.08));
        dy = -u * (p.y - H * 0.26);
        alpha = 1 - u;
        scale = 1 - 0.3 * u;
      }
      if (st.settle && st.settle.col === i && k >= col.length - st.settle.count) {
        scale = 1 + 0.08 * Math.sin(Math.PI * st.settle.k);
      }
      drawChip(ctx, imgs, v, p.x, p.y + dy, L.chip, alpha * fade, scale);
      ctx.globalAlpha = fade;
    });
  });

  ctx.globalAlpha = 1;

  // Coins in flight: an arc from where they were to where they land.
  if (st.flying) {
    const { s: m, k } = st.flying;
    const srcLen = m.before[m.from].length, dstLen = m.before[m.to].length;
    for (let j = 0; j < m.count; j++) {
      const kk = clamp01((k - j * 0.12) / (1 - (m.count - 1) * 0.12));
      const a = L.slot(m.from, srcLen - 1 - j);
      a.y -= L.chip * 0.25;
      const b = L.slot(m.to, dstLen + j);
      const e = ease(kk);
      const x = a.x + (b.x - a.x) * e;
      const peak = Math.min(a.y, b.y) - L.chip * 1.6;
      const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * peak + e * e * b.y;
      drawChip(ctx, imgs, m.value, x, y, L.chip, 1, 1 + 0.12 * Math.sin(Math.PI * kk));
    }
  }

  // A cash-in pops its value over the tube.
  if (st.banking) {
    const { s: m, k } = st.banking;
    for (const i of m.banked) {
      const tb = L.tubes[i];
      const v = m.mid[i][0];
      text(ctx, '+' + money(v * 4), tb.x + tb.w / 2, tb.y - L.chip * (0.3 + 0.6 * ease(k)), {
        size: 58 * s, color: '#3c6844', stroke: '#fff', alpha: Math.sin(Math.PI * k),
      });
    }
  }

  // The end: solved, the cat, the call to action.
  if (outro) {
    const u = clamp01((t - tl.end - 0.15) / 0.45);
    const pop = 1 + 0.25 * Math.sin(Math.PI * u) * (1 - u);
    confetti(ctx, W, H, t - tl.end);
    ctx.save();
    ctx.translate(W / 2, H * 0.27);
    ctx.scale(pop, pop);
    text(ctx, 'SOLVED!', 0, 0, { size: 170 * s, color: '#69cb67', stroke: '#2f5a36', alpha: u });
    ctx.restore();
    const how = solution ? `in ${o.par} moves` : `in ${o.used} moves${o.used <= o.par ? ' · perfect!' : ''}`;
    text(ctx, how, W / 2, H * 0.345, { size: 66 * s, color: '#54393e', alpha: u });
    if (imgs.cat?.width) {
      const cw = W * 0.56, ch = cw * imgs.cat.height / imgs.cat.width;
      ctx.globalAlpha = u;
      ctx.drawImage(imgs.cat, W / 2 - cw / 2, H * 0.39 + (1 - u) * 60 * s, cw, ch);
      ctx.globalAlpha = 1;
    }
    const v = clamp01((t - tl.end - 0.6) / 0.4);
    if (imgs.logo?.width) {
      const lw = W * 0.52, lh = lw * imgs.logo.height / imgs.logo.width;
      ctx.globalAlpha = v;
      ctx.drawImage(imgs.logo, W / 2 - lw / 2, H * 0.66, lw, lh);
      ctx.globalAlpha = 1;
    } else text(ctx, 'Cash Paws', W / 2, H * 0.72, { size: 110 * s, alpha: v });
    pill(ctx, W / 2, H * 0.9, 900 * s, 104 * s, `rgba(84,57,62,${v})`);
    text(ctx, solution ? 'New puzzle every day · free on Google Play' : 'Can you beat me? Play Cash Paws', W / 2, H * 0.9 + 2 * s, { size: 42 * s, color: '#fff', weight: 800, alpha: v, max: 840 * s });
  }
}

function confetti(ctx, W, H, t) {
  const colours = ['#eb7a29', '#69cb67', '#eeb420', '#a88fd2', '#dd6a33'];
  for (let i = 0; i < 70; i++) {
    const x0 = ((i * 7919) % 1000) / 1000 * W;
    const speed = 0.35 + ((i * 31) % 10) / 20;
    const y = -40 + t * H * speed * 0.6 + ((i * 131) % 300);
    if (y > H) continue;
    const x = x0 + Math.sin(t * 3 + i) * W * 0.03;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 4 + i);
    ctx.fillStyle = colours[i % colours.length];
    ctx.fillRect(-W * 0.008, -W * 0.004, W * 0.016, W * 0.008);
    ctx.restore();
  }
}

/* ---------------- recording on the phone ---------------- */

/** The best video type this WebView can record: MP4 where it can (shares everywhere), else WebM. */
export function clipType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((x) => { try { return MediaRecorder.isTypeSupported(x); } catch { return false; } }) || null;
}

/**
 * Play the clip on `canvas` in real time while recording it. Resolves a Blob
 * (or null where this phone can't record). `onProgress(0..1)`; `signal` stops it.
 */
export function recordClip(canvas, tl, o, { onProgress, fps = 30, bitrate = 4_000_000 } = {}) {
  const type = clipType();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  if (!type || !canvas.captureStream) return Promise.resolve(null);
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: bitrate });
  const parts = [];
  rec.ondataavailable = (e) => { if (e.data?.size) parts.push(e.data); };
  return new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      resolve(parts.length ? new Blob(parts, { type: type.split(';')[0] }) : null);
    };
    drawFrame(ctx, W, H, tl, 0, o);
    rec.start(250);
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawFrame(ctx, W, H, tl, Math.min(t, tl.duration), o);
      onProgress?.(Math.min(1, t / tl.duration));
      if (t < tl.duration) requestAnimationFrame(tick);
      else setTimeout(() => rec.state !== 'inactive' && rec.stop(), 120);
    };
    requestAnimationFrame(tick);
  });
}

/** Load the art the clip draws, as images: chips (in the player's set), the tube, logo, and the cat cheering and peeking. */
export function loadClipArt(urls) {
  const load = (src) => new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  return Promise.all([
    Promise.all(Object.entries(urls.chips).map(async ([v, u]) => [v, await load(u)])),
    load(urls.tube), load(urls.logo), load(urls.cat), load(urls.peek),
  ]).then(([chips, tube, logo, cat, peek]) => ({ chips: Object.fromEntries(chips), tube, logo, cat, peek }));
}


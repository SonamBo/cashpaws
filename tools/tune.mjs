/**
 * Tuning harness for Money Sort's level pacing and economy. Pass candidate
 * configs as JSON; prints minutes per level, the level-1 forced-drop rate, Hard
 * vs normal loss rates, and two-week difficulty for a returning player.
 *   node tools/tune.mjs '[["current",{}],["faster",{"levelStep":40}]]'
 * See docs/LEVEL-DESIGN.md for how the shipped values were chosen.
 */
import { Game, localWallet, levelKind } from '../www/games/money-sort/engine.js';
import { openBox, emptyBox } from '../www/shell/rewards.js';

const bot = (g) => {
  const ms = g.legalMoves(); if (!ms.length) return null;
  const cap = g.cfg.capacity;
  const sc = ([f, t2]) => { const a = g.columns[f], d = g.columns[t2], c = a[a.length - 1], n = g.movableCount(f, t2);
    if (d.length + n === cap && d.every((v) => v === c)) return 1000; if (d.length && d.every((v) => v === c)) return 500 + d.length;
    if (a.length === n && d.length) return 300; if (d.length) return 100; if (a.length === n) return -50; return 60; };
  return ms.reduce((b, x) => (sc(x) > sc(b) ? x : b), ms[0]);
};
const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : NaN; };

// First session: per-level moves, and the level-1 forced drop.
function firstSession(cfg, N = 250) {
  const moves = Array.from({ length: 25 }, () => []);
  let l1drop = 0;
  const hardLost = [], normLost = [];
  for (let s = 0; s < N; s++) {
    const g = new Game({ seed: s * 7919 + 13, config: cfg, wallet: localWallet(50) });
    let best = 1, start = 0, lostHere = false;
    g.on((e) => { if (e.type === 'level-lost') { lostHere = true; if (e.from === 1) l1drop++; } });
    for (let t = 0; t < 3000 && best < 25; t++) {
      if (g.level > best) { moves[best].push(t - start); (levelKind(best, g.cfg) === 'hard' ? hardLost : normLost).push(lostHere); best = g.level; start = t; lostHere = false; }
      if (g.status === 'locked') { if (g.sortCanHelp && g.canAffordSort) g.sort(); else g.loseLevel(); continue; }
      const m = bot(g); if (!m) break; g.move(m[0], m[1]);
    }
  }
  return { moves: moves.map(med), l1drop: l1drop / N,
           hardLoss: hardLost.filter(Boolean).length / Math.max(1, hardLost.length),
           normLoss: normLost.filter(Boolean).length / Math.max(1, normLost.length) };
}

// Two weeks, coins carried over, daily tasks and two boxes a day.
function twoWeeks(cfg, N = 120, days = 14, perDay = 250) {
  let late = 0, lateDays = 0, level = 0;
  for (let s = 0; s < N; s++) {
    let r = s + 1; const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    const w = localWallet(50);
    const g = new Game({ seed: s * 104729 + 11, config: cfg, wallet: w });
    let lost = false; g.on((e) => { if (e.type === 'level-lost') lost = true; });
    for (let d = 0; d < days; d++) {
      w.earn(155); lost = false;
      for (let t = 0; t < perDay; t++) {
        if (t === 60 || t === 185) w.earn(openBox(emptyBox(), { now: 1, day: 'd', value: g.sortPrice, rand }).coins);
        if (g.status === 'locked') { if (g.sortCanHelp && g.canAffordSort) g.sort(); else g.loseLevel(); continue; }
        const m = bot(g); if (!m) break; g.move(m[0], m[1]);
      }
      if (d >= 3) { lateDays++; if (lost) late++; }
    }
    level += g.level;
  }
  return { late: late / lateDays, level: level / N };
}

const CANDIDATES = JSON.parse(process.argv[2]);
for (const [label, cfg] of CANDIDATES) {
  const a = firstSession(cfg);
  const b = twoWeeks(cfg);
  const mins = (l) => (a.moves[l] * 2.5 / 60).toFixed(1);
  const first10 = a.moves.slice(1, 11).reduce((x, y) => x + y, 0) * 2.5 / 60;
  console.log(`${label.padEnd(26)} min/level L1 ${mins(1)} L3 ${mins(3)} L6 ${mins(6)} L10 ${mins(10)} L16 ${mins(16)} L22 ${mins(22)} | first 10 levels ${first10.toFixed(0)} min | L1 forced drop ${(a.l1drop * 100).toFixed(1)}% | lost a level: hard ${(a.hardLoss * 100).toFixed(0)}% normal ${(a.normLoss * 100).toFixed(0)}% | 2-wk days lost ${(b.late * 100).toFixed(1)}%, level ${b.level.toFixed(0)}`);
}

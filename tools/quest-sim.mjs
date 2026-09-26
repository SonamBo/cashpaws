/**
 * Bell Quest economy: the two-week returning-player model from tune.mjs, with
 * back-to-back quests from level 8. Prints quest win rate, coins a win pays,
 * and what the prize does to difficulty (days losing a level).
 *   node tools/quest-sim.mjs 0 10 20 30     (grand prize in Sort prices; 0 = no quest)
 */
import { Game, localWallet } from '../www/games/money-sort/engine.js';
import { openBox, emptyBox } from '../www/shell/rewards.js';
import * as Q from '../www/shell/quest.js';
const STEPS_ = Number(process.env.STEPS || 7), HOURS = Number(process.env.HOURS || 24);

const bot = (g) => {
  const ms = g.legalMoves(); if (!ms.length) return null;
  const cap = g.cfg.capacity;
  const sc = ([f, t2]) => { const a = g.columns[f], d = g.columns[t2], c = a[a.length - 1], n = g.movableCount(f, t2);
    if (d.length + n === cap && d.every((v) => v === c)) return 1000; if (d.length && d.every((v) => v === c)) return 500 + d.length;
    if (a.length === n && d.length) return 300; if (d.length) return 100; if (a.length === n) return -50; return 60; };
  return ms.reduce((b, x) => (sc(x) > sc(b) ? x : b), ms[0]);
};

function run(shares, N = 120, days = 14, perDay = Number(process.env.PERDAY || 250)) {
  let late = 0, lateDays = 0, level = 0, played = 0, won = 0, paid = 0, steps = [], expired = 0, knocked = 0;
  for (let s = 0; s < N; s++) {
    let r = s + 1; const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    const w = localWallet(50);
    const g = new Game({ seed: s * 104729 + 11, config: {}, wallet: w });
    const q = Q.emptyQuest();
    let lost = false, clock = 0;
    g.on((e) => {
      if (e.type === 'level-lost') { lost = true; if (Q.knockOut(q)) { knocked++; steps.push(q.step); } }
      if (e.type === 'levelup' && Q.isActive(q)) Q.advance(q, clock);
    });
    for (let d = 0; d < days; d++) {
      w.earn(155); lost = false;
      for (let t = 0; t < perDay; t++) {
        clock = d * 86400000 + t * 2500;
        if (t === 60 || t === 185) w.earn(openBox(emptyBox(), { now: 1, day: 'd', value: g.sortPrice, rand }).coins);
        if (shares) {
          Q.sync(q, { now: clock, level: g.level });
          if (q.status === 'won') { const c = Q.claim(q); w.earn(c); paid += c; won++; steps.push(7); }
          if (q.status === 'expired') expired++;
          if (q.status === 'lost' || q.status === 'expired') Q.acknowledge(q);
          if (q.status === 'offer') { Q.start(q, { now: clock, value: g.sortPrice * shares / Q.GRAND_SHARES, seed: s * 31 + t + d * 977, steps: STEPS_, durationMs: HOURS * 3600000 }); played++; }
        }
        if (g.status === 'locked') { if (g.sortCanHelp && g.canAffordSort) g.sort(); else g.loseLevel(); continue; }
        const m = bot(g); if (!m) break; g.move(m[0], m[1]);
      }
      if (d >= 3) { lateDays++; if (lost) late++; }
    }
    level += g.level;
  }
  const f = (x) => (100 * x).toFixed(1) + '%';
  console.log(`${STEPS_} steps ${HOURS}h ${process.env.PERDAY || 250}/day grand=${String(shares).padStart(2)}x Sort  days lost ${f(late / lateDays)}  level ${(level / N).toFixed(1)}`
    + (shares ? `  quests/player ${(played / N).toFixed(1)}  win ${f(won / Math.max(1, played))}  avg win ${Math.round(paid / Math.max(1, won))} coins  knocked ${f(knocked / Math.max(1, played))}  expired ${f(expired / Math.max(1, played))}` : ''));
}

for (const a of (process.argv.slice(2).length ? process.argv.slice(2) : ['0', '20']).map(Number)) run(a);

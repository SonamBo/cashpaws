/**
 * Pacing probe. How many turns does a level actually take, and how does the
 * board's chip load trend? Feeds the Stage 6 tuning pass.
 */

import { Game } from '../www/js/engine.js';

const GAMES = Number(process.argv[2] || 400);
const HORIZON = 400; // a generous single session

function greedy(g) {
  const moves = g.legalMoves();
  if (!moves.length) return null;
  const cap = g.cfg.capacity;
  const score = ([f, t]) => {
    const src = g.columns[f], dst = g.columns[t], chip = src[src.length - 1];
    if (dst.length === cap - 1 && dst.every((v) => v === chip)) return 1000;
    if (dst.length > 0 && dst.every((v) => v === chip)) return 500 + dst.length * 10;
    if (src.length === 1 && dst.length > 0) return 300;
    if (dst.length > 0) return 100;
    if (src.length === 1) return -50;
    return src[src.length - 2] === chip ? 60 : 40;
  };
  return moves.reduce((b, m) => (score(m) > score(b) ? m : b), moves[0]);
}

const reach = {};  // level -> [turns taken to first reach it]
const loadAt = {}; // turn bucket -> [chips on board]
let locksInHorizon = 0, lossesInHorizon = 0;

for (let s = 0; s < GAMES; s++) {
  const g = new Game({ seed: s * 104729 + 7 });
  const first = { 1: 0 };
  g.on((e) => {
    if (e.type === 'levelup' && first[e.level] === undefined) first[e.level] = g.turn;
    if (e.type === 'lock') locksInHorizon++;
    if (e.type === 'level-lost') lossesInHorizon++;
  });

  for (let turn = 0; turn < HORIZON; turn++) {
    if (g.status === 'locked') {
      if (g.shuffleCanHelp && g.canAffordShuffle) g.shuffle();
      else g.loseLevel();
    }
    const m = greedy(g);
    if (!m) break;
    g.move(m[0], m[1]);
    if (turn % 50 === 0) (loadAt[turn] ||= []).push(g.chipsOnBoard / (g.columnCount * g.cfg.capacity));
  }
  for (const [lv, t] of Object.entries(first)) (reach[lv] ||= []).push(t);
}

const pct = (arr) => ((arr.length / GAMES) * 100).toFixed(0);
const med = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };

console.log(`Pacing over ${GAMES} games, ${HORIZON}-turn horizon\n`);
console.log('  level   reached by   median turn');
Object.keys(reach).sort((a, b) => a - b).forEach((lv) => {
  console.log(`   LV ${String(lv).padStart(2)}      ${String(pct(reach[lv])).padStart(3)}%        ${String(med(reach[lv])).padStart(4)}`);
});

console.log('\n  board load (share of slots filled)');
Object.keys(loadAt).sort((a, b) => a - b).forEach((t) => {
  const a = loadAt[t];
  const m = a.reduce((n, v) => n + v, 0) / a.length;
  const bar = '#'.repeat(Math.round(m * 30));
  console.log(`   turn ${String(t).padStart(3)}  ${(m * 100).toFixed(0).padStart(3)}%  ${bar}`);
});

console.log(`\n  locks in horizon   ${(locksInHorizon / GAMES).toFixed(2)} per game`);
console.log(`  level losses       ${(lossesInHorizon / GAMES).toFixed(2)} per game`);

#!/usr/bin/env node
/**
 * What each cat actually does to the game.
 *
 * The claim in cats.js is that no cat is strictly better than another. That is
 * a claim, not a fact, so it gets measured: every cat plays the same seeds with
 * the same bot, and the spread is reported. Run after touching any perk.
 */

import { Game } from '../www/js/engine.js';
import { CATS } from '../www/js/cats.js';

const GAMES = Number(process.argv[2] || 400);
const HORIZON = 400;
const UNDO_RATE = 0.12;

function greedy(g) {
  const moves = g.legalMoves();
  if (!moves.length) return null;
  const cap = g.cfg.capacity;
  const score = ([f, t]) => {
    const s = g.columns[f], d = g.columns[t], c = s[s.length - 1];
    const n = g.movableCount(f, t);
    if (d.length + n === cap && d.every((v) => v === c)) return 1000 + n;
    if (d.length > 0 && d.every((v) => v === c)) return 500 + (d.length + n) * 10;
    if (s.length === n && d.length > 0) return 300;
    if (d.length > 0) return 100;
    if (s.length === n) return -50;
    return 60;
  };
  return moves.reduce((b, m) => (score(m) > score(b) ? m : b), moves[0]);
}

function run(seed, perk) {
  const g = new Game({ seed, perk });
  let locks = 0, losses = 0, banks = 0, sorts = 0, undos = 0;
  g.on((e) => {
    if (e.type === 'bank') banks++;
    if (e.type === 'lock') locks++;
    if (e.type === 'sort') sorts++;
    if (e.type === 'level-lost') losses++;
  });
  for (let t = 0; t < HORIZON; t++) {
    if (g.status === 'locked') {
      if (g.sortCanHelp && g.canAffordSort) g.sort();
      else g.loseLevel();
      continue;
    }
    if (g.canUndo && Math.random() < UNDO_RATE) { if (g.undo().ok) undos++; continue; }
    const m = greedy(g);
    if (!m) break;
    g.move(m[0], m[1]);
  }
  return { locks, losses, banks, sorts, undos, level: g.level, net: g.netWorth, coins: g.coins };
}

console.log(`Each cat over ${GAMES} games, ${HORIZON} turns, identical seeds\n`);
console.log('cat          perk                                  lost   peak LV   net worth   coins left   undos');

const rows = [];
for (const cat of CATS) {
  const rs = Array.from({ length: GAMES }, (_, i) => run(i * 9721 + 5, cat.perk));
  const avg = (k) => rs.reduce((n, r) => n + r[k], 0) / GAMES;
  const lostPct = (rs.filter((r) => r.losses > 0).length / GAMES) * 100;
  rows.push({ cat, lostPct, level: avg('level'), net: avg('net'), coins: avg('coins') });
  const perk = (cat.perkText || '').slice(0, 34);
  console.log(
    `${cat.name.padEnd(12)} ${perk.padEnd(35)}` +
    `${lostPct.toFixed(0).padStart(5)}%   ` +
    `${avg('level').toFixed(2).padStart(7)}   ` +
    `${('$' + avg('net').toFixed(0)).padStart(9)}   ` +
    `${avg('coins').toFixed(0).padStart(9)}   ` +
    `${avg('undos').toFixed(1).padStart(5)}`
  );
}

const base = rows[0];
const worst = rows.reduce((a, b) => (b.lostPct > a.lostPct ? b : a));
const best = rows.reduce((a, b) => (b.lostPct < a.lostPct ? b : a));
console.log(`\nbaseline (${base.cat.name}) loses a level in ${base.lostPct.toFixed(0)}% of runs.`);
console.log(`spread across the roster: ${best.lostPct.toFixed(0)}% to ${worst.lostPct.toFixed(0)}%`);
console.log(best.lostPct < base.lostPct - 12
  ? `\n${best.cat.name} makes the game markedly easier than the rest — worth reining in.`
  : '\nNo cat runs away with it.');

#!/usr/bin/env node
/**
 * Make the Puzzle of the Day list that ships with Money Sort:
 * www/games/money-sort/puzzles.js, one line per date from START to END.
 *
 *   node tools/daily-short/make-puzzles.mjs [end-date]
 *
 * Re-running gives the same puzzles (each date has its own seed), so dates
 * already played never change. Extend END before the list runs out; past it
 * the game makes the puzzle on the phone with the same code.
 */
import { writeFileSync } from 'node:fs';
import { makePuzzle, encode, replay, addDays, daysBetween } from '../../www/games/money-sort/puzzle.js';

const START = '2026-10-25';
const END = process.argv[2] || '2029-12-31';
const out = new URL('../../www/games/money-sort/puzzles.js', import.meta.url);

const lines = [];
for (let d = START; daysBetween(d, END) >= 0; d = addDays(d, 1)) {
  const p = makePuzzle(d);
  if (!replay(p.board, p.solution).ok) throw new Error(`${d}: the solution does not clear the board`);
  lines.push(encode(p));
  if (lines.length % 100 === 0) process.stdout.write(`${d} `);
}
writeFileSync(out, `/* Made by tools/daily-short/make-puzzles.mjs; do not edit by hand.
   One line per date from start: the board (tubes split by |, coins bottom
   first), the fewest moves, and a solution in that many (from-to). */
export default {
  start: '${START}',
  lines: [
${lines.map((l) => `    '${l}',`).join('\n')}
  ],
};
`);
console.log(`\n${lines.length} puzzles, ${START} to ${END}`);

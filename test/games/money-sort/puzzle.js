#!/usr/bin/env node
/**
 * Puzzle of the Day (1.20.0): the rules, the solver, every shipped puzzle,
 * dates, and the streak and rewards.
 * Run: node test/games/money-sort/puzzle.js
 */
import {
  applyMove, canMove, isSolved, solve, replay, makePuzzle, puzzleFor, encode, decode,
  localDateKey, addDays, daysBetween, weekday, DAY_SPECS, CAP,
} from '../../../www/games/money-sort/puzzle.js';
import data from '../../../www/games/money-sort/puzzles.js';
import { potdState, liveStreak, recordSolve, streakBonus } from '../../../www/games/money-sort/potd.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

/* ---------------- rules ---------------- */
{
  const b = [[5, 5, 1], [1], []];
  ok('a coin moves onto a matching top', canMove(b, 0, 1) && canMove(b, 1, 0) && !canMove([[5, 5], [1]], 0, 1));
  const r = applyMove(b, 0, 2);
  ok('only the top coin moves when the one under it differs', r.count === 1 && r.cols[2].join() === '1');
  const r1 = applyMove([[1, 5, 5], []], 0, 1);
  ok('the whole run of matching coins moves, as one move', r1.count === 2 && r1.cols[1].join() === '5,5');
  const r3 = applyMove([[1, 1, 1], [5, 1, 1], []], 0, 1);
  ok('a run moves only as far as there is room', r3.count === 1 && r3.cols[0].length === 2 && r3.cols[1].length === 4);
  const r2 = applyMove([[5, 1, 1], [1, 1], []], 0, 1);
  ok('a full tube of one value cashes in and empties', r2.count === 2 && r2.banked.join() === '1' && r2.cols[1].length === 0 && r2.value === 1);
  ok('nothing moves onto a full tube', !canMove([[1], [2, 2, 2, 5]], 0, 1));
  ok('nothing moves onto a different top', !canMove([[1], [2]], 0, 1));
  ok('any coin moves onto an empty tube', canMove([[1], []], 0, 1));
  ok('an illegal move returns null', applyMove([[1], [2]], 0, 1) === null);
  ok('the original board is never changed', b[0].join() === '5,5,1');
  ok('an empty board is solved', isSolved([[], [], []]));
}

/* ---------------- the solver ---------------- */
{
  const b = [[5, 1, 1, 1], [1, 5, 5, 5], []];
  const s = solve(b);
  ok('the solver clears a small board', s && replay(b, s).ok);
  ok('in the fewest moves (3 here)', s?.length === 3);
  ok('an impossible board has no solution', solve([[1, 5, 1, 5], [5, 1, 5, 1]]) === null);
}

/* ---------------- the shipped list ---------------- */
{
  ok('the list starts on 25 Oct 2026', data.start === '2026-10-25');
  ok('and runs to the end of 2029', data.lines.length === daysBetween('2026-10-25', '2029-12-31') + 1);
  let bad = 0, off = 0, unfair = 0;
  data.lines.forEach((line, i) => {
    const date = addDays(data.start, i);
    const p = decode(date, line);
    const spec = DAY_SPECS[weekday(date)];
    if (!replay(p.board, p.solution).ok || p.solution.length !== p.par) bad++;
    if (p.par < spec.par[0] || p.par > spec.par[1]) off++;
    const coins = p.board.flat();
    const counts = {};
    coins.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    if (Object.values(counts).some((n) => n !== CAP) || Object.keys(counts).length !== spec.values) unfair++;
  });
  ok('every shipped solution clears its board in exactly par moves', bad === 0);
  ok('every par falls in its weekday\'s range', off === 0);
  ok('every board has four of each value, as many values as its weekday says', unfair === 0);
  // Spot-check that the list matches the generator (so the Short and phones past 2029 agree).
  for (const i of [0, 100, 777]) {
    const date = addDays(data.start, i);
    ok(`day ${i} matches the generator`, encode(makePuzzle(date)) === data.lines[i]);
  }
}

/* ---------------- dates ---------------- */
{
  ok('25 Oct 2026 is a Sunday', weekday('2026-10-25') === 0);
  ok('addDays crosses months and years', addDays('2026-12-31', 1) === '2027-01-01' && addDays('2027-03-01', -1) === '2027-02-28');
  ok('the local date key is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(localDateKey()) && localDateKey(new Date(2026, 0, 5)) === '2026-01-05');
  const p = puzzleFor('2026-10-26', data);
  ok('puzzle #2 is Monday 26 Oct', p.number === 2 && p.day === 'Monday' && p.coins === DAY_SPECS[1].coins);
  const late = puzzleFor('2030-01-02', data);
  ok('past the list, the puzzle is made on the spot', late.par > 0 && replay(late.board, late.solution).ok);
  ok('Sunday pays more than Monday', DAY_SPECS[0].coins > DAY_SPECS[1].coins);
}

/* ---------------- streak and rewards ---------------- */
{
  const s = potdState(null);
  const p = { coins: 40 };
  const a = recordSolve(s, p, [[0, 1]], '2026-10-26');
  ok('a first solve starts a streak with no bonus', a.streak === 1 && a.bonus === 0 && a.coins === 40);
  ok('solving the same day again pays nothing', recordSolve(s, p, [[0, 1]], '2026-10-26') === null);
  const b = recordSolve(s, p, [], '2026-10-27');
  ok('the next day continues the streak, with a bonus', b.streak === 2 && b.bonus === 10);
  ok('the streak lives on through the next day', liveStreak(s, '2026-10-28') === 2);
  ok('and lapses after a missed day', liveStreak(s, '2026-10-29') === 0);
  const c = recordSolve(s, p, [], '2026-10-29');
  ok('a missed day starts the streak again', c.streak === 1 && s.best === 2);
  ok('the bonus is capped', streakBonus(30) === 50);
  ok('the solve is kept for the share clip', s.days['2026-10-26'].moves.length === 1);
  for (let i = 0; i < 20; i++) s.days[addDays('2026-11-01', i)] = { tries: 1, solved: false };
  ok('the save keeps only recent days', Object.keys(potdState(s).days).length === 10);
  ok('without changing the record it was given', Object.keys(s.days).length > 10);
}

console.log(`Puzzle of the Day tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

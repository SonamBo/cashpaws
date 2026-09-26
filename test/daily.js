#!/usr/bin/env node
/**
 * Daily tasks: the rules, tested without a browser.
 * Run: node test/daily.js
 */

import {
  emptyDaily, ensureDay, progressOf, isDone, claimable, claimTask, claimBonus,
  newlyDone, localDay, dayBefore, REWARD, BONUS,
} from '../www/shell/daily.js';
import moneySort from '../www/games/money-sort/index.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

const game = {
  id: 'g',
  tasks: [
    { id: 'e1', tier: 'easy', stat: 'a', target: 3, text: 'e1' },
    { id: 'e2', tier: 'easy', stat: 'a', target: 5, text: 'e2' },
    { id: 'm1', tier: 'medium', stat: 'b', target: 2, text: 'm1' },
    { id: 'm2', tier: 'medium', stat: 'b', target: 4, text: 'm2' },
    { id: 'h1', tier: 'hard', stat: 'c', target: 1, text: 'h1' },
    { id: 'h2', tier: 'hard', stat: 'd', target: 1, text: 'h2' },
  ],
};

/* ---- dates ---- */
ok('dayBefore crosses a month', dayBefore('2026-10-01') === '2026-09-30');
ok('dayBefore crosses a year', dayBefore('2027-01-01') === '2026-12-31');
ok('dayBefore handles a leap day', dayBefore('2028-03-01') === '2028-02-29');
ok('localDay uses local fields, not UTC', localDay(new Date(2026, 8, 26, 23, 59)) === '2026-09-26');

/* ---- drawing ---- */
{
  const d = emptyDaily();
  ok('first open draws a set', ensureDay(d, game, {}, '2026-09-26') === true);
  ok('one task per tier', d.tasks.map((t) => t.tier).join() === 'easy,medium,hard');
  const again = JSON.stringify(d.tasks);
  ok('reopening the same day does not redraw', ensureDay(d, game, {}, '2026-09-26') === false);
  ok('and leaves the set unchanged', JSON.stringify(d.tasks) === again);

  const e = emptyDaily();
  ensureDay(e, game, {}, '2026-09-26');
  ok('the draw is deterministic for a day', JSON.stringify(e.tasks) === again);

  const prev = new Set(d.tasks.map((t) => t.id));
  ensureDay(d, game, {}, '2026-09-27');
  ok("the next day avoids yesterday's tasks", d.tasks.every((t) => !prev.has(t.id)));
}

/* ---- progress counts from the day's snapshot ---- */
{
  const d = emptyDaily();
  const stats = { a: 40, b: 0, c: 0, d: 0 };
  ensureDay(d, game, stats, '2026-09-26');
  const easy = d.tasks[0];
  ok('a task starts at zero despite lifetime stats', progressOf(easy, stats) === 0);
  stats.a += 2;
  ok('progress counts only what happened today', progressOf(easy, stats) === 2);
  stats.a += 100;
  ok('progress caps at the target', progressOf(easy, stats) === easy.target);
}

/* ---- claiming ---- */
{
  const d = emptyDaily();
  const stats = {};
  ensureDay(d, game, stats, '2026-09-26');
  ok('nothing is claimable at the start', claimable(d, stats) === false);
  ok('an unfinished task pays nothing', claimTask(d, 0, stats) === 0);
  stats.a = 99;
  ok('a finished task is claimable', claimable(d, stats) === true);
  ok('claiming pays by tier', claimTask(d, 0, stats) === REWARD.easy);
  ok('a task pays only once', claimTask(d, 0, stats) === 0);
  ok('the bonus needs all three', claimBonus(d, stats) === 0);
  stats.b = 99; stats.c = 99; stats.d = 99;
  claimTask(d, 1, stats);
  ok('the bonus needs all three claimed, not just done', claimBonus(d, stats) === 0);
  claimTask(d, 2, stats);
  ok('the bonus is claimable once all are claimed', claimable(d, stats) === true);
  ok('the bonus pays', claimBonus(d, stats) === BONUS);
  ok('the bonus pays only once', claimBonus(d, stats) === 0);
  ok('nothing left to claim', claimable(d, stats) === false);
  ok('a full day starts the streak', d.streak === 1);
}

/* ---- streaks ---- */
function finishDay(d, day, stats) {
  ensureDay(d, game, stats, day);
  for (const k of ['a', 'b', 'c', 'd']) stats[k] = (stats[k] || 0) + 99;
  d.tasks.forEach((_, i) => claimTask(d, i, stats));
  claimBonus(d, stats);
}
{
  const d = emptyDaily();
  const stats = {};
  finishDay(d, '2026-09-26', stats);
  finishDay(d, '2026-09-27', stats);
  finishDay(d, '2026-09-28', stats);
  ok('consecutive full days build the streak', d.streak === 3);
  ensureDay(d, game, stats, '2026-09-29');     // opened, not finished
  ok('an unfinished day keeps it until the next draw', d.streak === 3);
  ensureDay(d, game, stats, '2026-09-30');
  ok('a missed day resets the streak', d.streak === 0);
  finishDay(d, '2026-09-30', stats);
  ok('and it starts again from one', d.streak === 1);
  finishDay(d, '2026-10-01', stats);
  ok('a streak carries across a month end', d.streak === 2);
}

/* ---- the clock, and swapping games ---- */
{
  const d = emptyDaily();
  ensureDay(d, game, {}, '2026-09-26');
  const set = JSON.stringify(d.tasks);
  ok('a clock wound backwards draws nothing', ensureDay(d, game, {}, '2026-09-20') === false);
  ok('and keeps the current set', JSON.stringify(d.tasks) === set);
  ok('installing another game redraws', ensureDay(d, { ...game, id: 'other' }, {}, '2026-09-26') === true);
}

/* ---- eligibility: the game can rule tasks out ---- */
{
  const d = emptyDaily();
  ensureDay(d, game, {}, '2026-09-26', (t) => t.id !== 'h1');
  ok('a task the game cannot offer is never drawn', d.tasks.every((t) => t.id !== 'h1'));
  const e = emptyDaily();
  ensureDay(e, { id: 'x', tasks: [{ id: 'only', tier: 'easy', stat: 'a', target: 1, text: 'x' }] }, {}, '2026-09-26');
  ok('a thin catalogue draws what it can', e.tasks.length === 1);
}

/* ---- toasts ---- */
{
  const d = emptyDaily();
  ensureDay(d, game, {}, '2026-09-26');
  const before = { a: 2 }, after = { a: 3 };
  ok('crossing a target is reported once', newlyDone(d, before, after).length === 1);
  ok('staying past it is not reported again', newlyDone(d, after, { a: 4 }).length === 0);
}

/* ---- Money Sort's real catalogue ---- */
{
  const tiers = new Set(moneySort.tasks.map((t) => t.tier));
  ok('money sort has every tier', ['easy', 'medium', 'hard'].every((t) => tiers.has(t)));
  ok('every money sort task names a stat and a target',
     moneySort.tasks.every((t) => t.stat && t.target > 0 && t.text));
  ok('no task asks the player to spend coins', !moneySort.tasks.some((t) => t.stat === 'sorts'));
}

console.log(`Daily tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

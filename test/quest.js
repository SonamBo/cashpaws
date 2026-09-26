#!/usr/bin/env node
/** Bell Quest rules, tested without a browser. Run: node test/quest.js */

import * as Q from '../www/shell/quest.js';
import moneySort from '../www/games/money-sort/index.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const H = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 26, 10);

/* ---- unlocking ---- */
{
  const q = Q.emptyQuest();
  ok('locked below the unlock level', !Q.sync(q, { now: T0, level: 7 }) && q.status === 'none');
  ok('offered once reached', Q.sync(q, { now: T0, level: 8 }) && q.status === 'offer');
  ok('Money Sort opens it after the first Hard level', moneySort.quest.unlockLevel === 8 && moneySort.quest.steps === 7);
  ok('a game can set its own unlock level', (() => {
    const r = Q.emptyQuest(); Q.sync(r, { now: T0, level: 3, unlockLevel: 3 }); return r.status === 'offer';
  })());
}

/* ---- a run to the end ---- */
{
  const q = Q.emptyQuest();
  Q.sync(q, { now: T0, level: 8 });
  ok('cannot advance before starting', Q.advance(q, T0) === 0);
  ok('starts', Q.start(q, { now: T0, value: 300, seed: 42 }));
  ok('cannot start twice', !Q.start(q, { now: T0, value: 300, seed: 42 }));
  ok('lasts 48 hours', q.endsAt - q.startedAt === 48 * H);
  ok('grand prize is ten reward values', q.grand === 3000);
  ok('everyone starts in', Q.catsLeft(q) === 100);
  let last = 100;
  let shrinking = true;
  for (let i = 1; i < 7; i++) {
    ok(`step ${i}`, Q.advance(q, T0 + i * H) === i);
    if (Q.catsLeft(q) > last) shrinking = false;
    last = Q.catsLeft(q);
  }
  ok('the field never grows', shrinking);
  ok('still running at 6/7', Q.isActive(q) && Q.hasNews(q));
  Q.advance(q, T0 + 7 * H);
  ok('seventh step wins', q.status === 'won');
  ok('share is the grand prize over the finishers', q.share === Q.shareOf(3000, q.field[7] + 1));
  ok('winning is news', Q.hasNews(q));
  const share = q.share;
  const coins = Q.claim(q);
  ok('claim pays the share', coins === share && coins > 0);
  ok('claim counts the win and offers the next', q.status === 'offer' && q.wins === 1 && q.played === 1);
  ok('claiming twice pays nothing', Q.claim(q) === 0);
  ok('old run data is cleared', q.field === undefined && q.step === undefined);
  ok('best step is kept', q.best === 7);
}

/* ---- knocked out ---- */
{
  const q = Q.emptyQuest();
  Q.sync(q, { now: T0, level: 9 });
  Q.start(q, { now: T0, seed: 7 });
  Q.advance(q, T0 + H);
  ok('a lost level knocks you out', Q.knockOut(q) && q.status === 'lost');
  ok('nothing more happens after', !Q.knockOut(q) && Q.advance(q, T0 + 2 * H) === 0);
  ok('losing is news', Q.hasNews(q));
  ok('nothing to claim', Q.claim(q) === 0);
  ok('acknowledging offers the next', Q.acknowledge(q) && q.status === 'offer');
  ok('no knockout without a quest', !Q.knockOut(q));
}

/* ---- the clock ---- */
{
  const q = Q.emptyQuest();
  Q.sync(q, { now: T0, level: 8 });
  Q.start(q, { now: T0, seed: 9 });
  ok('still running a minute before the end', !Q.sync(q, { now: T0 + 48 * H - 60000, level: 8 }) && Q.isActive(q));
  ok('expires at the end', Q.sync(q, { now: T0 + 48 * H, level: 8 }) && q.status === 'expired');
  ok('expiry is news, and acknowledges', Q.hasNews(q) && Q.acknowledge(q));

  const r = Q.emptyQuest();
  Q.sync(r, { now: T0, level: 8 });
  Q.start(r, { now: T0, seed: 9 });
  Q.sync(r, { now: T0 - 30 * 24 * H, level: 8 });
  ok('a clock wound back cannot stretch a quest past 48 hours', r.endsAt - (T0 - 30 * 24 * H) <= 48 * H);
  ok('a level won after the end does not count', (() => {
    const s = Q.emptyQuest(); Q.sync(s, { now: T0, level: 8 }); Q.start(s, { now: T0, seed: 1 });
    return Q.advance(s, T0 + 49 * H) === 0 && s.status === 'expired';
  })());
  ok('timers read nicely', Q.formatLeft(47 * H + 5 * 60000) === '47h 05m' && Q.formatLeft(90000) === '2m'
    && Q.formatShort(47 * H) === '1d 23h' && Q.formatShort(5 * H) === '5h 00m');
}

/* ---- news, for the lobby popup ---- */
{
  const q = Q.emptyQuest();
  Q.sync(q, { now: T0, level: 8 });
  ok('an offer alone is not news (it has its own once-a-session rule)', !Q.hasNews(q));
  Q.start(q, { now: T0, seed: 3 });
  ok('a fresh quest is not news', !Q.hasNews(q));
  Q.advance(q, T0 + H);
  ok('a step is news', Q.hasNews(q));
  q.seenStep = q.step;
  ok('until it is seen', !Q.hasNews(q));
}

/* ---- the field matches the published Lava Quest curve ---- */
{
  const N = 4000;
  const mean = Array(8).fill(0);
  let alone = 0;
  for (let s = 1; s <= N; s++) {
    const f = Q.drawField(s * 2654435761);
    f.forEach((v, i) => { mean[i] += (v + 1) / N; });
    if (f[7] === 0) alone++;
  }
  ok('about 70 left after one step', Math.abs(mean[1] - 70) < 4);
  ok('about 30 after three', Math.abs(mean[3] - 30) < 4);
  ok('about 7 finish', mean[7] > 5 && mean[7] < 9.5);
  ok('now and then you finish alone', alone > 0 && alone / N < 0.03);
  ok('the same seed draws the same field', JSON.stringify(Q.drawField(99)) === JSON.stringify(Q.drawField(99)));
  const five = Q.drawField(5, 5);
  ok('a shorter quest has its own length', five.length === 6);
}

/* ---- prize arithmetic ---- */
ok('grand prize rounds to 100, with a floor', Q.grandPrize(333) === 3300 && Q.grandPrize(10) === 1000);
ok('a lone winner takes it all', Q.shareOf(3000, 1) === 3000);
ok('shares round to 5', Q.shareOf(3000, 7) % 5 === 0);

console.log(`Bell Quest tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }

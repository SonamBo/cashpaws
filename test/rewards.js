#!/usr/bin/env node
/** The Rewards Box rules, tested without a browser. Run: node test/rewards.js */

import {
  emptyBox, isReady, msUntil, openBox, adOpensLeft, formatWait, PRIZES,
  REFILL_MS, AD_OPENS_PER_DAY, DEFAULT_VALUE,
} from '../www/shell/rewards.js';
import moneySort from '../www/games/money-sort/index.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const H = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 26, 10);

/* ---- the timer ---- */
{
  const box = emptyBox();
  ok('the first box is ready at once', isReady(box, T0));
  const won = openBox(box, { now: T0, day: 'd1', value: 400 });
  ok('opening it pays coins', won && won.coins > 0);
  ok('a box cannot be opened twice', openBox(box, { now: T0 + 1000, day: 'd1', value: 400 }) === null);
  ok('the next one is four hours away', msUntil(box, T0) === REFILL_MS);
  ok('not ready after three hours', !isReady(box, T0 + 3 * H));
  ok('ready after four', isReady(box, T0 + 4 * H));
  ok('the wait reads nicely', formatWait(2 * H + 13 * 60 * 1000) === '2h 13m' && formatWait(90 * 1000) === '2m');
}

/* ---- a clock wound backwards cannot strand the next box ---- */
{
  const box = emptyBox();
  openBox(box, { now: T0, day: 'd1' });
  const wayBack = T0 - 30 * 24 * H;               // a month earlier
  ok('winding the clock back never makes the wait longer than one refill',
     msUntil(box, wayBack) <= REFILL_MS);
  ok('and the box comes back within four hours of that clock', isReady(box, wayBack + REFILL_MS));
}

/* ---- coins scale with what the game says a reward is worth ---- */
{
  const avg = (value) => {
    let total = 0;
    for (let i = 0; i < 4000; i++) {
      const b = emptyBox();
      total += openBox(b, { now: T0, day: 'd', value }).coins;
    }
    return total / 4000;
  };
  const low = avg(150), high = avg(1290);
  ok('a box is worth about half the reward value', Math.abs(low / 150 - 0.48) < 0.05);
  ok('and grows in proportion as the value grows', Math.abs(high / low - 1290 / 150) < 0.6);
  ok('payouts are round numbers', openBox(emptyBox(), { now: T0, day: 'd', value: 777 }).coins % 5 === 0);
  ok('a game that names no value gets the default',
     openBox(emptyBox(), { now: T0, day: 'd', rand: () => 0 }).coins === Math.round(DEFAULT_VALUE * PRIZES[0].share / 5) * 5);
  ok('the rare top prize is a whole reward, flagged big',
     (() => { const w = openBox(emptyBox(), { now: T0, day: 'd', value: 400, rand: () => 0.999 }); return w.coins === 400 && w.big; })());
}

/* ---- opening early with an ad ---- */
{
  const box = emptyBox();
  openBox(box, { now: T0, day: 'd1' });                      // the free one
  ok('three ad opens a day are allowed', adOpensLeft(box, 'd1') === AD_OPENS_PER_DAY);
  for (let i = 0; i < AD_OPENS_PER_DAY; i++) openBox(box, { now: T0, day: 'd1', viaAd: true });
  ok('and then no more that day', openBox(box, { now: T0, day: 'd1', viaAd: true }) === null);
  ok('an ad open does not reset the free timer', msUntil(box, T0) === REFILL_MS);
  ok('the ad allowance renews the next day', adOpensLeft(box, 'd2') === AD_OPENS_PER_DAY
     && openBox(box, { now: T0, day: 'd2', viaAd: true }) !== null);
}

/* ---- Money Sort reports its Sort price as the reward value ---- */
{
  const root = { classList: { add() {} } };
  const inst = moneySort.create({ wallet: { coins: 0 }, stat() {}, stats: {}, progress() {}, dev: false, art: {}, asset: (x) => x }, root);
  ok('money sort declares a reward value', typeof inst.rewardValue === 'function');
}

console.log(`Rewards box tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

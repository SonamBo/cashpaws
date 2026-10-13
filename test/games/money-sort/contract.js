#!/usr/bin/env node
/**
 * Money Sort's side of the shell contract: what it declares to the shell
 * (daily tasks, Bell Quest, the Rewards Box value). Shell rules themselves are
 * tested in test/*.js, against made-up games.
 * Run: node test/games/money-sort/contract.js
 */
import moneySort from '../../../www/games/money-sort/index.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

/* ---- daily tasks: the real catalogue ---- */
{
  const tiers = new Set(moneySort.tasks.map((t) => t.tier));
  ok('money sort has every tier', ['easy', 'medium', 'hard'].every((t) => tiers.has(t)));
  ok('every money sort task names a stat and a target',
     moneySort.tasks.every((t) => t.stat && t.target > 0 && t.text));
  ok('no task asks the player to spend coins', !moneySort.tasks.some((t) => t.stat === 'sorts'));
}

/* ---- Bell Quest ---- */
ok('Money Sort opens it after the first Hard level', moneySort.quest.unlockLevel === 8 && moneySort.quest.steps === 7);

/* ---- Rewards Box: it reports its Sort price as the reward value ---- */
{
  const root = { classList: { add() {} } };
  const inst = moneySort.create({ wallet: { coins: 0 }, stat() {}, stats: {}, progress() {}, dev: false, art: {}, asset: (x) => x }, root);
  ok('money sort declares a reward value', typeof inst.rewardValue === 'function');
}

console.log(`Money Sort contract tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

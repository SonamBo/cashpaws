#!/usr/bin/env node
/**
 * Difficulty per level and help when stuck (1.19.0).
 * Run: node test/games/money-sort/difficulty.js
 */
import {
  Game, DEFAULTS, levelKind, levelDifficulty, parseDifficulty, netWorthFloor,
} from '../../../www/games/money-sort/engine.js';
import moneySort from '../../../www/games/money-sort/index.js';
import { checkSpecs, parseValue } from '../../../www/shell/config.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

/* ---- the default table is 1.18's rhythm ---- */
const old = (l) => { if (l < 7) return 'normal'; const k = (l - 7) % 4; return k === 0 ? 'hard' : k === 1 ? 'breather' : 'normal'; };
let same = true;
for (let l = 1; l < 300; l++) if (levelKind(l) !== old(l)) same = false;
ok('default table: Hard and breather levels exactly as in 1.18', same);
ok('default: normal 1, Hard 2, breather 0', levelDifficulty(5) === 1 && levelDifficulty(11) === 2 && levelDifficulty(12) === 0);

/* ---- parsing ---- */
const t = parseDifficulty('1-3:0.5, 9:1.5, 20-:1.2, x:2, 4/0:1, 5:7');
ok('ranges, single levels and open ends parse', t.rules.length === 4);
ok('bad entries are listed, not applied', t.bad.length === 2 && t.bad.includes('x:2'));
ok('points are capped at 4', t.rules.find((r) => r.from === 5).points === 4);
const cfg = { ...DEFAULTS, levelDifficulty: '7/4:2, 8/4:0, 1-3:0.5, 9:1.5, 20-:1.2' };
ok('a range applies', levelDifficulty(2, cfg) === 0.5 && levelKind(2, cfg) === 'breather');
ok('1.5 makes a level Hard', levelKind(9, cfg) === 'hard');
ok('later entries win', levelDifficulty(23, cfg) === 1.2 && levelKind(23, cfg) === 'normal');
ok('unlisted levels are 1', levelDifficulty(10, cfg) === 1);
ok('empty table: everything normal', levelKind(11, { ...DEFAULTS, levelDifficulty: '' }) === 'normal');

/* ---- what the points do ---- */
const at = (level, extra = {}) => new Game({ seed: 1, level, config: extra });
ok('normal level: flow and junk as configured', at(5).currentInterval === 7 && Math.abs(at(5).junkOdds - 0.4) < 1e-9);
ok('Hard level: one turn faster, +0.2 junk (as 1.18)', at(11).currentInterval === 6 && Math.abs(at(11).junkOdds - 0.6) < 1e-9);
ok('breather: one turn slower (as 1.18), less junk', at(12).currentInterval === 8 && Math.abs(at(12).junkOdds - 0.2) < 1e-9);
ok('difficulty 3: two turns faster', at(5, { levelDifficulty: '5:3' }).currentInterval === 5);
ok('flow never faster than 3 turns', at(5, { levelDifficulty: '5:4', flowInterval: 4 }).currentInterval === 3);
ok('junk odds stay within 0 and 0.9', at(5, { levelDifficulty: '5:4', junkChance: 0.8 }).junkOdds === 0.9 && at(5, { levelDifficulty: '5:0', junkChance: 0.1 }).junkOdds === 0);

/* ---- help when stuck ---- */
{
  const g = at(11);
  const seen = [];
  g.on((e) => seen.push(e));
  g.forcedStuck = true; g.checkLock();
  ok('one stuck board: no help yet', g.stuckHere === 1 && !g.assisted && g.difficulty === 2);
  g.forcedStuck = true; g.checkLock();
  ok('second stuck board: help on', g.assisted && g.difficulty === 1);
  ok('help eases flow and junk', g.currentInterval === 7 && Math.abs(g.junkOdds - 0.4) < 1e-9);
  ok('the level keeps its Hard label and pay', g.kind === 'hard');
  ok('an assist event is emitted once', seen.filter((e) => e.type === 'assist').length === 1);
  g.forcedStuck = true; g.checkLock();
  ok('no second assist event', seen.filter((e) => e.type === 'assist').length === 1);

  const saved = g.serialize();
  const back = Game.deserialize(saved, {});
  ok('stuck counts survive a save', back.stuckHere === 3 && back.assisted);

  g.netWorth = netWorthFloor(12, g.cfg);
  g.checkLevelUp();
  const up = seen.find((e) => e.type === 'levelup');
  ok('level-up reports the level was helped', up?.assisted === true);
  ok('beating the level clears its count', g.level === 12 && g.stuckHere === 0 && !g.assisted && !(11 in g.stuckOn));
}
{
  const g = at(15, { assistAfterStuck: 0 });
  for (let i = 0; i < 5; i++) { g.forcedStuck = true; g.checkLock(); }
  ok('assist_after_stuck 0 switches help off', !g.assisted && g.difficulty === 2);
}
{
  const g = at(9, { assistAfterStuck: 1, assistEase: 3 });
  g.forcedStuck = true; g.checkLock();
  ok('difficulty never goes below 0', g.assisted && g.difficulty === 0);
}
{
  // Stuck on 13, dropped to 12: 13's count waits for the player's return.
  const g = at(13);
  g.forcedStuck = true; g.checkLock();
  g.stuckOn[13] = 1; g.level = 12;
  ok('a drop keeps the failed level\'s count', g.stuckHere === 0 && g.stuckOn[13] === 1);
  g.level = 13;
  ok('back on it, the count carries on', g.stuckHere === 1);
}
ok('old saves without stuck counts load', Game.deserialize({ ...at(5).serialize(), stuckOn: undefined }, {}).stuckHere === 0);

/* ---- the Remote Config declarations match the engine ---- */
const R = moneySort.remote;
ok('Money Sort remote keys are valid', checkSpecs(R).length === 0);
ok('every remote default equals the engine default',
   Object.values(R).every((s) => s.default === DEFAULTS[s.engine]));
ok('a typed table comes through as text', parseValue(R.level_difficulty, '1-5:0.8, 7/4:2').value === '1-5:0.8, 7/4:2');

console.log(`Difficulty tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

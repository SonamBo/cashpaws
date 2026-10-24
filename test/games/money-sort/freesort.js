#!/usr/bin/env node
/**
 * Free Sorts on the early levels (1.17.0): level 1's first Sort is free, and
 * each level up to freeSortThrough starts with one. Unused ones don't pile up.
 * Run: node test/games/money-sort/freesort.js
 */
import { Game, netWorthFloor, DEFAULTS } from '../../../www/games/money-sort/engine.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));

/** Push the game over its next floor and collect the level-up event. */
function climb(g) {
  const seen = [];
  const off = g.on ? g.on((e) => seen.push(e)) : null;
  g.events.length = 0;
  g.netWorth = netWorthFloor(g.level + 1, g.cfg);
  g.checkLevelUp();
  if (typeof off === 'function') off();
  return [...seen, ...g.events].find((e) => e.type === 'levelup');
}

ok('levels 2 to 5 start with a free Sort', DEFAULTS.freeSortThrough === 5);

{
  const g = new Game({ seed: 7 });
  ok('a new player starts with one free Sort', g.freeSorts === 1);
  g.freeSorts = 0;                                   // used it on level 1
  const e = climb(g);
  ok('level 2: a free Sort again', g.level === 2 && g.freeSorts === 1 && e?.freeSort === true);
  climb(g);
  ok('unused ones do not pile up', g.level === 3 && g.freeSorts === 1);
  g.freeSorts = 0; climb(g); ok('level 4: free', g.freeSorts === 1);
  g.freeSorts = 0; climb(g); ok('level 5: free', g.level === 5 && g.freeSorts === 1);
  g.freeSorts = 0;
  const e6 = climb(g);
  ok('level 6: paid again', g.level === 6 && g.freeSorts === 0 && e6?.freeSort === false);
}

{
  const g = new Game({ seed: 3, level: 9, freeSorts: 0 });
  climb(g);
  ok('a returning player past level 5 gets none', g.freeSorts === 0);
}

{
  const g = new Game({ seed: 11, config: { freeSortThrough: 1 } });
  g.freeSorts = 0; climb(g);
  ok('the rule can be switched off in config', g.freeSorts === 0);
}

console.log(`Free Sort tests: ${pass}/${pass + fails.length} passed`);
fails.forEach((f) => console.log('   FAILED: ' + f));
process.exit(fails.length ? 1 : 0);

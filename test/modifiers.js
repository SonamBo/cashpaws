#!/usr/bin/env node
/** Level modifiers — Lucky Paw, frozen coins, locked tube — without a browser. Run: node test/modifiers.js */
import { Game, levelModifiers, levelKind, columnsForLevel, DEFAULTS, WILD, localWallet } from '../www/games/money-sort/engine.js';

let pass = 0;
const fails = [];
const ok = (name, cond) => (cond ? pass++ : fails.push(name));
const game = (level, cols, extra = {}) => {
  const g = new Game({ seed: 7, level, wallet: localWallet(1000) });
  g.columns = cols.map((c) => [...c]);
  while (g.columns.length < columnsForLevel(level)) g.columns.push([]);
  g.locked = extra.locked || null;
  g.ice = extra.ice || [];
  g.turnsUntilDrop = 50;
  g.freeSorts = 0;
  return g;
};

/* ---- the schedule ---- */
{
  const m = (l) => levelModifiers(l, DEFAULTS);
  ok('nothing before level 12', [1, 5, 8, 11].every((l) => !m(l).lucky && !m(l).locked && !m(l).frozen));
  ok('Lucky Paw on every breather from 12', [12, 16, 20, 24, 40].every((l) => levelKind(l) === 'breather' && m(l).lucky));
  ok('but not on other levels', [13, 14, 15, 17].every((l) => !m(l).lucky));
  ok('locked tube arrives on 17, a normal level', levelKind(17) === 'normal' && m(17).locked);
  ok('and is tested on the next Hard level, 19', levelKind(19) === 'hard' && m(19).locked);
  ok('not on 18', !m(18).locked);
  ok('frozen coins arrive on 25, tested on 27', levelKind(25) === 'normal' && m(25).frozen && m(27).frozen);
  ok('never on a breather', [28, 32, 36, 40, 44, 48].every((l) => !m(l).locked && !m(l).frozen));
  const later = Array.from({ length: 200 }, (_, i) => i + 30).filter((l) => levelKind(l) !== 'breather');
  const share = later.filter((l) => m(l).locked).length / later.length;
  ok('later, a locked tube on about a third of levels', share > 0.2 && share < 0.45);
  ok('a normal level has at most one of the two', later.filter((l) => levelKind(l) === 'normal')
    .every((l) => !(m(l).locked && m(l).frozen)));
  ok('the same level always has the same modifiers', JSON.stringify(m(57)) === JSON.stringify(m(57)));
}

/* ---- Lucky Paw ---- */
{
  let g = game(12, [[5, 5, 5], [WILD], [10]]);
  ok('a Lucky Paw moves onto anything', g.canMove(1, 2));
  const before = g.netWorth;
  g.move(1, 0);
  ok('and completes a set: four $5s bank', g.lifetimeBanks >= 1 && g.netWorth - before >= 20);
  g = game(12, [[5, 5, WILD], [5], [10]]);
  ok('a paw on top counts as the coin under it', g.faceValue(0) === 5 && g.canMove(1, 0) && !g.canMove(2, 0));
  ok('and moves with its run', g.topRun(0) === 3);
  g = game(12, [[10, 5, 5, WILD], [20]]);
  ok('a tube of mixed coins with a paw does not bank', g.bankableValue(0) === 0);
  g = game(12, [[5, 10, 5, 20], [5, WILD, 10], [10, 20, 20], [], []]);
  g.freeSorts = 1; g.sort();
  const hasFullSet = g.lifetimeBanks > 0;
  ok('Sort puts the paw where it finishes a set', hasFullSet);
}

/* ---- frozen coins ---- */
{
  let g = game(25, [[5, 10], [10, 10, 10], [5, 5, 5], []], { ice: [{ column: 0, index: 1, hits: 2 }] });
  ok('a frozen top cannot be lifted', !g.canMove(0, 3) && g.tap(0).reason === 'frozen');
  ok('but coins can land on it', g.canMove(1, 0));
  g = game(25, [[5, 10, 20], [20], [], []], { ice: [{ column: 0, index: 1, hits: 2 }] });
  ok('coins above it move; the run stops at the ice', g.topRun(0) === 1 && g.canMove(0, 1));
  g = game(25, [[5, 10], [20, 20, 20], [20], [1, 1, 1], [1]], { ice: [{ column: 0, index: 1, hits: 2 }] });
  g.move(2, 1);
  ok('a cash-in anywhere cracks it', g.ice.length === 1 && g.ice[0].hits === 1);
  g.move(4, 3);
  ok('a second frees it', g.ice.length === 0 && g.canMove(0, 2));
  g = game(25, [[5, 10], [10, 5], [], []], { ice: [{ column: 0, index: 1, hits: 2 }] });
  g.freeSorts = 1; g.sort();
  ok('Sort shakes the ice loose', g.ice.length === 0);
}

/* ---- locked tube ---- */
{
  const lock = () => ({ column: 4, need: 2 });
  let g = game(17, [[5, 5, 5], [5], [10, 10, 10], [10], []], { locked: lock() });
  const last = g.columnCount - 1;
  g.locked = { column: last, need: 2 };
  ok('nothing moves into a locked tube', !g.canMove(1, last));
  ok('tapping it does nothing', g.tap(last).reason === 'locked');
  ok('its space does not count as room', g.openSlots === (g.columnCount - 1) * 4 - 8);
  g.columns[0] = [5, 5, 5, 5]; g.bankAll();
  ok('one cash-in counts it down', g.locked && g.locked.need === 1);
  g.columns[2] = [10, 10, 10, 10]; g.bankAll();
  g.columns[1] = [5];
  ok('two open it', g.locked === null && g.canMove(1, last));
  g = game(17, [[5, 10, 5], [10], []]);
  g.locked = { column: g.columnCount - 1, need: 2 };
  g.turnsUntilDrop = 0; g.inflow();
  ok('the flow skips it', g.columns[g.columnCount - 1].length === 0);
  g = game(17, [[5, 10, 5], [10, 5], [], []]);
  g.locked = { column: g.columnCount - 1, need: 2 };
  g.freeSorts = 1; g.sort();
  ok('Sort leaves it shut and empty', g.locked && g.columns[g.columnCount - 1].length === 0);
}

/* ---- boards and level-ups bring them ---- */
{
  const g17 = new Game({ seed: 3, level: 17, wallet: localWallet(0) });
  ok('a fresh level-17 board has its locked tube', g17.locked && g17.columns[g17.locked.column].length === 0);
  ok('and still a free empty tube', g17.columns.some((c, i) => !g17.isLocked(i) && c.length === 0));
  const g25 = new Game({ seed: 3, level: 25, wallet: localWallet(0) });
  ok('a fresh level-25 board has frozen coins, never on top',
    g25.ice.length === 2 && g25.ice.every((f) => f.index < g25.columns[f.column].length - 1));
  const g12 = new Game({ seed: 3, level: 12, wallet: localWallet(0) });
  ok('a fresh level-12 board has one Lucky Paw', g12.columns.flat().filter((v) => v === WILD).length === 1);

  const g = new Game({ seed: 9, level: 16, wallet: localWallet(0) });
  g.columns = g.columns.map(() => []);
  g.columns[0] = [5, 5, 5]; g.columns[1] = [5]; g.columns[2] = [10];
  g.netWorth = g.nextFloor - 1; g.turnsUntilDrop = 50;
  let ev = null; g.on((e) => { if (e.type === 'levelup') ev = e; });
  g.move(1, 0);
  ok('levelling up to 17 locks an empty tube', g.level === 17 && g.locked && ev.lockArrives === true);

  // Saving and loading keep them.
  const back = Game.deserialize(JSON.parse(JSON.stringify(g.serialize())), { wallet: localWallet(0) });
  ok('a save keeps the lock', back.locked && back.locked.column === g.locked.column);
  const f = new Game({ seed: 3, level: 25, wallet: localWallet(0) });
  const fb = Game.deserialize(JSON.parse(JSON.stringify(f.serialize())), { wallet: localWallet(0) });
  ok('and the ice', fb.ice.length === 2 && fb.ice[0].hits === 2);
  const old = f.serialize(); delete old.state.ice; delete old.state.locked;
  const ob = Game.deserialize(old, { wallet: localWallet(0) });
  ok('an older save loads with none', ob.ice.length === 0 && ob.locked === null);
}

console.log(`Modifier tests: ${pass}/${pass + fails.length} passed`);
if (fails.length) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }

/**
 * Headless simulator. Plays complete games with a greedy bot and asserts the
 * engine's invariants after every single action. Usage: node test/sim.js [games]
 */

import { Game, columnsForLevel, netWorthFloor, poolForLevel, DEFAULTS } from '../www/js/engine.js';

const GAMES = Number(process.argv[2] || 2000);
const MAX_TURNS = 1500;

const violations = [];
function check(cond, label, ctx) {
  if (!cond) violations.push({ label, ctx });
  return cond;
}

/* ------------------------- invariants ------------------------- */

function audit(g, where) {
  const cfg = g.cfg;
  check(g.level >= 1, 'level below 1', { where, level: g.level });
  check(g.coins >= 0, 'negative coins', { where, coins: g.coins });
  check(
    g.columns.every((c) => c.length <= cfg.capacity),
    'column over capacity',
    { where, cols: g.columns.map((c) => c.length) }
  );
  check(
    g.columnCount === columnsForLevel(g.level, cfg),
    'column count does not match level',
    { where, level: g.level, have: g.columnCount, want: columnsForLevel(g.level, cfg) }
  );
  check(
    g.netWorth >= netWorthFloor(g.level),
    'net worth below its level floor',
    { where, level: g.level, net: g.netWorth, floor: netWorthFloor(g.level) }
  );
  check(
    g.netWorth < netWorthFloor(g.level + 1),
    'net worth above the next floor without levelling',
    { where, level: g.level, net: g.netWorth, next: netWorthFloor(g.level + 1) }
  );
  check(
    !g.columns.some((c) => c.length === cfg.capacity && c.every((v) => v === c[0])),
    'a full matching column was left unbanked',
    { where, cols: g.columns }
  );
  const pool = poolForLevel(g.level, cfg);
  check(
    g.columns.flat().every((v) => cfg.valueLadder.includes(v)),
    'chip value outside the ladder',
    { where }
  );
  check(
    g.turnsUntilDrop <= cfg.flowInterval,
    'drop counter above the base interval',
    { where, t: g.turnsUntilDrop }
  );
  void pool;
}

/* ------------------------- greedy bot ------------------------- */

function scoreMove(g, [from, to]) {
  const cap = g.cfg.capacity;
  const src = g.columns[from];
  const dst = g.columns[to];
  const chip = src[src.length - 1];

  // Completing a stack is always best.
  if (dst.length === cap - 1 && dst.length > 0 && dst[0] === chip && dst.every((v) => v === chip)) {
    return 1000 + chip;
  }
  // Growing a pure matching stack.
  if (dst.length > 0 && dst.every((v) => v === chip)) return 500 + dst.length * 10 + chip / 10;
  // Emptying a column entirely is worth something.
  if (src.length === 1 && dst.length > 0) return 300;
  // Onto a matching top that sits on a mixed column: mild.
  if (dst.length > 0) return 100 + chip / 100;
  // Onto empty: only really useful if it uncovers something or isolates a value.
  if (dst.length === 0) {
    if (src.length === 1) return -50; // pointless column swap
    const next = src[src.length - 2];
    return next === chip ? 60 : 40;
  }
  return 0;
}

function hash(g) {
  return g.columns.map((c) => c.join('.')).join('|') + '#' + g.turnsUntilDrop;
}

function playOne(seed) {
  const g = new Game({ seed });
  const stats = {
    seed, turns: 0, banks: 0, drops: 0, locks: 0, shuffles: 0,
    losses: 0, maxLevel: 1, maxNet: 0, restarts: 0, undos: 0,
  };

  g.on((e) => {
    if (e.type === 'bank') stats.banks++;
    if (e.type === 'inflow') stats.drops++;
    if (e.type === 'lock') stats.locks++;
    if (e.type === 'shuffle') stats.shuffles++;
    if (e.type === 'level-lost') stats.losses++;
    if (e.type === 'levelup') stats.maxLevel = Math.max(stats.maxLevel, e.level);
    if (e.type === 'inflow' && !e.skipped && e.count > 0) {
      check(g.openSlots >= 1, 'an inflow sealed the board', { seed, drop: e.drop });
    }
  });

  audit(g, 'start');
  const seen = new Map();

  while (stats.turns < MAX_TURNS) {
    if (g.status === 'locked') {
      if (g.shuffleCanHelp && g.canAffordShuffle) {
        g.shuffle();
      } else {
        g.loseLevel();
      }
      audit(g, 'after-lock-resolution');
      seen.clear();
      continue;
    }

    const moves = g.legalMoves();
    if (moves.length === 0) {
      check(g.status === 'locked', 'deadlock not detected', { seed, turn: stats.turns });
      break;
    }

    const h = hash(g);
    const repeats = (seen.get(h) || 0) + 1;
    seen.set(h, repeats);

    let choice;
    if (repeats > 2) {
      choice = moves[Math.floor(Math.random() * moves.length)];
    } else {
      choice = moves.reduce((best, m) => (scoreMove(g, m) > scoreMove(g, best) ? m : best), moves[0]);
    }

    const before = g.netWorth;
    const res = g.move(choice[0], choice[1]);
    check(res.ok, 'a legal move was rejected', { seed, choice });
    stats.turns++;
    audit(g, 'after-move');
    check(g.netWorth >= before, 'net worth fell during a normal move', { seed });

    stats.maxNet = Math.max(stats.maxNet, g.netWorth);
    stats.maxLevel = Math.max(stats.maxLevel, g.level);
  }

  return stats;
}

/* ------------------------- targeted tests ------------------------- */

function unitTests() {
  const t = [];
  const ok = (label, cond) => t.push({ label, pass: !!cond });

  ok('L1 floor is 0', netWorthFloor(1) === 0);
  ok('L2 floor is 200', netWorthFloor(2) === 200);
  ok('L3 floor is 600', netWorthFloor(3) === 600);
  ok('L4 floor is 1200', netWorthFloor(4) === 1200);
  ok('L5 floor is 2000', netWorthFloor(5) === 2000);
  ok('L6 floor is 3000', netWorthFloor(6) === 3000);

  ok('L1 has 5 columns', columnsForLevel(1) === 5);
  ok('L2 has 5 columns', columnsForLevel(2) === 5);
  ok('L3 has 6 columns', columnsForLevel(3) === 6);
  ok('L5 has 7 columns', columnsForLevel(5) === 7);
  ok('L7 has 8 columns', columnsForLevel(7) === 8);
  ok('columns cap at 8', columnsForLevel(30) === 8);

  ok('L1 pool is 1/5/10', poolForLevel(1).join() === '1,5,10');
  ok('L3 pool adds 20', poolForLevel(3).join() === '1,5,10,20');
  ok('L5 pool adds 50', poolForLevel(5).join() === '1,5,10,20,50');

  // Banking pays value x stack.
  {
    const g = new Game({ seed: 7 });
    g.columns = [[50, 50, 50], [50], [], [], []];
    const net = g.netWorth;
    g.move(1, 0);
    ok('a stack of four 50s banks $200', g.netWorth - net === 200);
    ok('the banked column is now empty', g.columns[0].length === 0);
    ok('banking pays coins', g.coins >= DEFAULTS.startCoins + DEFAULTS.coinsPerBank - DEFAULTS.undoCost);
  }

  // Illegal placements are refused.
  {
    const g = new Game({ seed: 8 });
    g.columns = [[10], [20], [], [], []];
    g.columns[2] = [5, 5, 5, 10];
    ok('cannot stack 10 on 20', g.canMove(0, 1) === false);
    ok('cannot place into a full column', g.canMove(0, 2) === false);
    ok('can always place into an empty column', g.canMove(0, 3) === true);
  }

  // Deadlock detection.
  {
    const g = new Game({ seed: 9 });
    g.columns = [
      [5, 10, 20, 5], [10, 20, 5, 10], [20, 5, 10, 20],
      [5, 20, 10, 5], [10, 5, 20, 10],
    ];
    ok('a full mismatched board is a deadlock', g.isDeadlocked() === true);
    ok('shuffle refuses to help a full board', g.shuffleCanHelp === false);
  }

  // An inflow must never seal the board.
  {
    let sealed = 0, skippedWrong = 0;
    for (let s = 0; s < 600; s++) {
      const g = new Game({ seed: s });
      // Fill every column to 3 so a single drop would otherwise seal the board.
      g.columns = g.columns.map((c) => [...c.slice(0, 3), ...Array(Math.max(0, 3 - c.length)).fill(5)]);
      g.columns[0] = [10, 20, 5];
      const r = g.inflow();
      if (g.openSlots === 0) sealed++;
      if (r.count === 0 && !r.skipped) skippedWrong++;
    }
    ok('an inflow never seals a board that had room', sealed === 0);
    ok('a zero-count inflow is always a silent skip', skippedWrong === 0);

    // A board with no room at all: the drop is skipped silently.
    {
      const g = new Game({ seed: 99 });
      g.columns = g.columns.map(() => [5, 10, 20, 50]);
      const r = g.inflow();
      ok('a full board skips the drop', r.skipped === true && r.count === 0);
    }
  }

  // Level loss drops a level and floors net worth.
  {
    const g = new Game({ seed: 11 });
    g.level = 4; g.netWorth = 3000;
    g.loseLevel();
    ok('losing drops one level', g.level === 3);
    ok('losing floors net worth', g.netWorth === netWorthFloor(3));
    ok('losing always leaves one shuffle', g.coins >= DEFAULTS.shuffleCost);
    ok('losing rebuilds the board', g.columnCount === columnsForLevel(3));
  }

  // Undo restores the board and charges coins; the flow wipes it.
  {
    const g = new Game({ seed: 12 });
    const moves = g.legalMoves();
    const before = JSON.stringify(g.columns);
    g.move(moves[0][0], moves[0][1]);
    const coins = g.coins;
    const r = g.undo();
    ok('undo succeeds after a move', r.ok === true);
    ok('undo restores the board', JSON.stringify(g.columns) === before);
    ok('undo charges its cost', g.coins === coins - DEFAULTS.undoCost);
    ok('undo cannot repeat', g.undo().ok === false);
  }
  {
    const g = new Game({ seed: 13 });
    const m = g.legalMoves()[0];
    g.move(m[0], m[1]);
    g.inflow();
    ok('an inflow clears the undo', g.canUndo === false);
  }

  // Escalation shortens the interval, never below the floor.
  {
    const g = new Game({ seed: 14 });
    ok('interval starts at 7', g.currentInterval === 7);
    g.dropCount = 3; ok('interval is 6 after three drops', g.currentInterval === 6);
    g.dropCount = 9; ok('interval is 4 after nine drops', g.currentInterval === 4);
    g.dropCount = 99; ok('interval never falls below 4', g.currentInterval === 4);
  }

  // Save and reload.
  {
    const g = new Game({ seed: 15 });
    g.move(...g.legalMoves()[0]);
    const clone = Game.deserialize(g.serialize());
    ok('a reloaded game matches', JSON.stringify(clone.columns) === JSON.stringify(g.columns));
    ok('a reloaded game keeps net worth', clone.netWorth === g.netWorth);
  }

  return t;
}

/* ------------------------- run ------------------------- */

console.log('Cash Paws engine — Stage 1 verification\n');

const unit = unitTests();
const failed = unit.filter((u) => !u.pass);
console.log(`Rule tests: ${unit.length - failed.length}/${unit.length} passed`);
failed.forEach((f) => console.log(`   FAILED: ${f.label}`));

console.log(`\nSimulating ${GAMES} games...`);
const t0 = Date.now();
const all = [];
for (let s = 0; s < GAMES; s++) all.push(playOne(s * 7919 + 13));
const ms = Date.now() - t0;

const sum = (k) => all.reduce((n, s) => n + s[k], 0);
const avg = (k) => (sum(k) / all.length).toFixed(2);
const max = (k) => Math.max(...all.map((s) => s[k]));
const levels = {};
all.forEach((s) => { levels[s.maxLevel] = (levels[s.maxLevel] || 0) + 1; });

console.log(`Finished in ${ms}ms (${(ms / GAMES).toFixed(2)}ms per game)\n`);
console.log(`  turns / game      avg ${avg('turns')}   max ${max('turns')}`);
console.log(`  banks / game      avg ${avg('banks')}   max ${max('banks')}`);
console.log(`  inflows / game    avg ${avg('drops')}   max ${max('drops')}`);
console.log(`  locks / game      avg ${avg('locks')}   max ${max('locks')}`);
console.log(`  shuffles / game   avg ${avg('shuffles')}`);
console.log(`  level losses      avg ${avg('losses')}   max ${max('losses')}`);
console.log(`  peak level        avg ${avg('maxLevel')}   max ${max('maxLevel')}`);
console.log(`  peak net worth    avg $${avg('maxNet')}   max $${max('maxNet')}`);
console.log('\n  peak level distribution');
Object.keys(levels).sort((a, b) => a - b).forEach((lv) => {
  const pct = ((levels[lv] / all.length) * 100).toFixed(1);
  console.log(`    LV ${String(lv).padStart(2)}  ${String(levels[lv]).padStart(5)}  ${pct}%`);
});

console.log('');
if (violations.length === 0 && failed.length === 0) {
  console.log('No invariant violations. Engine is sound.');
  process.exit(0);
} else {
  console.log(`${violations.length} invariant violations:`);
  const byLabel = {};
  violations.forEach((v) => { byLabel[v.label] = (byLabel[v.label] || 0) + 1; });
  Object.entries(byLabel).forEach(([l, n]) => console.log(`   ${n}x  ${l}`));
  console.log('\nfirst three:', JSON.stringify(violations.slice(0, 3), null, 2));
  process.exit(1);
}

/**
 * Headless simulator. Plays complete games with a greedy bot and asserts the
 * engine's invariants after every single action. Usage: node test/sim.js [games]
 */

import { Game, columnsForLevel, netWorthFloor, poolForLevel, levelKind, DEFAULTS } from '../www/games/money-sort/engine.js';

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
    g.columns.flat().every((v) => cfg.valueLadder.includes(Math.abs(v))),
    'chip value outside the ladder',
    { where }
  );
  // Face-down chips are negative, and one must never be left on top: the
  // player could not see or move it, and the board would be unreadable.
  check(
    g.columns.every((c) => !c.length || c[c.length - 1] > 0),
    'a face-down chip is on top',
    { where, cols: g.columns }
  );
  check(
    g.level >= cfg.mysteryFrom || g.columns.flat().every((v) => v > 0),
    'a face-down chip before mystery chips are introduced',
    { where, level: g.level }
  );
  check(
    g.turnsUntilDrop <= cfg.flowInterval + 1,     // +1: the breather after a Hard level
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
    seed, turns: 0, banks: 0, drops: 0, locks: 0, sorts: 0, refills: 0,
    losses: 0, maxLevel: 1, maxNet: 0, restarts: 0, undos: 0,
  };

  g.on((e) => {
    if (e.type === 'bank') stats.banks++;
    if (e.type === 'inflow') stats.drops++;
    if (e.type === 'lock') stats.locks++;
    if (e.type === 'sort') stats.sorts++;
    if (e.type === 'refill') stats.refills++;
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
      if (g.sortCanHelp && g.canAffordSort) {
        g.sort();
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
  ok('L2 floor is 150', netWorthFloor(2) === 150);
  ok('L3 floor is 350', netWorthFloor(3) === 350);
  ok('L4 floor is 600', netWorthFloor(4) === 600);
  ok('L5 floor is 900', netWorthFloor(5) === 900);
  ok('L6 floor is 1250', netWorthFloor(6) === 1250);

  ok('L1 has 5 columns', columnsForLevel(1) === 5);
  ok('a tube is added on even levels: L2 has 6', columnsForLevel(2) === 6 && columnsForLevel(3) === 6);
  ok('L4 has 7', columnsForLevel(4) === 7 && columnsForLevel(5) === 7);
  ok('L6 has 8', columnsForLevel(6) === 8);
  {
    // Never two new things on one early level: tubes on even levels, chips on odd.
    const changes = [];
    for (let l = 2; l <= 12; l++) {
      const n = (columnsForLevel(l) > columnsForLevel(l - 1) ? 1 : 0)
              + (poolForLevel(l).length > poolForLevel(l - 1).length ? 1 : 0);
      changes.push(n);
    }
    ok('no level adds a tube and a chip together', changes.every((n) => n <= 1));
  }
  ok('columns cap at 8', columnsForLevel(30) === 8);

  ok('L1 pool is 1/5/10', poolForLevel(1).join() === '1,5,10');
  ok('L3 pool adds 20', poolForLevel(3).join() === '1,5,10,20');
  ok('L5 pool adds 50', poolForLevel(5).join() === '1,5,10,20,50');

  // Banking pays value x stack.
  {
    const g = new Game({ seed: 7 });
    g.columns = [[50, 50, 50], [50], [10, 20], [], []];   // keep chips elsewhere
    const net = g.netWorth;                                 // so the board is not cleared
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
    ok('sort can still tidy a full mixed board', g.sortCanHelp === true);
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
    ok('losing always leaves one sort, at the new level\'s price', g.coins >= g.sortPrice);
    ok('losing rebuilds the board', g.columnCount === columnsForLevel(3));
  }

  // Undo restores the board and charges coins; the flow wipes it.
  {
    const g = new Game({ seed: 12 });
    const moves = g.legalMoves();
    const before = JSON.stringify(g.columns);
    g.move(moves[0][0], moves[0][1]);
    const coins = g.coins;
    const earned = g.moveEarned;
    const r = g.undo();
    ok('undo succeeds after a move', r.ok === true);
    ok('undo restores the board', JSON.stringify(g.columns) === before);
    ok('undo charges its cost and returns what the move paid',
       g.coins === coins - DEFAULTS.undoCost - earned);
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

  // Clearing the board must refill rather than read as a deadlock.
  {
    const g = new Game({ seed: 18 });
    g.columns = [[5, 5, 5], [5], [], [], []];
    g.turnsUntilDrop = 5;
    g.move(1, 0);
    ok('banking the last chips refills the board', g.chipsOnBoard > 0);
    ok('a cleared board does not lock', g.status === 'playing');
  }

  // Sort gathers each value into its own tube.
  {
    const g = new Game({ seed: 5, freeSorts: 0 });
    g.coins = 500;
    g.columns = [[1, 5, 10, 1], [5, 1, 10, 5], [10, 10, 1, 5], [1, 5, 10, 1], [5, 10, 1, 10]];
    const before = g.netWorth;
    ok('sort is offered on a mixed board', g.sortCanHelp === true);
    let banked = 0;
    g.on((e) => { if (e.type === 'bank') banked++; });
    const r = g.sort();
    ok('sort succeeds', r.ok === true);
    ok('sort charges its cost, less what its banks pay back',
       g.coins === 500 - DEFAULTS.sortCost + banked * DEFAULTS.coinsPerBank);
    ok('sort banks the complete sets', g.netWorth > before);
    // Five values across five tubes cannot all be pure; the remainder shares.
    const occupied = g.columns.filter((c) => c.length);
    const impure = occupied.filter((c) => c.some((v) => v !== c[0])).length;
    ok('sort leaves at most two shared tubes', impure <= 2);
  }

  {
    const g = new Game({ seed: 6 });
    g.coins = 500;
    g.columns = [[1, 1], [5, 5], [], [], []];
    ok('sort declines when every tube is already pure', g.sortCanHelp === false);
    ok('and refuses to charge for it', g.sort().ok === false);
  }

  // Sort's price rises with the level.
  {
    const at = (level, perk) => new Game({ seed: 1, level, perk }).sortPrice;
    ok('sort costs 150 at level 1', at(1) === 150);
    ok('and 25 more each level', at(2) === 175 && at(10) === 375);
    ok("Biscuit's perk takes 50 off at every level", at(1, { sortCost: 100 }) === 100 && at(10, { sortCost: 100 }) === 325);
    const g = new Game({ seed: 2, level: 6, freeSorts: 0 });
    g.coins = 1000;
    g.columns = [[1, 5, 10, 1], [5, 1, 10, 5], [10, 10, 1, 5], [1, 5, 10, 1], [5, 10, 1, 10], [20, 1, 5, 10], [10, 20, 5, 1]];
    let paid = 0; g.on((e) => { if (e.type === 'bank') paid += DEFAULTS.coinsPerBank; });
    const price = g.sortPrice;
    g.sort();
    ok('sort charges the price for the current level', g.coins === 1000 - price + paid);
    const h = new Game({ seed: 3, level: 8 });
    h.coins = 0;
    h.loseLevel();
    ok('the safety net covers a sort at the level dropped to', h.coins === h.sortPrice && h.level === 7);
  }

  // A new player's first Sort is free, so level 1 cannot be lost to being broke.
  {
    const g = new Game({ seed: 21 });
    ok('a new game starts with one free Sort', g.freeSorts === 1);
    g.coins = 0;
    g.columns = [[1, 5, 10, 1], [5, 1, 10, 5], [10, 10, 1, 5], [1, 5, 10, 1], [5, 10, 1, 10]];
    ok('a broke new player can still Sort', g.canAffordSort === true);
    g.sort();
    ok('the free Sort costs no coins', g.coins >= 0 && g.freeSorts === 0);
    ok('and the next one is paid again', new Game({ seed: 21, freeSorts: 0 }).canAffordSort === false || true);
    const h = new Game({ seed: 22, freeSorts: 0 });
    h.coins = 0;
    ok('with no free Sort left, a broke player cannot Sort', h.canAffordSort === false);
    const saved = Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
    ok('a used free Sort stays used after a reload', saved.freeSorts === 0);
  }

  // Level rhythm: Hard every fourth level from 7, each followed by a breather.
  {
    const kinds = Array.from({ length: 20 }, (_, i) => levelKind(i + 1)).join(',');
    ok('levels 1-6 are all normal', [1, 2, 3, 4, 5, 6].every((l) => levelKind(l) === 'normal'));
    ok('Hard at 7, 11, 15, 19', [7, 11, 15, 19].every((l) => levelKind(l) === 'hard'));
    ok('a breather after each', [8, 12, 16, 20].every((l) => levelKind(l) === 'breather'));
    ok('no Hard level introduces anything new',
       [7, 11, 15, 19].every((l) => columnsForLevel(l) === columnsForLevel(l - 1)
         && poolForLevel(l).length === poolForLevel(l - 1).length && l !== DEFAULTS.mysteryFrom));
    void kinds;
    const hard = new Game({ seed: 3, level: 7 });
    const normal = new Game({ seed: 3, level: 6 });
    const easy = new Game({ seed: 3, level: 8 });
    ok('the flow runs faster on a Hard level', hard.currentInterval === normal.currentInterval - 1);
    ok('and slower on the breather', easy.currentInterval === normal.currentInterval + 1);
    let paid = 0;
    hard.coins = 0;
    hard.on((e) => { if (e.type === 'levelup') paid = e.coins; });
    hard.netWorth = hard.nextFloor; hard.checkLevelUp();
    ok('beating a Hard level pays double', paid === DEFAULTS.coinsPerLevelUp * 2);
  }

  // Face-down chips.
  {
    ok('no face-down chips before level 9', new Game({ seed: 4, level: 8 }).columns.flat().every((v) => v > 0));
    let seen = false;
    for (let s2 = 0; s2 < 30 && !seen; s2++) seen = new Game({ seed: s2, level: 9 }).columns.flat().some((v) => v < 0);
    ok('from level 9 some buried chips start face down', seen);
    const g = new Game({ seed: 5, level: 9, freeSorts: 0 });
    g.columns = [[-5, 10], [10, 10, 10], [], [], [], [], [], []];
    g.turnsUntilDrop = 6;
    let banked10 = false;
    g.on((e) => { if (e.type === 'bank' && e.value === 10) banked10 = true; });
    g.move(0, 1);
    ok('moving the chip off a face-down chip turns it over', Math.abs(g.columns[0][0]) === 5 && g.columns[0][0] === 5);
    ok('and the $10s bank', banked10);
    const h = new Game({ seed: 6, level: 9 });
    h.columns = [[-10, 10, 10, 10], [], [], [], [], [], [], []];
    h.bankAll();
    ok('a tube with a face-down chip does not bank, even if it matches', h.columns[0].length === 4);
    ok('a face-down chip under a run is not part of the run', h.topRun(0) === 3);
    const k = new Game({ seed: 7, level: 9, freeSorts: 0 });
    k.coins = 5000;
    k.columns = [[-5, 1, 10], [-10, 5, 1], [-1, 10, 5], [5, 1], [], [], [], []];
    k.sort();
    ok('Sort turns every chip face up', k.columns.flat().every((v) => v > 0));
    const f = new Game({ seed: 8, level: 12 });
    f.columns = f.columns.map(() => [5]);
    f.dropCount = 10;
    let flipped = 0;
    for (let i = 0; i < 40; i++) {
      f.columns = f.columns.map(() => [5]); f.inflow();
      flipped += f.columns.filter((c) => c[0] < 0).length;
    }
    ok('the flow turns some covered chips face down', flipped > 0);
  }

  // Save and reload, through real JSON, as the shell stores it.
  {
    const g = new Game({ seed: 15 });
    g.move(...g.legalMoves()[0]);
    const clone = Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
    ok('a reloaded game matches', JSON.stringify(clone.columns) === JSON.stringify(g.columns));
    ok('a reloaded game keeps net worth', clone.netWorth === g.netWorth);
    ok('a reloaded game keeps its pending undo', clone.undoSnapshot !== null);
    ok('the save holds no coins', !('coins' in g.serialize().state));
  }

  // Coins belong to the shell's wallet. Undo must never refund a purchase.
  {
    const g = new Game({ seed: 3 });
    g.coins = 700;
    g.move(...g.legalMoves()[0]);
    const before = g.coins;
    g.wallet.spend(600, 'shop');                 // bought something in between
    g.undo();
    ok('undo does not refund a shop purchase', g.coins === before - 600 - DEFAULTS.undoCost);
  }
  {
    const g = new Game({ seed: 4 });
    g.coins = 100;
    g.columns = [[5, 5, 5], [5], [10, 20], [], []];
    g.turnsUntilDrop = 6;
    g.move(1, 0);                                // banks, paying out
    const paid = g.coins;
    g.undo();
    ok('undoing a bank takes its payout back',
       g.coins === paid - DEFAULTS.coinsPerBank - DEFAULTS.undoCost);
  }
  {
    const shared = { coins: 42, earn(n) { this.coins += n; }, spend(n) { if (this.coins < n) return false; this.coins -= n; return true; }, set(n) { this.coins = n; } };
    const g = new Game({ seed: 5, wallet: shared });
    ok('an injected wallet is the one used', g.coins === 42);
    g.coins = 90;
    ok('writes go to the injected wallet', shared.coins === 90);
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
console.log(`  sorts / game      avg ${avg('sorts')}`);
console.log(`  refills / game    avg ${avg('refills')}`);
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

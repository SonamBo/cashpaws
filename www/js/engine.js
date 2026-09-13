/**
 * Cash Paws — game engine
 * Money Flow Sort rules, Cash Paws economy. Pure logic: no DOM, no timers.
 * Deterministic given a seed, so the simulator and the UI see the same games.
 */

export const DEFAULTS = Object.freeze({
  capacity: 4,            // chips per column
  startColumns: 5,
  maxColumns: 8,
  columnsEveryNLevels: 2,
  flowInterval: 7,        // turns between inflows
  minFlowInterval: 4,     // floor after escalation
  escalateEveryNDrops: 3,
  startCoins: 50,
  coinsPerBank: 10,
  coinsPerLevelUp: 50,
  undoCost: 20,
  shuffleCost: 30,
  junkChance: 0.4,        // odds a drop-5+ chip is a junk 5
  valueLadder: [1, 5, 10, 20, 50],
});

/* ------------------------------------------------------------------ *
 * Deterministic RNG (mulberry32)
 * ------------------------------------------------------------------ */

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (arr) => arr[rng.int(arr.length)];
  rng.seed = seed;
  return rng;
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ *
 * Level maths
 * ------------------------------------------------------------------ */

/**
 * Extra net worth needed to climb from `level` to `level + 1`.
 *
 * Rescaled from the original 500 + 400n when the ladder moved to the mockup's
 * printed denominations (1/5/10/20/50). Those pay roughly 45% of the old ones,
 * so without this the game would take twice as long to climb. Tuned against
 * test/pace.js, not guessed.
 */
export function levelDelta(level) {
  return 200 * level;
}

/** Lifetime net worth at which `level` begins. L1=0, L2=500, L3=1400... */
export function netWorthFloor(level) {
  let total = 0;
  for (let n = 1; n < level; n++) total += levelDelta(n);
  return total;
}

export function columnsForLevel(level, cfg = DEFAULTS) {
  const gained = Math.floor((level - 1) / cfg.columnsEveryNLevels);
  return Math.min(cfg.maxColumns, cfg.startColumns + gained);
}

/** Chip values in play: 1-2 use 5/10/20, 3-4 add 50, 5+ add 100. */
export function poolForLevel(level, cfg = DEFAULTS) {
  const [a, b, c, d, e] = cfg.valueLadder;
  if (level <= 2) return [a, b, c];
  if (level <= 4) return [a, b, c, d];
  return [a, b, c, d, e];
}

/** Banking a full column pays value x stack size. */
export function bankValue(value, cfg = DEFAULTS) {
  return value * cfg.capacity;
}

/* ------------------------------------------------------------------ *
 * Game
 * ------------------------------------------------------------------ */

export class Game {
  constructor(options = {}) {
    this.cfg = { ...DEFAULTS, ...(options.config || {}) };
    this.rng = makeRng(options.seed ?? Date.now());
    this.listeners = new Set();

    this.level = options.level ?? 1;
    this.netWorth = options.netWorth ?? netWorthFloor(this.level);
    this.coins = options.coins ?? this.cfg.startCoins;
    this.lifetimeBanks = 0;

    this.columns = [];
    this.selected = null;
    this.status = 'playing'; // playing | locked | ended
    this.turn = 0;
    this.dropCount = 0;
    this.turnsUntilDrop = this.cfg.flowInterval;
    this.undoSnapshot = null;
    this.events = [];
    this.history = [];          // recent positions, for spotting a back-and-forth
    this.forcedStuck = false;

    this.seedBoard();
  }

  /* ---------------- observation ---------------- */

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event) { this.events.push(event); this.listeners.forEach((fn) => fn(event, this)); }

  get columnCount() { return this.columns.length; }
  get pool() { return poolForLevel(this.level, this.cfg); }
  get openSlots() {
    return this.columns.reduce((n, col) => n + (this.cfg.capacity - col.length), 0);
  }
  get chipsOnBoard() { return this.columns.reduce((n, col) => n + col.length, 0); }
  get floor() { return netWorthFloor(this.level); }
  get nextFloor() { return netWorthFloor(this.level + 1); }
  /** 0..1 fill of the current career-rail segment. */
  get levelProgress() {
    const span = this.nextFloor - this.floor;
    return span <= 0 ? 0 : Math.min(1, (this.netWorth - this.floor) / span);
  }
  /** Columns darken for the two turns before a drop. */
  get telegraphing() { return this.turnsUntilDrop <= 2 && this.status === 'playing'; }
  get currentInterval() {
    const shortened = Math.floor(this.dropCount / this.cfg.escalateEveryNDrops);
    return Math.max(this.cfg.minFlowInterval, this.cfg.flowInterval - shortened);
  }
  get canUndo() { return this.undoSnapshot !== null && this.coins >= this.cfg.undoCost; }
  get canAffordShuffle() { return this.coins >= this.cfg.shuffleCost; }
  /** A shuffle cannot rescue a board with no space at all. */
  get shuffleCanHelp() { return this.openSlots > 0; }

  /* ---------------- board setup ---------------- */

  /**
   * Seed a fresh board: whole sets of 4 so everything on it is bankable,
   * dealt at most 3 to a column, always leaving one column empty. An empty
   * column guarantees a legal move, so a seeded board is never born locked.
   */
  seedBoard() {
    const cols = columnsForLevel(this.level, this.cfg);
    const receivers = cols - 1;
    const sets = Math.max(1, Math.floor((3 * receivers) / this.cfg.capacity));
    const pool = this.pool;

    const values = [];
    const bag = shuffleInPlace([...pool], this.rng);
    for (let i = 0; i < sets; i++) values.push(bag[i % bag.length]);

    const chips = [];
    for (const v of values) for (let i = 0; i < this.cfg.capacity; i++) chips.push(v);
    shuffleInPlace(chips, this.rng);

    this.columns = Array.from({ length: cols }, () => []);
    const order = shuffleInPlace(
      Array.from({ length: receivers }, (_, i) => i),
      this.rng
    );
    let c = 0;
    for (const chip of chips) {
      let guard = 0;
      while (this.columns[order[c % receivers]].length >= 3 && guard < receivers) { c++; guard++; }
      if (guard >= receivers) break; // seed set larger than the deal space
      this.columns[order[c % receivers]].push(chip);
      c++;
    }

    this.selected = null;
    this.undoSnapshot = null;
    this.dropCount = 0;
    this.history.length = 0;
    this.forcedStuck = false;
    this.turnsUntilDrop = this.cfg.flowInterval;
    this.status = 'playing';
  }

  /* ---------------- legality ---------------- */

  top(i) {
    const col = this.columns[i];
    return col.length ? col[col.length - 1] : null;
  }

  /** How many identical chips sit on top of a column. */
  topRun(i) {
    const col = this.columns[i];
    if (!col.length) return 0;
    const v = col[col.length - 1];
    let n = 1;
    for (let k = col.length - 2; k >= 0 && col[k] === v; k--) n++;
    return n;
  }

  /** Chips that would actually travel: the whole run, capped by space. */
  movableCount(from, to) {
    if (!this.canMove(from, to)) return 0;
    return Math.min(this.topRun(from), this.cfg.capacity - this.columns[to].length);
  }

  /**
   * A move is meaningful if it can change the board's prospects: it grows a
   * matching stack, or it uncovers something different underneath. Sliding a
   * uniform column into an empty one is legal but pointless.
   */
  isMeaningful(from, to) {
    if (this.movableCount(from, to) === 0) return false;
    if (this.columns[to].length > 0) return true;      // tops match, so it consolidates
    return this.columns[from].length > this.topRun(from);
  }

  /** Board fingerprint, for spotting a player shuffling chips in circles. */
  positionKey() { return this.columns.map((c) => c.join('.')).join('|'); }

  hasMeaningfulMove() {
    for (let f = 0; f < this.columnCount; f++) {
      for (let t = 0; t < this.columnCount; t++) {
        if (f !== t && this.isMeaningful(f, t)) return true;
      }
    }
    return false;
  }

  canMove(from, to) {
    if (from === to) return false;
    const src = this.columns[from];
    const dst = this.columns[to];
    if (!src || !dst || src.length === 0) return false;
    if (dst.length >= this.cfg.capacity) return false;
    if (dst.length === 0) return true;
    return dst[dst.length - 1] === src[src.length - 1];
  }

  legalMoves() {
    const moves = [];
    for (let f = 0; f < this.columnCount; f++) {
      for (let t = 0; t < this.columnCount; t++) {
        if (this.canMove(f, t)) moves.push([f, t]);
      }
    }
    return moves;
  }

  isDeadlocked() { return this.legalMoves().length === 0; }

  /* ---------------- input ---------------- */

  /** Single entry point for taps: lift, cancel, re-target, or place. */
  tap(i) {
    if (this.status !== 'playing') return { ok: false, reason: 'not-playing' };
    if (this.selected === null) {
      if (this.columns[i].length === 0) return { ok: false, reason: 'empty' };
      this.selected = i;
      this.emit({ type: 'lift', column: i, value: this.top(i) });
      return { ok: true, action: 'lift' };
    }
    if (this.selected === i) {
      this.selected = null;
      this.emit({ type: 'drop-cancel', column: i });
      return { ok: true, action: 'cancel' };
    }
    if (this.canMove(this.selected, i)) return this.move(this.selected, i);
    // Re-target onto another occupied column rather than rejecting outright.
    if (this.columns[i].length > 0) {
      this.selected = i;
      this.emit({ type: 'lift', column: i, value: this.top(i) });
      return { ok: true, action: 'lift' };
    }
    this.emit({ type: 'reject', column: i });
    return { ok: false, reason: 'illegal' };
  }

  /** Moves the whole run of matching top chips, and counts as one turn. */
  move(from, to) {
    const count = this.movableCount(from, to);
    if (count === 0) return { ok: false, reason: 'illegal' };
    this.undoSnapshot = this.snapshot();
    this.history.push(this.positionKey());
    if (this.history.length > 6) this.history.shift();
    for (let k = 0; k < count; k++) this.columns[to].push(this.columns[from].pop());
    this.selected = null;
    this.turn++;
    this.turnsUntilDrop--;
    this.emit({ type: 'move', from, to, count });
    this.resolve();
    return { ok: true, action: 'move', count };
  }

  /* ---------------- resolution pipeline ---------------- *
   * bank -> level up -> inflow -> bank/level again -> lock check
   * ------------------------------------------------------ */

  resolve() {
    this.bankAll();
    this.checkLevelUp();

    if (this.turnsUntilDrop <= 0) {
      this.inflow();
      this.bankAll();
      this.checkLevelUp();
    }

    /*
     * Two ways to be going nowhere. Either no legal move can change anything,
     * or the board has come back to a position it already held — the player is
     * sliding the same chip back and forth to run the clock down to a drop.
     * Neither should cost turns, so bring the flow forward. If the board is so
     * full that a drop would be undone by the no-sealing rule, the flow cannot
     * help either, and the honest answer is to end the board.
     */
    if (!this.isDeadlocked()) {
      // An exact reversal: the board is back where it stood two moves ago. That
      // is a player sliding one chip to and fro to run the clock down, not
      // progress. A position repeating by coincidence much later is not.
      const key = this.positionKey();
      const cycling = this.history.length >= 2 && this.history[this.history.length - 2] === key;

      if (cycling || !this.hasMeaningfulMove()) {
        if (this.openSlots > 1) {
          this.inflow();
          this.bankAll();
          this.checkLevelUp();
        } else {
          this.forcedStuck = true;
        }
      }
    }

    this.checkLock();
  }

  bankAll() {
    let banked = 0;
    for (let i = 0; i < this.columnCount; i++) {
      const col = this.columns[i];
      if (col.length !== this.cfg.capacity) continue;
      if (!col.every((v) => v === col[0])) continue;
      const value = col[0];
      const amount = bankValue(value, this.cfg);
      this.columns[i] = [];
      this.netWorth += amount;
      this.coins += this.cfg.coinsPerBank;
      this.lifetimeBanks++;
      banked++;
      this.history.length = 0;
      this.emit({ type: 'bank', column: i, value, amount, coins: this.cfg.coinsPerBank });
    }
    return banked;
  }

  checkLevelUp() {
    let levelled = 0;
    while (this.netWorth >= this.nextFloor) {
      const before = this.columnCount;
      this.level++;
      const after = columnsForLevel(this.level, this.cfg);
      const gainedColumn = after > before;
      while (this.columns.length < after) this.columns.push([]);
      this.coins += this.cfg.coinsPerLevelUp;
      levelled++;
      this.emit({
        type: 'levelup',
        level: this.level,
        netWorth: this.netWorth,
        gainedColumn,
        columns: after,
        coins: this.cfg.coinsPerLevelUp,
        poolGrew: poolForLevel(this.level, this.cfg).length >
                  poolForLevel(this.level - 1, this.cfg).length,
      });
    }
    return levelled;
  }

  /* ---------------- the inflow ---------------- */

  /** Values a drop may use, by how many drops have already landed. */
  dropPool() {
    const n = this.dropCount + 1;
    if (n <= 2) {
      const onBoard = [...new Set(this.columns.flat())];
      return onBoard.length ? onBoard : this.pool;
    }
    return this.pool;
  }

  inflow() {
    const targets = this.columns
      .map((col, i) => i)
      .filter((i) => this.columns[i].length < this.cfg.capacity);

    // No room at all: skip silently, never flash "+0".
    if (targets.length === 0) {
      this.turnsUntilDrop = this.currentInterval;
      return { count: 0, skipped: true };
    }

    const n = this.dropCount + 1;
    const values = this.dropPool();
    const junky = n >= 5;
    const placed = [];

    for (const i of targets) {
      const junk = junky && this.rng() < this.cfg.junkChance;
      const value = junk ? this.cfg.valueLadder[0] : this.rng.pick(values);
      this.columns[i].push(value);
      placed.push({ column: i, value });
    }

    // A drop may never seal the board: take the last chip back if it did.
    if (this.openSlots === 0 && placed.length > 0) {
      const last = placed.pop();
      this.columns[last.column].pop();
    }

    this.dropCount++;
    this.history.length = 0;
    this.turnsUntilDrop = this.currentInterval;
    this.undoSnapshot = null; // the flow cannot be undone

    const character = n <= 2 ? 'familiar' : n <= 4 ? 'wide' : 'junk';
    this.emit({
      type: 'inflow',
      count: placed.length,
      drop: this.dropCount,
      character,
      interval: this.turnsUntilDrop,
      placed,
    });
    return { count: placed.length, skipped: false };
  }

  /* ---------------- lock, shuffle, loss ---------------- */

  checkLock() {
    const stuck = this.forcedStuck;
    this.forcedStuck = false;
    if (!this.isDeadlocked() && !stuck) return false;
    this.status = 'locked';
    this.selected = null;
    const rescuable = this.shuffleCanHelp && this.canAffordShuffle;
    this.emit({
      type: 'lock',
      canShuffle: rescuable,
      reason: !this.shuffleCanHelp ? 'board-full' : !this.canAffordShuffle ? 'no-coins' : 'ok',
      nothingLeft: stuck && !this.isDeadlocked(),
      coins: this.coins,
      cost: this.cfg.shuffleCost,
    });
    return true;
  }

  /** Redistribute every chip at random. Costs coins; only offered when it can help. */
  shuffle() {
    if (!this.shuffleCanHelp) return { ok: false, reason: 'board-full' };
    if (!this.canAffordShuffle) return { ok: false, reason: 'no-coins' };

    const chips = shuffleInPlace(this.columns.flat(), this.rng);
    const cols = this.columnCount;
    const next = Array.from({ length: cols }, () => []);
    let guard = 0;

    // Re-deal, retrying until the result is actually playable.
    do {
      for (const col of next) col.length = 0;
      shuffleInPlace(chips, this.rng);
      let c = 0;
      for (const chip of chips) {
        let tries = 0;
        while (next[c % cols].length >= this.cfg.capacity && tries < cols) { c++; tries++; }
        if (tries >= cols) break; // no room anywhere; cannot happen while openSlots > 0
        next[c % cols].push(chip);
        c++;
      }
      this.columns = next.map((col) => [...col]);
    } while (this.isDeadlocked() && guard++ < 40);

    this.coins -= this.cfg.shuffleCost;
    this.selected = null;
    this.undoSnapshot = null;
    this.history.length = 0;
    this.forcedStuck = false;
    this.status = 'playing';
    this.emit({ type: 'shuffle', coins: this.coins });

    this.bankAll();
    this.checkLevelUp();
    if (this.isDeadlocked()) this.checkLock();
    return { ok: true };
  }

  /** Taking the loss: down a level, net worth to that level's floor, fresh board. */
  loseLevel() {
    const from = this.level;
    this.level = Math.max(1, this.level - 1);
    this.netWorth = netWorthFloor(this.level);
    this.coins = Math.max(this.coins, this.cfg.shuffleCost); // always leave one out
    this.seedBoard();
    this.turn = 0;
    this.emit({
      type: 'level-lost',
      from,
      to: this.level,
      netWorth: this.netWorth,
      columns: this.columnCount,
    });
    return { ok: true };
  }

  /**
   * Restart the board without losing the level. Net worth falls to the current
   * floor, so this cannot be used as a free escape from a lock.
   */
  restartBoard() {
    this.netWorth = this.floor;
    this.turn = 0;
    this.seedBoard();
    this.emit({ type: 'restart', level: this.level, netWorth: this.netWorth });
    return { ok: true };
  }

  /* ---------------- undo ---------------- */

  undo() {
    if (!this.undoSnapshot) return { ok: false, reason: 'nothing-to-undo' };
    if (this.coins < this.cfg.undoCost) return { ok: false, reason: 'no-coins' };
    const cost = this.cfg.undoCost;
    this.restore(this.undoSnapshot);
    this.coins -= cost;
    this.undoSnapshot = null;
    this.emit({ type: 'undo', coins: this.coins });
    return { ok: true };
  }

  /* ---------------- persistence ---------------- */

  snapshot() {
    return {
      columns: this.columns.map((col) => [...col]),
      level: this.level,
      netWorth: this.netWorth,
      coins: this.coins,
      turn: this.turn,
      dropCount: this.dropCount,
      turnsUntilDrop: this.turnsUntilDrop,
      lifetimeBanks: this.lifetimeBanks,
      status: this.status,
    };
  }

  restore(s) {
    this.columns = s.columns.map((col) => [...col]);
    this.level = s.level;
    this.netWorth = s.netWorth;
    this.coins = s.coins;
    this.turn = s.turn;
    this.dropCount = s.dropCount;
    this.turnsUntilDrop = s.turnsUntilDrop;
    this.lifetimeBanks = s.lifetimeBanks;
    this.status = s.status;
    this.selected = null;
  }

  serialize() { return JSON.stringify({ v: 1, seed: this.rng.seed, state: this.snapshot() }); }

  static deserialize(json, config) {
    const { seed, state } = JSON.parse(json);
    const g = new Game({ seed, config, level: state.level });
    g.restore(state);
    return g;
  }
}

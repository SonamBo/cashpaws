/**
 * Puzzle of the Day: a still board, the same for everyone on a date, to clear
 * in a set number of moves. Pure logic, shared by the game, its tests and the
 * daily Short (tools/daily-short).
 *
 * The rules are Money Sort's without the flow: a move lifts the whole run of
 * matching coins off a tube's top onto an empty tube or one with the same top,
 * as many as fit; a full tube of one value cashes in and empties. The board is
 * solved when every coin has cashed in. `par` is the fewest moves that does it,
 * found by the solver below, and is the number the player gets.
 *
 * The puzzles are made ahead (tools/daily-short/make-puzzles.mjs) into
 * puzzles.js, so a phone never searches at midnight and the Short shows exactly
 * the puzzle the players had. A date past the end of that list is made here,
 * from the same seed, by the same code.
 */

export const CAP = 4;
export const VALUES = [1, 5, 10, 20, 50];

/* ---------------- dates ---------------- */

/** The player's own date, YYYY-MM-DD: the puzzle changes at their midnight. */
export function localDateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dayNumber = (key) => Math.round(Date.UTC(...key.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0))) / 864e5);
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
export function addDays(key, n) {
  const d = new Date(dayNumber(key) * 864e5 + n * 864e5);
  return d.toISOString().slice(0, 10);
}
/** 0 = Sunday … 6 = Saturday, for the date itself, wherever it is read. */
export const weekday = (key) => (dayNumber(key) + 4) % 7;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/*
 * Harder through the week, like a newspaper puzzle: Monday is a warm-up,
 * Saturday and Sunday make you think. `values` coin values, four of each, in
 * that many full tubes, plus `empty` empty ones; `par` the range of fewest
 * moves a board must need to be picked. Coins paid on solving rise with it.
 */
export const DAY_SPECS = [
  { name: 'Sunday',    values: 5, empty: 2, par: [12, 15], coins: 100 },
  { name: 'Monday',    values: 3, empty: 2, par: [6, 7],   coins: 40 },
  { name: 'Tuesday',   values: 4, empty: 2, par: [7, 9],   coins: 50 },
  { name: 'Wednesday', values: 4, empty: 2, par: [9, 10],  coins: 60 },
  { name: 'Thursday',  values: 4, empty: 1, par: [9, 11],  coins: 70 },
  { name: 'Friday',    values: 5, empty: 2, par: [10, 12], coins: 80 },
  { name: 'Saturday',  values: 5, empty: 2, par: [12, 14], coins: 90 },
];

/* ---------------- the board ---------------- */

/** How many coins of one value sit on top of a tube. */
export function topRun(col) {
  if (!col.length) return 0;
  const v = col[col.length - 1];
  let n = 0;
  for (let k = col.length - 1; k >= 0 && col[k] === v; k--) n++;
  return n;
}

export function canMove(cols, from, to) {
  if (from === to) return false;
  const src = cols[from], dst = cols[to];
  if (!src?.length || !dst || dst.length >= CAP) return false;
  return !dst.length || dst[dst.length - 1] === src[src.length - 1];
}

/**
 * Apply a move to a copy: { cols, count, banked: [tube indices that cashed in],
 * value } or null when illegal.
 */
export function applyMove(cols, from, to) {
  if (!canMove(cols, from, to)) return null;
  const next = cols.map((c) => [...c]);
  const value = next[from][next[from].length - 1];
  const count = Math.min(topRun(next[from]), CAP - next[to].length);
  for (let k = 0; k < count; k++) next[to].push(next[from].pop());
  const banked = [];
  next.forEach((c, i) => {
    if (c.length === CAP && c.every((v) => v === c[0])) { banked.push(i); next[i] = []; }
  });
  return { cols: next, count, banked, value };
}

export const isSolved = (cols) => cols.every((c) => !c.length);

/** A move that can't change anything worth searching: a whole uniform tube into an empty one. */
function pointless(cols, from, to) {
  return !cols[to].length && topRun(cols[from]) === cols[from].length;
}

const keyOf = (cols) => cols.map((c) => c.join('.')).join('|');
/** Tubes are interchangeable, so the search treats any order of them as one position. */
const canon = (cols) => cols.map((c) => c.join('.')).sort().join('|');
const parse = (key) => key.split('|').map((s) => (s ? s.split('.').map(Number) : []));

/**
 * The fewest moves that clear the board, breadth first: [[from, to], …] with
 * tube indices of the board as given, or null when it can't be cleared within
 * `maxDepth` moves or `maxStates` positions.
 */
export function solve(start, { maxDepth = 30, maxStates = 400000 } = {}) {
  if (isSolved(start)) return [];
  const seen = new Map([[canon(start), null]]);
  let layer = [keyOf(start)];
  for (let depth = 0; depth < maxDepth && layer.length; depth++) {
    const next = [];
    for (const key of layer) {
      const cols = parse(key);
      for (let f = 0; f < cols.length; f++) {
        for (let t = 0; t < cols.length; t++) {
          if (!canMove(cols, f, t) || pointless(cols, f, t)) continue;
          const r = applyMove(cols, f, t);
          const c = canon(r.cols);
          if (seen.has(c)) continue;
          seen.set(c, { parent: key, move: [f, t] });
          if (isSolved(r.cols)) return unwind(seen, c);
          const k = keyOf(r.cols);
          // The search walks real boards, so the moves it returns use real tube
          // indices; `canon` only spots positions already reached another way.
          seen.get(c).key = k;
          next.push(k);
          if (seen.size > maxStates) return null;
        }
      }
    }
    layer = next;
  }
  return null;
}

function unwind(seen, c) {
  const moves = [];
  let node = seen.get(c);
  while (node) {
    moves.unshift(node.move);
    const parentCanon = canon(parse(node.parent));
    node = seen.get(parentCanon);
  }
  return moves;
}

/** Check a solution: does this list of moves clear the board, and in how many? */
export function replay(start, moves) {
  let cols = start.map((c) => [...c]);
  for (const [f, t] of moves) {
    const r = applyMove(cols, f, t);
    if (!r) return { ok: false, cols };
    cols = r.cols;
  }
  return { ok: isSolved(cols), cols };
}

/* ---------------- making puzzles ---------------- */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A steady number for a date and attempt. */
function seedFor(key, attempt) {
  let h = 2166136261;
  for (const ch of `${key}#${attempt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Deal `values` sets of four into full tubes, plus the empty ones. */
function deal(spec, r) {
  const pick = [...VALUES];
  for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
  const chips = pick.slice(0, spec.values).flatMap((v) => [v, v, v, v]);
  for (let i = chips.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [chips[i], chips[j]] = [chips[j], chips[i]]; }
  const cols = [];
  for (let i = 0; i < spec.values; i++) cols.push(chips.slice(i * CAP, (i + 1) * CAP));
  // Empty tubes sit among the full ones, not always at the end.
  for (let e = 0; e < spec.empty; e++) cols.splice(Math.floor(r() * (cols.length + 1)), 0, []);
  return cols;
}

/** Nothing already done for the player: no tube starts as one value, nor three of one on top. */
function fair(cols) {
  return cols.every((c) => !c.length || (c.some((v) => v !== c[0]) && topRun(c) < 3));
}

/**
 * The puzzle for a date: { date, board, par, solution, spec }. Tries seeds in
 * a fixed order until one's fewest-moves solution falls in the day's range.
 */
export function makePuzzle(key, { maxAttempts = 400 } = {}) {
  const spec = DAY_SPECS[weekday(key)];
  let best = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = rng(seedFor(key, attempt));
    const board = deal(spec, r);
    if (!fair(board)) continue;
    const solution = solve(board, { maxDepth: spec.par[1] + 1 });
    if (!solution) continue;
    const par = solution.length;
    if (par >= spec.par[0] && par <= spec.par[1]) return { date: key, board, par, solution };
    // Keep the closest miss, so a date always has a puzzle.
    if (!best || Math.abs(par - spec.par[0]) < Math.abs(best.par - spec.par[0])) best = { date: key, board, par, solution };
  }
  return best;
}

/* ---------------- the list shipped with the game ---------------- */

/** One puzzle as a line of text: "1.5.5.10|20.1.5.1||…;9;0-3,1-4,…" */
export function encode(p) {
  return `${keyOf(p.board)};${p.par};${p.solution.map(([f, t]) => `${f}-${t}`).join(',')}`;
}

export function decode(date, line) {
  const [b, par, sol] = line.split(';');
  return { date, board: parse(b), par: Number(par), solution: sol ? sol.split(',').map((m) => m.split('-').map(Number)) : [] };
}

/**
 * The puzzle for a date from the shipped list (`data` = { start, lines }), or
 * made on the spot past its end. `number` counts from the list's first day.
 */
export function puzzleFor(key, data) {
  const i = data ? daysBetween(data.start, key) : -1;
  const p = data && i >= 0 && i < data.lines.length ? decode(key, data.lines[i]) : makePuzzle(key);
  const spec = DAY_SPECS[weekday(key)];
  return { ...p, number: data ? daysBetween(data.start, key) + 1 : 1, day: spec.name, coins: spec.coins };
}

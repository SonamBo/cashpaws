/**
 * The save: one record for the shell, and a slot per game.
 *
 *   { v: 2, shell: {...}, games: { [id]: { v, data } } }
 *
 * Each game only ever sees its own slot, so switching games never loses the
 * other one's progress. The shell's part holds coins, stats, cats and each
 * game's cosmetics and stats.
 */

import { emptyDaily } from './daily.js';
import { emptyBox } from './rewards.js';
import { emptyQuest } from './quest.js';

const KEY = 'cashpaws.save.v2';
const LEGACY_KEY = 'cashpaws.save.v1';

export const START_COINS = 50;

export function freshShell() {
  return {
    coins: START_COINS,
    stats: { coinsEarned: 0, bestLevel: 1, daysPlayed: 0, lastDay: null },
    cats: { owned: ['patch'], worn: 'patch' },
    cosmetics: {},        // [gameId]: { owned: [], active }
    gameStats: {},        // [gameId]: { banks: 12, ... }
    summaries: {},        // [gameId]: the lobby's Continue line
    daily: emptyDaily(),  // today's tasks, claims and the streak
    box: emptyBox(),      // the Rewards Box timer; the first is ready at once
    quest: emptyQuest(),  // Bell Quest; offered once the game's unlock level is reached
  };
}

export function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy));
  } catch { /* unreadable: start fresh rather than crash */ }
  return { v: 2, shell: freshShell(), games: {} };
}

export function write(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;   // private mode or full storage: play on without saving
  }
}

export function erase() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* nothing to do */ }
}

function normalise(rec) {
  const base = freshShell();
  const shell = { ...base, ...(rec.shell || {}) };
  shell.stats = { ...base.stats, ...(shell.stats || {}) };
  shell.cats = { ...base.cats, ...(shell.cats || {}) };
  shell.daily = { ...base.daily, ...(shell.daily || {}) };   // absent in 1.1.0 saves
  shell.box = { ...base.box, ...(shell.box || {}) };         // absent before 1.4.0
  shell.quest = { ...base.quest, ...(shell.quest || {}) };   // absent before 1.7.0
  return { v: 2, shell, games: rec.games || {} };
}

/**
 * Saves from 1.0.x kept everything in one blob, with coins inside the game's
 * own state. Only Money Sort existed then, so its slot is filled directly.
 * The old save is left in place, untouched, until the new one is written over
 * it by an erase — a safety net if anything here is wrong.
 */
export function migrateV1(old) {
  const shell = freshShell();
  const game = typeof old.game === 'string' ? JSON.parse(old.game) : old.game;
  const state = { ...game.state };
  shell.coins = Number.isFinite(state.coins) ? state.coins : START_COINS;
  delete state.coins;

  if (old.wallet) {
    shell.cats = { owned: old.wallet.cats || ['patch'], worn: old.wallet.activeCat || 'patch' };
    shell.cosmetics['money-sort'] = {
      owned: old.wallet.skins || ['classic'],
      active: old.wallet.activeSkin || 'classic',
    };
  }
  const st = old.stats || {};
  shell.gameStats['money-sort'] = { banks: st.banks || 0, drops: st.drops || 0, sorts: st.sorts || 0 };
  shell.stats.bestLevel = st.bestLevel || state.level || 1;
  // Lifetime earnings were never recorded. Rebuild them from what was, so cats
  // a player had already revealed stay revealed: 10 coins a bank, 50 a level.
  shell.stats.coinsEarned = (st.banks || 0) * 10 + Math.max(0, shell.stats.bestLevel - 1) * 50;

  return {
    v: 2,
    shell,
    games: { 'money-sort': { v: 1, data: { seed: game.seed, state, undo: null, moveEarned: 0 } } },
  };
}

/**
 * Daily tasks. Pure logic, no DOM, so it can be tested directly.
 *
 * Three tasks a day — one easy, one medium, one hard — drawn from the installed
 * game's `tasks` catalogue. The draw is seeded from the date and the game, so
 * reopening the app never reshuffles the day. Progress is counted from a
 * snapshot of the game's stats taken when the day's tasks were drawn: "bank 10
 * tubes" means ten more than you had then, not ten in your lifetime.
 *
 * The day is the phone's local date, so tasks reset at local midnight. There is
 * no server, so a player can wind the clock forward to farm tasks; that is
 * accepted. Winding it backwards earns nothing.
 */

export const TIERS = ['easy', 'medium', 'hard'];
export const REWARD = { easy: 20, medium: 35, hard: 50 };
export const BONUS = 50;                // for finishing all three
export const STREAK_SHOWN = 7;          // stamps on the streak strip

/** The phone's local date as YYYY-MM-DD. Not UTC: tasks reset at local midnight. */
export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The local date before `day`, done in local time so month and DST edges are safe. */
export function dayBefore(day) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1, 12));
}

function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function emptyDaily() {
  return { day: null, game: null, tasks: [], bonusClaimed: false, streak: 0, lastFullDay: null };
}

/**
 * Make sure today's tasks exist. Draws a fresh set on a new day, or when a
 * different game has been installed. `canOffer(task)` lets the game rule out
 * tasks the player cannot do yet. Returns true if a new set was drawn.
 */
export function ensureDay(daily, game, stats, day, canOffer = () => true) {
  if (daily.day && day < daily.day) return false;                 // clock went backwards
  if (daily.day === day && daily.game === game.id) return false;  // already drawn

  // A streak survives only if the last fully finished day was yesterday or today.
  if (daily.lastFullDay !== dayBefore(day) && daily.lastFullDay !== day) daily.streak = 0;

  const yesterday = new Set(daily.tasks.map((t) => t.id));
  const rand = seeded(`${day}|${game.id}`);
  const catalogue = (game.tasks || []).filter((t) => t.tier && canOffer(t));

  const picked = [];
  for (const tier of TIERS) {
    const pool = catalogue.filter((t) => t.tier === tier);
    if (!pool.length) continue;
    const fresh = pool.filter((t) => !yesterday.has(t.id));
    const from = fresh.length ? fresh : pool;
    picked.push(from[Math.floor(rand() * from.length)]);
  }

  daily.day = day;
  daily.game = game.id;
  daily.bonusClaimed = false;
  daily.tasks = picked.map((t) => ({
    id: t.id, text: t.text, stat: t.stat, target: t.target, tier: t.tier,
    base: stats[t.stat] || 0,
    claimed: false,
  }));
  return true;
}

export const progressOf = (task, stats) =>
  Math.max(0, Math.min(task.target, (stats[task.stat] || 0) - task.base));

export const isDone = (task, stats) => progressOf(task, stats) >= task.target;

export const allDone = (daily, stats) =>
  daily.tasks.length > 0 && daily.tasks.every((t) => isDone(t, stats));

/** Anything waiting to be claimed — drives the badge on the tab. */
export function claimable(daily, stats) {
  if (daily.tasks.some((t) => !t.claimed && isDone(t, stats))) return true;
  return allDone(daily, stats) && daily.tasks.every((t) => t.claimed) && !daily.bonusClaimed;
}

/** Claim one task. Returns the coins to pay, or 0 if it cannot be claimed. */
export function claimTask(daily, index, stats) {
  const t = daily.tasks[index];
  if (!t || t.claimed || !isDone(t, stats)) return 0;
  t.claimed = true;
  return REWARD[t.tier] || 0;
}

/** Claim the all-three bonus, which also moves the streak on. */
export function claimBonus(daily, stats) {
  if (daily.bonusClaimed || !allDone(daily, stats) || !daily.tasks.every((t) => t.claimed)) return 0;
  daily.bonusClaimed = true;
  daily.streak = daily.lastFullDay === dayBefore(daily.day) ? daily.streak + 1 : 1;
  daily.lastFullDay = daily.day;
  return BONUS;
}

/** Which tasks just crossed their target, given the stats before and after. */
export function newlyDone(daily, before, after) {
  return daily.tasks.filter((t) => !isDone(t, before) && isDone(t, after));
}

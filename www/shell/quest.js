/**
 * Bell Quest. Pure logic, no DOM.
 *
 * Beat STEPS levels in a row without losing one, within two days, and share a
 * grand prize with whichever cats are still in at the end. Modelled on Royal
 * Match's Lava Quest (see docs/BELL-QUEST.md).
 *
 * The app has no server, so the other 99 cats are simulated, and the app says
 * so plainly by calling them cats, never players. Their field is drawn from a
 * seed when the quest starts, one survival roll per step, tuned to the curve
 * published for Lava Quest: about 70% gone after three steps, then a trickle,
 * with a handful left at the end and now and then nobody else at all.
 *
 * What counts as a win and a loss is the game's call: it reports through
 * host.levelWon() and host.levelLost(). Money Sort loses a level only when the
 * player chooses to drop one, so paying for a Sort keeps the quest alive.
 *
 * Length and prize were chosen by simulation (tools/quest-sim.mjs): Money Sort
 * levels take about 3.5 minutes mid-game, so a ten-minute-a-day player could
 * not finish seven inside 24 hours; 84% of quests simply ran out.
 *
 * Statuses:
 *   none     not unlocked yet
 *   offer    a quest is waiting to be started
 *   active   running, `step` levels beaten so far
 *   won      finished, prize waiting to be claimed
 *   lost     knocked out, waiting to be acknowledged
 *   expired  the day ran out, waiting to be acknowledged
 * After claiming or acknowledging, the next quest is offered at once.
 */

export const STEPS = 7;
export const RIVALS = 99;                       // you make a hundred
export const DURATION_MS = 48 * 60 * 60 * 1000;   // Lava Quest's 24h assumes 2-minute levels
export const UNLOCK_LEVEL = 8;                  // a game can set its own
export const GRAND_SHARES = 10;                 // grand prize, in reward values
export const DEFAULT_VALUE = 150;

/** Share of the remaining cats who survive each step. Step 4 bites least:
 *  by then the field is small, which is what makes the end feel winnable. */
export const SURVIVAL = [0.70, 0.64, 0.66, 0.72, 0.58, 0.66, 0.74];
const SPREAD = 0.09;

export function emptyQuest() {
  return { status: 'none', played: 0, wins: 0, best: 0 };
}

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Rivals left after each step: field[0] = 99, field[7] = those who finished. */
export function drawField(seed, steps = STEPS) {
  const r = rng(seed);
  const field = [RIVALS];
  for (let i = 0; i < steps; i++) {
    // A shorter quest uses the same overall curve, squeezed into fewer steps.
    const j = Math.min(SURVIVAL.length - 1, Math.floor((i * SURVIVAL.length) / steps));
    const base = steps === STEPS ? SURVIVAL[i] : SURVIVAL[j] ** (STEPS / steps);
    const p = Math.min(0.97, Math.max(0.2, base + (r() * 2 - 1) * SPREAD));
    let left = 0;
    for (let k = 0; k < field[i]; k++) if (r() < p) left++;
    field.push(left);
  }
  return field;
}

/** The grand prize, fixed when the quest starts, so it never moves under you. */
export function grandPrize(value = DEFAULT_VALUE) {
  return Math.max(1000, Math.round((value * GRAND_SHARES) / 100) * 100);
}

/** What one winner takes: the grand prize over everyone who finished. */
export const shareOf = (grand, finishers) => Math.max(10, Math.round(grand / finishers / 5) * 5);

/** Cats still in, you included. */
export const catsLeft = (q) => (q.field ? q.field[Math.min(q.step, q.steps)] + 1 : RIVALS + 1);

export const isActive = (q) => q.status === 'active';

/**
 * Bring the quest up to date: offer the first one once the player is far
 * enough in, and end a quest whose day has run out. Returns true if anything
 * changed. A clock wound backwards cannot extend a quest past its day.
 */
export function sync(q, { now, level, unlockLevel = UNLOCK_LEVEL }) {
  if (q.status === 'none') {
    if (level < unlockLevel) return false;
    q.status = 'offer';
    return true;
  }
  if (q.status === 'active') {
    const day = q.duration || DURATION_MS;
    if (q.endsAt - now > day) q.endsAt = now + day;
    if (now >= q.endsAt) { q.status = 'expired'; return true; }
  }
  return false;
}

export function start(q, { now, value = DEFAULT_VALUE, seed = now, steps = STEPS, durationMs = DURATION_MS }) {
  if (q.status !== 'offer') return false;
  Object.assign(q, {
    status: 'active',
    startedAt: now,
    endsAt: now + durationMs,
    duration: durationMs,
    step: 0,
    steps,
    seenStep: 0,
    field: drawField(seed, steps),
    grand: grandPrize(value),
  });
  q.played += 1;
  return true;
}

/** A level beaten. Returns the new step, or 0 if no quest is running. */
export function advance(q, now) {
  if (q.status !== 'active') return 0;
  if (now >= q.endsAt) { q.status = 'expired'; return 0; }
  q.step += 1;
  q.best = Math.max(q.best, q.step);
  if (q.step >= q.steps) {
    q.status = 'won';
    q.share = shareOf(q.grand, q.field[q.steps] + 1);
  }
  return q.step;
}

/** A level lost. Returns true if that ended a running quest. */
export function knockOut(q) {
  if (q.status !== 'active') return false;
  q.status = 'lost';
  return true;
}

/** Pay out a won quest and offer the next. Returns the coins, or 0. */
export function claim(q) {
  if (q.status !== 'won') return 0;
  const coins = q.share;
  q.wins += 1;
  reset(q);
  return coins;
}

/** Close a lost or expired quest and offer the next. */
export function acknowledge(q) {
  if (q.status !== 'lost' && q.status !== 'expired') return false;
  reset(q);
  return true;
}

function reset(q) {
  for (const k of ['startedAt', 'endsAt', 'duration', 'step', 'steps', 'seenStep', 'field', 'grand', 'share']) delete q[k];
  q.status = 'offer';
}

/** Something the player has not seen yet: a result, or a step since they last looked. */
export function hasNews(q) {
  if (q.status === 'won' || q.status === 'lost' || q.status === 'expired') return true;
  return q.status === 'active' && q.step !== q.seenStep;
}

export function formatLeft(ms) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
}

/** The lobby icon's short form: 1d 23h, 5h 12m, 12m. */
export function formatShort(ms) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  if (mins >= 24 * 60) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  return formatLeft(ms);
}

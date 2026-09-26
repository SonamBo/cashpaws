/**
 * The Rewards Box. Pure logic, no DOM.
 *
 * A box refills every few hours and pays coins. The amount is a share of what
 * the installed game says a reward is worth right now — Money Sort answers
 * with its current Sort price — so a box means the same at level 20 as at
 * level 1, instead of shrinking into irrelevance as prices rise. A game that
 * says nothing gets DEFAULT_VALUE.
 *
 * Time is the phone's clock, like daily tasks. Winding it forward opens boxes
 * early; winding it back is clamped so it cannot strand the next box for days.
 */

export const REFILL_MS = 4 * 60 * 60 * 1000;
export const DEFAULT_VALUE = 150;
export const AD_OPENS_PER_DAY = 3;       // opening early with an ad, once ads exist

/**
 * What a box can hold, as a share of the game's reward value. Mostly a third
 * of a Sort, sometimes most of one, now and then a whole one.
 * Tuned by simulation; see docs/ROADMAP.md.
 */
export const PRIZES = [
  { share: 0.3, weight: 55 },
  { share: 0.6, weight: 33 },
  { share: 1.0, weight: 12, big: true },
];

export function emptyBox() {
  return { nextAt: 0, opened: 0, adOpens: { day: null, count: 0 } };   // 0: ready now
}

/** The clock went backwards: never let the wait grow past one full refill. */
function clamp(box, now) {
  if (box.nextAt - now > REFILL_MS) box.nextAt = now + REFILL_MS;
}

export function isReady(box, now) {
  clamp(box, now);
  return now >= box.nextAt;
}

export function msUntil(box, now) {
  clamp(box, now);
  return Math.max(0, box.nextAt - now);
}

export function formatWait(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function roll(rand) {
  const total = PRIZES.reduce((n, p) => n + p.weight, 0);
  let x = rand() * total;
  for (const p of PRIZES) { x -= p.weight; if (x < 0) return p; }
  return PRIZES[PRIZES.length - 1];
}

export const adOpensLeft = (box, day) =>
  box.adOpens.day === day ? Math.max(0, AD_OPENS_PER_DAY - box.adOpens.count) : AD_OPENS_PER_DAY;

/**
 * Open the box. Returns `{ coins, big }` for the caller to pay, or null if it
 * cannot be opened. `value` is the game's reward value right now. `viaAd`
 * opens it ahead of the timer, within a daily limit.
 */
export function openBox(box, { now, day, value = DEFAULT_VALUE, rand = Math.random, viaAd = false }) {
  if (viaAd) {
    if (box.adOpens.day !== day) box.adOpens = { day, count: 0 };
    if (box.adOpens.count >= AD_OPENS_PER_DAY) return null;
  } else if (!isReady(box, now)) {
    return null;
  }
  const prize = roll(rand);
  const coins = Math.max(10, Math.round((value * prize.share) / 5) * 5);
  if (viaAd) box.adOpens.count += 1;
  else box.nextAt = now + REFILL_MS;
  box.opened += 1;
  return { coins, big: !!prize.big };
}

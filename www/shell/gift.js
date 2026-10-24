/**
 * Tomorrow's gift (1.17.0). Pure logic, no DOM, so it can be tested directly.
 *
 * Most players who leave never come back after their first day. So once a new
 * player has beaten a few levels, the shell shows them a locked gift that opens
 * tomorrow, and offers a reminder for when it does. Coming back on any later
 * day opens it.
 *
 *   none     → not offered yet
 *   waiting  → offered on `day`; opens on any later local day
 *   claimed  → done, never offered again
 *
 * Days are the phone's local dates (daily.js localDay), like daily tasks.
 * Winding the clock forward opens it early; that is accepted.
 */

import { localDay } from './daily.js';

export const GIFT_AFTER_LEVEL = 3;         // offered once level 3 is beaten (level 4 reached)
export const GIFT_VALUE_SHARE = 2;         // the gift is worth two of the game's reward value
export const GIFT_ROUND = 50;
export const REMINDER_EARLIEST = 9;        // 9 am local
export const REMINDER_LATEST = 21;         // 9 pm local
export const NUDGE_EVERY_DAYS = 2;         // unclaimed: one more nudge two days on

export function emptyGift() {
  return { status: 'none', day: null, offeredAt: 0, coins: 0, claimedDay: null };
}

/**
 * Coins for the gift, from the game's reward value (Money Sort: Sort's price).
 * `share` comes from Remote Config (gift_value_share) since 1.19.0.
 */
export function giftCoins(value, share = GIFT_VALUE_SHARE) {
  const v = Number.isFinite(value) && value > 0 ? value : 150;
  const k = Number.isFinite(share) && share > 0 ? share : GIFT_VALUE_SHARE;
  return Math.max(GIFT_ROUND, Math.round((v * k) / GIFT_ROUND) * GIFT_ROUND);
}

/**
 * Should the gift be offered now that `level` has been reached? Only once,
 * ever. `afterLevel` comes from Remote Config (gift_after_level) since 1.19.0.
 */
export function shouldOffer(gift, level, afterLevel = GIFT_AFTER_LEVEL) {
  return gift.status === 'none' && Number.isFinite(level) && level > afterLevel;
}

export function offer(gift, { now, value, share }) {
  if (gift.status !== 'none') return false;
  gift.status = 'waiting';
  gift.day = localDay(new Date(now));
  gift.offeredAt = now;
  gift.coins = giftCoins(value, share);
  return true;
}

/** Ready to open: offered, and today is a later local day than the offer. */
export function isReady(gift, now) {
  return gift.status === 'waiting' && localDay(new Date(now)) > gift.day;
}

/** Open it. Returns the coins, or 0 if it can't be opened yet. */
export function claim(gift, now) {
  if (!isReady(gift, now)) return 0;
  gift.status = 'claimed';
  gift.claimedDay = localDay(new Date(now));
  return gift.coins;
}

/** Whole local days from the offer to `now` (1 = next day). */
export function daysSinceOffer(gift, now) {
  if (!gift.day) return 0;
  const [y, m, d] = gift.day.split('-').map(Number);
  const [y2, m2, d2] = localDay(new Date(now)).split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2, 12) - new Date(y, m - 1, d, 12)) / 86400000);
}

/**
 * When to remind: the day after the offer, an hour before the time of day
 * they played, kept between 9 am and 9 pm. If that has passed and the gift is
 * still unopened, the same time every NUDGE_EVERY_DAYS days after. Never
 * sooner than `gap` from now (someone who just played isn't nudged).
 */
export function reminderAt(gift, now, gap = 4 * 3600000) {
  if (gift.status !== 'waiting') return null;
  const played = new Date(gift.offeredAt);
  const hour = Math.min(REMINDER_LATEST, Math.max(REMINDER_EARLIEST, played.getHours() - 1));
  const at = new Date(played);
  at.setDate(at.getDate() + 1);
  at.setHours(hour, played.getHours() - 1 === hour ? played.getMinutes() : 0, 0, 0);
  while (at.getTime() < now + gap) at.setDate(at.getDate() + NUDGE_EVERY_DAYS);
  return at.getTime();
}

export function giftReminder(gift, now) {
  const at = reminderAt(gift, now);
  if (!at) return null;
  const first = localDay(new Date(at)) <= nextDay(gift.day);
  return first
    ? { at, title: 'Your gift is ready', body: `${fmt(gift.coins)} coins are waiting. Tap to open.` }
    : { at, title: 'Your gift is still waiting', body: `${fmt(gift.coins)} coins, saved for you` };
}

const fmt = (n) => Number(n).toLocaleString('en-US');

function nextDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + 1, 12));
}

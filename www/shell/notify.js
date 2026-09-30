/**
 * Local reminders: what to say, and when. The native bridge
 * (window.CashPawsNotify, WorkManager) only posts what it's given.
 *
 *   box    when the next Rewards Box is ready
 *   quest  once a day at 7 pm local time, about Bell Quest: the step you're
 *          on, a prize to claim, or a new quest. If the quest would run out
 *          before then, 2 hours before it ends instead.
 *
 * Both are rescheduled whenever the app goes to the background, so they
 * always describe the latest state; nothing is posted while the app is open.
 * In a browser there is no bridge and nothing happens; under ?dev=1 a stub
 * keeps them in window.__reminders so the rules can be tested.
 */

import { catsLeft, formatLeft, grandPrize } from './quest.js';

const H = 3600000;
export const QUEST_HOUR = 19;              // 7 pm, the phone's local time
export const QUEST_MIN_GAP = 4 * H;        // never nag someone who just played

const fmt = (n) => Number(n).toLocaleString('en-US');

/** The next `hour`:00 local that is at least `gap` from now. */
export function nextDaily(now, hour = QUEST_HOUR, gap = QUEST_MIN_GAP) {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  while (d.getTime() < now + gap) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function boxReminder(box, now) {
  if (!box || box.nextAt <= now + 60000) return null;      // ready already: the lobby shows it
  return {
    at: box.nextAt,
    title: 'Your Rewards Box is ready',
    body: 'Coins inside, and the further you get, the more a box holds.',
  };
}

/** `value` is what a reward is worth now, to name the prize of a new quest. */
export function questReminder(q, now, value) {
  if (!q || q.status === 'none') return null;
  if (q.status === 'active') {
    const left = q.steps - q.step;
    const daily = nextDaily(now);
    const cats = catsLeft(q);
    if (daily < q.endsAt - 30 * 60000) {
      return {
        at: daily,
        title: `Bell Quest: step ${q.step} of ${q.steps}`,
        body: `${cats} cats are still in. Beat ${left} more level${left === 1 ? '' : 's'} to share `
          + `${fmt(q.grand)} coins. ${formatLeft(q.endsAt - daily)} left.`,
      };
    }
    const lastCall = q.endsAt - 2 * H;
    if (lastCall < now + 30 * 60000) return null;             // too late to be useful
    return {
      at: lastCall,
      title: 'Bell Quest ends in 2 hours',
      body: `You're on step ${q.step} of ${q.steps} with ${cats} cats left. Finish to share ${fmt(q.grand)} coins.`,
    };
  }
  const at = nextDaily(now);
  if (q.status === 'won') {
    return { at, title: 'Your Bell Quest prize is waiting', body: `Claim your share of ${fmt(q.grand)} coins.` };
  }
  return {                                                    // offer, lost or expired: a new one is ready
    at,
    title: 'A new Bell Quest is ready',
    body: `Beat 7 levels in a row and share ${fmt(grandPrize(value))} coins with every cat who makes it.`,
  };
}

export function createNotify({ dev = false } = {}) {
  let native = globalThis.CashPawsNotify;
  try { if (!native?.isEnabled()) native = null; } catch { native = null; }

  const waiting = [];
  globalThis.__notifyPermission = (granted) => { while (waiting.length) waiting.shift()(!!granted); };

  if (!native && dev) {
    // A stand-in, so the flow can be built and tested in a browser.
    // Like the phone, it remembers the permission across launches.
    globalThis.__reminders = {};
    const KEY = 'cashpaws.dev.notifyPermission';
    const load = () => { try { return localStorage.getItem(KEY) || 'ask'; } catch { return 'ask'; } };
    globalThis.__notifyPermissionState = load();
    native = {
      permission: () => globalThis.__notifyPermissionState,
      requestPermission: () => setTimeout(() => {
        globalThis.__notifyPermissionState = globalThis.__notifyGrant === false ? 'denied' : 'granted';
        try { localStorage.setItem(KEY, globalThis.__notifyPermissionState); } catch { /* ignore */ }
        globalThis.__notifyPermission(globalThis.__notifyPermissionState === 'granted');
      }, 50),
      schedule: (id, at, title, body) => { globalThis.__reminders[id] = { at, title, body }; },
      cancel: (id) => { delete globalThis.__reminders[id]; },
      takeLaunchSource: () => '',
    };
  }

  return {
    available: !!native,
    /** 'granted', 'denied', 'ask', or 'none' where there is no bridge. */
    permission() { try { return native ? native.permission() : 'none'; } catch { return 'none'; } },
    request() {
      if (!native) return Promise.resolve(false);
      return new Promise((resolve) => {
        waiting.push(resolve);
        try { native.requestPermission(); } catch { resolve(false); }
      });
    },
    set(id, r) {
      try { if (r) native?.schedule(id, r.at, r.title, r.body); else native?.cancel(id); } catch { /* ignore */ }
    },
    /** The reminder that opened the app, if any. */
    launchSource() { try { return native?.takeLaunchSource() || ''; } catch { return ''; } },
  };
}

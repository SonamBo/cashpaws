/**
 * Sharing and the rating sheet (Social.java, bridge window.CashPawsSocial).
 *
 * Share: the phone's share sheet with a line of text, the Play link and the
 * app's share image (shareImage in www/app.config.js, when it has one). From the lobby,
 * Settings and the level-up card. Off on the web: CrazyGames doesn't allow
 * links to other stores.
 *
 * Rating: Google Play's in-app review sheet, asked at the break after the
 * player clears level 2, then again after levels 10 and 25 (Google shows it
 * only when its own quota allows, and never says whether they rated). Once
 * per milestone, never twice at one break, never in place of a choice.
 */

export const REVIEW_AT = [3, 11, 26];     // the level just reached: after clearing 2, 10 and 25

let nextId = 0;
const waiting = new Map();
globalThis.__reviewDone = (id, asked) => {
  const r = waiting.get(String(id)); waiting.delete(String(id));
  r?.(!!asked);
};

function bridge() {
  const b = globalThis.CashPawsSocial;
  return b && typeof b.share === 'function' ? b : null;
}

export function createSocial({ app, ledger, dev, toast, track = () => {}, save = () => {} }) {
  const native = bridge();
  const link = `https://play.google.com/store/apps/details?id=${app.applicationId}`;
  const text = `${app.shareText || `Sorting cash with cats 🐾 ${app.name}`}\n${link}`;

  return {
    /** A share button makes sense here. */
    get canShare() { return !!native || !!dev; },

    share(from) {
      track('share_open', { from });
      if (native) { try { native.share(text, app.shareImage || ''); } catch { /* bridge gone */ } return; }
      if (dev) toast(`<span>Share sheet (stub): ${text.split('\n')[0]}</span>`, 2400);
    },

    /** The highest rating milestone reached and not yet asked, or 0. */
    reviewDue(level) {
      if (!native) return 0;                // Google Play's sheet: Android only, never the web
      const due = REVIEW_AT.filter((l) => level >= l && !ledger.asked.includes(l));
      return due.length ? due[due.length - 1] : 0;
    },

    /** Ask Google for the rating sheet; every milestone up to `at` counts as asked. */
    async review(at) {
      REVIEW_AT.filter((l) => l <= at).forEach((l) => { if (!ledger.asked.includes(l)) ledger.asked.push(l); });
      save();
      track('review_request', { at });
      if (!native) { if (dev) toast('<span>Rating sheet (stub)</span>', 1800); return; }
      const id = String(++nextId);
      const asked = await new Promise((resolve) => {
        waiting.set(id, resolve);
        try { native.review(id); } catch { waiting.delete(id); resolve(false); }
        setTimeout(() => { if (waiting.delete(id)) resolve(false); }, 60000);   // never hold the game
      });
      track('review_done', { at, asked });
    },
  };
}

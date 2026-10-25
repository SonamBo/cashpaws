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

    /** A file of the game's own can go out: the app's share sheet, or a browser that shares files or downloads. */
    get canShareFile() { return !!native?.shareFileBegin || typeof document !== 'undefined'; },

    /**
     * Share a file the game made (host.shareFile). On Android it goes over
     * the bridge in pieces (a clip is megabytes; one string that size can
     * stall the WebView) and out through the share sheet with the store link.
     * In a browser: its share sheet where files are allowed, else a download.
     * The web text carries no store link: CrazyGames doesn't allow one.
     */
    async shareFile({ blob, name = 'share', text = '', from = 'game' }) {
      track('share_file', { from, type: (blob?.type || '').split(';')[0], kb: Math.round((blob?.size || 0) / 1024) });
      if (!blob) return false;
      const mime = (blob.type || 'application/octet-stream').split(';')[0];
      if (native?.shareFileBegin) {
        try {
          if (!native.shareFileBegin(name)) return false;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const CHUNK = 3 * 128 * 1024;                 // a multiple of 3: each piece is whole base64
          for (let i = 0; i < bytes.length; i += CHUNK) {
            let bin = '';
            const part = bytes.subarray(i, i + CHUNK);
            for (let k = 0; k < part.length; k += 8192) bin += String.fromCharCode(...part.subarray(k, k + 8192));
            if (!native.shareFileChunk(btoa(bin))) return false;
          }
          native.shareFileEnd(`${text}\n${link}`.trim(), mime);
          return true;
        } catch { return false; }
      }
      const file = new File([blob], name, { type: mime });
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return true; }
      } catch (e) { if (e?.name === 'AbortError') return true; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      if (dev) toast(`<span>Saved ${name}</span>`, 1800);
      return true;
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

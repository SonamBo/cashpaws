/**
 * Analytics, as the shell sees it. Everything goes through track(); the
 * native bridge (window.CashPawsAnalytics, Firebase) is the only destination.
 *
 * Three situations, as with ads:
 *  - The Android app: events go to Firebase Analytics, and JS errors to
 *    Crashlytics as non-fatals.
 *  - A browser, or the tests: nothing is sent anywhere.
 *  - ?dev=1: nothing is sent, but every event is kept in window.__events and
 *    printed to the console, so the wiring can be checked.
 *
 * Firebase's rules are enforced here, so a careless call cannot lose an event:
 * names and keys are 1-40 letters, digits or underscores starting with a
 * letter; string values are cut to 100 characters; at most 25 parameters.
 */

const NAME = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const RESERVED = /^(firebase_|google_|ga_)/;

export function clean(name) {
  const n = String(name).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]+/, '').slice(0, 40);
  return NAME.test(n) && !RESERVED.test(n) ? n : null;
}

export function cleanParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params).slice(0, 25)) {
    const key = clean(k);
    if (!key || v === undefined || v === null) continue;
    if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else if (typeof v === 'number') { if (Number.isFinite(v)) out[key] = v; }
    else out[key] = String(v).slice(0, 100);
  }
  return out;
}

function nativeBridge() {
  const b = globalThis.CashPawsAnalytics;
  try { return b && b.isEnabled() ? b : null; } catch { return null; }
}

export function createAnalytics({ dev = false } = {}) {
  const native = nativeBridge();
  if (dev) globalThis.__events = [];

  const api = {
    /** True when events actually leave the phone. */
    enabled: !!native,

    track(name, params = {}) {
      const n = clean(name);
      if (!n) return;
      const p = cleanParams(params);
      if (dev) { globalThis.__events.push({ name: n, params: p }); console.debug('[analytics]', n, p); }
      try { native?.logEvent(n, JSON.stringify(p)); } catch { /* never let analytics break play */ }
    },

    /** A fact about the player that stays attached to later events. Values: 36 chars. */
    setUser(name, value) {
      const n = clean(name);
      if (!n || n.length > 24) return;
      const v = value === null || value === undefined ? null : String(value).slice(0, 36);
      if (dev) globalThis.__events.push({ user: n, value: v });
      try { native?.setUserProperty(n, v); } catch { /* ignore */ }
    },
  };

  // Game code that throws is worth knowing about; report it, once per message.
  if (native) {
    const seen = new Set();
    const report = (message, stack) => {
      const key = String(message).slice(0, 200);
      if (seen.has(key) || seen.size > 20) return;
      seen.add(key);
      try { native.reportError(key, String(stack || '').slice(0, 2000)); } catch { /* ignore */ }
    };
    globalThis.addEventListener?.('error', (e) => report(e.message, e.error?.stack));
    globalThis.addEventListener?.('unhandledrejection', (e) => report(e.reason?.message || e.reason, e.reason?.stack));
  }

  return api;
}

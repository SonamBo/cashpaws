/**
 * A cloud copy of the save, through Google Play Games (CloudSave.java, bridge
 * window.CashPawsPlay). Players are signed in automatically; nothing to tap.
 *
 *  - On start: once signed in, read the cloud save. If it came from another
 *    install (a new phone, a reinstall) and is further along than this one,
 *    offer it: "Continue from level 24?". Restoring swaps the save and reloads.
 *  - Then: every save is copied up, at most once a minute, and at once when
 *    the app goes to the background.
 *
 * Nothing is uploaded until the cloud save has been read and decided on, so
 * a fresh install can never overwrite a player's progress with level 1.
 *
 * Off without the bridge (browsers, CrazyGames: it has its own cloud saves)
 * and when the app has no playGamesAppId.
 */

const EVERY_MS = 60000;
let nextId = 0;

function bridge() {
  const b = globalThis.CashPawsPlay;
  try { return b && b.isEnabled() ? b : null; } catch { return null; }
}

/** How far along a save is, for comparing two of them. */
export function progressOf(rec) {
  const s = rec?.shell || {};
  return (s.stats?.bestLevel || 0) * 1e7 + Math.min(9999999, s.stats?.coinsEarned || 0);
}

/**
 * The cloud save restored on this install: its progress, plus anything bought
 * here that it doesn't know about, so a purchase is never lost or repaid.
 */
export function mergeForRestore(cloud, local) {
  const out = JSON.parse(JSON.stringify(cloud));
  const sh = out.shell;
  const mine = local.shell.iap || { granted: [], coins: 0, purchases: 0 };
  sh.iap = { granted: [], purchases: 0, coins: 0, ...(sh.iap || {}) };
  const unknown = mine.granted.filter((t) => !sh.iap.granted.includes(t));
  if (unknown.length && mine.coins > 0) {
    sh.coins = (sh.coins || 0) + mine.coins;      // bought on this install before restoring
    sh.iap.coins += mine.coins;
    sh.iap.purchases += unknown.length;
  }
  sh.iap.granted = [...new Set([...sh.iap.granted, ...mine.granted])].slice(-50);
  sh.device = local.shell.device;                 // this install owns the save now
  return out;
}

export function createCloud({ read, write, ask, track = () => {}, onChange = () => {} }) {
  const native = bridge();
  let signedIn = false;
  let player = '';
  let ready = false;            // the cloud save has been read and decided on
  let lastUp = 0;
  let timer = null;
  const waiting = new Map();

  function upload() {
    if (!native || !signedIn || !ready) return;
    clearTimeout(timer); timer = null;
    const rec = read();
    lastUp = Date.now();
    try {
      native.save(JSON.stringify(rec), `Level ${rec.shell.stats.bestLevel}`, String(progressOf(rec)));
    } catch { /* bridge gone */ }
  }

  async function decide() {
    const id = String(++nextId);
    const res = await new Promise((resolve) => {
      waiting.set(id, resolve);
      try { native.load(id); } catch { waiting.delete(id); resolve({ ok: false }); }
    });
    if (!res.ok) return;                    // couldn't read: try again next launch, upload nothing
    let cloud = null;
    try { cloud = res.data ? JSON.parse(res.data) : null; } catch { cloud = null; }
    const local = read();
    const fromElsewhere = cloud?.shell && cloud.shell.device !== local.shell.device;
    if (fromElsewhere && progressOf(cloud) > progressOf(local)) {
      const lvl = cloud.shell.stats?.bestLevel || 1;
      const coins = Number(cloud.shell.coins || 0).toLocaleString('en-US');
      track('cloud_restore_offer', { level: lvl, local_level: local.shell.stats.bestLevel });
      const yes = await ask({
        kicker: 'Saved game found',
        title: `Continue from level ${lvl}?`,
        line: `${coins} coins · from your Google account`,
        ok: 'Continue',
        cancel: 'Start fresh',
      });
      track('cloud_restore', { restored: yes });
      if (yes) {
        write(mergeForRestore(cloud, local));
        location.reload();
        return;
      }
    }
    ready = true;
    upload();                               // the cloud now matches this install
  }

  globalThis.__cloud = (e) => {
    if (!e) return;
    if (e.type === 'auth') {
      const was = signedIn;
      signedIn = !!e.signedIn;
      player = e.player || '';
      if (signedIn && !was) { track('cloud_signed_in', {}); decide(); }
      onChange();
    } else if (e.type === 'loaded') {
      const r = waiting.get(String(e.id)); waiting.delete(String(e.id));
      r?.({ ok: !!e.ok, data: e.data || '' });
    }
  };

  if (native) { try { native.start(); } catch { /* bridge gone */ } }

  return {
    /** Play Games is in this build. */
    get enabled() { return !!native; },
    get signedIn() { return signedIn; },
    get player() { return player; },

    /** After every save: copy up, at most once a minute. */
    saved() {
      if (!native || !signedIn || !ready || timer) return;
      timer = setTimeout(upload, Math.max(0, EVERY_MS - (Date.now() - lastUp)));
    },
    /** The app is going to the background: copy up now. */
    flush() { if (timer || Date.now() - lastUp > 5000) upload(); },
    signIn() { try { native?.signIn(); } catch { /* bridge gone */ } },
    status() { try { return native ? JSON.parse(native.status() || '{}') : null; } catch { return null; } },
  };
}

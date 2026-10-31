/**
 * Build the `host` object handed to a game — the only way a game reaches the
 * shell. See docs/GAME-MODULE.md for the contract.
 */

import { cat, coinIcon, logo } from './art.js';
import { asset } from './assets.js';
import { celebrate, setback, confirm, show, dismiss, wait } from './overlays.js';

export function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

export function createHost({ game, shell, wallet, header, ads, onProgress, onStat, save, exit, dev, events = {}, coach, sound, config }) {
  const stats = (shell.gameStats[game.id] ||= {});

  return {
    wallet: {
      get coins() { return wallet.coins; },
      canAfford: (n) => wallet.canAfford(n),
      earn: (n, reason) => wallet.earn(n, reason),
      spend: (n, reason) => wallet.spend(n, reason),
      set: (n) => wallet.set(n),
    },

    stat(key, n = 1) {
      const before = { ...stats };
      stats[key] = (stats[key] || 0) + n;
      onStat?.(before, stats);        // daily tasks watch this
    },
    /** This game's own counters, read-only by convention. */
    get stats() { return stats; },

    progress(p) {
      header.setProgress(p);
      if (Number.isFinite(p.level)) shell.stats.bestLevel = Math.max(shell.stats.bestLevel, p.level);
      shell.summaries[game.id] = p.summary || '';
      onProgress(p);
    },

    /*
     * Outcomes, for events like Bell Quest and for analytics. A game reports
     * each level it wins and each it loses, with anything worth recording
     * (Money Sort sends { level, kind }). What those mean is the game's call. Before a loss the
     * player chose, the game asks confirmLevelLoss(), which resolves true at
     * once unless something running would be lost with it.
     */
    levelWon: (info) => events.levelWon?.(info),
    levelLost: (info) => events.levelLost?.(info),

    /** An event of the game's own, for analytics: host.track('board_stuck', { level: 12 }). */
    track: (name, params) => events.track?.(name, params),
    confirmLevelLoss: () => (events.confirmLevelLoss ? events.confirmLevelLoss() : Promise.resolve(true)),
    /** The same, as data for the game's own card: { kicker, title, line, stat, ok, cancel, answer(yes) } or null. */
    levelLossWarning: () => events.levelLossWarning?.() ?? null,
    /** Between one level's celebration and the next level: the shell may show event progress. */
    levelBreak: () => Promise.resolve(events.levelBreak?.()),

    // `share: true` adds a small Share button where sharing works (the level-up card).
    // `juicy: true` is the big level-end card: headline, stars, fireworks, confetti,
    // with sound and vibration in time (the stars chime, the fireworks boom).
    celebrate: (o) => {
      const onShare = o?.share ? events.shareFrom?.('levelup') : null;
      if (!o?.juicy) { sound?.play('celebrate'); return celebrate({ ...o, onShare }); }
      const onBeat = (kind, i) => {
        if (kind === 'open') { sound?.play('fanfare'); haptic([0, 22, 40, 22]); }
        else if (kind === 'star') { sound?.play(`star${i}`); haptic(9); }
        else if (kind === 'boom') { sound?.play('boom'); haptic(26); }
      };
      return celebrate({ ...o, onShare, onBeat });
    },
    setback: (o) => { sound?.play('setback'); return setback(o); },
    // A sound effect: tap, lift, drop, bank, levelup, flow, sort, undo, error,
    // coin, open, unlock (see shell/sound.js). Silent when the player turned sound off.
    sound: (name) => sound?.play(name),
    confirm,
    cards: { show, dismiss, wait },

    /** A natural break, such as a finished level. Awaitable; nothing is tied to it now. */
    moment: (kind) => ads.moment(kind),
    rewarded: ads.rewarded,

    /*
     * Short of coins: await host.shortOf({ price, what: 'a Sort', ad: 'rescue-sort',
     * adLabel: 'Watch an ad · free Sort' }). The shell offers coin packs first,
     * then the rewarded ad, and resolves 'coins' (enough now), 'ad' (watched)
     * or null. host.shortHelps(ad) says whether it has anything to offer, so a
     * button can stay tappable when the player is short.
     */
    shortOf: (o) => events.shortOf?.(o) ?? Promise.resolve(null),
    shortHelps: (ad) => !!events.shortHelps?.(ad),
    /** Coin packs for real money: whether this build sells them, and the Shop's coin section. */
    coinsForSale: () => !!events.coinsForSale?.(),
    openCoins: (from) => events.openCoins?.(from) ?? Promise.resolve(),

    /*
     * A button of the game's own on the lobby, opposite Bell Quest's: a daily
     * challenge, an event. host.lobbyButton('daily-puzzle', { icon: <a file in the game's folder>,
     * pill: 'Solve!', badge: '3', news: true, label: 'Puzzle of the Day' })
     * shows or updates it; null takes it away. A tap opens the game screen and
     * calls the instance's openFromLobby(id) first.
     */
    lobbyButton: (id, o) => events.lobbyButton?.(id, o ? { ...o, icon: o.icon ? asset(game.path + o.icon) : '' } : null),

    /*
     * Share a file the game made, such as a replay clip: await host.shareFile({
     * blob, name: 'clip.mp4', text: 'I solved it in 9 moves', from: 'puzzle' }).
     * The phone's share sheet on Android (the store link is added to the text),
     * the browser's where it can share files, a download otherwise. Resolves
     * true once something opened. host.canShareFile() says whether to offer it.
     */
    shareFile: (o) => events.shareFile?.(o) ?? Promise.resolve(false),
    canShareFile: () => !!events.canShareFile?.(),

    art: {
      cat: (pose, width, cls = '') => cat(pose, width, cls),
      coin: (width) => coinIcon(width),
      logo: (width) => logo(width),       // the app's title art, for a game's own cards and clips
    },
    asset: (path) => asset(game.path + path),

    /** Tutorial coach marks: tip(), spotlight(), clear(). See coach.js. */
    coach,

    /*
     * A tuning value the game declared in its manifest's `remote` field,
     * from Firebase Remote Config when set there, else the declared default.
     * Fixed for the session. host.remote('free_sort_through') → 5.
     */
    remote: (key) => {
      if (!config?.has(key)) return game.remote?.[key]?.default;
      return config.get(key);
    },

    /** Small facts a game remembers across launches, such as a finished tutorial. */
    flag: (key) => !!(shell.flags[game.id] || {})[key],
    setFlag(key, value = true) {
      (shell.flags[game.id] ||= {})[key] = value;
      save();
    },

    haptic,
    // true while a move or animation is playing: no Ad break starts until false.
    busy: (on) => document.body.classList.toggle('busy', !!on),
    save,
    exit,
    dev,
  };
}

/**
 * Load a game's declared stylesheets before it starts, so its first layout
 * pass measures styled markup. In the single-file build they are already
 * inlined as <style data-src>, and this finds them there.
 */
export async function loadStyles(game) {
  for (const file of game.styles || []) {
    const href = game.path + file;
    if (document.querySelector(`style[data-src="${href}"], link[data-src="${href}"]`)) continue;
    await new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.src = href;
      link.onload = link.onerror = resolve;
      document.head.appendChild(link);
    });
  }
}

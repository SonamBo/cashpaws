/**
 * Build the `host` object handed to a game — the only way a game reaches the
 * shell. See docs/GAME-MODULE.md for the contract.
 */

import { cat, coinIcon } from './art.js';
import { asset } from './assets.js';
import { celebrate, setback, confirm, show, dismiss, wait } from './overlays.js';

export function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

export function createHost({ game, shell, wallet, header, ads, onProgress, onStat, save, exit, dev, events = {} }) {
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
      onProgress();
    },

    /*
     * Outcomes, for events like Bell Quest. A game reports each level it wins
     * and each it loses; what those mean is the game's call. Before a loss the
     * player chose, the game asks confirmLevelLoss(), which resolves true at
     * once unless something running would be lost with it.
     */
    levelWon: () => events.levelWon?.(),
    levelLost: () => events.levelLost?.(),
    confirmLevelLoss: () => (events.confirmLevelLoss ? events.confirmLevelLoss() : Promise.resolve(true)),

    celebrate,
    setback,
    confirm,
    cards: { show, dismiss, wait },

    moment: (kind) => ads.moment(kind),
    rewarded: ads.rewarded,

    art: {
      cat: (pose, width, cls = '') => cat(pose, width, cls),
      coin: (width) => coinIcon(width),
    },
    asset: (path) => asset(game.path + path),

    haptic,
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

/**
 * Ads, as the shell sees them. Games never touch an ad network: they mark a
 * natural break with host.moment() and ask host.rewarded whether a rewarded
 * ad is on offer. Policy — which placements exist, how often — lives here.
 *
 * Three situations:
 *  - The Android app with an AdMob ad unit: window.CashPawsAds exists and reports
 *    itself enabled. Rewarded ads are real.
 *  - The app without keys, or any browser: no ads. Every placement reports
 *    unavailable, so games hide their ad buttons.
 *  - ?dev=1: a stub pretends, so the flows can be built and tested.
 */

/*
 * Interstitials (1.16.0): at the end of each level won, once the player has
 * beaten level 10, so the first comes after level 10 and never mid-board. The shell
 * announces each with a 2-second "Ad break" screen first. Right after a
 * rewarded ad (within a minute) one is skipped, so ads never come back to back.
 */
export const INTERSTITIAL_FROM_LEVEL = 11;      // the level just reached: "after level 10"
export const AFTER_REWARDED_MS = 60000;

let nextId = 0;
const pending = new Map();

// The native bridge calls this when an ad closes.
globalThis.__adResult = (id, earned) => {
  const resolve = pending.get(String(id));
  pending.delete(String(id));
  resolve?.(!!earned);
};

function nativeBridge() {
  const b = globalThis.CashPawsAds;
  try { return b && b.isEnabled() ? b : null; } catch { return null; }
}

export function createAds({ dev, confirm, track = () => {} }) {
  const native = nativeBridge();

  const rewarded = native
    ? {
      available: () => { try { return native.rewardedReady(); } catch { return false; } },
      show(placement) {
        return new Promise((resolve) => {
          const id = String(++nextId);
          pending.set(id, resolve);
          try { native.showRewarded(placement, id); } catch { pending.delete(id); resolve(false); }
        });
      },
    }
    : {
      available: () => dev,
      async show(placement) {
        if (!dev) return false;
        return confirm({
          kicker: 'Rewarded ad (stub)',
          title: 'An ad would play here',
          line: `Placement: ${placement}. Choose whether the player finished watching.`,
          ok: 'Watched it',
          cancel: 'Skipped',
        });
      },
    };

  // Every rewarded ad started, and whether it paid out, by placement.
  let lastRewarded = -Infinity;
  const show = rewarded.show;
  rewarded.show = async (placement) => {
    track('ad_rewarded_start', { placement });
    const earned = await show(placement);
    track('ad_rewarded_result', { placement, earned });
    lastRewarded = Date.now();       // an ad just played: no Ad break straight after it
    return earned;
  };

  const interstitial = native
    ? {
      available: () => { try { return !!native.interstitialReady?.(); } catch { return false; } },
      show(placement) {
        return new Promise((resolve) => {
          const id = String(++nextId);
          pending.set(id, resolve);
          try { native.showInterstitial(placement, id); } catch { pending.delete(id); resolve(false); }
        });
      },
    }
    : {
      // The dev stub stands in for the full-screen ad with a short pause.
      available: () => dev,
      show: () => new Promise((resolve) => setTimeout(() => resolve(dev), 600)),
    };

  return {
    /** True when real ads can be served; the privacy controls and wording follow it. */
    enabled: !!native,
    /** The ad bridge pauses the game's audio itself (CrazyGames: only once an ad really starts). */
    handlesAudio: !!native?.handlesAudio,
    rewarded,

    /** Seconds since the last rewarded ad (Infinity if none), for the testing card. */
    get sinceRewarded() { return Math.round((Date.now() - lastRewarded) / 1000); },

    /**
     * At the end of a level: is an Ad break due? `level` is the level just
     * reached; due from 11 on (so after level 10), unless a rewarded ad played
     * within the last minute, and only with an ad loaded.
     */
    interstitialDue(level) {
      return level >= INTERSTITIAL_FROM_LEVEL && Date.now() - lastRewarded >= AFTER_REWARDED_MS
        && interstitial.available();
    },

    /** Play it. Resolves when the player is back, true if an ad was shown. */
    async showInterstitial(placement, { level = 0 } = {}) {
      track('ad_interstitial_show', { placement, level });
      const shown = await interstitial.show(placement);
      track('ad_interstitial_result', { placement, shown });
      return shown;
    },

    /** A natural break in a game (host.moment). Nothing is tied to it now. */
    async moment() { return false; },

    /**
     * Privacy choices (the US "do not sell or share" link, or GDPR if ever
     * needed). Google's consent SDK decides who must be offered them and owns
     * the form; Settings shows the row only when it says so.
     */
    /** What the native side knows (consent, loads, errors), for the Ad status card. */
    status() { try { return native ? JSON.parse(native.status?.() || '{}') : null; } catch { return null; } },

    privacyRequired() { try { return !!native?.privacyOptionsRequired(); } catch { return false; } },
    showPrivacy() { try { native?.showPrivacyOptions(); } catch { /* no bridge */ } },
  };
}

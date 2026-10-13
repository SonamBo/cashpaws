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
 * Interstitials: after level 10, once per 2.5 minutes of actual play. The
 * shell announces each one with a 2-second "Ad break" screen first (so it
 * never ambushes a tap), and only starts one between moves. Watching a
 * rewarded ad restarts the clock too, so ads never come back to back.
 */
export const INTERSTITIAL_EVERY_MS = 150000;
export const INTERSTITIAL_FROM_LEVEL = 11;      // "after level 10"
const RETRY_AFTER_FAIL_MS = 30000;              // an ad that didn't show: try again in 30 s of play

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
  let playMs = 0;
  const show = rewarded.show;
  rewarded.show = async (placement) => {
    track('ad_rewarded_start', { placement });
    const earned = await show(placement);
    track('ad_rewarded_result', { placement, earned });
    playMs = 0;                      // an ad just played: the interstitial clock starts again
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

    /** Seconds of actual play, fed by the shell while the board is on screen. */
    played(ms) { playMs += ms; },
    get playSeconds() { return Math.round(playMs / 1000); },

    /** An interstitial is due: past level 10, 2.5 minutes of play, and one is loaded. */
    interstitialDue(level) {
      return level >= INTERSTITIAL_FROM_LEVEL && playMs >= INTERSTITIAL_EVERY_MS && interstitial.available();
    },

    /** Play it. Resolves when the player is back, true if an ad was shown. */
    async showInterstitial(placement, { level = 0 } = {}) {
      track('ad_interstitial_show', { placement, level, play_seconds: Math.round(playMs / 1000) });
      const shown = await interstitial.show(placement);
      track('ad_interstitial_result', { placement, shown });
      playMs = shown ? 0 : INTERSTITIAL_EVERY_MS - RETRY_AFTER_FAIL_MS;
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

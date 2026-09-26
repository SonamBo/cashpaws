/**
 * Ads, as the shell sees them. Games never touch an ad network: they mark a
 * natural break with host.moment() and ask host.rewarded whether a rewarded
 * ad is on offer. Policy — which placements exist, how often — lives here.
 *
 * Three situations:
 *  - The Android app with AppLovin keys: window.CashPawsAds exists and reports
 *    itself enabled. Rewarded ads are real.
 *  - The app without keys, or any browser: no ads. Every placement reports
 *    unavailable, so games hide their ad buttons.
 *  - ?dev=1: a stub pretends, so the flows can be built and tested.
 */

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

export function createAds({ dev, confirm }) {
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

  return {
    /** True when real ads can be served; the privacy controls and wording follow it. */
    enabled: !!native,
    rewarded,

    /** A natural break. Interstitials will go here, behind frequency caps. */
    async moment() {},

    /** The US "do not sell or share" choice. Stored natively so it applies before the SDK starts. */
    getDoNotSell() { try { return !!native?.getDoNotSell(); } catch { return false; } },
    setDoNotSell(value) { try { native?.setDoNotSell(!!value); } catch { /* no bridge */ } },
  };
}

/**
 * A stand-in for https://sdk.crazygames.com/crazygames-sdk-v3.js, served by
 * the tests in its place. It behaves like the real SDK's documented API and
 * records every call in window.__mockCG.calls.
 *
 * Set window.__mockCG before the page loads to change its behaviour:
 *   { environment: 'crazygames' | 'local' | 'disabled', adblock, fill,
 *     adMs, cloud: { key: value }, initMs }
 */
(function () {
  const M = window.__mockCG = Object.assign({
    environment: 'crazygames', adblock: false, fill: true, adMs: 300, cloud: {}, initMs: 50, calls: [],
  }, window.__mockCG || {});
  const rec = (name, arg) => M.calls.push(arg === undefined ? name : `${name}:${arg}`);
  const guard = (name, fn) => (...a) => {
    if (M.environment === 'disabled') throw new Error('CrazyGames SDK is disabled on this domain');
    rec(name, a[0] && typeof a[0] === 'string' ? a[0] : undefined);
    return fn(...a);
  };
  const SDK = {
    environment: 'uninitialized',
    init: () => new Promise((ok) => setTimeout(() => { SDK.environment = M.environment; rec('init'); ok(); }, M.initMs)),
    ad: {
      hasAdblock: guard('hasAdblock', () => Promise.resolve(M.adblock)),
      requestAd: guard('requestAd', (type, cb) => {
        setTimeout(() => {
          if (!M.fill) return cb.adError && cb.adError({ code: 'unfilled', message: 'No ad available' });
          M.adShowing = type;
          cb.adStarted && cb.adStarted();
          setTimeout(() => { M.adShowing = null; cb.adFinished && cb.adFinished(); }, M.adMs);
        }, 30);
      }),
    },
    game: {
      gameplayStart: guard('gameplayStart', () => {}),
      gameplayStop: guard('gameplayStop', () => {}),
      loadingStart: guard('loadingStart', () => {}),
      loadingStop: guard('loadingStop', () => {}),
      happytime: guard('happytime', () => {}),
    },
    data: {
      getItem: guard('data.getItem', (k) => (k in M.cloud ? M.cloud[k] : null)),
      setItem: guard('data.setItem', (k, v) => { M.cloud[k] = String(v); }),
      removeItem: guard('data.removeItem', (k) => { delete M.cloud[k]; }),
      clear: guard('data.clear', () => { M.cloud = {}; }),
    },
  };
  window.CrazyGames = { SDK };
})();

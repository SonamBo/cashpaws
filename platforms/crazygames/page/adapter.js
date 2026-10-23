/**
 * The shell on CrazyGames. Loaded before the game, it connects the unchanged
 * shell (and whatever game is installed) to the CrazyGames SDK v3:
 *
 *  - Ads. The shell looks for an ad bridge called window.CashPawsAds; on
 *    Android that is AdMob, here it is this file. Rewarded ads keep their
 *    places (rescue Sort, opening the Rewards Box early). Ad breaks only ever
 *    happen right after a level-up and at most every 3 minutes: CrazyGames
 *    wants midgame ads at natural breaks. Built without ads (Basic Launch),
 *    no bridge exists and the shell shows no ad buttons at all.
 *  - Gameplay start/stop, which CrazyGames requires: "playing" means the board
 *    is on screen with nothing over it and no ad running.
 *  - Loading start/stop, and opening straight into the game.
 *  - Saves: the shell saves to localStorage as always; every save is also
 *    copied to the SDK's Data module, and restored from it at start, so a
 *    logged-in player's progress follows them between devices.
 *
 * With no SDK (blocked, offline, or any other website) the game runs exactly
 * as in a browser: no ads, saves in localStorage.
 */
(function () {
  const CFG = window.__CG_CONFIG || { ads: false };
  // The game's web.json can say how its header shows the level, as a regular
  // expression with one number group. Default: the first number in the title.
  const LEVEL_RE = new RegExp((window.__WEB_GAME && window.__WEB_GAME.levelPattern) || '(\\d+)');
  const SAVE_KEY = 'cashpaws.save.v2';
  const MIDGAME_GAP_MS = 180000;        // CrazyGames: at most one midgame ad every 3 minutes
  const AFTER_LEVEL_UP_MS = 120000;     // an Ad break only near a level-up (the shell asks at the level's end, after its card)
  const REWARDED_RETRY_MS = 60000;      // after an unfilled rewarded ad, hide the offer this long

  let sdk = null;
  let env = 'none';
  let adblock = false;
  let adRunning = false;
  let lastAdAt = 0;
  let levelUpAt = 0;
  let rewardedHiddenUntil = 0;
  let initError = '';
  const events = [];                     // what was sent to the SDK, for the tests
  const note = (name) => events.push({ name, at: Date.now() });
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

  /* ---------------- start ---------------- */

  async function init() {
    const S = window.CrazyGames && window.CrazyGames.SDK;
    if (!S) { initError = 'no SDK script'; return; }
    try { await withTimeout(S.init(), 6000); } catch (e) { initError = 'init: ' + (e && e.message); return; }
    env = S.environment;
    // Anywhere but CrazyGames (or localhost) every SDK call throws.
    if (env !== 'crazygames' && env !== 'local') { initError = 'environment ' + env; return; }
    sdk = S;
    safe(() => sdk.game.loadingStart()); note('loadingStart');
    if (CFG.ads) {
      try { adblock = !!(await withTimeout(sdk.ad.hasAdblock(), 2500)); } catch (e) { adblock = false; }
    }
    restoreSave();
  }

  /* ---------------- saves: localStorage, mirrored to the Data module ---------------- */

  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;

  function restoreSave() {
    const cloud = safe(() => sdk.data.getItem(SAVE_KEY));
    const local = safe(() => localStorage.getItem(SAVE_KEY));
    if (cloud) safe(() => rawSet.call(localStorage, SAVE_KEY, cloud));
    else if (local) safe(() => sdk.data.setItem(SAVE_KEY, local));
    Storage.prototype.setItem = function (key, value) {
      rawSet.call(this, key, value);
      if (this === window.localStorage && key === SAVE_KEY && sdk) safe(() => sdk.data.setItem(key, String(value)));
    };
    Storage.prototype.removeItem = function (key) {
      rawRemove.call(this, key);
      if (this === window.localStorage && key === SAVE_KEY && sdk) safe(() => sdk.data.removeItem(key));
    };
  }

  /* ---------------- after the shell is up ---------------- */

  const app = () => document.getElementById('app');
  const onGame = () => !!app() && app().classList.contains('on-game');
  const covered = () => !!app() && !!app().querySelector('.overlays .ovl, .panel-sheet.in');

  let playing = false;
  function tick() {
    const now = !adRunning && onGame() && !covered() && document.visibilityState === 'visible';
    if (now === playing) return;
    playing = now;
    if (!sdk) return;
    if (now) { safe(() => sdk.game.gameplayStart()); note('gameplayStart'); }
    else { safe(() => sdk.game.gameplayStop()); note('gameplayStop'); }
  }

  // A level-up is the title's level number going up.
  let shownLevel = 0;
  function watchLevel() {
    const t = app() && app().querySelector('[data-title]');
    const m = t && LEVEL_RE.exec(t.textContent || '');
    const n = m ? Number(m[1]) : 0;
    if (shownLevel && n > shownLevel) levelUpAt = Date.now();
    if (n) shownLevel = n;
  }

  function booted() {
    // Straight into the game: CrazyGames players should land in gameplay.
    // The shell builds the lobby asynchronously, so wait for its Play button.
    const started = Date.now();
    (function enter() {
      const play = app() && app().querySelector('[data-play]');
      if (play && app().classList.contains('on-lobby')) {
        play.click();
        if (sdk) { safe(() => sdk.game.loadingStop()); note('loadingStop'); }
      } else if (Date.now() - started < 8000) return void setTimeout(enter, 50);
      else if (sdk) { safe(() => sdk.game.loadingStop()); note('loadingStop'); }
    })();
    setInterval(() => { watchLevel(); tick(); }, 250);
    document.addEventListener('visibilitychange', tick);
  }

  /* ---------------- the ad bridge the shell looks for ---------------- */

  function request(type, callbackId) {
    const soundHold = (on) => { const snd = window.CashPaws && window.CashPaws.sound; if (snd) on ? snd.hold('ad') : snd.release('ad'); };
    const reply = (ok) => {
      adRunning = false;
      soundHold(false);
      if (ok) lastAdAt = Date.now();
      tick();
      if (window.__adResult) window.__adResult(callbackId, ok);
    };
    if (!sdk) return reply(false);
    adRunning = true;
    tick();                                  // gameplayStop for the ad
    note('requestAd:' + type);
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; reply(ok); } };
    try {
      sdk.ad.requestAd(type, {
        // CrazyGames: mute when the ad actually starts, not on request.
        adStarted: () => { note('adStarted:' + type); soundHold(true); },
        adFinished: () => { note('adFinished:' + type); done(true); },
        adError: (err) => {
          note('adError:' + type + ':' + (err && err.code));
          if (type === 'rewarded') rewardedHiddenUntil = Date.now() + REWARDED_RETRY_MS;
          done(false);
        },
      });
    } catch (e) { done(false); }
  }

  const adsUsable = () => !!sdk && CFG.ads && !adblock && !adRunning;

  if (CFG.ads) {
    window.CashPawsAds = {
      handlesAudio: true,              // the shell leaves muting during ads to us
      isEnabled: () => !!sdk,
      rewardedReady: () => adsUsable() && Date.now() >= rewardedHiddenUntil,
      showRewarded: (placement, id) => request('rewarded', id),
      interstitialReady: () => adsUsable()
        && Date.now() - levelUpAt < AFTER_LEVEL_UP_MS
        && Date.now() - lastAdAt >= MIDGAME_GAP_MS,
      showInterstitial: (placement, id) => request('midgame', id),
      privacyOptionsRequired: () => false,     // CrazyGames handles consent on its site
      showPrivacyOptions: () => {},
      status: () => JSON.stringify({
        build: 'CrazyGames web',
        consent: 'handled by CrazyGames',
        canRequestAds: adsUsable(),
        consentError: initError || (adblock ? 'ad blocker detected' : ''),
        started: !!sdk,
        rewarded: adsUsable() ? (Date.now() >= rewardedHiddenUntil ? 'ready' : 'resting after an unfilled ad') : 'off',
        interstitial: adsUsable() ? `after a level-up, ${Math.max(0, Math.ceil((MIDGAME_GAP_MS - (Date.now() - lastAdAt)) / 1000))} s until allowed` : 'off',
      }),
    };
  }

  window.__cg = {
    ready: init().catch((e) => { initError = String(e); }),
    booted,
    events,
    state: () => ({ env, sdk: !!sdk, adblock, adRunning, playing, levelUpAt, lastAdAt, initError }),
  };
})();

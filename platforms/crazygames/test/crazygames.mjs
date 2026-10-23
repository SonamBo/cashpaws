/**
 * The CrazyGames build, with whatever game is installed, against a stand-in
 * for the CrazyGames SDK. Nothing here knows which game it is; a game's own
 * web checks go in test/games/<id>/crazygames.mjs.
 *
 *   node platforms/crazygames/build.mjs && node platforms/crazygames/test/crazygames.mjs
 */
import { FULL, BASIC, BUILD, SAVE_KEY, open, check, calls, done } from './harness.mjs';

const SIZES = [[1000, 562], [1280, 720], [1920, 1080], [800, 600], [390, 844], [844, 390]];

/* ================= full build ================= */
console.log(`--- ${BUILD.name} ${BUILD.version} (${BUILD.game}), full build ---`);
{
  const { ctx, p, errs } = await open(FULL, { dev: true });
  const c = await calls(p);
  check('the SDK is initialised', c.includes('init'));
  check('loading is reported, start and stop', c.includes('loadingStart') && c.includes('loadingStop'));
  check('the player lands straight in the game', await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
  check('the page carries the app\'s name', (await p.title()) === BUILD.name, await p.title());
  check('gameplayStart once the game is up', (await calls(p)).includes('gameplayStart'));

  const n0 = (await calls(p)).length;
  await p.keyboard.press('p'); await p.waitForTimeout(600);
  check('P pauses', (await p.locator('.overlays .ovl').count()) > 0);
  check('which stops gameplay for CrazyGames', (await calls(p)).slice(n0).includes('gameplayStop'));
  await p.keyboard.press('p'); await p.waitForTimeout(700);
  check('P again resumes, and gameplay starts again', (await p.locator('.overlays .ovl').count()) === 0
    && (await calls(p)).slice(n0).includes('gameplayStart'));

  // The game's own keys press its own controls.
  const keys = await p.evaluate(() => (window.__WEB_GAME.keys || []).map((k) => ({ key: k.key, sel: k.click })));
  for (const k of keys) {
    const key = /^(\d)-\d$/.test(k.key) ? k.key[0] : k.key;
    const sel = k.sel.replaceAll('{i}', Number(key) - 1).replaceAll('{n}', key);
    const hit = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el || el.disabled || el.offsetParent === null) return 'absent';
      window.__hit = false;
      el.addEventListener('click', () => { window.__hit = true; }, { once: true });
      return 'ok';
    }, sel);
    if (hit === 'absent') { console.log(`      (key ${key}: ${sel} not on screen right now, skipped)`); continue; }
    await p.keyboard.press(key); await p.waitForTimeout(500);
    check(`key ${key} presses ${sel}`, await p.evaluate(() => window.__hit === true));
    await p.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 4000 }).catch(() => {});
    while (await p.locator('.overlays .ovl').count()) { await p.keyboard.press('p'); await p.waitForTimeout(500); if (await p.locator('.overlays .ovl').count()) { await p.keyboard.press('Enter'); await p.waitForTimeout(500); } break; }
  }

  // Saves mirrored to the Data module.
  await p.evaluate(() => window.CashPaws.flush()); await p.waitForTimeout(200);
  const cloud = await p.evaluate((k) => window.__mockCG.cloud[k], SAVE_KEY);
  check('every save is copied to the CrazyGames Data module', !!cloud && cloud === await p.evaluate((k) => localStorage.getItem(k), SAVE_KEY));

  // Rewarded ads, through the shell. The game's sound goes quiet only once
  // the ad has actually started (CrazyGames' rule), and comes back after.
  check('rewarded ads are offered', await p.evaluate(() => window.__ads.rewarded.available('test')));
  await p.evaluate(() => {
    window.__holds = [];
    const snd = window.CashPaws.sound;
    const hold = snd.hold, release = snd.release;
    snd.hold = (r) => { window.__holds.push('hold:' + r + ':' + (window.__mockCG.adShowing || 'none')); hold(r); };
    snd.release = (r) => { window.__holds.push('release:' + r); release(r); };
  });
  const earned = await p.evaluate(() => window.__ads.rewarded.show('test'));
  const holds = await p.evaluate(() => window.__holds.join(' '));
  check('sound is held once the ad starts, and released after', /hold:ad:rewarded.*release:ad/.test(holds) && !/hold:ad:none/.test(holds), holds);
  const c2 = await calls(p);
  check('a rewarded ad goes to CrazyGames and pays when finished', earned === true && c2.includes('requestAd:rewarded'));
  await p.evaluate(() => { window.__mockCG.fill = false; });
  const unfilled = await p.evaluate(() => window.__ads.rewarded.show('test'));
  check('an unfilled ad pays nothing', unfilled === false);
  check('and the offer goes away, so no button does nothing', await p.evaluate(() => !window.__ads.rewarded.available('test')));

  // Midgame ads only after a level-up, never back to back.
  check('no midgame ad without a level-up', await p.evaluate(() => !window.CashPawsAds.interstitialReady()));

  // Settings and privacy.
  await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(600);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const menu = (await p.locator('.ovl-menu').last().innerText()).replace(/\s+/g, ' ');
  check('Settings says CrazyGames serves the ads', /ads by CrazyGames/.test(menu) && !/AdMob/.test(menu));
  check('the privacy link is the page inside the zip', (await p.locator('.menu-link').getAttribute('href')) === 'privacy.html');
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();

  const { ctx: c3, p: pv } = await open(FULL);
  await pv.goto(FULL + 'privacy.html');
  const text = await pv.locator('main').innerText();
  check('the privacy page names the app, the contact and CrazyGames', text.includes(BUILD.name) && /@/.test(text) && /CrazyGames Privacy Policy/.test(text) && !/«/.test(text));
  await c3.close();
}

/* ---- progress comes back from the player's CrazyGames account ---- */
{
  const first = await open(FULL, { dev: true });
  await first.p.evaluate(() => { wallet.earn(777 - wallet.coins, 'test'); window.CashPaws.flush(); });
  const cloud = await first.p.evaluate((k) => window.__mockCG.cloud[k], SAVE_KEY);
  await first.ctx.close();
  const { ctx, p } = await open(FULL, { mock: { cloud: { [SAVE_KEY]: cloud } } });
  check('on another device, progress comes back from the account', (await p.locator('[data-coins]').first().textContent()).replace(/\D/g, '') === '777');
  await ctx.close();
}

/* ---- ad blocker, SDK blocked, other websites ---- */
{
  const { ctx, p, errs } = await open(FULL, { dev: true, mock: { adblock: true } });
  check('with an ad blocker, no ads are offered', await p.evaluate(() => !window.__ads.rewarded.available('test')));
  check('and the game still runs', await p.evaluate(() => document.getElementById('app').classList.contains('on-game')) && errs.length === 0, errs.join(' | '));
  await ctx.close();
}
for (const [label, opts] of [['SDK blocked', { sdk: 'blocked' }], ['another website', { mock: { environment: 'disabled' } }]]) {
  const { ctx, p, errs } = await open(FULL, opts);
  check(`${label}: the game starts, without ads or errors`, await p.evaluate(() => document.getElementById('app').classList.contains('on-game')
    && (!window.CashPawsAds || !window.CashPawsAds.isEnabled())) && errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ================= basic build ================= */
console.log('--- basic build (Basic Launch: ads off) ---');
{
  const { ctx, p, errs } = await open(BASIC);
  check('no ad bridge at all', await p.evaluate(() => !window.CashPawsAds));
  check('gameplay is still reported to CrazyGames', (await calls(p)).includes('gameplayStart'));
  await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(600);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const menu = (await p.locator('.ovl-menu').last().innerText()).replace(/\s+/g, ' ');
  check('Settings says no ads, saved in this browser', /No ads/.test(menu) && /this browser/.test(menu));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ================= fits every window ================= */
console.log('--- layout ---');
const must = ['[data-menu]', ...BUILD.mustBeVisible];
for (const size of SIZES) {
  const { ctx, p, errs } = await open(FULL, { size });
  const m = await p.evaluate((sels) => {
    const out = {};
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null);
      out[s] = els.length > 0 && els.every((e) => { const r = e.getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; });
    }
    out.noScroll = document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight;
    return out;
  }, must);
  check(`${size.join('×')}: ${must.join(', ')} all on screen, no scrolling`, Object.values(m).every(Boolean), JSON.stringify(m));
  if (errs.length) check(`${size.join('×')}: no page errors`, false, errs.join(' | '));
  await ctx.close();
}

await done();

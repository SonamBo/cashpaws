/**
 * The shell, in a browser, with whatever game is installed: it boots under the
 * app's own name, every lobby tab opens, the game starts and saves, Settings
 * links the privacy policy and shows the version, and ads switch on when the
 * native bridge is there. Nothing here knows which game it is.
 *
 * Needs the dev server (node serve.js 8080) and Playwright.
 * Run: node test/shell.mjs
 */
import pw from 'playwright';
import APP from '../www/app.config.js';

const URL = 'http://localhost:8080/';
let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

const b = await pw.chromium.launch();

async function open({ bridge = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
  if (bridge) {
    await ctx.addInitScript(`window.CashPawsAds = {
      isEnabled: () => true, rewardedReady: () => true, interstitialReady: () => true,
      showRewarded(p, id) { setTimeout(() => window.__adResult(id, true), 50); },
      showInterstitial(p, id) { setTimeout(() => window.__adResult(id, true), 50); },
      privacyOptionsRequired: () => true, showPrivacyOptions() { window.__privacyShown = true; },
      status: () => JSON.stringify({ build: 'debug (Google test ads)', consent: 'not required', canRequestAds: true, started: true, rewarded: 'ready', interstitial: 'ready' }),
    };`);
  }
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL + 'css/tokens.css');
  await p.evaluate(() => localStorage.clear());
  await p.goto(URL + '?dev=1&lobby=1');
  await p.waitForTimeout(900);
  // The installed game's tutorial, if it has one, would cover what we click.
  await p.evaluate(() => { for (const id of Object.keys(shell.flags || {})) shell.flags[id] = { ...shell.flags[id], ftue: true }; shell.reminders.asked = true; });
  return { ctx, p, errs };
}
const events = (p) => p.evaluate(() => (window.__events || []).map((e) => e.name));

/* ---------------- a browser: no ad SDK ---------------- */
{
  const { ctx, p, errs } = await open();
  check('the page is titled with the app\'s name', (await p.title()) === APP.name, await p.title());
  check('it reports app_ready', (await events(p)).includes('app_ready'));

  for (const tab of ['daily', 'cats', 'progress', 'shop', 'home']) {
    await p.click(`[data-tab="${tab}"]`); await p.waitForTimeout(350);
    check(`the ${tab} tab opens`, await p.locator(`[data-tab="${tab}"].on`).count() === 1);
  }

  await p.click('[data-play]'); await p.waitForTimeout(800);
  const views = await p.evaluate(() => (window.__events || []).filter((e) => e.name === 'screen_view').map((e) => e.params.screen_name));
  check('Play opens the game screen', views.includes('game'), views.join(', '));
  check('and the game draws something', await p.evaluate(() => [...document.querySelectorAll('.screen')].some((s) => s.offsetParent && s.innerHTML.length > 200)));
  check('back returns to the lobby', await p.evaluate(() => window.CashPaws.onBack()) === true);
  await p.waitForTimeout(500);

  await p.evaluate(() => window.CashPaws.flush());
  const save = await p.evaluate(() => JSON.parse(localStorage.getItem('cashpaws.save.v2') || 'null'));
  check('the save has the shell and a slot for the game', !!save?.shell && Object.keys(save?.games || {}).length === 1, Object.keys(save?.games || {}).join(', '));
  await p.reload(); await p.waitForTimeout(900);
  check('a reload comes back without errors', errs.length === 0, errs.join(' | '));

  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const menu = (await p.locator('.ovl-menu').last().innerText()).replace(/\s+/g, ' ');
  check('Settings carries the app\'s name', menu.includes(APP.name));
  const link = p.locator('.menu-link');
  check('it links the app\'s privacy policy', (await link.getAttribute('href')) === APP.privacyUrl, await link.getAttribute('href'));
  check('in a new page, never inside the game', (await link.getAttribute('target')) === '_blank');
  check('and shows the version', menu.includes(`Version ${APP.versionName}`));
  check('it has Sound effects and Music switches', /Sound effects/.test(menu) && /Music/.test(menu));
  check('it says there are no ads in a browser', /No ads/.test(menu));
  const v = p.locator('.settings-version');
  for (let i = 0; i < 5; i++) { await v.click(); await p.waitForTimeout(60); }
  await p.waitForTimeout(500);
  check('five taps on the version open Ad status', /Ad status/.test(await p.locator('.ovl').last().innerText()));
  check('which says no ad SDK here', /No ad SDK/.test(await p.locator('.ovl').last().innerText()));
  await p.locator('.ovl [data-cancel]').last().click(); await p.waitForTimeout(400);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------------- the app: the native ad bridge is there ---------------- */
{
  const { ctx, p, errs } = await open({ bridge: true });
  check('with the bridge, ads are on', await p.evaluate(() => window.__ads.enabled));
  check('and a rewarded ad can be offered', await p.evaluate(() => window.__ads.rewarded.available('any')));
  const earned = await p.evaluate(() => window.__ads.rewarded.show('test'));
  check('a finished rewarded ad pays out', earned === true);
  check('and is tracked', (await events(p)).includes('ad_rewarded_result'));
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const menu = (await p.locator('.ovl-menu').last().innerText()).replace(/\s+/g, ' ');
  check('Settings names Google AdMob', /AdMob/.test(menu));
  check('and offers the US privacy choice when Google says so', /Do not sell or share/.test(menu));
  await p.locator('[data-pick="privacy"]').click(); await p.waitForTimeout(300);
  check('which opens Google\'s own form', await p.evaluate(() => window.__privacyShown === true));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

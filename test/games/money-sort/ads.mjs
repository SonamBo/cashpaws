/**
 * The shell against a mock of the native ad bridge (window.CashPawsAds, the
 * interface Ads.java exposes). Covers the placements, paying out only when an
 * ad was finished, Google's privacy choices, and the Settings wording in each case.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';

const b = await pw.chromium.launch();
let failed = 0;
const errs = [];
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

// Behaves like Ads.java: showRewarded answers later through window.__adResult.
const MOCK = ({ enabled, rewardNext, privacy = false }) => `
  window.__mock = { calls: [], privacyShown: 0, rewardNext: ${rewardNext} };
  window.CashPawsAds = {
    isEnabled: () => ${enabled},
    rewardedReady: () => true,
    showRewarded(placement, id) {
      __mock.calls.push(placement);
      setTimeout(() => window.__adResult(id, __mock.rewardNext), 50);
    },
    privacyOptionsRequired: () => ${privacy},
    showPrivacyOptions() { __mock.privacyShown++; },
  };`;

async function open({ bridge, dev = false }) {
  const ctx = await b.newContext({ viewport: { width: 1160, height: 1060 } });
  if (bridge) await ctx.addInitScript(MOCK(bridge));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(() => localStorage.clear());
  await p.goto(`http://localhost:8080/${dev ? '?dev=1' : ''}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  return { p, ctx };
}
const settingsText = async (p) => {
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const t = await p.locator('.ovl-menu').textContent();
  return t;
};
// Outside dev there are no debugging handles, so read coins as the player does.
const coins = (p) => p.evaluate(() => Number(document.querySelector('.lobby-top [data-coins]').textContent));
const closeSettings = async (p) => { await p.locator('[data-pick="close"]').click(); await p.waitForTimeout(400); };

console.log('--- the app with AdMob, a US player (mock bridge, privacy choices required) ---');
let { p, ctx } = await open({ bridge: { enabled: true, rewardNext: true, privacy: true } });
let t = await settingsText(p);
check('Settings names Google AdMob, the optional ads and the Ad breaks', /Optional ads give rewards/.test(t) && /Ad break/.test(t) && /Google AdMob/.test(t));
check('the US privacy choice is offered', await p.locator('[data-pick="privacy"]').count() === 1);
await p.locator('.device').screenshot({ path: '/tmp/settings-ads.png' });
await p.locator('[data-pick="privacy"]').click(); await p.waitForTimeout(500);
check('and opens Google\'s own form', await p.evaluate(() => __mock.privacyShown) === 1);
await ctx.close();

console.log('--- the app with AdMob, a player who needs no privacy message ---');
({ p, ctx } = await open({ bridge: { enabled: true, rewardNext: true, privacy: false } }));
t = await settingsText(p);
check('no privacy row when Google says none is required', await p.locator('[data-pick="privacy"]').count() === 0);
await closeSettings(p);

// the Rewards Box, opened early with a real (mock) ad
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('[data-pick="open"]').click(); await p.waitForTimeout(600);
await p.locator('[data-go]').click(); await p.waitForTimeout(400);
await p.click('[data-box]'); await p.waitForTimeout(400);
check('with ads live, the box offers an early open outside dev', await p.locator('[data-pick="ad"]').count() === 1);
const c0 = await coins(p);
await p.locator('[data-pick="ad"]').click(); await p.waitForTimeout(900);
check('it asks the native side for the box-early placement', (await p.evaluate(() => __mock.calls)).includes('box-early'));
check('and pays once the ad reports it was finished', (await coins(p)) > c0);
await p.locator('[data-go]').click().catch(() => {}); await p.waitForTimeout(300);

// an ad closed before the reward pays nothing
await p.evaluate(() => { __mock.rewardNext = false; });
await p.click('[data-box]'); await p.waitForTimeout(400);
const c1 = await coins(p);
await p.locator('[data-pick="ad"]').click(); await p.waitForTimeout(900);
check('an ad closed early pays nothing', (await coins(p)) === c1);
await ctx.close();

// the stuck card, broke, with a real (mock) ad
({ p, ctx } = await open({ bridge: { enabled: true, rewardNext: true } }));
await p.click('[data-play]'); await p.waitForTimeout(400);
const [f, to] = await p.evaluate(() => {
  game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
  game.coins = 0; game.freeSorts = 0; game.status = 'playing'; game.selected = null; game.turnsUntilDrop = 6; game.undoSnapshot = null;
  view.update(); return game.legalMoves()[0];
});
await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
await p.click(`.tube[data-col="${to}"]`); await p.waitForTimeout(900);
check('stuck and broke, the rescue ad is offered outside dev', await p.locator('[data-ad-sort]').count() === 1);
await p.locator('[data-ad-sort]').click(); await p.waitForTimeout(1500);
check('it asks for the rescue-sort placement', (await p.evaluate(() => __mock.calls)).includes('rescue-sort'));
check('and a finished ad sorts the board for free', (await p.evaluate(() => game.status)) === 'playing');
await ctx.close();

console.log('--- the app built without keys (bridge present, disabled) ---');
({ p, ctx } = await open({ bridge: { enabled: false, rewardNext: true } }));
t = await settingsText(p);
check('Settings says no ads', /No ads\. No purchases\./.test(t));
check('and shows no privacy row, since no ads are shown', await p.locator('[data-pick="privacy"]').count() === 0);
await ctx.close();

console.log('--- a browser, no bridge at all ---');
({ p, ctx } = await open({ bridge: null }));
t = await settingsText(p);
check('Settings says no ads here too', /No ads\. No purchases\./.test(t));
await ctx.close();

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

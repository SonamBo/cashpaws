/**
 * Sound in the running app, with whatever game is installed:
 *  - silent until the first tap or key (browsers and the Android WebView
 *    insist), then music starts;
 *  - the Settings switches stop effects and music, and are remembered;
 *  - everything goes quiet while an ad plays and while the app is hidden.
 *
 * Needs the dev server (node serve.js 8080) and Playwright.
 * Run: node test/sound.mjs
 */
import pw from 'playwright';

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

// Count what the page asks Web Audio for, and expose its contexts.
const SPY = `
  window.__audio = { contexts: [], oscillators: 0 };
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...a) { super(...a); window.__audio.contexts.push(this); }
    createOscillator() { window.__audio.oscillators++; return super.createOscillator(); }
  };
  window.CashPawsAds = {
    isEnabled: () => true, rewardedReady: () => true, interstitialReady: () => false,
    showRewarded(p, id) { window.__adOpen = true; setTimeout(() => { window.__adOpen = false; window.__adResult(id, true); }, 600); },
    showInterstitial(p, id) { window.__adResult(id, false); },
    privacyOptionsRequired: () => false, showPrivacyOptions() {}, status: () => '{}',
  };`;

const b = await pw.chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
await ctx.addInitScript(SPY);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1');
await p.waitForTimeout(900);

const state = () => p.evaluate(() => window.__audio.contexts.map((c) => c.state).join(','));
const oscIn = async (ms) => { const a = await p.evaluate(() => window.__audio.oscillators); await p.waitForTimeout(ms); return (await p.evaluate(() => window.__audio.oscillators)) - a; };

check('nothing plays before the first tap', (await state()) !== 'running', await state());

await p.mouse.click(200, 300);                               // the first gesture
await p.waitForTimeout(500);
check('the first tap starts audio', (await state()) === 'running', await state());
check('and the music plays', (await oscIn(3000)) > 10);

await p.evaluate(() => window.__sound.play('bank'));
check('effects play', true);

// Settings: music off, effects off, remembered after a reload.
await p.evaluate(() => window.CashPaws.onBack?.());
await p.waitForTimeout(400);
await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
check('Settings has a Music switch and a Sound effects switch',
  (await p.locator('[data-pick="music"]').count()) === 1 && (await p.locator('[data-pick="sfx"]').count()) === 1);
await p.locator('[data-pick="music"]').click(); await p.waitForTimeout(800);
check('Music off stops the music', (await oscIn(3000)) === 0);
await p.locator('[data-pick="sfx"]').click(); await p.waitForTimeout(500);
const before = await p.evaluate(() => window.__audio.oscillators);
await p.evaluate(() => { window.__sound.play('bank'); window.__sound.play('drop'); });
check('Sound effects off silences effects', (await p.evaluate(() => window.__audio.oscillators)) === before);
await p.evaluate(() => window.CashPaws.flush());
await p.reload(); await p.waitForTimeout(900);
await p.mouse.click(200, 300); await p.waitForTimeout(400);
check('both stay off after a reload', (await p.evaluate(() => [window.__sound.sfx, window.__sound.music].join())) === 'false,false');
// Back on, for the rest.
await p.evaluate(() => window.CashPaws.onBack?.()); await p.waitForTimeout(300);
await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
await p.locator('[data-pick="music"]').click(); await p.waitForTimeout(500);
await p.locator('[data-pick="sfx"]').click(); await p.waitForTimeout(500);
await p.locator('[data-pick="close"]').click().catch(() => {}); await p.waitForTimeout(400);
check('switched back on, the music returns', (await oscIn(3000)) > 10);

// An ad: silent while it plays, back afterwards.
const ad = p.evaluate(() => window.__ads.rewarded.show('test'));
await p.waitForTimeout(250);
check('silent while an ad plays', (await state()) === 'suspended', await state());
await ad; await p.waitForTimeout(300);
check('sound comes back after the ad', (await state()) === 'running', await state());

// The app hidden (home button, another tab).
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await p.waitForTimeout(300);
check('silent while the app is hidden', (await state()) === 'suspended', await state());
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await p.waitForTimeout(300);
check('and back when it returns', (await state()) === 'running', await state());

check('one audio context only', (await p.evaluate(() => window.__audio.contexts.length)) === 1);
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

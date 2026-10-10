/**
 * Interstitials, against a mock of the native bridge: past level 10, every
 * 2.5 minutes of actual play, announced by a 2-second "Ad break" screen.
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

const MOCK = `
  window.__mock = { inter: [], at: [] };
  window.CashPawsAds = {
    isEnabled: () => true,
    rewardedReady: () => true,
    showRewarded(placement, id) { setTimeout(() => window.__adResult(id, true), 50); },
    interstitialReady: () => true,
    showInterstitial(placement, id) {
      __mock.inter.push(placement); __mock.at.push(performance.now());
      setTimeout(() => window.__adResult(id, true), 400);
    },
    privacyOptionsRequired: () => false,
    showPrivacyOptions() {},
  };`;

const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
await ctx.addInitScript(MOCK);
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(900);
await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; });
await p.click('[data-play]'); await p.waitForTimeout(600);
const inter = () => p.evaluate(() => __mock.inter.length);
const setLevel = (l) => p.evaluate((lvl) => { game.level = lvl; game.netWorth = game.floor; view.update(); window.CashPaws.flush(); }, l);
// One real move, so the game repaints and tells the shell its level.
async function move() {
  const [f, t] = await p.evaluate(() => {
    game.columns = game.columns.map(() => []);
    game.columns[0] = [5, 10]; game.columns[1] = [20];
    game.turnsUntilDrop = 9; game.status = 'playing'; game.selected = null; view.update();
    return [0, 2];
  });
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(120);
  await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(700);
}

// The play clock runs on the board, and stops under the pause menu.
const t0 = await p.evaluate(() => __ads.playSeconds);
await p.waitForTimeout(2300);
const t1 = await p.evaluate(() => __ads.playSeconds);
check('the play clock runs on the board', t1 - t0 >= 2, `${t0} → ${t1}`);
await p.click('[data-menu]'); await p.waitForTimeout(2300);
const t2 = await p.evaluate(() => __ads.playSeconds);
check('and stops while the pause menu is open', t2 - t1 <= 1, `${t1} → ${t2}`);
await p.locator('[data-pick="resume"]').click(); await p.waitForTimeout(300);

// Level 10: no ad, however long the play.
await setLevel(10);
await move();
await p.evaluate(() => __ads.played(10 * 60000));
await p.waitForTimeout(2200);
check('at level 10, no ad break', await inter() === 0 && await p.locator('.ad-break').count() === 0);

// Level 11, 2.5 minutes of play: the Ad break screen, then the ad.
await setLevel(11);
await move();
await p.evaluate(() => { __ads.played(-__ads.playSeconds * 1000 + 149000); });
// Watch for the screen, and time the ad from the moment it appears.
await p.evaluate(() => new Promise((resolve) => {
  const t = setInterval(() => { if (document.querySelector('.ovl.in .ad-break')) { window.__breakAt = performance.now(); clearInterval(t); resolve(); } }, 20);
}));
check('at 2.5 minutes past level 10, the Ad break screen appears', await p.locator('.ovl.in .ad-break').count() === 1);
check('with the cat and the title', /Ad break/.test(await p.locator('.ovl.in').textContent())
  && await p.locator('.ovl.in .ovl-cheer').count() === 1);
check('and the ad has not started yet', await inter() === 0);
await p.waitForTimeout(900);
await p.screenshot({ path: '/tmp/ad-break.png' });
check('still waiting at 1 second', await inter() === 0);
await p.waitForTimeout(1700);
const gap = await p.evaluate(() => __mock.at[0] - window.__breakAt);
check('the ad starts 2 seconds after the screen', await inter() === 1 && gap >= 1900 && gap < 2600, `${Math.round(gap)} ms`);
await p.waitForTimeout(900);
check('then the screen goes and the board is back', await p.locator('.ad-break').count() === 0
  && await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
check('the clock starts again', await p.evaluate(() => __ads.playSeconds) <= 2);

// Not during a move animation: it waits for the board to be idle.
await p.evaluate(() => { __ads.played(150000); document.body.classList.add('busy'); });
await p.waitForTimeout(1500);
check('never while a move is animating', await p.locator('.ad-break').count() === 0);
await p.evaluate(() => document.body.classList.remove('busy'));
await p.waitForTimeout(1300);
check('but as soon as the board is idle', await p.locator('.ovl.in .ad-break').count() === 1);
await p.waitForTimeout(3200);

// Nothing in the lobby.
await p.evaluate(() => __ads.played(150000));
await p.click('[data-menu]'); await p.waitForTimeout(300);
await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(2500);
check('never in the lobby', await inter() === 2 && await p.locator('.ad-break').count() === 0);

const ev = await p.evaluate(() => window.__events.filter((e) => e.name === 'ad_interstitial_show').map((e) => e.params.level));
check('tracked with the level', JSON.stringify(ev) === '[11,11]', JSON.stringify(ev));

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

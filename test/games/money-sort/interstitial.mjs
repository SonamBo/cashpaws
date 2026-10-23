/**
 * Interstitials, against a mock of the native bridge (1.16.0): at the end of
 * each level won once level 10 is beaten, after the level-up card, announced
 * by a 2-second "Ad break" screen. Never mid-board, and not within a minute
 * of a rewarded ad.
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
await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; shell.quest.status = 'none'; });
await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(400);
await p.click('[data-play]'); await p.waitForTimeout(600);
const inter = () => p.evaluate(() => __mock.inter.length);

/** Beat level `from`: one move that banks past the level's target. */
async function beat(from) {
  await p.evaluate((lvl) => {
    game.level = lvl; game.netWorth = game.nextFloor - 1; game.locked = null; game.ice = [];
    game.columns = game.columns.map(() => []);
    game.columns[0] = [5, 5, 5]; game.columns[1] = [5]; game.columns[2] = [10, 20]; game.columns[3] = [20, 10];
    game.turnsUntilDrop = 9; game.status = 'playing'; game.selected = null; view.update();
  }, from);
  await p.click('.tube[data-col="1"]'); await p.waitForTimeout(150);
  await p.click('.tube[data-col="0"]'); await p.waitForTimeout(1600);
}
/** Tap through the level-up card; stop if the Ad break screen comes up. */
async function throughCards() {
  for (let i = 0; i < 8; i++) {
    if (await p.locator('.ovl.in .ad-break').count()) return true;
    if (!(await p.locator('.overlays .ovl').count())) return false;
    await p.keyboard.press('Enter');
    await p.locator('.overlays .ovl-btn').last().click({ timeout: 500 }).catch(() => {});
    await p.waitForTimeout(700);
  }
  return !!(await p.locator('.ovl.in .ad-break').count());
}

// Beating level 9 (reaching 10): no ad.
await beat(9);
check('the level-up card shows first', /Level up/i.test(await p.locator('.overlays').innerText()));
await throughCards();
await p.waitForTimeout(2600);
check('reaching level 10: no Ad break', await inter() === 0);

// Mid-board, however long: nothing.
await p.waitForTimeout(3000);
check('never mid-board', await inter() === 0 && await p.locator('.ad-break').count() === 0);

// Beating level 10 (reaching 11): the Ad break, after the level-up card.
await beat(10);
check('beating level 10: the level-up card comes first, no ad yet', await inter() === 0 && await p.locator('.ad-break').count() === 0);
const shownBreak = await throughCards();
await p.evaluate(() => { window.__breakAt = performance.now(); });
check('then the Ad break screen appears', shownBreak, '');
check('with the cat and the title', /Ad break/.test(await p.locator('.ovl.in').last().textContent())
  && await p.locator('.ovl.in .ovl-cheer').count() >= 1);
check('and the ad has not started yet', await inter() === 0);
await p.waitForTimeout(2700);
check('the ad plays about 2 seconds later', await inter() === 1);
await p.waitForTimeout(900);
check('then the screen goes and the next level is on', await p.locator('.ad-break').count() === 0
  && await p.evaluate(() => document.getElementById('app').classList.contains('on-game') && game.level === 11));

// Every level end after that.
await beat(11);
await throughCards(); await p.waitForTimeout(3400);
check('beating level 11: another Ad break', await inter() === 2);

// Right after a rewarded ad: skipped.
await p.evaluate(() => window.__ads.rewarded.show('test'));
await beat(12);
await throughCards(); await p.waitForTimeout(3000);
check('within a minute of a rewarded ad: no Ad break', await inter() === 2);

// Nothing in the lobby.
await p.click('[data-menu]'); await p.waitForTimeout(300);
await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(2500);
check('never in the lobby', await inter() === 2 && await p.locator('.ad-break').count() === 0);

const ev = await p.evaluate(() => window.__events.filter((e) => e.name === 'ad_interstitial_show').map((e) => e.params.level));
check('tracked with the level reached', JSON.stringify(ev) === '[11,12]', JSON.stringify(ev));

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

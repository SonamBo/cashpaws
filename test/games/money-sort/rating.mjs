/**
 * The rating sheet and the level-up Share (1.17.0), against stand-ins for
 * Social.java and AdMob: the sheet is asked after clearing levels 2, 10 and
 * 25, once each, at the break before the next level, and that break has no
 * Ad break. Every level-up card has a Share button that leaves the card up.
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

const FAKES = `
  window.__f = { shared: [], reviews: 0, inter: 0 };
  window.__shift = 0;
  const realNow = Date.now.bind(Date);
  Date.now = () => realNow() + window.__shift;      // tests move time on: ad breaks are 3 minutes apart
  window.CashPawsSocial = {
    share(text, image) { window.__f.shared.push({ text, image }); },
    review(id) { window.__f.reviews++; setTimeout(() => window.__reviewDone(id, true), 100); },
  };
  window.CashPawsAds = {
    isEnabled: () => true, rewardedReady: () => false, interstitialReady: () => true,
    showRewarded(p, id) { window.__adResult(id, false); },
    showInterstitial(p, id) { window.__f.inter++; setTimeout(() => window.__adResult(id, true), 200); },
    privacyOptionsRequired: () => false, showPrivacyOptions() {}, status: () => '{}',
  };`;

const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
await ctx.addInitScript(FAKES);
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1&lobby=1'); await p.waitForTimeout(900);
await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; shell.gift.status = 'claimed'; shell.quest.status = 'none'; shell.stats.firstDay = '2000-01-01'; });
await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(400);
await p.click('[data-play]'); await p.waitForTimeout(600);
const f = () => p.evaluate(() => window.__f);

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
async function through() {
  for (let i = 0; i < 8 && await p.locator('.overlays .ovl').count(); i++) {
    await p.locator('.overlays .ovl [data-go], .overlays .ovl .ovl-btn').last().click({ timeout: 600 }).catch(() => {});
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(2600);           // an Ad break, if any, plays out
}

// Level 1 cleared: the card, with Share; no rating yet.
await beat(1);
check('the level-up card has a Share button', await p.locator('.ovl.in [data-share]').count() === 1);
await p.locator('.ovl.in [data-share]').click(); await p.waitForTimeout(300);
const s = (await f()).shared[0];
check('it shares the image and the Play link', !!s && s.image === 'img/share.jpg' && /play\.google\.com/.test(s.text), JSON.stringify(s));
check('and the card stays up', await p.locator('.ovl.in [data-go]').count() === 1);
await through();
check('after level 1: no rating sheet', (await f()).reviews === 0);

// Level 2 cleared: the rating sheet, after the card.
await beat(2);
check('the rating sheet waits for the level-up card', (await f()).reviews === 0);
await through();
check('after level 2: the rating sheet is asked for', (await f()).reviews === 1);
check('and the next level is on', await p.evaluate(() => game.level === 3 && game.status === 'playing'));

await beat(3); await through();
check('after level 3: not again', (await f()).reviews === 1);

// Level 10 cleared: rating instead of the first Ad break; then Ad breaks as usual.
await beat(10); await through();
check('after level 10: the rating sheet, and no Ad break at that break', (await f()).reviews === 2 && (await f()).inter === 0, JSON.stringify(await f()));
await p.evaluate(() => { window.__shift += 4 * 60000; });
await beat(11); await through();
check('after level 11: the Ad break, no rating', (await f()).reviews === 2 && (await f()).inter === 1);

// Level 25 cleared: the last one. Remembered across launches.
await beat(25); await through();
check('after level 25: the rating sheet once more', (await f()).reviews === 3);
await p.evaluate(() => window.CashPaws.flush());
check('milestones asked are saved', JSON.stringify(await p.evaluate(() => shell.review.asked)) === '[3,11,26]');

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

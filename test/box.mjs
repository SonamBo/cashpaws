/**
 * The Rewards Box in the real app: the first box is ready at once, pays in
 * proportion to the Sort price, refills after four hours, and — in dev, where
 * the ad stub answers — can be opened early for an ad. In the real app there
 * is no ad button yet.
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

async function fresh(dev, iso) {
  const ctx = await b.newContext({ viewport: { width: 1160, height: 1060 }, timezoneId: 'Asia/Kolkata' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date(iso));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(() => localStorage.clear());
  await p.goto(`http://localhost:8080/${dev ? '?dev=1' : ''}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  return p;
}

let p = await fresh(true, '2026-09-26T10:00:00+05:30');
check('the gift glows on a first launch', await p.locator('[data-box].ready').count() === 1);
await p.click('[data-box]'); await p.waitForTimeout(500);
check('the box is ready', (await p.locator('.box-card .ovl-h').textContent()).includes('ready'));
await p.locator('.device').screenshot({ path: '/tmp/box-ready.png' });

const before = await p.evaluate(() => wallet.coins);
await p.locator('[data-pick="open"]').click(); await p.waitForTimeout(700);
const title = await p.locator('.ovl-milestone .ovl-h').textContent();
const after = await p.evaluate(() => wallet.coins);
check('opening it pays coins, shown on the worn cat\'s card', after > before && title.includes(`+${after - before}`), title);
check('at level 1 it is within 10–150 coins', after - before >= 10 && after - before <= 150, `+${after - before}`);
await p.locator('[data-go]').click(); await p.waitForTimeout(400);
check('the gift stops glowing once opened', await p.locator('[data-box].ready').count() === 0);

await p.click('[data-box]'); await p.waitForTimeout(500);
const waitText = await p.locator('.box-card .ovl-h').textContent();
check('it counts down to the next one', /Next box in 4h 0m|Next box in 3h 59m/.test(waitText), waitText.trim());
check('in dev, an ad can open it early', await p.locator('[data-pick="ad"]').count() === 1);
await p.locator('.device').screenshot({ path: '/tmp/box-wait.png' });
await p.locator('[data-pick="ad"]').click(); await p.waitForTimeout(500);
await p.locator('[data-ok]').click(); await p.waitForTimeout(700);
check('watching the ad opens it', (await p.evaluate(() => wallet.coins)) > after);
await p.locator('[data-go]').click(); await p.waitForTimeout(400);
check('without resetting the free timer', !(await p.evaluate(() => shell.box.nextAt <= Date.now())));

// four hours later the free box is back
await p.clock.setFixedTime(new Date('2026-09-26T14:01:00+05:30'));
await p.evaluate(() => CashPaws.flush());
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
check('four hours later the box is ready again', await p.locator('[data-box].ready').count() === 1);

// a bigger Sort price means a bigger box
const hi = await p.evaluate(() => { game.level = 12; game.netWorth = game.floor; return game.sortPrice; });
const c0 = await p.evaluate(() => wallet.coins);
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('[data-pick="open"]').click(); await p.waitForTimeout(700);
const got = (await p.evaluate(() => wallet.coins)) - c0;
check('at level 12 the box pays in proportion to a pricier Sort', got >= hi * 0.3 - 5 && got <= hi, `Sort ${hi}, box +${got}`);
await p.close();

p = await fresh(false, '2026-09-26T10:00:00+05:30');
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('[data-pick="open"]').click(); await p.waitForTimeout(600);
await p.locator('[data-go]').click(); await p.waitForTimeout(400);
await p.click('[data-box]'); await p.waitForTimeout(400);
check('in the real app, no ad button while ads do not exist', await p.locator('[data-pick="ad"]').count() === 0);
check('just the countdown and Close', await p.locator('[data-pick="close"]').count() === 1);
await p.close();

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

/**
 * Out of coins in Money Sort (1.16.0): coin packs are offered first, then an
 * ad for a free Sort, from both the Sort button and the stuck card. Against
 * stand-ins for Google Play Billing and AdMob.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';
import { readFileSync } from 'node:fs';

const cfg = readFileSync(new URL('../../../www/app.config.js', import.meta.url), 'utf8');
const APP = JSON.parse(cfg.replace(/^\s*\/\/.*$/gm, '').replace(/^[\s\S]*?export default/, '').replace(/;\s*$/, ''));
const PACKS = APP.coinPacks || [];
const BIG = PACKS[PACKS.length - 1];

const b = await pw.chromium.launch();
let failed = 0;
const errs = [];
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

const BRIDGES = `
  const send = (e) => setTimeout(() => window.__billing && window.__billing(e), 30);
  const known = ${JSON.stringify(PACKS.map((x, i) => ({ id: x.id, price: '$' + (i + 1) + '.99', micros: (i + 1) * 1e6, currency: 'USD' })))};
  let n = 0;
  window.CashPawsBilling = {
    start() { send({ type: 'products' }); },
    products: () => JSON.stringify(known),
    buy(id, rid) { const token = 't' + (++n); send({ type: 'purchase', token, products: [id], quantity: 1, state: 'purchased' }); send({ type: 'result', id: rid, status: 'purchased' }); },
    consume() {}, refresh() {}, status: () => '{}',
  };
  window.CashPawsAds = {
    isEnabled: () => true, rewardedReady: () => true, interstitialReady: () => false,
    showRewarded(p, id) { setTimeout(() => window.__adResult(id, true), 50); },
    showInterstitial(p, id) { window.__adResult(id, false); },
    privacyOptionsRequired: () => false, showPrivacyOptions() {}, status: () => '{}',
  };`;

async function openGame() {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
  await ctx.addInitScript(BRIDGES);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(900);
  await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; });
  await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(300);
  await p.click('[data-play]'); await p.waitForTimeout(500);
  return { ctx, p };
}
const order = (p) => p.locator('.overlays .ovl.in').last().locator('button').evaluateAll((bs) => bs.map((x) => x.dataset.choice || Object.keys(x.dataset)[0]));

if (!PACKS.length) { console.log('No coinPacks: skipping.'); process.exit(0); }

console.log('--- the Sort button, short of coins ---');
{
  const { ctx, p } = await openGame();
  await p.evaluate(() => {
    game.columns = [[5, 10, 20], [10, 20], [20, 5], [10, 5], []];
    game.freeSorts = 0; game.status = 'playing'; game.selected = null; game.locked = null; game.ice = [];
    wallet.set(0); view.update();
  });
  check('Sort stays tappable when short', await p.locator('[data-sort]').isEnabled());
  check('with its price greyed', await p.locator('[data-sort].short').count() === 1);
  await p.click('[data-sort]'); await p.waitForTimeout(700);
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/short-sort.png' });
  const o = await order(p);
  check('tapping it offers coin packs first, then the ad', o[0] === 'coins' && o[1] === 'ad' && o.includes('cancel'), o.join(' > '));
  await p.locator('[data-choice="coins"]').click(); await p.waitForTimeout(600);
  check('"Get coins" opens the Shop at its coin packs', await p.evaluate(() => document.querySelector('.panel-sheet').classList.contains('in')));
  const price = await p.evaluate(() => game.sortPrice);
  await p.click(`[data-buy-pack="${BIG.id}"]`); await p.waitForTimeout(500);
  await p.locator('.panel-sheet [data-close]').click(); await p.waitForTimeout(1400);
  const sorts = await p.evaluate(() => window.__events.filter((e) => e.name === 'sort_used').map((e) => e.params.how));
  check('after buying, closing the Shop does the Sort, paid', sorts.join() === 'paid' && (await p.evaluate(() => wallet.coins)) <= BIG.coins - price + 200, `${sorts} coins ${await p.evaluate(() => wallet.coins)}`);

  // Short again: the ad this time.
  await p.evaluate(() => { game.columns = [[5, 10, 20], [10, 20], [20, 5], [10, 5], []]; game.status = 'playing'; wallet.set(0); view.update(); });
  await p.click('[data-sort]'); await p.waitForTimeout(500);
  await p.locator('[data-choice="ad"]').click(); await p.waitForTimeout(1400);
  const s2 = await p.evaluate(() => window.__events.filter((e) => e.name === 'sort_used').map((e) => e.params.how));
  check('the ad gives a free Sort', s2.join() === 'paid,ad' && (await p.evaluate(() => wallet.coins)) >= 0, s2.join());
  // Not now: nothing happens.
  await p.evaluate(() => { game.columns = [[5, 10, 20], [10, 20], [20, 5], [10, 5], []]; game.status = 'playing'; wallet.set(0); view.update(); });
  await p.click('[data-sort]'); await p.waitForTimeout(500);
  await p.locator('.overlays [data-cancel]').last().click(); await p.waitForTimeout(500);
  check('"Not now" does nothing', (await p.evaluate(() => window.__events.filter((e) => e.name === 'sort_used').length)) === 2);
  await ctx.close();
}

console.log('--- the stuck card, short of coins ---');
{
  const { ctx, p } = await openGame();
  const [f, t] = await p.evaluate(() => {
    game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
    game.freeSorts = 0; game.status = 'playing'; game.selected = null; game.locked = null; game.ice = [];
    game.turnsUntilDrop = 6; game.undoSnapshot = null; wallet.set(0); view.update();
    return game.legalMoves()[0];
  });
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(900);
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/short-stuck.png' });
  const o = await p.locator('.ovl-locked .ovl-card button').evaluateAll((bs) => bs.map((x) => Object.keys(x.dataset)[0]));
  check('the stuck card offers coins, then the ad, then dropping a level', o.join() === 'buyCoins,adSort,drop', o.join());
  await p.locator('[data-buy-coins]').click(); await p.waitForTimeout(600);
  await p.locator('.panel-sheet [data-close]').click(); await p.waitForTimeout(700);
  check('closing the Shop without buying brings the card back', await p.locator('.ovl-locked [data-buy-coins]').count() === 1);
  await p.locator('[data-buy-coins]').click(); await p.waitForTimeout(600);
  await p.click(`[data-buy-pack="${BIG.id}"]`); await p.waitForTimeout(500);
  await p.locator('.panel-sheet [data-close]').click(); await p.waitForTimeout(1500);
  check('buying enough sorts the board', (await p.evaluate(() => game.status)) === 'playing'
    && (await p.evaluate(() => window.__events.filter((e) => e.name === 'sort_used').map((e) => `${e.params.how}/${e.params.where}`).join())) === 'paid/stuck');
  await ctx.close();
}

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

/**
 * Coin packs (shell/billing.js), with whatever game is installed, against a
 * stand-in for the Android bridge (Billing.java):
 *  - prices come from Google Play, and the Shop shows them;
 *  - a purchase pays once: coins added and saved before Play is told
 *    (consume), and a purchase reported again pays nothing;
 *  - pending payments, cancels, errors and unknown products;
 *  - bought coins don't count as earned (cats stay a playing reward);
 *  - no bridge (a browser, CrazyGames): nothing for sale, and it says so.
 *
 * Needs the dev server (node serve.js 8080) and Playwright.
 * Run: node test/billing.mjs
 */
import pw from 'playwright';
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

const cfgText = readFileSync(new URL('../www/app.config.js', import.meta.url), 'utf8');
const APP = JSON.parse(cfgText.replace(/^\s*\/\/.*$/gm, '').replace(/^[\s\S]*?export default/, '').replace(/;\s*$/, ''));
const PACKS = APP.coinPacks || [];
if (!PACKS.length) {
  console.log('No coinPacks in www/app.config.js: this app sells nothing. Skipping.');
  process.exit(0);
}
const [P0, P1] = PACKS;
const SAVE = 'cashpaws.save.v2';

/*
 * The bridge as Billing.java presents it. Tests drive it through
 * window.__fake: what Play "knows", and purchases to report.
 */
const FAKE = (opts) => `
  window.__fake = { started: null, consumed: [], consumedSaved: [], bought: [], known: ${JSON.stringify(opts.known)} };
  const send = (e) => setTimeout(() => window.__billing && window.__billing(e), 30);
  window.__fake.send = send;
  window.CashPawsBilling = {
    start(ids) {
      window.__fake.started = JSON.parse(ids);
      send({ type: 'products' });
      ${opts.atStart ? `send(${JSON.stringify(opts.atStart)});` : ''}
    },
    products() { return JSON.stringify(window.__fake.known); },
    status() { return JSON.stringify({ state: 'ready', error: '', asked: window.__fake.started, found: window.__fake.known.length }); },
    buy(id, rid) {
      window.__fake.bought.push(id);
      const how = window.__fake.next || 'purchased';
      if (how === 'cancelled' || how === 'error') return send({ type: 'result', id: rid, status: how });
      const token = 'tok-' + window.__fake.bought.length;
      send({ type: 'purchase', token, products: [id], quantity: 1, orderId: 'GPA.1', state: how });
      send({ type: 'result', id: rid, status: how });
    },
    consume(token) {
      window.__fake.consumed.push(token);
      // Was the token already in the save when Play was told? It must be.
      const rec = JSON.parse(localStorage.getItem('${SAVE}') || '{}');
      window.__fake.consumedSaved.push((rec.shell?.iap?.granted || []).includes(token));
    },
    refresh() {},
  };`;

const KNOWN = PACKS.map((p, i) => ({ id: p.id, price: `₹${(89 * (i + 1)).toFixed(2)}`, micros: 89e6 * (i + 1), currency: 'INR', title: p.name }));

const b = await pw.chromium.launch();

async function open({ init = '', dev = false, keep = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v); }, [SAVE, keep]);
  await p.goto(`http://localhost:8080/${dev ? '?dev=1' : ''}`);
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.CashPaws.onBack());      // to the lobby, wherever it opened
  await p.waitForTimeout(400);
  return { ctx, p, errs };
}
const coins = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).shell.coins, SAVE);
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).shell, SAVE);
const openShop = async (p) => { await p.locator('[data-coin-pill]:visible').first().click(); await p.waitForTimeout(500); };
const flush = (p) => p.evaluate(() => window.CashPaws.flush());

/* ---------------- Android: the bridge, Play answering ---------------- */
console.log('--- Android, Play answering ---');
{
  const { ctx, p, errs } = await open({ init: FAKE({ known: KNOWN }) });
  check('the shell asks Play for exactly the packs in app.config.js', JSON.stringify(await p.evaluate(() => window.__fake.started)) === JSON.stringify(PACKS.map((x) => x.id)));
  await openShop(p);
  check('the + on the coin counter opens the Shop', await p.evaluate(() => document.querySelector('.panel-sheet').classList.contains('in')));
  const prices = await p.locator('[data-buy-pack]').allTextContents();
  check('every pack shows Play\'s price, in the player\'s currency', prices.length === PACKS.length && prices.every((t, i) => t.trim() === KNOWN[i].price), prices.join(' '));
  check('extra value is worked out from the real prices', (await p.locator('.pack-bonus').count()) === PACKS.filter((x, i) => i > 0 && x.coins / (i + 1) / PACKS[0].coins >= 1.05).length);
  check('the Shop no longer says nothing is for sale', !/Nothing sold for real money/.test(await p.locator('.panel-sheet').innerText()));

  await flush(p);
  const before = await coins(p);
  const earned = (await saved(p)).stats.coinsEarned;
  await p.click(`[data-buy-pack="${P0.id}"]`);
  await p.waitForTimeout(500);
  check(`buying ${P0.name} adds ${P0.coins} coins`, (await coins(p)) === before + P0.coins, `${before} → ${await coins(p)}`);
  check('the coin counter shows it', (await p.locator('[data-coins]:visible').first().textContent()).trim() === String(before + P0.coins));
  check('a thank-you note appears', /Thank you/.test(await p.locator('.toast').last().innerText().catch(() => '')));
  const f = await p.evaluate(() => window.__fake);
  check('Play is told (consume) once, with the purchase token', JSON.stringify(f.consumed) === '["tok-1"]');
  check('the coins and token were saved BEFORE Play was told', f.consumedSaved[0] === true);
  const sh = await saved(p);
  check('bought coins don\'t count as coins earned', sh.stats.coinsEarned === earned, `${earned} → ${sh.stats.coinsEarned}`);
  check('the save counts the purchase', sh.iap.purchases === 1 && sh.iap.coins === P0.coins);

  // The app closed after saving but before consuming: Play reports it again.
  await p.evaluate(() => window.__fake.send({ type: 'purchase', token: 'tok-1', products: [window.__fake.started[0]], quantity: 1, state: 'purchased' }));
  await p.waitForTimeout(300);
  check('a purchase reported again pays nothing', (await coins(p)) === before + P0.coins);
  check('but is consumed, so Play stops reporting it', (await p.evaluate(() => window.__fake.consumed)).length === 2);

  // Cancel, error: nothing changes, the button works again.
  await p.evaluate(() => { window.__fake.next = 'cancelled'; });
  const c0 = await coins(p);
  await p.click(`[data-buy-pack="${P1.id}"]`); await p.waitForTimeout(400);
  check('a cancelled purchase pays nothing', (await coins(p)) === c0);
  check('and the button can be pressed again', await p.locator(`[data-buy-pack="${P1.id}"]`).isEnabled());
  await p.evaluate(() => { window.__fake.next = 'error'; });
  await p.click(`[data-buy-pack="${P1.id}"]`); await p.waitForTimeout(400);
  check('an error says so', /Purchase failed/.test(await p.locator('.toast').last().innerText()));

  // Pending (cash, slow bank methods): a note now, coins when it clears.
  await p.evaluate(() => { window.__fake.next = 'pending'; });
  await p.click(`[data-buy-pack="${P1.id}"]`); await p.waitForTimeout(400);
  check('a pending payment pays nothing yet', (await coins(p)) === c0);
  check('and says the coins come when Play confirms', /pending/i.test(await p.locator('.toast').last().innerText()));
  const tok = `tok-${(await p.evaluate(() => window.__fake.bought.length))}`;
  await p.evaluate((t) => window.__fake.send({ type: 'purchase', token: t, products: [window.__fake.started[1]], quantity: 1, state: 'purchased' }), tok);
  await p.waitForTimeout(300);
  check(`once it clears, ${P1.coins} coins arrive`, (await coins(p)) === c0 + P1.coins);

  // Quantity, and a product this app doesn't sell.
  const c1 = await coins(p);
  await p.evaluate(() => window.__fake.send({ type: 'purchase', token: 'tok-q', products: [window.__fake.started[0]], quantity: 3, state: 'purchased' }));
  await p.waitForTimeout(300);
  check('a quantity of 3 pays three packs', (await coins(p)) === c1 + 3 * P0.coins);
  const n = (await p.evaluate(() => window.__fake.consumed)).length;
  await p.evaluate(() => window.__fake.send({ type: 'purchase', token: 'tok-x', products: ['not_ours'], quantity: 1, state: 'purchased' }));
  await p.waitForTimeout(300);
  check('a product this app doesn\'t sell is ignored and left unconsumed', (await coins(p)) === c1 + 3 * P0.coins && (await p.evaluate(() => window.__fake.consumed)).length === n);

  // Settings tells the truth.
  await p.locator('.panel-sheet [data-close]').click(); await p.waitForTimeout(300);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  const menu = (await p.locator('.ovl-menu').last().innerText()).replace(/\s+/g, ' ');
  check('Settings mentions the coin packs, and no longer "No purchases"', /coin packs/i.test(menu) && !/No purchases/.test(menu));
  check('no page errors', errs.length === 0, errs.join(' | '));
  const keep = await p.evaluate((k) => localStorage.getItem(k), SAVE);
  await ctx.close();

  // Next launch: Play reports a purchase that was paid but never consumed, and one that was never paid.
  const atStart = { type: 'purchase', token: 'tok-1', products: [P0.id], quantity: 1, state: 'purchased' };
  const r = await open({ init: FAKE({ known: KNOWN, atStart }), keep });
  await r.p.waitForTimeout(300); await flush(r.p);
  const k0 = JSON.parse(keep).shell.coins;
  check('after a restart, an already-paid purchase pays nothing', (await coins(r.p)) === k0);
  await r.ctx.close();
  const fresh = await open({ init: FAKE({ known: KNOWN, atStart: { ...atStart, token: 'tok-new' } }), keep });
  await fresh.p.waitForTimeout(300); await flush(fresh.p);
  check('after a restart, a purchase that never paid pays now', (await coins(fresh.p)) === k0 + P0.coins);
  await fresh.ctx.close();
}

/* ---------------- Android: Play reachable, packs not set up ---------------- */
console.log('--- Android, packs missing in Play ---');
{
  const { ctx, p, errs } = await open({ init: FAKE({ known: [] }) });
  await openShop(p);
  check('with no packs in Play, the Shop says they can\'t be reached', /Unavailable right now/.test(await p.locator('.panel-sheet').innerText()) && (await p.locator('[data-buy-pack]').count()) === 0);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------------- no bridge: a browser, CrazyGames ---------------- */
console.log('--- a browser, no billing ---');
{
  const { ctx, p, errs } = await open();
  await openShop(p);
  check('without the bridge nothing is for sale, and the Shop says so', /Nothing sold for real money/.test(await p.locator('.panel-sheet').innerText()) && (await p.locator('[data-buy-pack]').count()) === 0);
  await p.locator('.panel-sheet [data-close]').click(); await p.waitForTimeout(300);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  check('and Settings still says no purchases', /No purchases/.test(await p.locator('.ovl-menu').last().innerText()));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ---------------- dev stub, and running short ---------------- */
console.log('--- ?dev=1 stub, not enough coins ---');
{
  const { ctx, p, errs } = await open({ dev: true });
  // Reveal the second cat, then try to buy it without enough coins.
  await p.evaluate(() => { window.stats.coinsEarned = 100000; window.wallet.set(10); });
  await p.click('[data-tab="cats"]'); await p.waitForTimeout(500);
  await p.locator('[data-buy-cat]').nth(1).click(); await p.waitForTimeout(500);
  check('a cat that costs too much offers coin packs', /Not enough coins/.test(await p.locator('.overlays .ovl').last().innerText().catch(() => '')));
  await p.locator('.overlays .ovl').last().getByText('Get coins').click(); await p.waitForTimeout(600);
  check('"Get coins" opens the Shop at its coin packs', await p.evaluate(() => {
    const s = document.querySelector('.panel-sheet');
    const h = s.querySelector('[data-coins-section]');
    return s.classList.contains('in') && !!h && h.getBoundingClientRect().top < innerHeight;
  }));
  await p.click(`[data-buy-pack="${P0.id}"]`); await p.waitForTimeout(400);
  await p.locator('.overlays .ovl').last().getByText('Pay', { exact: true }).click(); await p.waitForTimeout(500);
  check('the stub pays too', (await p.evaluate(() => window.wallet.coins)) === 10 + P0.coins);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

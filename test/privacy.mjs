import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1160, height: 1060 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);

await p.click('.lobby-top [data-settings]');
await p.waitForTimeout(600);
const link = p.locator('.menu-link');
console.log('settings card shown =', await p.locator('.ovl-menu').count() > 0);
console.log('privacy href        =', await link.getAttribute('href'));
console.log('opens outside game  =', await link.getAttribute('target'), '/', await link.getAttribute('rel'));
await p.locator('.device').screenshot({ path: '/home/claude/shots/settings.png' });

// clicking must open a separate page, never navigate the game away
const [popup] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null),
  link.click(),
]);
await p.waitForTimeout(400);
console.log('opened new page     =', !!popup, popup ? '(' + popup.url() + ')' : '');
console.log('game still here     =', p.url().startsWith('http://localhost:8080'));
if (popup) await popup.close();

// Done closes it; the erase path still asks before wiping
await p.locator('[data-pick="close"]').click();
await p.waitForTimeout(500);
console.log('Done closes card    =', await p.locator('.ovl-menu').count() === 0);
await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
await p.locator('[data-pick="erase"]').click(); await p.waitForTimeout(600);
console.log('erase still confirms=', (await p.locator('.ovl .ovl-title').first().textContent()).trim());
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();

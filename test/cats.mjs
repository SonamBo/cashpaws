import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const errs = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 1060 }, deviceScaleFactor: 2 });
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(700);

await p.click('[data-tab="cats"]');
await p.waitForTimeout(600);
console.log('locked cats shown  =', await p.locator('.card.locked').count());
console.log('buyable cats       =', await p.locator('.card[data-buy-cat]').count());
await p.locator('.device').screenshot({ path: '/home/claude/shots/cats-locked.png' });

// a locked cat must not be purchasable at any price
await p.evaluate(() => { game.coins = 9999; });
const before = await p.evaluate(() => ({ coins: game.coins, owned: [...document.querySelectorAll('.card')].length }));
await p.locator('.card.locked').first().click({ force: true });
await p.waitForTimeout(400);
console.log('locked cat bought? =', (await p.evaluate(() => game.coins)) !== before.coins);

// reveal everything, then buy and wear one
await p.evaluate(() => {
  stats.banks = 200; stats.drops = 40; stats.bestLevel = 8; game.coins = 9999;
});
await p.click('[data-tab="progress"]'); await p.waitForTimeout(300);
await p.click('[data-tab="cats"]'); await p.waitForTimeout(500);
console.log('after milestones   =', await p.locator('.card.locked').count(), 'still locked');
await p.locator('.device').screenshot({ path: '/home/claude/shots/cats-open.png' });

const undoBefore = await p.evaluate(() => game.cfg.undoCost);
await p.locator('[data-buy-cat="mittens"]').click();
await p.waitForTimeout(600);
console.log('wearing            =', await p.evaluate(() => wallet?.activeCat ?? 'n/a'),
            '| undo cost', undoBefore, '->', await p.evaluate(() => game.cfg.undoCost));

await p.click('[data-close]'); await p.waitForTimeout(400);
await p.click('[data-play]'); await p.waitForTimeout(600);
console.log('footer undo label  =', await p.locator('[data-undo-cost]').textContent());

// perk must survive a reload
await p.evaluate(() => CashPaws.flush());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
console.log('after reload       = undo', await p.evaluate(() => game.cfg.undoCost),
            '| cat art', await p.evaluate(() => document.querySelector('.corner-cat')?.getAttribute('src')));
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();

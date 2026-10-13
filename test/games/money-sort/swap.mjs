import pw from 'playwright';
import { writeFileSync } from 'fs';
const { chromium } = pw;
const ACTIVE = '/home/claude/cashpaws/www/games/active.js';
const install = (folder) => writeFileSync(ACTIVE,
  `/** The installed game. Change this one line to swap games. */\nexport { default } from './${folder}/index.js';\n`);

const b = await chromium.launch();
const errs = [];
const check = (label, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);

// Each phase is a fresh browser (so no stale module cache), carrying the save across.
async function phase(folder, saved, body) {
  install(folder);
  const ctx = await b.newContext({ viewport: { width: 1160, height: 1060 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${folder}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${folder}: ${m.text()}`); });
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('cashpaws.save.v2', s); }, saved);
  await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await body(p);
  await p.evaluate(() => CashPaws.flush());
  const out = await p.evaluate(() => localStorage.getItem('cashpaws.save.v2'));
  await ctx.close();
  return out;
}

let save = null, sortBoard, coinsAfterSort;
try {

console.log('--- Money Sort installed ---');
save = await phase('money-sort', null, async (p) => {
  await p.click('[data-play]'); await p.waitForTimeout(500);
  for (let i = 0; i < 6; i++) { await p.click('#step'); await p.waitForTimeout(300); }
  sortBoard = await p.evaluate(() => JSON.stringify(game.columns));
  coinsAfterSort = await p.evaluate(() => wallet.coins);
  const turn = await p.evaluate(() => game.turn);
  check('money sort plays', turn >= 3, `turn ${turn}`);
});

console.log('--- swapped to Coin Catch: only active.js changed ---');
let catchCoins = 0;
save = await phase('template', save, async (p) => {
  check('lobby still loads', await p.locator('[data-play]').isVisible());
  await p.click('[data-play]'); await p.waitForTimeout(600);
  check('the new game is on screen', await p.locator('.cc-grid').isVisible());
  check('header shows the game\'s own title', (await p.locator('[data-title]').textContent()) === 'Streak 0');
  check('no progress bar for a game without levels', await p.evaluate(() => document.querySelector('[data-bar]').hidden));
  const before = await p.evaluate(() => wallet.coins);
  for (let i = 0; i < 10; i++) { await p.click('.cc-cell.on'); await p.waitForTimeout(120); }
  await p.waitForTimeout(500);
  // the 10-streak celebration is a shell card: the worn cat cheers
  check('shell celebrates with the worn cat', await p.locator('.ovl .ovl-cheer').count() > 0);
  await p.locator('[data-go]').click(); await p.waitForTimeout(400);
  for (let i = 0; i < 2; i++) { await p.click('.cc-cell.on'); await p.waitForTimeout(120); }
  catchCoins = (await p.evaluate(() => wallet.coins)) - before;
  check('catching coins earns shell coins', catchCoins > 0, `+${catchCoins}`);
  check('header coins follow the wallet',
    (await p.locator('.hdr [data-coins]').textContent()) === String(await p.evaluate(() => wallet.coins)));

  await p.click('[data-menu]'); await p.waitForTimeout(500);
  check('pause menu has no Restart, since this game offers none',
    await p.locator('[data-pick="restart"]').count() === 0);
  await p.locator('[data-pick="cats"]').click(); await p.waitForTimeout(500);
  const txt = await p.locator('.panel-inner').textContent();
  check('Cats tab names the game', txt.includes('Coin Catch'));
  await p.evaluate(() => { stats.coinsEarned = 5000; });
  await p.locator('[data-close]').click(); await p.waitForTimeout(300);
  await p.click('[data-menu]'); await p.waitForTimeout(400);
  await p.locator('[data-pick="cats"]').click(); await p.waitForTimeout(500);
  const cats = await p.locator('.panel-inner').textContent();
  check("a cat with a perk here shows it", cats.includes('waits half a second longer'));
  check('cats without a perk here are cosmetic', cats.includes('Just for looks in this game'));
  await p.locator('[data-close]').click(); await p.waitForTimeout(300);
  await p.click('[data-menu]'); await p.waitForTimeout(400);
  await p.locator('[data-pick="shop"]').click(); await p.waitForTimeout(500);
  check('Shop copes with a game that sells nothing',
    (await p.locator('.panel-inner').textContent()).includes('Nothing for sale in this game yet'));
  await p.locator('[data-close]').click(); await p.waitForTimeout(300);
  await p.click('[data-menu]'); await p.waitForTimeout(400);
  await p.locator('[data-pick="progress"]').click(); await p.waitForTimeout(500);
  check("Progress shows the game's own tiles", (await p.locator('.panel-inner').textContent()).includes('best streak'));
  await p.locator('[data-close]').click(); await p.waitForTimeout(300);
});

console.log('--- Coin Catch progress survives a reload ---');
save = await phase('template', save, async (p) => {
  check('best streak restored', (await p.locator('[data-play-sub]').textContent()).includes('Best streak'));
});

console.log('--- swapped back to Money Sort ---');
await phase('money-sort', save, async (p) => {
  check('the sort board is exactly as it was left', (await p.evaluate(() => JSON.stringify(game.columns))) === sortBoard);
  check('coins earned in the other game are kept', (await p.evaluate(() => wallet.coins)) === coinsAfterSort + catchCoins,
    `${coinsAfterSort} + ${catchCoins} = ${await p.evaluate(() => wallet.coins)}`);
  const slots = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cashpaws.save.v2')).games));
  check('both games keep their own save slot', slots.includes('money-sort') && slots.includes('template'), slots.join(', '));
});

} finally {
  install('money-sort');   // never leave the wrong game installed
}
console.log(errs.length ? 'ERRORS:\n  ' + errs.join('\n  ') : 'no console errors in any phase');
await b.close();

import pw from 'playwright';
const { chromium } = pw;
const errs = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 1060 }, deviceScaleFactor: 2 });
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
p.on('requestfailed', r => { const why = r.failure()?.errorText || ''; if (!why.includes('ABORTED')) errs.push('failed (' + why + '): ' + r.url()); });
p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ': ' + r.url()); });
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);

const r = {};
r.lobby = await p.evaluate(() => document.getElementById('app').className);
r.playLabel = await p.locator('[data-play-label]').textContent();
await p.locator('.device').screenshot({ path: '/home/claude/shots/mod-lobby.png' });
await p.click('[data-play]');
await p.waitForTimeout(700);
r.onGame = await p.evaluate(() => document.getElementById('app').classList.contains('on-game'));
r.title = await p.locator('[data-title]').textContent();
r.tubes = await p.locator('.tube').count();
r.chips = await p.locator('.chip').count();
r.coinsShown = await p.locator('.hdr [data-coins]').textContent();
r.styleLoaded = await p.evaluate(() => !!document.querySelector('link[data-src="games/money-sort/style.css"]'));

const m = await p.evaluate(() => game.legalMoves()[0]);
const t0 = await p.evaluate(() => game.turn);
await p.click(`.tube[data-col="${m[0]}"]`); await p.waitForTimeout(150);
await p.click(`.tube[data-col="${m[1]}"]`); await p.waitForTimeout(900);
r.moved = (await p.evaluate(() => game.turn)) > t0;
await p.locator('.device').screenshot({ path: '/home/claude/shots/mod-board.png' });

// coins live in the shell wallet, and the header follows it
await p.evaluate(() => wallet.earn(33, 'test'));
await p.waitForTimeout(200);
r.headerFollowsWallet = (await p.locator('.hdr [data-coins]').textContent()) === String(await p.evaluate(() => wallet.coins));

// save and reload restores the board and the coins
const before = await p.evaluate(() => ({ turn: game.turn, coins: wallet.coins, cols: JSON.stringify(game.columns) }));
await p.evaluate(() => CashPaws.flush());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);
const after = await p.evaluate(() => ({ turn: game.turn, coins: wallet.coins, cols: JSON.stringify(game.columns) }));
r.reloadKeepsBoard = before.cols === after.cols && before.turn === after.turn;
r.reloadKeepsCoins = before.coins === after.coins;
r.continueLine = await p.locator('[data-play-sub]').textContent();

console.log(JSON.stringify(r, null, 1));
console.log(errs.length ? 'ERRORS:\n  ' + [...new Set(errs)].join('\n  ') : 'no errors, no 404s');
await b.close();

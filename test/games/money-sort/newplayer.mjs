/**
 * What a brand-new player sees when their first board jams: a free Sort, not
 * a forced drop back to $0. Before 1.6, one new player in six hit exactly that
 * wall on level 1, around their twelfth move, with 50 coins against a
 * 150-coin Sort.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';

const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 1060 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const check = (label, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); };

await p.goto('http://localhost:8080/css/tokens.css'); await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('[data-play]'); await p.waitForTimeout(500);
check('the Sort button says Free for a new player', (await p.locator('[data-sort-cost]').textContent()).trim() === 'Free');
check('and it is usable with only 50 coins', !(await p.locator('[data-sort]').isDisabled()));

const [f, t] = await p.evaluate(() => {
  game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
  game.status = 'playing'; game.selected = null; game.turnsUntilDrop = 6; game.undoSnapshot = null;
  view.update(); return game.legalMoves()[0];
});
await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(1000);
check('a jam on level 1 offers the free Sort', await p.locator('[data-do-sort]').count() === 1);
check('and says so', (await p.locator('.ovl-locked .ovl-sub').first().textContent()).includes('first Sort is free'));
await p.locator('.device').screenshot({ path: '/tmp/newplayer-stuck.png' });
await p.locator('[data-do-sort]').click(); await p.waitForTimeout(1400);
check('taking it keeps the player on level 1 with their net worth', await p.evaluate(() => game.status === 'playing' && game.level === 1));
check('and costs no coins', (await p.evaluate(() => Number(document.querySelector('.hdr [data-coins]').textContent))) >= 50);
check('after which Sort shows its price again', (await p.locator('[data-sort-cost]').textContent()).trim() === '150');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

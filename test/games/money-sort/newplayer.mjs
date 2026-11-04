/**
 * What a brand-new player sees when their first board jams. Before 1.6, one
 * new player in six hit a forced drop back to $0 on level 1; 1.6 gave them a
 * free Sort on a stuck card. Since 1.22.0 there is no stuck card at all on the
 * first ten levels: the board sorts itself, and Sort is free there.
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
await p.goto('http://localhost:8080/?lobby=1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('[data-play]'); await p.waitForTimeout(500);
check('the Sort button says Free for a new player', (await p.locator('[data-sort-cost]').textContent()).trim() === 'Free');
check('and it is usable with only 50 coins', !(await p.locator('[data-sort]').isDisabled()));

const [f, t] = await p.evaluate(() => {
  game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
  game.status = 'playing'; game.selected = null; game.turnsUntilDrop = 6; game.undoSnapshot = null;
  view.update(); return game.legalMoves()[0];
});
await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(1400);
check('a jam on level 1 shows no stuck card', await p.locator('.ovl-locked').count() === 0);
const st = await p.evaluate(() => ({ status: game.status, level: game.level, moves: game.legalMoves().length, ev: game.events.map((e) => e.type).join(',') }));
check('the board sorts itself and play goes on', st.status === 'playing' && st.moves > 0 && /rescue,sort/.test(st.ev), JSON.stringify(st));
check('without costing a level', st.level >= 1);
check('or coins', (await p.evaluate(() => Number(document.querySelector('.hdr [data-coins]').textContent))) >= 50);
check('Sort is still free', (await p.locator('[data-sort-cost]').textContent()).trim() === 'Free');
await p.locator('.device').screenshot({ path: '/tmp/newplayer-stuck.png' });

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

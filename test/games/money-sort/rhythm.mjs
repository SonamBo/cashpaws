/**
 * Hard levels and face-down chips in the running app: the header and FLOW
 * strip mark a Hard level, the level-up card warns of one and announces the
 * breather after, and face-down chips draw as a "?" that turns over on reaching
 * the top.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';

const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 1060 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const check = (label, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`); };
const gains = async () => (await p.locator('.ovl-gains').textContent()).replace(/\s+/g, ' ');

await p.goto('http://localhost:8080/css/tokens.css'); await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
await p.click('[data-play]'); await p.waitForTimeout(500);

// level 6 -> 7: warned that a Hard level is next
await p.evaluate(() => { game.level = 6; game.netWorth = game.floor; view.update(); });
await p.click('#levelup'); await p.waitForTimeout(900);
check('the level-up card warns a Hard level is next', (await gains()).includes('Hard level'));
await p.locator('[data-go]').click(); await p.waitForTimeout(600);
check('the header says Hard', (await p.locator('[data-title]').textContent()).includes('Hard'));
check('the FLOW strip is marked', await p.locator('.ms-root.hard-level').count() === 1);
await p.locator('.device').screenshot({ path: '/tmp/hard-level.png' });

// 7 -> 8: double reward, and the breather announced
const c0 = await p.evaluate(() => wallet.coins);
await p.click('#levelup'); await p.waitForTimeout(900);
const g8 = await gains();
check('beating it pays double', (await p.evaluate(() => wallet.coins)) - c0 === 100 && g8.includes('Hard bonus'), `+${(await p.evaluate(() => wallet.coins)) - c0}`);
check('and the next level is announced as gentler', g8.includes('gentler'));
await p.locator('[data-go]').click(); await p.waitForTimeout(500);
check('the breather is not marked Hard', !(await p.locator('[data-title]').textContent()).includes('Hard'));

// 8 -> 9: face-down chips introduced, on a normal level
await p.click('#levelup'); await p.waitForTimeout(900);
check('level 9 introduces face-down chips', (await gains()).includes('face down'));
await p.locator('[data-go]').click(); await p.waitForTimeout(500);
check('and level 9 itself is not Hard', !(await p.locator('[data-title]').textContent()).includes('Hard'));

// face-down chips draw as "?" and turn over on reaching the top
const [f, t] = await p.evaluate(() => {
  game.columns = [[-20, -5, 10], [10, 10, 10], [1, 5], [], [], [], [], []];
  game.status = 'playing'; game.selected = null; game.turnsUntilDrop = 6; view.update();
  return [0, 1];
});
await p.waitForTimeout(800);
check('face-down chips are drawn face down', await p.locator('.tube[data-col="0"] .hidden-chip').count() === 2);
await p.locator('.device').screenshot({ path: '/tmp/face-down.png' });
await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(1200);
check('moving the chip above turns the next one over', await p.locator('.tube[data-col="0"] .hidden-chip').count() === 1
  && await p.evaluate(() => game.columns[0][game.columns[0].length - 1] === 5));

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

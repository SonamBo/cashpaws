/**
 * Level modifiers in the running app, each reached through a real level-up:
 * the Lucky Paw at 12, the locked tube at 17, frozen coins at 25.
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

const p = await b.newPage({ viewport: { width: 402, height: 874 } });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(900);
await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; });
await p.click('[data-play]'); await p.waitForTimeout(600);

/** Put the game one cash-in short of `to`, then make that cash-in by tapping. */
async function levelUpTo(to) {
  await p.evaluate((lvl) => {
    game.level = lvl - 1;
    game.netWorth = game.nextFloor - 1;
    game.locked = null; game.ice = [];
    game.columns = game.columns.map(() => []);
    while (game.columns.length < 8) game.columns.push([]);
    game.columns.length = Math.min(game.columns.length, 8);
    game.columns[0] = [5, 5, 5]; game.columns[1] = [5]; game.columns[2] = [10, 20]; game.columns[3] = [20, 10];
    game.turnsUntilDrop = 9; game.status = 'playing'; game.selected = null;
    view.update();
  }, to);
  await p.click('.tube[data-col="1"]'); await p.waitForTimeout(150);
  await p.click('.tube[data-col="0"]'); await p.waitForTimeout(1500);
  const card = await p.locator('.ovl-milestone.in').textContent().catch(() => '');
  await p.locator('.ovl-milestone.in [data-go]').click().catch(() => {});
  await p.waitForTimeout(700);
  return card.replace(/\s+/g, ' ');
}

/* ---- Lucky Paw ---- */
let card = await levelUpTo(12);
check('level 12 announces the Lucky Paw', /Lucky Paw coin! It counts as any coin/.test(card), card.slice(0, 120));
check('and one is on the board', await p.locator('.chip.lucky').count() === 1);
await p.screenshot({ path: '/tmp/mod-lucky.png' });

/* ---- locked tube ---- */
card = await levelUpTo(17);
check('level 17 announces the locked tube', /New: a locked tube/.test(card));
const lockCol = await p.evaluate(() => game.locked?.column);
check('a tube is locked, showing 2 to go', lockCol >= 0 && (await p.locator(`.tube[data-col="${lockCol}"] .lock b`).textContent()) === '2');
await p.click(`.tube[data-col="${lockCol}"]`); await p.waitForTimeout(200);
check('tapping it selects nothing', await p.evaluate(() => game.selected === null));
// Two cash-ins open it.
for (let k = 0; k < 2; k++) {
  await p.evaluate(() => {
    const free = game.columns.map((c, i) => i).filter((i) => !game.isLocked(i));
    game.columns[free[0]] = [1, 1, 1]; game.columns[free[1]] = [1]; game.turnsUntilDrop = 9; view.update();
  });
  const [a, z] = await p.evaluate(() => { const f = game.columns.map((c, i) => i).filter((i) => !game.isLocked(i)); return [f[1], f[0]]; });
  await p.click(`.tube[data-col="${a}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${z}"]`); await p.waitForTimeout(900);
  if (k === 0) check('one cash-in: 1 to go', (await p.locator(`.tube[data-col="${lockCol}"] .lock b`).textContent().catch(() => '')) === '1');
}
await p.waitForTimeout(700);
check('two: the padlock opens and goes', await p.locator('.lock').count() === 0 && await p.evaluate(() => game.locked === null));

/* ---- frozen coins ---- */
card = await levelUpTo(25);
check('level 25 announces frozen coins', /New: frozen coins/.test(card));
const ice = await p.evaluate(() => game.ice);
check('two coins are frozen', ice.length === 2, JSON.stringify(ice));
check('and drawn under ice', await p.locator('.cell.frozen').count() === 2);
await p.screenshot({ path: '/tmp/mod-frozen.png' });
// Uncover one frozen coin and try to lift it.
const f = ice[0];
await p.evaluate(({ column, index }) => { game.columns[column].length = index + 1; view.update(); }, f);
await p.click(`.tube[data-col="${f.column}"]`); await p.waitForTimeout(200);
check('a frozen top cannot be lifted', await p.evaluate(() => game.selected === null));

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

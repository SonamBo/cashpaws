/**
 * The first-time tutorial: a hand on the best move, the "four of the same"
 * tip, and the progress bar spotlit on the first cash-in. Only on a true
 * first board, only once.
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
const boot = async () => { await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(1000); };
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await boot();

check('nothing in the lobby', await p.locator('.coach-bubble').count() === 0);
await p.click('[data-play]'); await p.waitForTimeout(900);
check('the first board shows a tip', /Tap a tube/.test(await p.locator('.coach-bubble').textContent()));
check('and a hand', await p.locator('.coach-hand').count() === 1);
const tipBox = await p.locator('.coach-bubble').boundingBox();
const barBox = await p.locator('[data-bar]').boundingBox();
const rows = await p.locator('[data-rows]').boundingBox();
check('the tip sits below the tubes, clear of the progress bar', tipBox.y > rows.y + rows.height - 2 && tipBox.y > barBox.y + barBox.height,
  `tip y ${tipBox.y}, tubes end ${rows.y + rows.height}`);
check('the tip never blocks a tap', await p.evaluate(() => getComputedStyle(document.querySelector('.coach')).pointerEvents) === 'none');

// Make the first move one that does not cash in, to see the second tip.
const [f, t] = await p.evaluate(() => {
  game.columns = game.columns.map(() => []);
  game.columns[0] = [5, 5, 5]; game.columns[1] = [10, 5]; game.columns[2] = [10];
  game.turnsUntilDrop = 9; game.selected = null; view.update();
  return [1, 3];          // $5 onto an empty tube: a move, not a cash-in
});
await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
const handAfterLift = await p.locator('.coach-hand').boundingBox();
const tube0 = await p.locator('.tube[data-col="0"]').boundingBox();
check('once lifted, the hand points at the drop', handAfterLift && handAfterLift.x > tube0.x - 10 && handAfterLift.x < tube0.x + tube0.width,
  `hand x ${handAfterLift?.x}, tube 0 ${tube0.x}–${tube0.x + tube0.width}`);
await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(900);
check('after a first move, the four-of-a-kind tip', /4 of the same coin/.test(await p.locator('.coach-bubble').textContent()));
await p.screenshot({ path: '/tmp/ftue-stack.png' });

// Now cash in: $5 from tube 3 onto the three $5s.
await p.click('.tube[data-col="3"]'); await p.waitForTimeout(150);
await p.click('.tube[data-col="0"]'); await p.waitForTimeout(1400);
check('the first cash-in spotlights the progress bar', await p.locator('.coach-hole').count() === 1);
check('explaining net worth and levelling up', /net worth/.test(await p.locator('.coach-bubble').textContent())
  && /level up/.test(await p.locator('.coach-bubble').textContent()));
const hole = await p.locator('.coach-hole').boundingBox();
const fig = await p.locator('[data-figure]').boundingBox();
check('the spotlight takes in the bar and the figure', hole.y <= barBox.y && hole.y + hole.height >= fig.y + fig.height);
check('and waits for a tap', await p.evaluate(() => getComputedStyle(document.querySelector('.coach')).pointerEvents) === 'auto');
await p.screenshot({ path: '/tmp/ftue-bank.png' });
await p.locator('.coach-ok').click(); await p.waitForTimeout(300);
check('Got it ends the tutorial', await p.locator('.coach-bubble').count() === 0);
check('and it is remembered', await p.evaluate(() => shell.flags['money-sort']?.ftue === true));
const ev = await p.evaluate(() => window.__events.filter((e) => e.name?.startsWith('ftue')).map((e) => e.params.step || e.name));
check('each beat is tracked', JSON.stringify(ev) === JSON.stringify(['move', 'stack', 'bank', 'ftue_complete']), JSON.stringify(ev));

// Never again.
await boot();
await p.click('[data-play]'); await p.waitForTimeout(900);
check('not shown a second time', await p.locator('.coach-bubble').count() === 0);

// A player who already has progress (an update from an older version) skips it.
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await boot();
await p.evaluate(() => { game.level = 3; CashPaws.flush(); });
await p.click('[data-play]'); await p.waitForTimeout(900);
check('a returning player past level 1 never sees it', await p.locator('.coach-bubble').count() === 0
  && await p.evaluate(() => shell.flags['money-sort']?.ftue === true));

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

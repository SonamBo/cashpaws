/**
 * The stuck card's ad rescue. A player who is stuck and cannot afford Sort is
 * offered a free one for watching an ad. Skipping the ad costs nothing. A
 * player who can pay is not shown the ad, and in the real app — no ad network
 * yet — nobody is.
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

async function stuckWith(coins, dev) {
  const p = await b.newPage({ viewport: { width: 1160, height: 1060 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(() => localStorage.clear());
  await p.goto(`http://localhost:8080/${dev ? '?dev=1' : ''}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.click('[data-play]'); await p.waitForTimeout(400);
  // One legal move exists; making it jams the board.
  const [f, t] = await p.evaluate((c) => {
    game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
    game.coins = c; game.freeSorts = 0; game.status = 'playing'; game.selected = null;
    game.turnsUntilDrop = 6; game.undoSnapshot = null; view.update();
    return game.legalMoves()[0];
  }, coins);
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(900);
  return p;
}

console.log('--- broke, in dev (the ad stub answers) ---');
let p = await stuckWith(0, true);
check('the stuck card is up', await p.locator('.ovl-locked [data-drop]').count() === 1);
check('it offers an ad for a free Sort', await p.locator('[data-ad-sort]').count() === 1);
check('and no paid Sort, since the player cannot afford one', await p.locator('[data-do-sort]').count() === 0);
await p.locator('.device').screenshot({ path: '/tmp/rescue-card.png' });

await p.locator('[data-ad-sort]').click(); await p.waitForTimeout(500);
check('the ad plays (stub)', (await p.locator('.ovl .ovl-title').textContent()).includes('An ad would play here'));
await p.locator('[data-cancel]').click(); await p.waitForTimeout(600);
check('skipping the ad brings the choice back', await p.locator('[data-ad-sort]').count() === 1);
check('and costs nothing', (await p.evaluate(() => game.status)) === 'locked');

const before = await p.evaluate(() => ({ coins: wallet.coins, level: game.level }));
await p.locator('[data-ad-sort]').click(); await p.waitForTimeout(500);
await p.locator('[data-ok]').click(); await p.waitForTimeout(1400);
const after = await p.evaluate(() => ({ coins: wallet.coins, level: game.level, status: game.status }));
check('watching it sorts the board for free', after.status === 'playing' && after.coins >= before.coins,
  `coins ${before.coins} -> ${after.coins} (banks only)`);
check('without costing a level', after.level === before.level);
check('and it is counted', (await p.evaluate(() => gameStats.adSorts)) === 1);
await p.close();

console.log('--- can afford it, in dev ---');
p = await stuckWith(1000, true);
check('a player who can pay sees the paid Sort', await p.locator('[data-do-sort]').count() === 1);
check('and no ad', await p.locator('[data-ad-sort]').count() === 0);
await p.close();

console.log('--- broke, in the real app (no ad network yet) ---');
p = await stuckWith(0, false);
check('no ad button while ads do not exist', await p.locator('[data-ad-sort]').count() === 0);
check('dropping a level is the way out', await p.locator('[data-drop]').count() === 1);
await p.close();

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

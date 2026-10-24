/**
 * Money Sort on CrazyGames: the game-specific half. The shell side (SDK,
 * saves, Settings, layout, ad blockers) is platforms/crazygames/test.
 *
 *   node platforms/crazygames/build.mjs && node test/games/money-sort/crazygames.mjs
 */
import { FULL, BASIC, open, check, calls, done } from '../../../platforms/crazygames/test/harness.mjs';

const chips = (p, col) => p.locator(`.tube[data-col="${col}"] .chip`).count();

/** Stuck, with `coins`: one move leaves no move at all. */
async function stuck(p, coins) {
  await p.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  const [f, t] = await p.evaluate((c) => {
    game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
    game.coins = c; if (window.wallet) wallet.coins = c; game.freeSorts = 0; game.status = 'playing'; game.selected = null;
    game.turnsUntilDrop = 6; game.undoSnapshot = null; view.update();
    return game.legalMoves()[0];
  }, coins);
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${t}"]`);
  await p.waitForSelector('.ovl-locked', { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(400);
}

console.log('--- Money Sort, full build ---');
{
  const { ctx, p, errs } = await open(FULL, { dev: true });
  // Keys
  await p.evaluate(() => { game.columns[4] = []; view.update(); });
  const before = [await chips(p, 0), await chips(p, 4)];
  await p.keyboard.press('1'); await p.waitForTimeout(150);
  await p.keyboard.press('5'); await p.waitForTimeout(700);
  const after = [await chips(p, 0), await chips(p, 4)];
  check('keys 1 then 5 move coins from tube 1 to tube 5', after[1] > before[1] && after[0] + after[1] === before[0] + before[1], `${before} → ${after}`);
  check('and the tubes show their keys', (await p.locator('.tube[data-key="1"]').count()) === 1);
  await p.keyboard.press('z'); await p.waitForTimeout(700);
  check('Z undoes it', (await chips(p, 0)) === before[0], `tube 1 has ${await chips(p, 0)}`);

  // Rescue Sort, through a CrazyGames rewarded ad
  await stuck(p, 0);
  check('stuck and broke: a rewarded ad is offered', (await p.locator('[data-ad-sort]').count()) === 1);
  const coinsBefore = await p.evaluate(() => wallet.coins);
  const mark = await p.evaluate(() => window.__cg.events.length);
  await p.locator('[data-ad-sort]').click(); await p.waitForTimeout(1200);
  const ev = await p.evaluate((m) => window.__cg.events.slice(m).map((e) => e.name), mark);
  const i0 = ev.indexOf('requestAd:rewarded'), i1 = ev.indexOf('adFinished:rewarded');
  check('the game is held while the ad runs', i0 >= 0 && i1 > i0 && !ev.slice(i0, i1).includes('gameplayStart'));
  check('a finished ad sorts the board for free', (await p.evaluate(() => game.status)) === 'playing' && (await p.evaluate(() => wallet.coins)) >= coinsBefore);

  await p.evaluate(() => { window.__mockCG.fill = false; });
  await stuck(p, 0);
  await p.locator('[data-ad-sort]').click(); await p.waitForTimeout(700);
  check('an unfilled ad pays nothing', (await p.evaluate(() => game.status)) === 'locked');
  check('and the ad offer goes away', (await p.locator('[data-ad-sort]').count()) === 0);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('--- Ad breaks: a midgame ad right after a level-up only ---');
{
  const { ctx, p, errs } = await open(FULL, { dev: true });
  // Past the shell's own rules (1.17.0): not in the first two days, not in the
  // first 3 minutes after opening, and no gift card at this level break.
  await p.evaluate(() => {
    shell.stats.firstDay = '2000-01-01'; shell.gift.status = 'claimed';
    const real = Date.now.bind(Date); Date.now = () => real() + 4 * 60000;
  });
  await p.evaluate(() => { game.level = 12; game.netWorth = game.floor; game.status = 'playing'; view.update(); });
  await p.waitForTimeout(3000);
  check('no level-up: no Ad break mid-board', !(await calls(p)).includes('requestAd:midgame'));
  await p.evaluate(() => {
    game.netWorth = game.nextFloor - 1; game.locked = null; game.ice = [];
    game.columns = game.columns.map(() => []);
    game.columns[0] = [5, 5, 5]; game.columns[1] = [5]; game.columns[2] = [10, 20]; game.columns[3] = [20, 10];
    game.turnsUntilDrop = 9; game.status = 'playing'; game.selected = null; view.update();
  });
  await p.click('.tube[data-col="1"]'); await p.waitForTimeout(150);
  await p.click('.tube[data-col="0"]'); await p.waitForTimeout(1500);
  for (let i = 0; i < 8 && await p.locator('.overlays .ovl').count(); i++) {
    if (await p.locator('.overlays .ovl h2:has-text("Ad break")').count()) break;
    await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  }
  await p.waitForFunction(() => window.__mockCG.calls.includes('requestAd:midgame'), null, { timeout: 8000 }).catch(() => {});
  check('right after a level-up, the Ad break plays a CrazyGames midgame ad', (await calls(p)).includes('requestAd:midgame'));
  await p.waitForTimeout(1500);
  check('and the game comes back afterwards', (await p.locator('.overlays .ovl').count()) === 0 && await p.evaluate(() => window.__cg.state().playing));
  check('no second Ad break within 3 minutes', await p.evaluate(() => window.CashPawsAds.interstitialReady()) === false);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('--- tutorial, ad blocker, basic build ---');
{
  const { ctx, p } = await open(FULL, { tutorial: true });
  const tip = await p.locator('.coach').first().innerText().catch(() => '');
  check('the tutorial says Click', /Click a tube/.test(tip), tip.slice(0, 60));
  await ctx.close();
}
{
  const { ctx, p } = await open(FULL, { dev: true, mock: { adblock: true } });
  await stuck(p, 0);
  check('ad blocker: no rescue ad, and dropping a level is the way out', (await p.locator('[data-ad-sort]').count()) === 0 && (await p.locator('[data-drop]').count()) === 1);
  await ctx.close();
}
{
  const { ctx, p } = await open(BASIC);
  await stuck(p, 0);
  check('basic build: no rescue ad', (await p.locator('[data-ad-sort]').count()) === 0);
  await ctx.close();
}

await done();

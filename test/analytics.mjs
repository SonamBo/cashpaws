/**
 * Analytics in the running app. Under ?dev=1 every event lands in
 * window.__events instead of Firebase, so this checks what would be sent.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';
import { clean, cleanParams } from '../www/shell/analytics.js';

const b = await pw.chromium.launch();
let failed = 0;
const errs = [];
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

/* ---- Firebase's naming rules, enforced before anything is sent ---- */
check('names keep letters, digits and underscores', clean('level_up') === 'level_up' && clean('box-open') === 'box_open');
check('names must start with a letter, 40 chars max', clean('1abc') === 'abc' && clean('x'.repeat(50)).length === 40);
check('reserved prefixes are refused', clean('firebase_thing') === null && clean('google_x') === null);
const cp = cleanParams({ a: true, b: NaN, c: 'y'.repeat(150), d: null, 'bad key!': 3 });
check('params: booleans to 1/0, NaN and null dropped, strings cut to 100',
  cp.a === 1 && !('b' in cp) && cp.c.length === 100 && !('d' in cp) && cp.bad_key_ === 3, JSON.stringify(Object.keys(cp)));

const p = await b.newPage({ viewport: { width: 402, height: 874 } });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
const boot = async () => { await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(1000); };
const events = () => p.evaluate(() => window.__events);
const named = async (n) => (await events()).filter((e) => e.name === n);
const clear = () => p.evaluate(() => { window.__events.length = 0; });

await boot();
check('app_ready on launch', (await named('app_ready')).length === 1);
// The tutorial has its own test; here it would spotlight the first bank.
await p.evaluate(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; CashPaws.flush(); });
check('the lobby is a screen view', (await named('screen_view')).some((e) => e.params.screen_name === 'lobby'));
const user = (await events()).filter((e) => e.user);
check('player facts are set', ['game', 'best_level', 'cat_worn', 'days_played', 'cats_owned']
  .every((k) => user.some((u) => u.user === k)), user.map((u) => u.user).join(','));

/* ---- play: banks are summed, not sent one by one ---- */
await p.click('[data-play]'); await p.waitForTimeout(500);
check('the game is a screen view', (await named('screen_view')).some((e) => e.params.screen_name === 'game'));
await clear();
// Bank a few tubes and level up for real, through the engine.
await p.evaluate(() => { for (let i = 0; i < 3; i++) wallet.earn(10, 'bank'); });
check('no event per bank', (await named('earn_virtual_currency')).length === 0);
await p.evaluate(() => { game.netWorth = game.nextFloor; game.checkLevelUp(); });
await p.waitForTimeout(300);
const lu = (await named('level_up'))[0];
check('level_up carries the level, kind, moves and seconds', lu && lu.params.level === 2
  && 'kind' in lu.params && 'moves' in lu.params && 'seconds' in lu.params, JSON.stringify(lu?.params));
const earns = await named('earn_virtual_currency');
const bank = earns.find((e) => e.params.source === 'bank');
check('banks arrive as one total at the level end', bank && bank.params.value === 30, JSON.stringify(bank?.params));
check('the level-up bonus is its own earn event', earns.some((e) => e.params.source === 'levelup'));
await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
await p.waitForTimeout(400);

/* ---- stuck, Sort, and the ad placement ---- */
await clear();
const jam = async (coins) => {
  const [f, t] = await p.evaluate((c) => {
    game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
    game.freeSorts = 0; game.status = 'playing'; game.selected = null; wallet.set(c);
    game.turnsUntilDrop = 6; game.undoSnapshot = null; view.update();
    return game.legalMoves()[0];
  }, coins);
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(900);
};
await jam(0);
const stuck = (await named('board_stuck'))[0];
check('board_stuck, with what was on offer', stuck && stuck.params.ad_offer === 1 && stuck.params.coins === 0, JSON.stringify(stuck?.params));
await p.locator('.ovl.in [data-ad-sort]').click(); await p.waitForTimeout(400);
await p.locator('.ovl.in [data-ok]').click(); await p.waitForTimeout(900);   // the dev stub: "Watched it"
check('the ad is tracked by placement', (await named('ad_rewarded_start'))[0]?.params.placement === 'rescue-sort');
check('and whether it paid out', (await named('ad_rewarded_result'))[0]?.params.earned === 1);
const su = (await named('sort_used'))[0];
check('sort_used says it was paid for by an ad', su?.params.how === 'ad' && su?.params.where === 'stuck', JSON.stringify(su?.params));
check('stuck_choice records the pick', (await named('stuck_choice'))[0]?.params.choice === 'free-sort');

// The Sort may have banked its way to a level-up card; wave anything through.
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
  await p.waitForTimeout(300);
}
await clear();
const levelBefore = await p.evaluate(() => game.level);
await jam(0);
await p.locator('.ovl.in [data-drop]').click(); await p.waitForTimeout(800);
const ll = (await named('level_lost'))[0];
check('level_lost, with where from and to', ll && ll.params.level === levelBefore && ll.params.to === levelBefore - 1, JSON.stringify(ll?.params));
check('the safety-net top-up is visible as its own source',
  (await named('earn_virtual_currency')).some((e) => e.params.source === 'safety-net'));
await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
await p.waitForTimeout(400);

/* ---- lobby things ---- */
await p.click('[data-menu]'); await p.waitForTimeout(350);
await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(700);
await clear();
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('.ovl.in [data-pick="open"]').click(); await p.waitForTimeout(600);
const box = (await named('box_open'))[0];
check('box_open with its coins', box && box.params.coins > 0 && box.params.via_ad === 0, JSON.stringify(box?.params));
check('and the coins as an earn from the box', (await named('earn_virtual_currency')).some((e) => e.params.source === 'box'));
await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
await p.waitForTimeout(400);
await p.click('[data-tab="cats"]'); await p.waitForTimeout(300);
check('tabs are screen views', (await named('screen_view')).some((e) => e.params.screen_name === 'cats'));

/* ---- a quest step and the give-up prompt ---- */
await p.evaluate(() => { shell.stats.bestLevel = 8; CashPaws.flush(); });
await boot();
await p.locator('.ovl-quest.in [data-pick="start"]').click(); await p.waitForTimeout(2200);
check('quest_offer and quest_start', (await named('quest_offer')).length === 1 && (await named('quest_start'))[0]?.params.grand > 0);
await p.locator('.q-finding').click(); await p.waitForTimeout(500);
await p.locator('.ovl-quest.in [data-pick="play"]').click(); await p.waitForTimeout(500);
await clear();
await p.evaluate(() => { game.netWorth = game.nextFloor; game.checkLevelUp(); });
await p.waitForTimeout(300);
check('quest_step on a level-up during a quest', (await named('quest_step'))[0]?.params.step === 1);
check('and level_up knows it was a quest step', (await named('level_up'))[0]?.params.quest_step === 1);

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

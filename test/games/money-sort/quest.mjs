/**
 * Bell Quest in the running app: unlock, the popup on open and on lobby
 * return, starting, stepping, the drop re-confirm, knockout, win, and expiry.
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
const boot = async () => {
  await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1100);
};
const card = () => p.locator('.ovl-quest.in');
const text = async (sel) => (await p.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
const pick = async (v) => { await p.locator(`.ovl-quest.in [data-pick="${v}"]`).first().click(); await p.waitForTimeout(450); };
const quest = () => p.evaluate(() => JSON.parse(JSON.stringify(shell.quest)));
const edit = (fn, arg) => p.evaluate(fn, arg);
const toLobby = async () => {
  await p.click('[data-menu]'); await p.waitForTimeout(350);
  await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(800);
};
// Beat a level without playing it: the engine emits a real levelup.
const levelUp = () => p.evaluate(() => { game.netWorth = game.nextFloor; game.checkLevelUp(); });
// Beat a level with a real move, so the whole sequence plays: the bank, the
// level-up card, then whatever comes between levels.
const levelUpByMove = async () => {
  await p.evaluate(() => {
    game.columns = game.columns.map(() => []);
    game.columns[0] = [5, 5, 5]; game.columns[1] = [5];
    game.netWorth = game.nextFloor - 1; game.turnsUntilDrop = 9;
    game.status = 'playing'; game.selected = null; view.update();
  });
  await p.click('.tube[data-col="1"]'); await p.waitForTimeout(150);
  await p.click('.tube[data-col="0"]'); await p.waitForTimeout(1500);
};
const waveLevelUp = async () => {
  await p.locator('.ovl-milestone.in [data-go]').click(); await p.waitForTimeout(700);
};

await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());

/* ---- locked for a new player ---- */
await boot();
// The tutorial is for real first boards; it has its own test (test/ftue.mjs).
await edit(() => { shell.flags['money-sort'] = { ftue: true }; shell.reminders.asked = true; CashPaws.flush(); });
await boot();
check('a new player sees no quest icon', await p.locator('[data-quest]').isHidden());
check('and no popup', await card().count() === 0);
check('the save starts with the quest locked', (await quest()).status === 'none');

/* ---- unlock: the offer pops up on app open ---- */
await edit(() => { shell.stats.bestLevel = 8; CashPaws.flush(); });
await boot();
check('past level 7, the offer pops up on open', await card().count() === 1);
check('and it names the prize and the rule', /Beat 7 levels in a row/.test(await text('.ovl-quest.in')));
const grandShown = await text('.ovl-quest.in .q-sign');
check('the grand prize is ten Sorts', grandShown.replace(/\D/g, '') === String(Math.round(await p.evaluate(() => game.sortPrice) * 10 / 100) * 100), grandShown);
await p.locator('.ovl-quest.in').screenshot({ path: '/tmp/quest-intro.png' });
check('the lobby icon says New!', (await text('[data-quest-pill]')) === 'New!');

// Close it; returning from the game does not offer it twice in one session.
await pick('close');
check('closing leaves it on offer', (await quest()).status === 'offer');
await p.click('[data-play]'); await p.waitForTimeout(500);
await toLobby();
check('the offer does not nag on lobby return', await card().count() === 0);

/* ---- starting ---- */
await p.click('[data-quest]'); await p.waitForTimeout(450);
await pick('start');
check('Start rounds up the cats', await p.locator('.q-finding').count() === 1);
await p.waitForTimeout(1900);
check('the count reaches 100', (await text('.q-count')).startsWith('100/100'));
await p.locator('.q-finding').screenshot({ path: '/tmp/quest-finding.png' });
await p.locator('.q-finding').click(); await p.waitForTimeout(500);
check('then the path, with the rules the first time', await p.locator('.q-rules li').count() === 3);
check('levels 0/7, cats 100/100', (await text('.q-stats')).includes('0/7') && (await text('.q-stats')).includes('100/100'));
check('48 hours on the clock', /4[78]h \d\dm left/.test(await text('.ovl-quest.in .q-timer')), await text('.ovl-quest.in .q-timer'));
await p.locator('.ovl-quest.in').screenshot({ path: '/tmp/quest-path0.png' });
let q = await quest();
check('the quest is running', q.status === 'active' && q.step === 0 && q.steps === 7);

// Play goes straight into the game.
await pick('play');
check('Play on the path opens the game', await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));

/* ---- a step: shown in the game, between levels ---- */
await levelUpByMove();
check('the level-up card comes first', await p.locator('.ovl-milestone.in').count() === 1);
check('with the quest not yet shown', await card().count() === 0);
q = await quest();
check('step 1 saved', q.step === 1);
await waveLevelUp();
check('then the quest path, still in the game', await card().count() === 1
  && await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
check('saying you made it', /You made it to the next step/.test(await text('.ovl-quest.in')));
check('with Continue, not Play', /Continue/.test(await text('.ovl-quest.in [data-pick="play"]')));
check('your cat stands on the first stone', await p.locator('.ovl-quest.in .q-stone.here').count() === 1
  && await p.locator('.ovl-quest.in .q-stone.start.here').count() === 0);
await p.waitForTimeout(1300);   // let the cat hop across
const meLeft = await p.evaluate(() => document.querySelector('.ovl-quest.in [data-me]').style.left);
check('and hops from the start to it', meLeft === '30%', meLeft);
check('and the rules not repeated', await p.locator('.q-rules').count() === 0);
check('fewer cats left', Number((await text('.q-stats')).match(/(\d+)\/100/)[1]) < 100);
await p.locator('.ovl-quest.in').screenshot({ path: '/tmp/quest-path1.png' });
await pick('play');
check('Continue returns to the board', await card().count() === 0
  && await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
await toLobby();
check('seen in the game, so the lobby does not repeat it', await card().count() === 0);
check('the icon shows the step', (await text('[data-quest-badge]')) === '1/7');
await p.locator('.screen[data-screen="lobby"]').screenshot({ path: '/tmp/quest-lobby.png' });

// No news, no popup.
await p.click('[data-play]'); await p.waitForTimeout(500);
await toLobby();
check('no popup when nothing changed', await card().count() === 0);

// App open always shows it.
await boot();
check('reopening the app shows the path', await p.locator('.ovl-quest.in .q-path').count() === 1);
await pick('close');

/* ---- dropping a level asks first ---- */
await p.click('[data-play]'); await p.waitForTimeout(500);
const jam = async () => {
  const [f, t] = await p.evaluate(() => {
    game.columns = [[5, 10, 20], [10, 20, 50, 20], [20, 50, 5, 10], [50, 5, 10, 5], [5, 20, 10, 5]];
    game.freeSorts = 0; game.status = 'playing'; game.selected = null; wallet.set(0);
    game.turnsUntilDrop = 6; game.undoSnapshot = null; view.update();
    return game.legalMoves()[0];
  });
  await p.click(`.tube[data-col="${f}"]`); await p.waitForTimeout(150);
  await p.click(`.tube[data-col="${t}"]`); await p.waitForTimeout(900);
};
await jam();
check('the board is stuck', await p.locator('.ovl.in [data-drop]').count() === 1);
await p.locator('.ovl.in [data-drop]').click(); await p.waitForTimeout(450);
check('Drop asks about the quest', /Give up your quest\?/.test(await text('.ovl.in')));
check('in the same card: one card, the slumped cat still on it', await p.locator('.ovl').count() === 1
  && await p.locator('.ovl.in .cat-lying').count() === 1);
check('naming the step and the prize', /Step 2 of 7/.test(await text('.ovl.in')) && /sharing/.test(await text('.ovl.in')));
await p.locator('.ovl.in').screenshot({ path: '/tmp/quest-confirm.png' });
await p.locator('.ovl.in [data-keep]').click(); await p.waitForTimeout(300);
check('Keep my quest puts the stuck card back', await p.locator('.ovl.in [data-drop]').count() === 1
  && /No legal moves left|Nothing left to do/.test(await text('.ovl.in')));
check('with the quest intact', (await quest()).status === 'active');
await p.locator('.ovl.in [data-drop]').click(); await p.waitForTimeout(300);
await p.locator('.ovl.in [data-drop-anyway]').click(); await p.waitForTimeout(500);
check('dropping anyway knocks you out', (await quest()).status === 'lost');
await p.waitForTimeout(300);
await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
await p.waitForTimeout(500);
await toLobby();
check('the lobby shows Knocked out', /Knocked out/.test(await text('.ovl-quest.in')));
await p.locator('.ovl-quest.in').screenshot({ path: '/tmp/quest-out.png' });
await pick('again');
check('Start a new quest goes straight in', await p.locator('.q-finding').count() === 1);
await p.waitForTimeout(1900);
await p.locator('.q-finding').click(); await p.waitForTimeout(500);
check('a fresh quest at 0/7, no rules this time', (await quest()).step === 0 && await p.locator('.q-rules').count() === 0);
await pick('close');

/* ---- without a quest, dropping is not questioned ---- */
// (checked below after the win, when no quest is running)

/* ---- winning ---- */
await edit(() => { shell.quest.step = 6; shell.quest.seenStep = 6; });
await p.click('[data-play]'); await p.waitForTimeout(500);
await levelUpByMove();
q = await quest();
check('the last step wins', q.status === 'won');
const others = q.field[7];
await waveLevelUp();
check('the win shows in the game, right after the level-up', await p.locator('.q-won').count() === 1
  && await p.evaluate(() => document.getElementById('app').classList.contains('on-game')));
const shareText = await text('.q-share');
check('paying the grand prize over the finishers', Number(shareText.replace(/\D/g, '')) === q.share
  && q.share === Math.max(10, Math.round(q.grand / (others + 1) / 5) * 5), `${shareText} of ${q.grand}, ${others + 1} finishers`);
await p.locator('.ovl-quest.in').screenshot({ path: '/tmp/quest-won.png' });
const before = await p.evaluate(() => wallet.coins);
await pick('claim');
check('claiming pays it', (await p.evaluate(() => wallet.coins)) - before === q.share);
await toLobby();
q = await quest();
check('and the next quest is on offer', q.status === 'offer' && q.wins === 1);
check('which the lobby offers', await card().count() === 1 && /Start/.test(await text('.ovl-quest.in')));
await pick('close');

/* ---- no quest running: Drop is not questioned ---- */
await p.click('[data-play]'); await p.waitForTimeout(500);
await jam();
await p.locator('.ovl.in [data-drop]').click(); await p.waitForTimeout(500);
check('with no quest running, Drop just drops', !/Give up/.test(await text('.ovl.in')));
await p.evaluate(() => { const c = document.querySelector('.ovl.in [data-go]'); if (c) c.click(); });
await p.waitForTimeout(500);

/* ---- expiry ---- */
await edit(() => {
  Object.assign(shell.quest, { status: 'active', step: 3, seenStep: 3, steps: 7, grand: 3000,
    field: [99, 70, 45, 30, 22, 13, 9, 7], startedAt: Date.now() - 49 * 3600e3, endsAt: Date.now() - 3600e3,
    duration: 48 * 3600e3 });
  CashPaws.flush();
});
await boot();
check('an expired quest says so on open', /Time ran out/.test(await text('.ovl-quest.in')));
await pick('close');
check('and closing it offers the next', (await quest()).status === 'offer');

/* ---- small screen ---- */
await p.setViewportSize({ width: 360, height: 640 });
await boot();
const box = await p.locator('.ovl-quest.in .q-card').boundingBox();
check('the card fits a 360x640 screen', box && box.y >= 0 && box.y + box.height <= 640 && box.width <= 360, JSON.stringify(box));
await pick('close');
const icon = await p.locator('[data-quest]').boundingBox();
const logo = await p.locator('.logo').boundingBox();
check('the icon clears the logo on a small phone', icon.x + icon.width <= logo.x || icon.y + icon.height <= logo.y,
  `icon ${JSON.stringify(icon)} logo ${JSON.stringify(logo)}`);
await p.locator('.screen[data-screen="lobby"]').screenshot({ path: '/tmp/quest-lobby-small.png' });

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

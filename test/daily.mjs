/**
 * Daily tasks in the real app: drawing, the mid-game toast, claiming, the
 * badge, persistence, the streak across days, and local-midnight resets.
 * The page clock is fixed so days can be stepped through. Timers still run.
 *
 * Needs the dev server: node serve.js 8080
 */
import pw from 'playwright';

const b = await pw.chromium.launch();
// India, UTC+5:30: a UTC-based day would roll over at 05:30 local.
const ctx = await b.newContext({ viewport: { width: 1160, height: 1060 }, timezoneId: 'Asia/Kolkata' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};
const at = (iso) => p.clock.setFixedTime(new Date(iso));
const daily = () => p.evaluate(() => JSON.parse(JSON.stringify(shell.daily)));
const openDaily = async () => { await p.click('[data-tab="daily"]'); await p.waitForTimeout(400); };
const closeSheet = async () => { await p.locator('[data-close]').click(); await p.waitForTimeout(300); };

await at('2026-09-26T10:00:00+05:30');
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);

/* ---- day one ---- */
let d = await daily();
check('a Daily tab exists', await p.locator('[data-tab="daily"]').isVisible());
check("today's set is drawn on open", d.day === '2026-09-26' && d.tasks.length === 3, d.tasks.map((t) => t.id).join(', '));
check('one task per tier', d.tasks.map((t) => t.tier).join() === 'easy,medium,hard');
check('no chip task a level-1 player cannot do', !d.tasks.some((t) => /twenties|fifties/.test(t.id)));
check('no badge while nothing is finished', await p.locator('[data-daily-dot]').isHidden());

await openDaily();
check('the sheet lists three tasks and a bonus', await p.locator('.card.task').count() === 4);
await p.locator('.panel-sheet').screenshot({ path: '/tmp/daily-start.png' });
await closeSheet();

// Real play: the bot makes moves until the easy task is done, watching for the toast.
await p.click('[data-play]');
await p.waitForTimeout(500);
let sawToast = false;
const easy = d.tasks[0];
for (let i = 0; i < 12 && !sawToast; i++) {
  await p.click('#step10');
  for (let j = 0; j < 20 && !sawToast; j++) {
    sawToast = await p.locator('.toast').count() > 0;
    if (!sawToast) await p.waitForTimeout(150);
    // the bot can lose a level along the way; wave any card through
    const card = p.locator('.ovl.in [data-go], .ovl.in [data-drop]').first();
    if (await card.count()) await card.click({ timeout: 1500 }).catch(() => {});
  }
}
const toastText = sawToast ? await p.locator('.toast').first().textContent() : '';
check('finishing a task mid-board shows a toast', sawToast, toastText.trim());
check('and the toast does not block the board', await p.locator('.ovl').count() === 0);
// Since 1.6 levels are short, so the task is often "reach a new level" and its
// level-up card lands just after the toast. Wave it through.
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(250);
  const card = p.locator('.ovl.in [data-go], .ovl.in [data-drop]').first();
  if (await card.count()) await card.click({ timeout: 1500 }).catch(() => {});
}

await p.click('[data-menu]'); await p.waitForTimeout(400);
await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(500);
check('the badge shows back in the lobby', await p.locator('[data-daily-dot]').isVisible());

/* ---- claiming ---- */
await openDaily();
const coins0 = await p.evaluate(() => wallet.coins);
const claimBtn = p.locator('[data-claim]').first();
check('a finished task offers Claim', await claimBtn.count() === 1);
await claimBtn.click(); await p.waitForTimeout(400);
const coins1 = await p.evaluate(() => wallet.coins);
check('claiming pays coins', coins1 > coins0, `+${coins1 - coins0}`);
check('and marks it claimed', (await daily()).tasks.some((t) => t.claimed));

// Finish the rest directly, then claim everything including the bonus.
await p.evaluate(() => { for (const t of shell.daily.tasks) gameStats[t.stat] = t.base + t.target; });
await closeSheet(); await openDaily();
while (await p.locator('[data-claim]').count()) { await p.locator('[data-claim]').first().click(); await p.waitForTimeout(300); }
check('the bonus unlocks once all three are claimed', await p.locator('[data-claim-bonus]').count() === 1);
const before = await p.evaluate(() => wallet.coins);
await p.locator('[data-claim-bonus]').click(); await p.waitForTimeout(400);
check('the bonus pays 50', (await p.evaluate(() => wallet.coins)) - before === 50);
check('a finished day starts the streak', (await daily()).streak === 1);
check('one filled stamp', await p.locator('.stamp.on').count() === 1);
await p.locator('.panel-sheet').screenshot({ path: '/tmp/daily-done.png' });
check('nothing left to claim, so no badge', await p.locator('[data-daily-dot]').isHidden());
await closeSheet();

/* ---- persistence ---- */
await p.evaluate(() => CashPaws.flush());
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);
d = await daily();
check('claims survive a reload', d.bonusClaimed && d.tasks.every((t) => t.claimed));
check('and the set is not redrawn', d.day === '2026-09-26');

/* ---- local midnight, not UTC ---- */
await at('2026-09-26T23:50:00+05:30');                 // UTC is still the 26th
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
check('before local midnight it is still the 26th', (await daily()).day === '2026-09-26');
await at('2026-09-27T00:10:00+05:30');                 // UTC is 18:40 on the 26th
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
d = await daily();
check('just after LOCAL midnight a new day begins', d.day === '2026-09-27', `UTC still says ${new Date('2026-09-27T00:10:00+05:30').toISOString().slice(0, 10)}`);
check('with nothing claimed yet', d.tasks.every((t) => !t.claimed) && !d.bonusClaimed);
check('the streak carries into the new day', d.streak === 1);

/* ---- a day opened mid-session, while on the board ---- */
await p.click('[data-play]'); await p.waitForTimeout(400);
await at('2026-09-28T09:00:00+05:30');
await p.click('[data-menu]'); await p.waitForTimeout(400);
await p.locator('[data-pick="lobby"]').click(); await p.waitForTimeout(500);
check('returning to the lobby after midnight draws the new day', (await daily()).day === '2026-09-28');
check('skipping a full day ends the streak', (await daily()).streak === 0);

/* ---- clock wound backwards ---- */
await at('2026-09-20T09:00:00+05:30');
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
check('a clock wound backwards changes nothing', (await daily()).day === '2026-09-28');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

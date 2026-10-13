/**
 * Reminders in the running app, with the dev stub standing in for Android:
 * the soft ask after the first Rewards Box, the permission, what gets
 * scheduled, and the Settings switch.
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
await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(1000);
const reminders = () => p.evaluate(() => ({ ...window.__reminders }));

check('nothing scheduled before permission', Object.keys(await reminders()).length === 0);

// Open the first box: the soft ask follows the reward.
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('.ovl.in [data-pick="open"]').click(); await p.waitForTimeout(500);
await p.locator('.ovl.in [data-go]').click(); await p.waitForTimeout(500);
check('after the first box, the game asks in its own words', /nudge/.test(await p.locator('.ovl.in').textContent()));
await p.locator('.ovl.in').screenshot({ path: '/tmp/reminders-ask.png' });
await p.locator('.ovl.in [data-ok]').click(); await p.waitForTimeout(500);
let r = await reminders();
check('yes: permission, then the box reminder is set', r.box && r.box.at > Date.now() + 3.9 * 3600e3, JSON.stringify(r.box));
check('no quest reminder before Bell Quest unlocks', !r.quest);
check('asked once only', await p.evaluate(() => shell.reminders.asked === true));

// Unlock Bell Quest: the daily reminder appears.
await p.evaluate(() => { shell.stats.bestLevel = 8; CashPaws.flush(); });
await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(1200);
r = await reminders();
check('quest unlocked: a 7 pm reminder', r.quest && new Date(r.quest.at).getHours() === 19 && /Bell Quest/.test(r.quest.title), r.quest?.title);
if (await p.locator('.ovl-quest.in').count()) { await p.locator('.ovl-quest.in [data-pick="close"]').first().click(); await p.waitForTimeout(400); }

// Settings: the switch turns them off and on.
await p.click('[data-settings]'); await p.waitForTimeout(400);
check('Settings shows the Reminders switch, on', await p.locator('[data-pick="reminders"] .switch.on').count() === 1);
await p.locator('[data-pick="reminders"]').click(); await p.waitForTimeout(500);
check('off cancels both', Object.keys(await reminders()).length === 0);
check('and the switch shows off', await p.locator('[data-pick="reminders"] .switch.on').count() === 0);
await p.locator('[data-pick="reminders"]').click(); await p.waitForTimeout(500);
check('on again restores them', Object.keys(await reminders()).length === 2);
await p.locator('[data-pick="close"]').click(); await p.waitForTimeout(300);

// A player who said Not now is never asked again.
await p.goto('http://localhost:8080/css/tokens.css');
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:8080/?dev=1'); await p.waitForTimeout(1000);
await p.evaluate(() => { window.__notifyPermissionState = 'ask'; });
await p.click('[data-box]'); await p.waitForTimeout(400);
await p.locator('.ovl.in [data-pick="open"]').click(); await p.waitForTimeout(500);
await p.locator('.ovl.in [data-go]').click(); await p.waitForTimeout(500);
await p.locator('.ovl.in [data-cancel]').click(); await p.waitForTimeout(400);
check('Not now: nothing scheduled', Object.keys(await reminders()).length === 0);
const ev = await p.evaluate(() => window.__events.filter((e) => e.name === 'reminders_offer').map((e) => e.params));
check('the answer is tracked', ev.length === 1 && ev[0].yes === 0 && ev[0].reason === 'box');

console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await b.close();
process.exit(failed || errs.length ? 1 : 0);

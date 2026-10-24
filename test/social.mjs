/**
 * Cloud save (shell/cloud.js) and sharing (shell/social.js), with whatever
 * game is installed, against stand-ins for the Android bridges
 * (CloudSave.java as window.CashPawsPlay, Social.java as window.CashPawsSocial).
 *
 *  - nothing is uploaded until the cloud save has been read and decided on;
 *  - a save from another install that is further along is offered, and
 *    restoring keeps this install's purchases;
 *  - a save from this install, or one behind, is never offered;
 *  - uploads are throttled, and flushed when the app goes to the background;
 *  - Share sits in the lobby and Settings where sharing works, and nowhere else.
 *
 * Needs the dev server (node serve.js 8080) and Playwright.
 * Run: node test/social.mjs
 */
import pw from 'playwright';

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};
const SAVE = 'cashpaws.save.v2';

/** A cloud save from another install, `level` reached, `coins` held. */
function cloudSave(level, coins, device = 'other-phone', granted = []) {
  return JSON.stringify({
    v: 2, games: {},
    shell: { coins, device, stats: { coinsEarned: level * 100, bestLevel: level, daysPlayed: 3, lastDay: null },
      cats: { owned: ['patch'], worn: 'patch' }, iap: { granted, purchases: granted.length, coins: 0 } },
  });
}

const FAKES = ({ cloud = '', signedIn = true, loadDelay = 400 } = {}) => `
  window.__f = { saved: [], shared: [], signIns: 0, reviews: 0 };
  const send = (e, ms = 30) => setTimeout(() => window.__cloud && window.__cloud(e), ms);
  window.CashPawsPlay = {
    isEnabled: () => true,
    start() { ${signedIn ? "send({ type: 'auth', signedIn: true, player: 'Sonam' });" : "send({ type: 'auth', signedIn: false });"} },
    signIn() { window.__f.signIns++; send({ type: 'auth', signedIn: true, player: 'Sonam' }); },
    load(id) { send({ type: 'loaded', id, ok: true, data: sessionStorage.getItem('fakeCloud') ?? ${JSON.stringify(cloud)} }, ${loadDelay}); },
    save(json, desc, progress) { window.__f.saved.push({ json, desc, progress }); sessionStorage.setItem('fakeCloud', json); },
    status: () => JSON.stringify({ signedIn: true, player: 'Sonam' }),
  };
  window.CashPawsSocial = {
    share(text, image) { window.__f.shared.push({ text, image }); },
    review(id) { window.__f.reviews++; setTimeout(() => window.__reviewDone(id, true), 50); },
  };`;

const b = await pw.chromium.launch();
async function open({ init = '', keep = null, dev = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/css/tokens.css');
  await p.evaluate(([k, v]) => { localStorage.clear(); sessionStorage.clear(); if (v) localStorage.setItem(k, v); }, [SAVE, keep]);
  await p.goto(`http://localhost:8080/${dev ? '?dev=1&lobby=1' : '?lobby=1'}`);
  await p.waitForTimeout(250);
  return { ctx, p, errs };
}
const saved = (p) => p.evaluate(() => window.__f.saved.length);
const local = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).shell, SAVE);
const toLobby = async (p) => { await p.evaluate(() => window.CashPaws.onBack()); await p.waitForTimeout(400); };

console.log('--- a first launch, nothing in the cloud ---');
{
  const { ctx, p, errs } = await open({ init: FAKES({ cloud: '' }) });
  check('nothing is uploaded before the cloud save is read', await saved(p) === 0);
  await p.waitForTimeout(800);
  check('then this install is uploaded once', await saved(p) === 1);
  const up = await p.evaluate(() => JSON.parse(window.__f.saved[0].json));
  check('the upload is the whole save, with this install\'s id', up.shell?.device === (await local(p)).device && !!up.games);
  check('described by level, with a progress value', await p.evaluate(() => /^Level \d+$/.test(window.__f.saved[0].desc) && Number(window.__f.saved[0].progress) > 0));
  await p.evaluate(() => window.CashPaws.flush()); await p.waitForTimeout(300);
  check('saves after that are throttled (at most once a minute)', await saved(p) === 1);
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(200);
  check('going to the background uploads at once', await saved(p) === 2);
  check('no restore card', await p.locator('.ovl.in').filter({ hasText: 'Saved game found' }).count() === 0);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('--- a new phone, the cloud is further along ---');
{
  const keep = JSON.stringify({ v: 2, games: {}, shell: { coins: 50, device: 'this-phone', stats: { coinsEarned: 0, bestLevel: 1, daysPlayed: 1, lastDay: null }, iap: { granted: ['tok-here'], purchases: 1, coins: 500 } } });
  const { ctx, p, errs } = await open({ init: FAKES({ cloud: cloudSave(24, 3200, 'old-phone', ['tok-old']) }), keep });
  await p.waitForTimeout(900);
  const card = await p.locator('.ovl.in').last().innerText().catch(() => '');
  check('it offers the saved game: level and coins', /Continue from level 24/.test(card) && /3,200 coins/.test(card), card.replace(/\s+/g, ' ').slice(0, 80));
  check('and uploads nothing while asking', await saved(p) === 0);
  await p.locator('.ovl.in').last().getByText('Continue', { exact: true }).click();
  await p.waitForLoadState('load'); await p.waitForTimeout(1200);
  const sh = await local(p);
  check('continuing restores it', sh.stats.bestLevel === 24, `level ${sh.stats.bestLevel}`);
  check('keeping what was bought on this phone', sh.coins === 3200 + 500 && sh.iap.granted.includes('tok-here') && sh.iap.granted.includes('tok-old'), `${sh.coins} coins, ${sh.iap.granted}`);
  check('and this install now owns the save', sh.device === 'this-phone');
  check('no card the second time (same install now)', await p.locator('.ovl.in').filter({ hasText: 'Saved game found' }).count() === 0);
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('--- the cloud is further along, but the player starts fresh ---');
{
  const { ctx, p } = await open({ init: FAKES({ cloud: cloudSave(24, 3200) }) });
  await p.waitForTimeout(900);
  await p.locator('.ovl.in').last().getByText('Start fresh').click(); await p.waitForTimeout(500);
  check('"Start fresh" keeps this install', (await local(p)).stats.bestLevel === 1);
  check('and uploads it', await saved(p) === 1 && await p.evaluate(() => JSON.parse(window.__f.saved[0].json).shell.stats.bestLevel) === 1);
  await ctx.close();
}

console.log('--- never offered: this install\'s own save, or one behind ---');
{
  const keep = JSON.stringify({ v: 2, games: {}, shell: { coins: 900, device: 'me', stats: { coinsEarned: 2000, bestLevel: 12, daysPlayed: 4, lastDay: null } } });
  let r = await open({ init: FAKES({ cloud: cloudSave(30, 9999, 'me') }), keep });
  await r.p.waitForTimeout(900);
  check('a save from this same install is not offered', await r.p.locator('.ovl.in').filter({ hasText: 'Saved game found' }).count() === 0);
  await r.ctx.close();
  r = await open({ init: FAKES({ cloud: cloudSave(5, 100, 'old') }), keep });
  await r.p.waitForTimeout(900);
  check('one from elsewhere but behind is not offered', await r.p.locator('.ovl.in').filter({ hasText: 'Saved game found' }).count() === 0);
  check('and is replaced by this install', await saved(r.p) === 1);
  await r.ctx.close();
}

console.log('--- not signed in ---');
{
  const { ctx, p, errs } = await open({ init: FAKES({ cloud: '', signedIn: false }) });
  await p.waitForTimeout(900);
  check('nothing is uploaded', await saved(p) === 0);
  await toLobby(p);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  check('Settings offers Play Games', await p.locator('[data-pick="cloud"]').innerText() === 'Back up with Play Games');
  await p.locator('[data-pick="cloud"]').click(); await p.waitForTimeout(1000);
  check('which signs in, reads the cloud and uploads', await p.evaluate(() => window.__f.signIns) === 1 && await saved(p) === 1);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  check('then shows who it backs up to', /Backed up · Sonam/.test(await p.locator('[data-pick="cloud"]').innerText()));
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('--- share ---');
{
  const { ctx, p, errs } = await open({ init: FAKES() });
  await p.waitForTimeout(800);
  await toLobby(p);
  check('the lobby has a Share button', await p.locator('.lobby-top [data-share]').isVisible());
  await p.click('.lobby-top [data-share]'); await p.waitForTimeout(200);
  const s = await p.evaluate(() => window.__f.shared[0]);
  check('it opens the share sheet with the Play link', !!s && /play\.google\.com\/store\/apps\/details\?id=/.test(s.text), s?.text);
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  await p.locator('[data-pick="share"]').click(); await p.waitForTimeout(300);
  check('Settings has Share too', await p.evaluate(() => window.__f.shared.length) === 2);
  const ev = await p.evaluate(() => (window.__events || []).filter((e) => e.name === 'share_open').map((e) => e.params.from));
  check('each share is tracked with where it came from', ev.length === 0 || ev.join() === 'lobby,settings', ev.join());
  check('no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{
  const { ctx, p } = await open();
  await p.waitForTimeout(600); await toLobby(p);
  check('without the bridge (a browser, CrazyGames) there is no Share button', !(await p.locator('.lobby-top [data-share]').isVisible()));
  await p.click('.lobby-top [data-settings]'); await p.waitForTimeout(500);
  check('nor a Share or Play Games row in Settings', await p.locator('[data-pick="share"], [data-pick="cloud"]').count() === 0);
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

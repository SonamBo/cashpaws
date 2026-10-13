/**
 * Shared by the CrazyGames tests: serves the built zips (dist/crazygames/full
 * on :8091, basic on :8092), opens pages with the SDK replaced by
 * mock-sdk.js (or blocked), and counts checks.
 *
 *   import { FULL, BASIC, open, check, done, calls } from '<path>/platforms/crazygames/test/harness.mjs';
 */
import pw from 'playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DIST = resolve(process.env.CG_DIST || join(HERE, '../../../dist/crazygames'));
const MOCK = readFileSync(join(HERE, 'mock-sdk.js'), 'utf8');
export const SAVE_KEY = 'cashpaws.save.v2';          // the shell's save key (internal name)
export const BUILD = existsSync(join(DIST, 'build.json')) ? JSON.parse(readFileSync(join(DIST, 'build.json'), 'utf8')) : null;
if (!BUILD) { console.error(`No build in ${DIST}. Run: node platforms/crazygames/build.mjs`); process.exit(2); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const servers = [];
const serve = (dir, port) => new Promise((ok) => {
  const s = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(port, ok);
  servers.push(s);
});
await serve(join(DIST, 'full'), 8091);
await serve(join(DIST, 'basic'), 8092);
export const FULL = 'http://localhost:8091/';
export const BASIC = 'http://localhost:8092/';

let failed = 0;
export const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

export const browser = await pw.chromium.launch();

/**
 * A page on `url`. Options: mock (mock SDK settings), sdk: 'mock' | 'blocked',
 * size [w, h], dev (?dev=1, for setting game state), save (a save to start
 * from), tutorial (leave the first-time tutorial on).
 */
export async function open(url, { mock = {}, sdk = 'mock', size = [1000, 562], dev = false, save = null, tutorial = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  await ctx.route('https://sdk.crazygames.com/**', (r) => (sdk === 'blocked' ? r.abort() : r.fulfill({ contentType: 'text/javascript', body: MOCK })));
  await ctx.addInitScript(`window.__mockCG = ${JSON.stringify(mock)};`);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url + 'privacy.html');
  await p.evaluate(([key, s]) => { localStorage.clear(); if (s) localStorage.setItem(key, s); }, [SAVE_KEY, save]);
  await p.goto(url + (dev ? '?dev=1' : ''));
  await p.waitForFunction(() => document.getElementById('app')?.classList.contains('on-game'), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  if (!tutorial) {
    // Switch off the installed game's first-time tutorial, so its spotlight
    // doesn't hold the clicks a test makes.
    await p.evaluate((id) => {
      if (!window.shell) return;
      shell.flags[id] = { ...(shell.flags[id] || {}), ftue: true };
      shell.reminders.asked = true;
    }, BUILD.game);
    await p.evaluate(() => document.querySelectorAll('.coach').forEach((c) => c.remove()));
  }
  return { ctx, p, errs };
}

export const calls = (p) => p.evaluate(() => window.__mockCG.calls.slice());

export async function done() {
  await browser.close();
  servers.forEach((s) => s.close());
  console.log(failed ? `\n${failed} failed` : '\nall passed');
  process.exit(failed ? 1 : 0);
}

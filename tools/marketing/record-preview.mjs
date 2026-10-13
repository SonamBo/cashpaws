#!/usr/bin/env node
/**
 * Records store preview videos from real gameplay. The game plays itself,
 * following marketing/showcase.mjs, and every frame is captured and encoded
 * to MP4: no sound, no cursor, exact sizes.
 *
 *   node platforms/crazygames/build.mjs
 *   node tools/marketing/record-preview.mjs [--preset crazygames] [--length 18]
 *        [--cover-landscape a.png] [--cover-portrait b.png]
 *
 * Writes marketing/out/<preset>-<shape>.mp4. With covers, each video opens on
 * its cover for one second (CrazyGames asks for that).
 *
 * marketing/showcase.mjs exports:
 *   setup({ page })          optional: put the game in a good-looking state (dev mode is on)
 *   play(api)                plays until api.timeLeft() <= 0
 * where api = { page, tap(selector), key(k), idle(), wait(ms), timeLeft(), shape }.
 */
import pw from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRESET = arg('--preset', 'crazygames');
const LENGTH = Number(arg('--length', 18));
const SITE = join(ROOT, 'dist/crazygames/basic');       // the web build, without ads
const OUT = join(ROOT, 'marketing/out');

// Store video shapes. css × 2 = pixels, so the game draws at 2x and stays sharp.
const PRESETS = {
  crazygames: [
    { shape: '16x9', css: [960, 540], px: [1920, 1080], cover: arg('--cover-landscape') },
    { shape: '2x3', css: [540, 810], px: [1080, 1620], cover: arg('--cover-portrait') },
  ],
  play: [                                                // Play Store promo video (upload to YouTube)
    { shape: '16x9', css: [960, 540], px: [1920, 1080], cover: arg('--cover-landscape') },
  ],
};
const SHOTS = PRESETS[PRESET];
if (!SHOTS) { console.error(`Unknown preset ${PRESET}: ${Object.keys(PRESETS).join(', ')}`); process.exit(2); }
if (!existsSync(join(SITE, 'index.html'))) { console.error('Build the web version first: node platforms/crazygames/build.mjs'); process.exit(2); }
const showcasePath = join(ROOT, 'marketing/showcase.mjs');
if (!existsSync(showcasePath)) { console.error('No marketing/showcase.mjs: see marketing/README.md'); process.exit(2); }
const SHOW = await import(pathToFileURL(showcasePath).href);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(SITE, p);
  if (!f.startsWith(SITE) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => server.listen(8095, ok));
mkdirSync(OUT, { recursive: true });

const game = JSON.parse(readFileSync(join(ROOT, 'dist/crazygames/build.json'), 'utf8')).game;
const b = await pw.chromium.launch();
for (const shot of SHOTS) {
  const ctx = await b.newContext({ viewport: { width: shot.css[0], height: shot.css[1] }, deviceScaleFactor: 2 });
  await ctx.route('https://sdk.crazygames.com/**', (r) => r.abort());
  // An ad bridge with nothing ever ready: dev mode would otherwise put the
  // shell's stand-in ad cards on screen, and a trailer shows no ads.
  await ctx.addInitScript(`window.CashPawsAds = { isEnabled: () => true, rewardedReady: () => false,
    interstitialReady: () => false, showRewarded() {}, showInterstitial() {}, privacyOptionsRequired: () => false,
    showPrivacyOptions() {}, status: () => '{}' };`);
  const page = await ctx.newPage();
  await page.goto('http://localhost:8095/privacy.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:8095/?dev=1');
  await page.waitForFunction(() => document.getElementById('app')?.classList.contains('on-game'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  // No tutorial or reminder prompts in a trailer.
  await page.evaluate((id) => {
    shell.flags[id] = { ...(shell.flags[id] || {}), ftue: true };
    shell.reminders.asked = true;
    document.querySelectorAll('.coach').forEach((c) => c.remove());
  }, game);
  if (SHOW.setup) await SHOW.setup({ page, shape: shot.shape });
  // Out to the lobby and back, so the header shows whatever setup() arranged.
  await page.evaluate(() => window.CashPaws.onBack()); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-play]').click()); await page.waitForTimeout(700);

  // Capture every frame the page paints.
  const dir = join(OUT, `.frames-${shot.shape}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    writeFileSync(join(dir, `${String(frames.length).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    frames.push(metadata.timestamp);
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: shot.px[0], maxHeight: shot.px[1], everyNthFrame: 1 });
  const t0 = Date.now();
  const api = {
    page, shape: shot.shape,
    timeLeft: () => (LENGTH + 0.6) * 1000 - (Date.now() - t0),
    wait: (ms) => page.waitForTimeout(ms),
    idle: () => page.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 5000 }).catch(() => {}),
    tap: (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel),     // a click, without moving a pointer
    key: (k) => page.keyboard.press(k),
  };
  await SHOW.play(api);
  while (api.timeLeft() > 0) await page.waitForTimeout(100);
  await cdp.send('Page.stopScreencast');
  await ctx.close();

  // Encode at the real frame timings, then a constant 30 fps.
  const list = frames.map((t, i) => `file '${String(i).padStart(5, '0')}.jpg'\nduration ${Math.max(0.001, (frames[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`).join('\n')
    + `\nfile '${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  writeFileSync(join(dir, 'list.txt'), list);
  const clip = join(dir, 'gameplay.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt',
    '-vf', `scale=${shot.px[0]}:${shot.px[1]}:flags=lanczos,fps=30,format=yuv420p`, '-t', String(LENGTH),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-an', clip], { cwd: dir });

  const final = join(OUT, `${PRESET}-${shot.shape}.mp4`);
  if (shot.cover) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-t', '1', '-i', resolve(shot.cover), '-i', clip,
      '-filter_complex', `[0:v]scale=${shot.px[0]}:${shot.px[1]}:force_original_aspect_ratio=increase,crop=${shot.px[0]}:${shot.px[1]},fps=30,format=yuv420p,setsar=1[c];[1:v]setsar=1[g];[c][g]concat=n=2:v=1[v]`,
      '-map', '[v]', '-t', String(LENGTH), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-an', final]);
  } else {
    copyFileSync(clip, final);
  }
  rmSync(dir, { recursive: true, force: true });
  const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,codec_name,r_frame_rate:format=duration', '-of', 'csv=p=0', final]).toString().trim().replace(/\n/g, ' | ');
  console.log(`✓ marketing/out/${PRESET}-${shot.shape}.mp4  ${info}${shot.cover ? '' : '  (no cover)'}`);
}
await b.close();
server.close();
process.exit(0);

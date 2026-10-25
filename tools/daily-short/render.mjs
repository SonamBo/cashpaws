#!/usr/bin/env node
/**
 * Render a day's Puzzle of the Day solution as a YouTube Short: 1080x1920,
 * 30 fps, H.264 with the game's own sounds and music, plus its title,
 * description and tags.
 *
 *   node tools/daily-short/render.mjs [--date 2026-10-26] [--out dist/short]
 *
 * The date defaults to today in India (TZ below), which is the day the Short
 * goes out. Needs Playwright's Chromium (draws the frames with the game's
 * own clip.js) and ffmpeg (encodes them). Writes <out>/puzzle-<date>.mp4 and
 * <out>/puzzle-<date>.json.
 */
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import pw from 'playwright';
import { puzzleFor } from '../../www/games/money-sort/puzzle.js';
import data from '../../www/games/money-sort/puzzles.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WWW = join(ROOT, 'www');
const TZ = 'Asia/Kolkata';
const W = 1080, H = 1920, FPS = 30;

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const DATE = arg('date', today);
const OUT = resolve(ROOT, arg('out', 'dist/short'));
mkdirSync(OUT, { recursive: true });

const puzzle = puzzleFor(DATE, data);
const { default: APP } = await import('../../www/app.config.js');
const PLAY = `https://play.google.com/store/apps/details?id=${APP.applicationId}`;

/* A small static server for www/, so the page can import the game's modules. */
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/short.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><link rel="stylesheet" href="/css/tokens.css"><body style="margin:0"><canvas id="c"></canvas>');
    return;
  }
  const file = join(WWW, path);
  if (!file.startsWith(WWW) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/short.html`);

// Lay the clip out and load the art, in the page.
const info = await page.evaluate(async ({ puzzle, W, H }) => {
  await document.fonts.load('900 60px Nunito');
  await document.fonts.load('800 60px Nunito');
  const clip = await import('/games/money-sort/clip.js');
  const chips = Object.fromEntries([1, 5, 10, 20, 50].map((v) => [v, `/games/money-sort/img/chip-${v}.png`]));
  const imgs = await clip.loadClipArt({ chips, tube: '/games/money-sort/img/tube.png', logo: '/img/logo.png', cat: '/img/cat-patch-cheer.png', peek: '/img/cat-patch-peek.png' });
  const tl = clip.buildTimeline({ board: puzzle.board, moves: puzzle.solution, mode: 'solution' });
  const c = document.getElementById('c');
  c.width = W; c.height = H;
  window.__clip = { clip, imgs, tl, ctx: c.getContext('2d'), c, o: { number: puzzle.number, day: puzzle.day, par: puzzle.par, used: puzzle.par, imgs } };
  return { duration: tl.duration, cues: tl.cues };
}, { puzzle, W, H });

const frames = Math.ceil(info.duration * FPS);
const video = join(OUT, `puzzle-${DATE}.mp4`);
const audio = join(OUT, `puzzle-${DATE}.wav`);

// Sound: the game's own effects at each cue, over the shell's music, rendered offline.
const wav = await page.evaluate(async ({ cues, duration }) => {
  const { createSound } = await import('/shell/sound.js');
  const { FX_SOUNDS } = await import('/games/money-sort/fx.js');
  const SR = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil((duration + 0.5) * SR), SR);
  const s = createSound({ context: ctx });
  s.register(FX_SOUNDS);
  s.scheduleMusic(0, Math.ceil(duration / (4 * 60 / 84)));
  for (const c of cues) s.play(c.sound, c.t);
  const buf = await ctx.startRendering();
  const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, str) => [...str].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let bin = '';
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
}, { cues: info.cues, duration: info.duration });
writeFileSync(audio, Buffer.from(wav, 'base64'));

// Frames, drawn by clip.js and piped to ffmpeg as JPEGs.
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', audio,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '18', '-preset', 'medium',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (code) => (code ? rej(new Error(`ffmpeg exited ${code}`)) : res())));
for (let i = 0; i < frames; i += 10) {
  const batch = await page.evaluate(({ from, to, FPS, W, H }) => {
    const { clip, tl, ctx, c, o } = window.__clip;
    const out = [];
    for (let f = from; f < to; f++) {
      clip.drawFrame(ctx, W, H, tl, f / FPS, o);
      out.push(c.toDataURL('image/jpeg', 0.93).split(',')[1]);
    }
    return out;
  }, { from: i, to: Math.min(frames, i + 10), FPS, W, H });
  for (const b of batch) if (!ff.stdin.write(Buffer.from(b, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) process.stdout.write(`${Math.round((i / frames) * 100)}% `);
}
ff.stdin.end();
await done;
await browser.close();
server.close();

// What goes with it on YouTube.
const meta = {
  date: DATE,
  number: puzzle.number,
  title: `Puzzle of the Day #${puzzle.number}: clear it in ${puzzle.par} moves? 🐾💰 #shorts`,
  description: [
    `${puzzle.day}'s Cash Paws puzzle, solved in ${puzzle.par} moves. Did you get it?`,
    '',
    'A new sorting puzzle every day in Cash Paws, the cat-and-cash sort game.',
    `Play free on Google Play: ${PLAY}`,
    '',
    '#CashPaws #PuzzleOfTheDay #SortPuzzle #puzzle #shorts',
  ].join('\n'),
  tags: ['Cash Paws', 'puzzle of the day', 'daily puzzle', 'sort puzzle', 'coin sort', 'cat game', 'brain teaser', 'shorts'],
  video: video.replace(ROOT + '/', ''),
};
writeFileSync(join(OUT, `puzzle-${DATE}.json`), JSON.stringify(meta, null, 2));
console.log(`\n${meta.video}: puzzle #${puzzle.number} (${puzzle.day}), ${puzzle.par} moves, ${info.duration.toFixed(1)} s`);

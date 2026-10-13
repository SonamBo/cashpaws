#!/usr/bin/env node
/**
 * Renders the shell's sound (www/shell/sound.js) to audio files you can
 * listen to, and checks the levels: every effect once, then the music loop,
 * then the music with effects over it.
 *
 *   node serve.js 8080 &           (the dev server)
 *   node tools/sound-preview.mjs   → dist/sound/sound-preview.wav and .mp3
 *
 * It fails if anything clips (peak at or above 0 dBFS) or if an effect is
 * silent, so a change to sound.js can be checked without speakers.
 */
import pw from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist/sound');
mkdirSync(OUT, { recursive: true });

const b = await pw.chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:8080/css/tokens.css');
const res = await p.evaluate(async () => {
  const { createSound } = await import('/shell/sound.js');
  const SR = 44100;
  const names = ['tap', 'lift', 'drop', 'bank', 'levelup', 'celebrate', 'setback', 'flow', 'sort', 'undo', 'error', 'coin', 'open', 'unlock'];
  const GAP = 1.1;                                   // seconds per effect
  const fxEnd = names.length * GAP;
  const musicBars = 8;
  const BAR = 4 * 60 / 84;
  const total = fxEnd + 0.5 + musicBars * BAR + 1;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
  const s = createSound({ context: ctx });
  names.forEach((n, i) => s.play(n, i * GAP));
  const musicAt = fxEnd + 0.5;
  s.scheduleMusic(musicAt, musicBars);
  // Over the second half of the music, effects as in real play.
  ['drop', 'drop', 'bank', 'drop', 'levelup'].forEach((n, i) => s.play(n, musicAt + 4 * BAR + i * 1.3));
  const buf = await ctx.startRendering();

  const L = buf.getChannelData(0);
  const seg = (a, z) => {
    let peak = 0, sum = 0;
    const i0 = Math.floor(a * SR), i1 = Math.min(L.length, Math.floor(z * SR));
    for (let i = i0; i < i1; i++) { const v = Math.abs(L[i]); if (v > peak) peak = v; sum += L[i] * L[i]; }
    const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
    return { peak: +db(peak).toFixed(1), rms: +db(Math.sqrt(sum / Math.max(1, i1 - i0))).toFixed(1) };
  };
  const report = {
    effects: Object.fromEntries(names.map((n, i) => [n, seg(i * GAP, i * GAP + GAP)])),
    music: seg(musicAt, musicAt + 4 * BAR),
    mix: seg(musicAt + 4 * BAR, musicAt + 8 * BAR),
    whole: seg(0, total),
  };

  // 16-bit WAV, stereo.
  const n = buf.length, ch = 2;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, str) => [...str].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, SR, true); data.setUint32(28, SR * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { data.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 0x7fff, true); o += 2; }
  let bin = '';
  const bytes = new Uint8Array(data.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { report, wav: btoa(bin) };
});
await b.close();

const wav = join(OUT, 'sound-preview.wav');
writeFileSync(wav, Buffer.from(res.wav, 'base64'));
try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '160k', join(OUT, 'sound-preview.mp3')]); } catch { /* wav is enough */ }

const r = res.report;
console.log('effect       peak dB   rms dB');
for (const [k, v] of Object.entries(r.effects)) console.log(`  ${k.padEnd(10)} ${String(v.peak).padStart(6)}   ${String(v.rms).padStart(6)}`);
console.log(`  music      ${String(r.music.peak).padStart(6)}   ${String(r.music.rms).padStart(6)}`);
console.log(`  music+fx   ${String(r.mix.peak).padStart(6)}   ${String(r.mix.rms).padStart(6)}`);
const problems = [];
if (r.whole.peak >= -0.1) problems.push(`clipping: peak ${r.whole.peak} dBFS`);
for (const [k, v] of Object.entries(r.effects)) if (v.peak < -40) problems.push(`${k} is nearly silent (${v.peak} dB)`);
if (r.music.rms < -45) problems.push(`music is nearly silent (${r.music.rms} dB rms)`);
console.log(problems.length ? `\n✗ ${problems.join('; ')}` : `\n✓ no clipping, every effect audible → dist/sound/sound-preview.wav`);
process.exit(problems.length ? 1 : 0);

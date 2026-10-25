#!/usr/bin/env node
/**
 * Builds the starter: this repo with Cash Paws taken out, for anyone building
 * a different game on the same shell (analytics, ads, Bell Quest, daily tasks,
 * Rewards Box, reminders, the Android app and the CI pipeline).
 *
 *   node tools/export-starter.mjs <folder>
 *
 * <folder> is normally a clone of the starter repo. Everything in it except
 * .git is replaced, so commit the result and every change to the shell shows
 * up as an ordinary diff. Apps built from the starter pull those diffs with
 * `git pull upstream main` (see SETUP.md), and because every shared file is
 * byte-for-byte the same as here, the pull never touches their game.
 *
 * Three kinds of file:
 *   shared   copied as-is: the shell, Android, CI, tests, the docs about them.
 *   private  never leaves this repo: Money Sort, Cash Paws' keys and IDs, its
 *            store listing, privacy policy and history.
 *   owned    the starter's own version from tools/starter/: the app config,
 *            the installed game, placeholder logo and icons, README, privacy
 *            policy template. An app built from the starter edits these freely.
 *
 * .github/workflows/starter.yml runs this after every green build of Cash
 * Paws and pushes the result, so nobody has to remember to.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OVERLAY = join(ROOT, 'tools/starter');
const target = process.argv[2];
if (!target) {
  console.error('usage: node tools/export-starter.mjs <folder>');
  process.exit(2);
}
const OUT = resolve(target);
if (OUT === ROOT || OUT.startsWith(ROOT + '/')) {
  console.error('The starter must be exported outside this repo.');
  process.exit(2);
}

/** Never exported. A trailing slash means the whole folder. */
const PRIVATE = [
  // build output and local state
  '.git/', 'node_modules/', 'cashpaws.html', 'game.html', 'android/.gradle/', 'android/build/', 'android/app/build/',
  'android/app/src/main/assets/www/', 'android/local.properties', '.DS_Store',
  // the game
  'www/games/money-sort/', 'test/games/money-sort/',
  // Cash Paws' accounts and keys
  'android/app/google-services.json', 'android/ads.properties', 'www/img/share.jpg',
  // Cash Paws' store presence, history and art pipeline
  'PROGRESS.md', 'PUSH.md', 'PLAY-STORE.md', 'play-assets/',
  'docs/store-listing.md', 'docs/privacy-policy/', 'docs/LEVEL-DESIGN.md', 'docs/ROADMAP.md', 'docs/DESIGN.md',
  'docs/shots/', 'docs/BELL-QUEST-ART-PROMPTS.md', 'docs/CAT-ART-PROMPTS.md', 'docs/MODIFIER-ART-PROMPTS.md', 'docs/HIRES-ART-PROMPTS.md',
  'tools/art-src/', 'tools/process-modifier-art.py', 'tools/tune.mjs', 'tools/quest-sim.mjs',
  // Money Sort's Puzzle of the Day Shorts (its puzzles and clip live in the game's folder)
  'tools/daily-short/', '.github/workflows/daily-short.yml',
  // Cash Paws' own marketing (the starter gets a template from tools/starter/marketing)
  'marketing/', 'dist/',
  // this exporter and its sync
  'tools/starter/', 'tools/export-starter.mjs', '.github/workflows/starter.yml',
];

const isPrivate = (rel) => PRIVATE.some((p) => (p.endsWith('/') ? rel === p.slice(0, -1) || rel.startsWith(p) : rel === p || rel.endsWith('/' + p)));

function walk(dir, base, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(base, abs).split('\\').join('/');
    if (isPrivate(rel) || isPrivate(rel + '/')) continue;
    if (statSync(abs).isDirectory()) walk(abs, base, out);
    else out.push(rel);
  }
  return out;
}

// 1. Empty the target, keeping its git history.
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) if (name !== '.git') rmSync(join(OUT, name), { recursive: true, force: true });

// 2. Shared files.
const shared = walk(ROOT, ROOT);
for (const rel of shared) {
  mkdirSync(dirname(join(OUT, rel)), { recursive: true });
  cpSync(join(ROOT, rel), join(OUT, rel));
}

// 3. The starter's own files, over the top.
const owned = [];
(function overlay(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(OVERLAY, abs).split('\\').join('/');
    if (statSync(abs).isDirectory()) { overlay(abs); continue; }
    mkdirSync(dirname(join(OUT, rel)), { recursive: true });
    cpSync(abs, join(OUT, rel));
    owned.push(rel);
  }
})(OVERLAY);

// 4. Which shell this is, so an app can tell what it has pulled.
const app = JSON.parse(readFileSync(join(ROOT, 'www/app.config.js'), 'utf8')
  .replace(/^\s*\/\/.*$/gm, '').replace(/^[\s\S]*?export default/, '').replace(/;\s*$/, ''));
writeFileSync(join(OUT, 'SHELL-VERSION'), `${app.versionName}\n`);

// 5. Nothing of Cash Paws may be left in a file the starter ships.
const LEAKS = [/pixelartgames000/, /cash-paws-prod/, /5379524261124242/, /SonamBo/];
const leaks = [];
for (const rel of [...shared, ...owned]) {
  if (!/\.(js|mjs|json|md|kt|java|gradle|xml|yml|html|css|properties|txt)$/.test(rel)) continue;
  const text = readFileSync(join(OUT, rel), 'utf8');
  for (const re of LEAKS) if (re.test(text) && !ALLOWED_LEAK(rel)) leaks.push(`${rel}: ${re}`);
}
function ALLOWED_LEAK(rel) {
  // The pre-flight names Cash Paws' IDs precisely so it can refuse them.
  return rel === 'test/preflight.js';
}
if (leaks.length) {
  console.error('Cash Paws details would leak into the starter:\n  ' + leaks.join('\n  '));
  process.exit(1);
}

console.log(`Starter written to ${OUT}`);
console.log(`  ${shared.length} shared files, ${owned.length} starter files, shell ${app.versionName}`);

#!/usr/bin/env node
/**
 * Pre-flight. Asserts that every file the build REQUIRES is present.
 *
 * This exists because a shell mistake once wrote the Gradle root files to the
 * wrong directory, and the review that followed only validated files that were
 * there — it never asked whether anything was missing. CI then failed with
 * "does not contain a Gradle build". Checking presence is the whole point.
 *
 * Run: node test/preflight.js
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const notes = [];

function need(rel, why) {
  if (!existsSync(join(ROOT, rel))) fails.push(`MISSING  ${rel}  — ${why}`);
}

function needContains(rel, needle, why) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return fails.push(`MISSING  ${rel}  — ${why}`);
  if (!readFileSync(p, 'utf8').includes(needle)) {
    fails.push(`CONTENT  ${rel} does not contain "${needle}"  — ${why}`);
  }
}

/* --- the Gradle build must be discoverable --- */
need('android/settings.gradle', 'without it Gradle reports "does not contain a Gradle build"');
need('android/build.gradle', 'declares the AGP and Kotlin plugin versions');
need('android/gradle.properties', 'sets androidx and JVM options');
need('android/app/build.gradle', 'the app module');
needContains('android/settings.gradle', "include ':app'", 'the app module must be included');
needContains('android/build.gradle', 'com.android.application', 'the Android plugin must be declared');
needContains('android/app/build.gradle', 'copyWebApp', 'the web app must be synced into assets');

/* --- the Android app itself --- */
need('android/app/src/main/AndroidManifest.xml', 'no manifest, no app');
need('android/app/src/main/java/com/cashpaws/game/MainActivity.kt', 'the only Activity');
need('android/app/proguard-rules.pro', 'referenced by the release build type');
for (const f of [
  'values/strings.xml', 'values/colors.xml', 'values/themes.xml',
  'drawable/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml',
  'mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml',
  'xml/backup_rules.xml', 'xml/data_extraction_rules.xml',
]) need(`android/app/src/main/res/${f}`, 'referenced from the manifest or a theme');

/* --- the game --- */
need('.github/workflows/android.yml', 'no workflow means no APK is ever built');

/* --- launcher icon at every density --- */
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const f of ['ic_fg.png', 'ic_launcher.png', 'ic_launcher_round.png']) {
    need(`android/app/src/main/res/mipmap-${d}/${f}`, 'launcher icon');
  }
}
needContains('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', '@mipmap/ic_fg',
  'the adaptive icon must point at the bitmap foreground');
need('www/index.html', 'the entry point the WebView loads');
for (const f of ['engine.js', 'render.js', 'app.js', 'overlays.js', 'tabs.js', 'art.js', 'lobby.js'])
  need(`www/js/${f}`, 'imported by the app');
for (const f of ['tokens.css', 'board.css', 'overlays.css']) need(`www/css/${f}`, 'linked from index.html');
for (const v of [1, 5, 10, 20, 50]) {
  need(`www/img/chip-${v}.png`, `chip artwork for $${v}`);
  need(`www/img/chipb-${v}.png`, `alternate chip artwork for $${v}`);
}
for (const f of ['cat-avatar', 'cat-sad', 'cat-hero', 'cat-cheer', 'coin', 'logo', 'tagline',
                 'ref-cat', 'ref-heart', 'tube', 'knob-cat'])
  need(`www/img/${f}.png`, 'referenced by art.js, the board or the lobby');
need('www/img/bg-room.jpg', 'the room background');

/* --- every asset referenced in code or CSS must exist on disk --- */
const refs = new Set();
const scan = (text) => {
  for (const m of text.matchAll(/img\/([\w-]+)\.(png|jpg|jpeg)/g)) refs.add(`${m[1]}.${m[2]}`);
};
for (const f of readdirSync(join(ROOT, 'www/js'))) scan(readFileSync(join(ROOT, 'www/js', f), 'utf8'));
for (const f of readdirSync(join(ROOT, 'www/css'))) scan(readFileSync(join(ROOT, 'www/css', f), 'utf8'));
scan(readFileSync(join(ROOT, 'www/index.html'), 'utf8'));
for (const r of refs) {
  if (!existsSync(join(ROOT, 'www/img', r))) {
    fails.push(`MISSING  www/img/${r}  — referenced in code or CSS but not on disk`);
  }
}
notes.push(`${refs.size} image references checked against disk`);

/* --- nothing the build needs may be gitignored --- */
const ignores = ['.gitignore', 'android/.gitignore']
  .filter((f) => existsSync(join(ROOT, f)))
  .flatMap((f) => readFileSync(join(ROOT, f), 'utf8').split('\n'))
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
for (const pat of ignores) {
  if (['build.gradle', 'settings.gradle', '*.gradle', 'android'].includes(pat)) {
    fails.push(`IGNORED  .gitignore rule "${pat}" would exclude part of the build`);
  }
}
notes.push(`${ignores.length} ignore rules checked`);

console.log('Cash Paws pre-flight\n');
notes.forEach((n) => console.log('  ' + n));
console.log('');
if (fails.length === 0) {
  console.log('All required files present. Safe to push.');
  process.exit(0);
}
fails.forEach((f) => console.log('  ' + f));
console.log(`\n${fails.length} problem(s). Fix before pushing.`);
process.exit(1);

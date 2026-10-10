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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
const posixJoin = (from, spec) => posix.normalize(posix.join(posix.dirname(from), spec));
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
need('android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt', 'the only Activity');

/* --- namespace, applicationId and the Kotlin package must agree --- */
{
  const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
  const ns = gradle.match(/namespace\s+'([\w.]+)'/)?.[1];
  const appId = gradle.match(/applicationId\s+"([\w.]+)"/)?.[1];
  const ktPath = `android/app/src/main/java/${(ns || '').replace(/\./g, '/')}/MainActivity.kt`;
  if (!ns || !appId) {
    fails.push('CONTENT  build.gradle is missing a namespace or applicationId');
  } else {
    if (!existsSync(join(ROOT, ktPath))) {
      fails.push(`MISSING  ${ktPath}  — the Activity must sit in the namespace's folder`);
    } else {
      const pkg = readFileSync(join(ROOT, ktPath), 'utf8').match(/^package\s+([\w.]+)/m)?.[1];
      if (pkg !== ns) {
        fails.push(`CONTENT  MainActivity declares package "${pkg}" but the namespace is "${ns}"`);
      }
    }
      const vc = gradle.match(/versionCode\s+(\d+)/)?.[1];
    const vn = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
    notes.push(`package ${ns}, published as ${appId}`);
    notes.push(`versionCode ${vc}, versionName ${vn} — Play rejects a repeated versionCode`);
  }
}
need('android/app/proguard-rules.pro', 'referenced by the release build type');
for (const f of [
  'values/strings.xml', 'values/colors.xml', 'values/themes.xml',
  'drawable/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml',
  'mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml',
  'xml/backup_rules.xml', 'xml/data_extraction_rules.xml',
]) need(`android/app/src/main/res/${f}`, 'referenced from the manifest or a theme');

/* --- the game --- */
need('.github/workflows/android.yml', 'no workflow means no APK is ever built');

/* --- Kotlin: new enough for the libraries, and syntax it accepts --- */
{
  // The ad SDK (25.x) and Firebase ship Kotlin 2.2/2.3 metadata; a compiler
  // reads one version ahead at most, so it must be 2.2 or newer (1.13.0 failed
  // on 2.0.21). And 2.2 made `kotlinOptions {}` an error.
  const root = readFileSync(join(ROOT, 'android/build.gradle'), 'utf8');
  const kv = root.match(/org\.jetbrains\.kotlin\.android'\s+version\s+'(\d+)\.(\d+)\.?(\d*)'/);
  if (!kv) fails.push('CONTENT  android/build.gradle does not pin the Kotlin plugin version');
  else if (+kv[1] < 2 || (+kv[1] === 2 && +kv[2] < 2)) {
    fails.push(`CONTENT  Kotlin ${kv[1]}.${kv[2]} can't read the ad SDK's Kotlin 2.3 metadata — use 2.2 or newer`);
  } else notes.push(`Kotlin ${kv[1]}.${kv[2]}.${kv[3]}`);
  const app = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8').replace(/\/\/.*$/gm, '');
  // registerForActivityResult needs androidx.fragment 1.3+; the ad SDK brings an
  // older one, and release lint (InvalidFragmentVersionForActivityResult) fails.
  const fr = app.match(/androidx\.fragment:fragment(?:-ktx)?:(\d+)\.(\d+)/);
  if (!fr || +fr[1] < 1 || (+fr[1] === 1 && +fr[2] < 3)) fails.push('CONTENT  app/build.gradle must pin androidx.fragment 1.3+ (release lint fails on the ad SDK\'s old one)');
  if (/kotlinOptions\s*\{/.test(app)) fails.push('CONTENT  app/build.gradle uses kotlinOptions {}, an error since Kotlin 2.2 — use kotlin { compilerOptions {} }');

  const kt = readFileSync(join(ROOT, 'android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt'), 'utf8');
  // An underscore catch parameter: keep parameters named, as older compilers reject "_".
  if (/catch\s*\(\s*_\s*:/.test(kt)) {
    fails.push('CONTENT  MainActivity.kt uses catch (_: ...) — name the parameter');
  }
}

/* --- the privacy policy Play requires must stay reachable in the app --- */
needContains('www/shell/overlays.js', 'PRIVACY_URL', 'the settings sheet must link the privacy policy');
needContains('android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt', 'ACTION_VIEW',
  'external links must be handed to the browser; the app has no internet permission');
/* --- ads: since 1.5.0 the app requests INTERNET for AppLovin. The old guard
       that forbade it is retired; what matters now is that nothing we publish
       still claims the app has no ads or no internet. --- */
{
  const man = readFileSync(join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  if (man.includes('android.permission.INTERNET')) {
    const claims = [/AppLovin/, /\bno ads\b/i, /no internet/i, /does not even request internet/i, /nothing you do[^.]*leaves/i];
    for (const f of ['docs/store-listing.md', 'PLAY-STORE.md']) {
      if (!existsSync(join(ROOT, f))) continue;
      const text = readFileSync(join(ROOT, f), 'utf8');
      for (const re of claims) {
        if (re.test(text)) fails.push(`CLAIM    ${f} still says "${text.match(re)[0]}", but the app now serves ads over the internet`);
      }
    }
  }
  // Google AdMob (1.12): pinned SDK, the app ID in the manifest, real IDs
  // in release, Google's test IDs in debug.
  const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
  const sdk = gradle.match(/play-services-ads:([^'"]+)/)?.[1];
  if (!sdk) fails.push('CONTENT  build.gradle does not depend on the Google Mobile Ads SDK');
  else if (sdk.includes('+')) fails.push(`CONTENT  Mobile Ads SDK version "${sdk}" is not pinned`);
  else notes.push(`Google Mobile Ads SDK ${sdk}`);
  if (/applovin/i.test(gradle)) fails.push('CONTENT  build.gradle still pulls in AppLovin');
  if (!gradle.includes('ca-app-pub-3940256099942544~3347511713') || !gradle.includes('ca-app-pub-3940256099942544/5224354917')) {
    fails.push('CONTENT  debug builds must use Google\'s test app ID and test rewarded unit');
  }
  needContains('android/app/src/main/AndroidManifest.xml', 'com.google.android.gms.ads.APPLICATION_ID',
    'the SDK crashes at launch without the AdMob app ID in the manifest');
  need('android/ads.properties', 'the AdMob IDs for release builds');
  need('android/app/src/main/java/com/pixelartgames/cashpaw/Ads.java', 'the native ad bridge');
  // The bridge's name has to match on both sides, or ads silently never appear.
  needContains('android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt', '"CashPawsAds"', 'the Activity must expose the bridge');
  needContains('www/shell/ads.js', 'CashPawsAds', 'the shell must look for the same bridge name');
  const props = existsSync(join(ROOT, 'android/ads.properties')) ? readFileSync(join(ROOT, 'android/ads.properties'), 'utf8') : '';
  const appId = props.match(/^appId=(\S*)/m)?.[1] || '';
  const unit = props.match(/^rewardedAdUnit=(\S*)/m)?.[1] || '';
  if (appId && !/^ca-app-pub-\d{16}~\d{10}$/.test(appId)) fails.push(`CONTENT  ads.properties appId "${appId}" is not an AdMob app ID (ca-app-pub-…~…)`);
  if (unit && !/^ca-app-pub-\d{16}\/\d{10}$/.test(unit)) fails.push(`CONTENT  ads.properties rewardedAdUnit "${unit}" is not an ad unit ID (ca-app-pub-…/…)`);
  if (appId && unit && appId.split('~')[0] !== unit.split('/')[0]) fails.push('CONTENT  the app ID and ad unit ID belong to different AdMob accounts');
  if (unit && !appId) fails.push('CONTENT  ads.properties has an ad unit but no appId: release ads would never serve');
  if (/3940256099942544/.test(props)) fails.push('CONTENT  ads.properties holds Google\'s TEST IDs: release builds must use your own');
  notes.push(unit ? `ads: release builds serve AdMob unit ${unit}` : 'ads: no ad unit in android/ads.properties — release builds show no ads');
  // Interstitials (1.13): well-formed, same account, test unit in debug, and
  // no listing or policy that still promises every ad is optional.
  const inter = props.match(/^interstitialAdUnit=(\S*)/m)?.[1] || '';
  if (inter && !/^ca-app-pub-\d{16}\/\d{10}$/.test(inter)) fails.push(`CONTENT  ads.properties interstitialAdUnit "${inter}" is not an ad unit ID`);
  if (inter && appId && inter.split('/')[0] !== appId.split('~')[0]) fails.push('CONTENT  the interstitial unit belongs to a different AdMob account');
  if (inter && inter === unit) fails.push('CONTENT  the interstitial and rewarded units are the same ID');
  if (!gradle.includes('ca-app-pub-3940256099942544/1033173712')) fails.push('CONTENT  debug builds must use Google\'s test interstitial unit');
  if (inter) {
    const promises = [/only when you (want|choose)/i, /only if you want/i, /every ad[^.]*(optional|your choice)/i, /never see one/i];
    for (const f of ['docs/store-listing.md', 'docs/PRIVACY-POLICY.md', 'PLAY-STORE.md']) {
      const text = readFileSync(join(ROOT, f), 'utf8').replace(/Until 1\.12[^]*?gone\./, '');
      for (const re of promises) if (re.test(text)) fails.push(`CLAIM    ${f} says "${text.match(re)[0]}", but interstitials are on`);
    }
    notes.push(`ads: interstitial ${inter}, after level 10, every 2.5 min of play`);
  }
}

/* --- Firebase (1.8.0): the config must cover every build, and the privacy
       policy must say so before any event leaves a phone. --- */
{
  const cfgPath = 'android/app/google-services.json';
  if (!existsSync(join(ROOT, cfgPath))) fails.push(`MISSING  ${cfgPath} — download it from the Firebase console`);
  else {
    const cfg = JSON.parse(readFileSync(join(ROOT, cfgPath), 'utf8'));
    const pkgs = cfg.client.map((c) => c.client_info.android_client_info.package_name);
    const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
    const appId = gradle.match(/applicationId\s+"([^"]+)"/)?.[1];
    const suffix = gradle.match(/applicationIdSuffix\s+"([^"]+)"/)?.[1] || '';
    for (const want of [appId, appId + suffix]) {
      if (!pkgs.includes(want)) fails.push(`CONTENT  ${cfgPath} has no app for ${want} — add it in Firebase and download the file again`);
    }
    notes.push(`Firebase project ${cfg.project_info.project_id}: ${pkgs.join(', ')}`);
  }
  const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
  const bom = gradle.match(/firebase-bom:([^'"]+)/)?.[1];
  if (!bom || bom.includes('+')) fails.push('CONTENT  the Firebase BoM must be present and pinned');
  needContains('android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt', '"CashPawsAnalytics"', 'the Activity must expose the analytics bridge');
  needContains('www/shell/analytics.js', 'CashPawsAnalytics', 'the shell must look for the same bridge name');
  needContains('docs/PRIVACY-POLICY.md', 'Firebase', 'the privacy policy must disclose Firebase');
}

/* --- reminders (1.10.0): the bridge names match, and Android 13 can ask --- */
needContains('android/app/src/main/java/com/pixelartgames/cashpaw/MainActivity.kt', '"CashPawsNotify"', 'the Activity must expose the reminders bridge');
needContains('www/shell/notify.js', 'CashPawsNotify', 'the shell must look for the same bridge name');
needContains('android/app/src/main/AndroidManifest.xml', 'POST_NOTIFICATIONS', 'Android 13+ needs the permission declared to ask for it');
need('android/app/src/main/res/drawable/ic_notify.xml', 'the white notification icon');

/* --- launcher icon at every density --- */
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const f of ['ic_fg.png', 'ic_launcher.png', 'ic_launcher_round.png']) {
    need(`android/app/src/main/res/mipmap-${d}/${f}`, 'launcher icon');
  }
}
needContains('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', '@mipmap/ic_fg',
  'the adaptive icon must point at the bitmap foreground');
need('www/index.html', 'the entry point the WebView loads');
needContains('www/index.html', 'shell/main.js', 'the page must boot the shell');
for (const f of ['tokens.css', 'shell.css']) need(`www/css/${f}`, 'linked from index.html');
for (const f of ['main', 'host', 'wallet', 'save', 'header', 'lobby', 'tabs', 'overlays', 'cats', 'art', 'assets', 'ads', 'daily', 'rewards'])
  need(`www/shell/${f}.js`, 'part of the shell');
for (const f of ['cat-hero', 'coin', 'logo', 'tagline']) need(`www/img/${f}.png`, 'shell artwork');
need('www/img/bg-room.jpg', 'the room background');

/* --- the installed game, and every game folder, must honour the contract --- */
const IMPORT_RE = /^\s*(?:import|export)\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm;
const jsIn = (dir) => {
  const out = [];
  if (!existsSync(join(ROOT, dir))) return out;
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${f}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...jsIn(rel));
    else if (f.endsWith('.js')) out.push(rel);
  }
  return out;
};

{
  need('www/games/active.js', 'names the installed game');
  const active = readFileSync(join(ROOT, 'www/games/active.js'), 'utf8').match(/from\s+['"]\.\/([^/'"]+)\//)?.[1];
  if (!active) fails.push('CONTENT  www/games/active.js does not point at a game folder');
  else if (!existsSync(join(ROOT, `www/games/${active}/index.js`))) {
    fails.push(`MISSING  www/games/${active}/index.js  — active.js points at a game that is not there`);
  } else notes.push(`installed game: ${active}`);

  const games = readdirSync(join(ROOT, 'www/games')).filter((d) => statSync(join(ROOT, 'www/games', d)).isDirectory());
  for (const g of games) {
    const index = `www/games/${g}/index.js`;
    if (!existsSync(join(ROOT, index))) { fails.push(`MISSING  ${index}  — every game folder needs one`); continue; }
    const src = readFileSync(join(ROOT, index), 'utf8');
    // The folder name is the id: assets and the save slot are found by it.
    const id = src.match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
    if (id !== g) fails.push(`CONTENT  ${index} declares id "${id}" but lives in folder "${g}"`);
    for (const k of ['saveVersion', 'create(']) {
      if (!src.includes(k)) fails.push(`CONTENT  ${index} is missing ${k.replace('(', '()')}, which the shell requires`);
    }
    const styles = ((src.match(/styles:\s*\[([^\]]*)\]/) || [])[1] || '')
      .split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    for (const f of styles) need(`www/games/${g}/${f}`, `${g} lists it in styles`);

    // Daily tasks: every task needs a tier the shell knows, a stat and a target,
    // or it can never be drawn — or never be finished.
    const tasksBlock = (src.match(/tasks:\s*\[([\s\S]*?)\n\s*\],/) || [])[1] || '';
    const tasks = [...tasksBlock.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]);
    for (const t of tasks) {
      const tid = t.match(/id:\s*'([^']+)'/)?.[1] || '?';
      const tier = t.match(/tier:\s*'([^']+)'/)?.[1];
      if (!['easy', 'medium', 'hard'].includes(tier)) fails.push(`TASKS    ${g}: task "${tid}" has tier "${tier}" — use easy, medium or hard`);
      if (!/stat:\s*'[^']+'/.test(t)) fails.push(`TASKS    ${g}: task "${tid}" names no stat`);
      if (!/target:\s*[1-9]/.test(t)) fails.push(`TASKS    ${g}: task "${tid}" has no positive target`);
    }
    if (tasks.length) {
      const tiers = new Set(tasks.map((t) => t.match(/tier:\s*'([^']+)'/)?.[1]));
      const missing = ['easy', 'medium', 'hard'].filter((x) => !tiers.has(x));
      if (missing.length) notes.push(`${g}: no ${missing.join('/')} tasks — its daily set will be short`);
    }

    // A game reaches the shell only through host. Importing the shell, or a
    // sibling game, is what would stop games being swappable.
    for (const file of jsIn(`www/games/${g}`)) {
      const code = readFileSync(join(ROOT, file), 'utf8');
      for (const [, spec] of code.matchAll(IMPORT_RE)) {
        const target = posixJoin(file, spec);
        if (!target.startsWith(`www/games/${g}/`)) {
          fails.push(`BOUNDARY ${file} imports ${spec} — a game may only import from its own folder`);
        }
      }
    }

    // Asset literals and stylesheet urls must exist inside the game's folder.
    const refs = new Set();
    for (const file of jsIn(`www/games/${g}`)) {
      for (const [, r] of readFileSync(join(ROOT, file), 'utf8').matchAll(/host\.asset\(\s*['"`]([^'"`$]+)['"`]\s*\)/g)) refs.add(r);
    }
    for (const f of styles) {
      for (const [, r] of readFileSync(join(ROOT, `www/games/${g}/${f}`), 'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (!/^(data:|https?:)/.test(r)) refs.add(r);
      }
    }
    for (const r of refs) need(`www/games/${g}/${r}`, `${g} refers to it`);
  }
  notes.push(`${games.length} game folders checked: ${games.join(', ')}`);
}

/* --- the shell never imports a game, except through active.js --- */
for (const file of jsIn('www/shell')) {
  const code = readFileSync(join(ROOT, file), 'utf8');
  for (const [, spec] of code.matchAll(IMPORT_RE)) {
    const target = posixJoin(file, spec);
    if (target.startsWith('www/games/') && target !== 'www/games/active.js') {
      fails.push(`BOUNDARY ${file} imports ${spec} — the shell must only reach games through active.js`);
    }
  }
}

/* --- Money Sort's chip art, which it builds by name at runtime --- */
for (const v of [1, 5, 10, 20, 50]) {
  need(`www/games/money-sort/img/chip-${v}.png`, `chip artwork for $${v}`);
  need(`www/games/money-sort/img/chipb-${v}.png`, `paper chip artwork for $${v}`);
}

/* --- cat art: every cat flagged hasArt must have all four poses --- */
{
  const src = readFileSync(join(ROOT, 'www/shell/cats.js'), 'utf8');
  const cats = [...src.matchAll(/id:\s*'([\w-]+)',\s*name:\s*'[^']*',\s*hasArt:\s*(true|false)/g)];
  if (!cats.length) fails.push('CONTENT  shell/cats.js declares no cats with a hasArt flag');
  for (const [, id, has] of cats) {
    if (has !== 'true') continue;
    for (const pose of ['peek', 'cheer', 'slump', 'face']) {
      need(`www/img/cat-${id}-${pose}.png`, `${id} is flagged hasArt but is missing its ${pose} pose`);
    }
  }
  notes.push(`${cats.length} cats declared, ${cats.filter((m) => m[2] === 'true').length} with artwork`);
}

/* --- literal image references in the shell must exist --- */
{
  const refs = new Set();
  const scan = (t) => { for (const m of t.matchAll(/['"(]((?:\.\.\/)?img\/[\w-]+\.(?:png|jpg|jpeg))/g)) refs.add(m[1].replace('../', '')); };
  for (const f of jsIn('www/shell')) scan(readFileSync(join(ROOT, f), 'utf8'));
  for (const f of readdirSync(join(ROOT, 'www/css'))) scan(readFileSync(join(ROOT, 'www/css', f), 'utf8'));
  for (const r of refs) need(`www/${r}`, 'referenced by the shell');
  notes.push(`${refs.size} shell image references checked`);
}

/* --- the version the app reports matches the one Play sees --- */
{
  const main = readFileSync(join(ROOT, 'www/shell/main.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
  const gradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8').match(/versionName\s+"([^"]+)"/)?.[1];
  if (main !== gradle) {
    fails.push(`CONTENT  shell/main.js says version ${main} but build.gradle says ${gradle} — keep them equal`);
  }
}

/* --- leftover source from old package names still gets compiled --- */
{
  const base = join(ROOT, 'android/app/src/main/java');
  const walk = (d) => readdirSync(d).flatMap((n) => {
    const f = join(d, n);
    return statSync(f).isDirectory() ? walk(f) : [f.slice(base.length + 1)];
  });
  const stray = existsSync(base)
    ? walk(base).filter((f) => /\.(kt|java)$/.test(f) && !f.startsWith('com/pixelartgames/cashpaw/'))
    : [];
  stray.forEach((f) => notes.push(`WARNING  stray source file android/app/src/main/java/${f}, left from an old package name. Delete it (git rm).`));
}

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

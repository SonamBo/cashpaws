#!/usr/bin/env node
/**
 * Builds the CrazyGames upload for whatever game is installed. Nothing in
 * www/ or android/ is changed: everything happens to a copy.
 *
 *   node platforms/crazygames/build.mjs [--out <dir>] [--serve [--basic]]
 *
 * Output (default <repo>/dist/crazygames/):
 *   <app>-crazygames-basic.zip    Basic Launch: no ads at all (CrazyGames has them off then)
 *   <app>-crazygames-full.zip     Full Launch: CrazyGames rewarded and midgame ads
 *   basic/, full/               the same, unzipped, for testing
 *
 * The game's www/games/<id>/web.json adds its keys, wording changes and PC
 * styles (see platforms/crazygames/README.md). --serve plays the result on
 * http://localhost:8090.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const WWW = join(ROOT, 'www');
const PAGE = join(HERE, 'page');
const argAt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const DIST = resolve(argAt('--out') || join(ROOT, 'dist/crazygames'));

const die = (msg) => { console.error('\n✗ ' + msg); process.exit(1); };
const readConfig = (path) => JSON.parse(readFileSync(path, 'utf8')
  .replace(/^\s*\/\/.*$/gm, '').replace(/^[\s\S]*?export default/, '').replace(/;\s*$/, ''));
const APP = readConfig(join(WWW, 'app.config.js'));
const ACTIVE = readFileSync(join(WWW, 'games/active.js'), 'utf8').match(/from\s+['"]\.\/([^/'"]+)\//)?.[1];
if (!ACTIVE) die('www/games/active.js names no game');
const SLUG = APP.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ACTIVE;
const SHELL = JSON.parse(readFileSync(join(HERE, 'overrides.json'), 'utf8'));
const gameWebPath = join(WWW, 'games', ACTIVE, 'web.json');
const GAME = existsSync(gameWebPath) ? JSON.parse(readFileSync(gameWebPath, 'utf8')) : {};
if (!existsSync(gameWebPath)) console.log(`  (no www/games/${ACTIVE}/web.json: no game keys or PC styles; see platforms/crazygames/README.md)`);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

function applyOverride(out, r, kind, origin) {
  if (r.builds && !r.builds.includes(kind)) return;
  const file = join(out, r.file);
  if (!existsSync(file)) die(`override (${origin}): ${r.file} doesn't exist (${r.why})`);
  const text = readFileSync(file, 'utf8');
  const count = text.split(r.find).length - 1;
  if (count !== 1) die(`override (${origin}): expected the text once in ${r.file}, found it ${count} times.\n  The source changed here; update ${origin}.\n  (${r.why})`);
  writeFileSync(file, text.replace(r.find, r.replace.replaceAll('{keys}', GAME.keysHelp || '')));
}

function build(kind) {
  const out = join(DIST, kind);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // 1. The web app, with only the installed game.
  cpSync(WWW, out, {
    recursive: true,
    filter: (p) => {
      const rel = relative(WWW, p).split('\\').join('/');
      const parts = rel.split('/');
      if (parts[0] === 'games' && parts.length >= 2 && parts[1] !== 'active.js') return parts[1] === ACTIVE;
      return true;
    },
  });

  // 2. Wording changes, on the copy only: the shell's, then the game's.
  for (const r of SHELL.replace) applyOverride(out, r, kind, 'platforms/crazygames/overrides.json');
  for (const r of GAME.overrides || []) applyOverride(out, r, kind, `www/games/${ACTIVE}/web.json`);

  // 3. The config the shell reads: same app, web privacy page.
  writeFileSync(join(out, 'app.config.js'),
    `// Web build of ${APP.name}, made by platforms/crazygames/build.mjs.\nexport default ${JSON.stringify({ ...APP, ...SHELL.config }, null, 2)};\n`);

  // 4. The web page and its layer.
  const webGame = { keys: GAME.keys || [], numberLabels: GAME.numberLabels || null, levelPattern: GAME.levelPattern || null };
  const page = readFileSync(join(PAGE, 'index.html'), 'utf8')
    .replace('<title>Game</title>', `<title>${APP.name}</title>`)
    .replace(/\/\*CG_CONFIG\*\/[\s\S]*?\/\*END\*\//, `/*CG_CONFIG*/ ${JSON.stringify({ ads: kind === 'full' })} /*END*/`)
    .replace(/\/\*WEB_GAME\*\/[\s\S]*?\/\*END\*\//, `/*WEB_GAME*/ ${JSON.stringify(webGame)} /*END*/`);
  writeFileSync(join(out, 'index.html'), page);
  mkdirSync(join(out, 'web'), { recursive: true });
  for (const f of ['adapter.js', 'pc.js', 'pc.css']) cpSync(join(PAGE, f), join(out, 'web', f));
  const gameCss = GAME.css ? join(WWW, 'games', ACTIVE, GAME.css) : null;
  if (gameCss && !existsSync(gameCss)) die(`web.json names css "${GAME.css}", which isn't in www/games/${ACTIVE}/`);
  writeFileSync(join(out, 'web/game.css'), gameCss ? readFileSync(gameCss, 'utf8') : '/* no game PC styles */\n');
  writeFileSync(join(out, 'privacy.html'), readFileSync(join(PAGE, 'privacy.html'), 'utf8')
    .replaceAll('«contact»', APP.contactEmail || '').replaceAll('«name»', APP.name));

  // 5. What CrazyGames checks.
  const files = walk(out);
  const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
  if (files.length > 1500) die(`${kind}: ${files.length} files; CrazyGames allows 1500`);
  if (bytes > 50 * 1024 * 1024) die(`${kind}: ${(bytes / 1048576).toFixed(1)} MB; CrazyGames allows 50 MB initial download`);
  const absolute = [];
  const external = [];
  for (const f of files.filter((x) => /\.(html|css|js)$/.test(x))) {
    const rel = relative(out, f);
    const code = readFileSync(f, 'utf8');
    // Paths must be relative: CrazyGames serves the game from a subfolder.
    for (const m of code.matchAll(/(?:src|href)\s*=\s*["']\/(?!\/)[^"']*|url\(\s*["']?\/(?!\/)[^)"']*|from\s+["']\/(?!\/)[^"']*/g)) absolute.push(`${rel}: ${m[0]}`);
    // Scripts and styles may only come from CrazyGames.
    for (const m of code.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*["'](https?:)?\/\/([^/"']+)/g)) {
      if (m[2] !== 'sdk.crazygames.com') external.push(`${rel}: ${m[2]}`);
    }
    if (/ca-app-pub-\d/.test(code)) die(`${kind}: AdMob ID in ${rel}`);
  }
  if (absolute.length) die(`${kind}: absolute paths would break on CrazyGames:\n  ${absolute.join('\n  ')}`);
  if (external.length) die(`${kind}: external scripts or styles:\n  ${external.join('\n  ')}`);

  // 6. Zip, index.html at the top level.
  const zip = join(DIST, `${SLUG}-crazygames-${kind}.zip`);
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: out });
  const mb = (statSync(zip).size / 1048576).toFixed(2);
  console.log(`✓ ${kind.padEnd(5)} ${files.length} files, ${(bytes / 1048576).toFixed(2)} MB unzipped, ${mb} MB zip → ${relative(process.cwd(), zip) || zip}`);
  if (bytes > 20 * 1024 * 1024) console.log('  (over 20 MB: not eligible for the CrazyGames mobile homepage)');
}

console.log(`${APP.name} ${APP.versionName} (game: ${ACTIVE}) → CrazyGames`);
mkdirSync(DIST, { recursive: true });
build('basic');
build('full');
writeFileSync(join(DIST, 'build.json'), JSON.stringify({ name: APP.name, slug: SLUG, version: APP.versionName, game: ACTIVE, mustBeVisible: GAME.mustBeVisible || [] }, null, 2));

if (process.argv.includes('--serve')) {
  const { createServer } = await import('node:http');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const root = join(DIST, process.argv.includes('--basic') ? 'basic' : 'full');
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(root, p);
    if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(8090, () => console.log(`serving ${root} on http://localhost:8090`));
}

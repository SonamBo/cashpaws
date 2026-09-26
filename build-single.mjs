/**
 * Build one self-contained cashpaws.html that opens by double-click.
 *
 * Opening the real build from disk fails: file:// blocks ES modules and gives
 * localStorage an opaque origin. So this follows the import graph from the
 * shell's entry point and wraps each module in its own function scope, joined
 * by a tiny require(). Each module keeps its own names — a game and the shell
 * can both declare `money` or `wait` without colliding. The old bundler pasted
 * everything into one scope and only worked because no two files shared a name.
 *
 * Only the installed game is bundled, because the graph is followed through
 * games/active.js. Images and stylesheets are inlined as data URIs.
 *
 * Run: node build-single.mjs [out.html]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WWW = join(ROOT, 'www');
const read = (p) => readFileSync(join(WWW, p), 'utf8');
const ENTRY = 'shell/main.js';

/* ---------------- modules ---------------- */

const resolveSpec = (from, spec) => posix.normalize(posix.join(posix.dirname(from), spec));
const IMPORT = /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm;
const REEXPORT = /^[ \t]*export\s+\{\s*default\s*\}\s+from\s+['"]([^'"]+)['"];?/gm;

function transform(id, src) {
  const deps = [];
  const exported = [];

  src = src.replace(REEXPORT, (m, spec) => {
    const dep = resolveSpec(id, spec);
    deps.push(dep);
    return `__exports.default = __require(${JSON.stringify(dep)}).default;`;
  });

  src = src.replace(IMPORT, (m, what, spec) => {
    const dep = resolveSpec(id, spec);
    deps.push(dep);
    const req = `__require(${JSON.stringify(dep)})`;
    what = what.trim();
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = ${req};`;
    if (what.startsWith('{')) {
      const names = what.slice(1, what.lastIndexOf('}')).split(',')
        .map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
      return `const { ${names.join(', ')} } = ${req};`;
    }
    return `const ${what} = ${req}.default;`;
  });

  src = src.replace(/^export\s+default\s+/m, '__exports.default = ');
  src = src.replace(/^export\s+((?:async\s+)?function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (m, kind, name) => { exported.push([name, name]); return `${kind} ${name}`; });
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (m, list) => {
    list.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
      const [local, as] = s.split(/\s+as\s+/);
      exported.push([as || local, local]);
    });
    return '';
  });

  const tail = exported.map(([name, local]) => `__exports.${name} = ${local};`).join('\n');
  return { deps, code: `${src}\n${tail}` };
}

const modules = new Map();
(function collect(id) {
  if (modules.has(id)) return;
  if (!existsSync(join(WWW, id))) throw new Error(`module not found: ${id}`);
  const t = transform(id, read(id));
  modules.set(id, t.code);
  t.deps.forEach(collect);
})(ENTRY);

const leftover = [...modules].filter(([, c]) => /^[ \t]*(import|export)\s/m.test(c)).map(([id]) => id);
if (leftover.length) {
  console.error('untransformed import/export left in:', leftover);
  process.exit(1);
}

/* ---------------- the installed game ---------------- */

const gameFolder = read('games/active.js').match(/from\s+['"]\.\/([^/]+)\//)[1];
const gameIndex = read(`games/${gameFolder}/index.js`);
const styleList = ((gameIndex.match(/styles:\s*\[([^\]]*)\]/) || [])[1] || '')
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

/* ---------------- assets ---------------- */

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
const assets = {};
function addImages(dir) {
  if (!existsSync(join(WWW, dir))) return;
  for (const f of readdirSync(join(WWW, dir))) {
    const rel = posix.join(dir, f);
    if (statSync(join(WWW, rel)).isDirectory()) { addImages(rel); continue; }
    const ext = f.split('.').pop().toLowerCase();
    if (MIME[ext]) assets[rel] = `data:${MIME[ext]};base64,` + readFileSync(join(WWW, rel)).toString('base64');
  }
}
addImages('img');
addImages(`games/${gameFolder}/img`);

/** url(...) inside a stylesheet resolves relative to that stylesheet. */
function inlineCss(path) {
  return read(path).replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (m, ref) => {
    if (/^(data:|https?:)/.test(ref)) return m;
    const key = posix.normalize(posix.join(posix.dirname(path), ref));
    if (!assets[key]) throw new Error(`${path} refers to missing ${key}`);
    return `url("${assets[key]}")`;
  });
}

/* ---------------- page ---------------- */

const html = read('index.html');
const inlineStyle = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script/)[1];
const gameStyles = styleList.map((f) => {
  const path = `games/${gameFolder}/${f}`;
  return `<style data-src="${path}">\n${inlineCss(path)}\n</style>`;
}).join('\n');

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#fcf5e6">
<title>Cash Paws</title>
<style>
${inlineCss('css/tokens.css')}
${inlineCss('css/shell.css')}
${inlineStyle}
</style>
${gameStyles}
</head>
<body>
${body}
<script>
"use strict";
globalThis.__ASSETS = ${JSON.stringify(assets)};
const __defs = {}, __cache = {};
function __require(id) {
  if (__cache[id]) return __cache[id];
  const exports = (__cache[id] = {});
  __defs[id](__require, exports);
  return exports;
}
${[...modules].map(([id, code]) =>
  `__defs[${JSON.stringify(id)}] = function (__require, __exports) {\n${code}\n};`).join('\n\n')}
__require(${JSON.stringify(ENTRY)});
<\/script>
</body>
</html>
`;

const target = process.argv[2] || join(ROOT, 'cashpaws.html');
writeFileSync(target, out);
console.log(`wrote ${target}`);
console.log(`  game: ${gameFolder}`);
console.log(`  ${modules.size} modules, each in its own scope`);
console.log(`  ${Object.keys(assets).length} images inlined`);
console.log(`  ${(Buffer.byteLength(out) / 1024 / 1024).toFixed(2)} MB`);

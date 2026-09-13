/**
 * Builds a single self-contained cashpaws.html.
 *
 * Opening the normal build from disk does not work: a file:// origin blocks ES
 * modules as cross-origin and gives localStorage an opaque origin. This flattens
 * the modules into one classic script and inlines every image as a data URI, so
 * the result is one file that opens by double-click with no server.
 *
 * The shipped app still loads the real files — this is only for review.
 * Run: node build-single.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const WWW = join(ROOT, 'www');
const read = (p) => readFileSync(join(WWW, p), 'utf8');

/* ---------- images as data URIs ---------- */

const images = {};
for (const f of readdirSync(join(WWW, 'img'))) {
  const m = f.match(/^(.+)\.(png|jpg|jpeg)$/);
  if (!m) continue;
  const mime = m[2] === 'png' ? 'image/png' : 'image/jpeg';
  images[m[1]] = `data:${mime};base64,` + readFileSync(join(WWW, 'img', f)).toString('base64');
}
const assetMap = `const __IMG = ${JSON.stringify(images)};\nconst ASSET = (n) => __IMG[n] || '';\n`;

/* ---------- modules, flattened in dependency order ---------- */

const ORDER = ['engine.js', 'cats.js', 'art.js', 'render.js', 'overlays.js', 'tabs.js', 'lobby.js', 'app.js'];

function flatten(src) {
  // drop import statements, including multi-line ones
  src = src.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  src = src.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');
  // drop re-export statements, keep the declarations they point at
  src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  // `export const x` -> `const x`
  src = src.replace(/^export\s+(const|let|var|function|class|async)\b/gm, '$1');
  return src;
}

let code = ORDER.map((f) => {
  let src = flatten(read(join('js', f)));

  // src is built dynamically in these three places; point them at the map
  if (f === 'art.js') {
    src = src.replace('src="${IMG}${file}.png"', 'src="${ASSET(file)}"');
    // the cat poses build their path at runtime, so the literal scan misses them
    src = src.replace('src="${IMG}cat-${id}-${pose}.png"', 'src="${ASSET(`cat-${id}-${pose}`)}"');
    src = src.replace("this.src='${IMG}cat-patch-${pose}.png'", "this.src=\'${ASSET(`cat-patch-${pose}`)}\'");
  }
  if (f === 'render.js') {
    src = src.replace(
      "el.src = `img/${this.chipSet === 'b' ? 'chipb' : 'chip'}-${value}.png`;",
      "el.src = ASSET((this.chipSet === 'b' ? 'chipb' : 'chip') + '-' + value);"
    );
  }
  if (f === 'tabs.js') {
    src = src.replace(
      /src="img\/\$\{s\.id === 'notes' \? 'chipb' : 'chip'\}-20\.png"/,
      'src="${ASSET((s.id === \'notes\' ? \'chipb\' : \'chip\') + \'-20\')}"'
    );
  }
  return `/* ===== ${f} ===== */\n${src}`;
}).join('\n');

// any remaining literal reference (the lobby uses several)
const inlineRefs = (t) => t.replace(/(?:\.\.\/)?img\/([\w-]+)\.(?:png|jpg|jpeg)/g, (m, n) => images[n] || m);
code = inlineRefs(code);

const leftovers = [...code.matchAll(/img\/[\w-]+\.(?:png|jpg|jpeg)/g)].map((m) => m[0]);
if (leftovers.length) {
  console.error('unresolved image references:', [...new Set(leftovers)]);
  process.exit(1);
}

/* ---------- shell ---------- */

const html = read('index.html');
const inlineStyle = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script/)[1];

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#fcf5e6">
<title>Cash Paws</title>
<style>
${inlineRefs(read('css/tokens.css'))}
${inlineRefs(read('css/board.css'))}
${inlineRefs(read('css/overlays.css'))}
${inlineStyle}
</style>
</head>
<body>
${body}
<script>
"use strict";
${assetMap}
(function () {
${code}
})();
<\/script>
</body>
</html>
`;

const target = process.argv[2] || join(ROOT, 'cashpaws.html');
writeFileSync(target, out);
console.log(`wrote ${target}`);
console.log(`  ${Object.keys(images).length} images inlined`);
console.log(`  ${(Buffer.byteLength(out) / 1024 / 1024).toFixed(2)} MB`);

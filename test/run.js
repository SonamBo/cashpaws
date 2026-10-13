#!/usr/bin/env node
/**
 * Every rule test that runs without a browser: the shell's (test/*.js) and the
 * installed game's (test/games/<id>/*.js, if it has any). CI runs this, so a
 * game's own tests are picked up just by putting them in its folder.
 *
 * A test can ask for arguments with a comment line such as  // ci-args: 3000
 *
 * Run: node test/run.js
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['run.js', 'preflight.js']);
const active = readFileSync(join(ROOT, 'www/games/active.js'), 'utf8').match(/from\s+['"]\.\/([^/'"]+)\//)?.[1];

const files = readdirSync(join(ROOT, 'test')).filter((f) => f.endsWith('.js') && !SKIP.has(f)).map((f) => `test/${f}`);
const gameDir = `test/games/${active}`;
if (active && existsSync(join(ROOT, gameDir))) {
  files.push(...readdirSync(join(ROOT, gameDir)).filter((f) => f.endsWith('.js')).map((f) => `${gameDir}/${f}`));
}

let failed = 0;
for (const f of files) {
  const args = readFileSync(join(ROOT, f), 'utf8').match(/^\/\/\s*ci-args:\s*(.+)$/m)?.[1].trim().split(/\s+/) || [];
  console.log(`\n▶ ${f} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [f, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`✗ ${f} failed`); }
}
console.log(`\n${files.length - failed}/${files.length} test files passed (installed game: ${active})`);
process.exit(failed ? 1 : 0);

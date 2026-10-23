#!/usr/bin/env node
/**
 * tools/marketing/youtube-upload.mjs against a stand-in for Google: the token
 * refresh, the resumable upload, the queue order, what gets moved to posted/,
 * the checks on metadata, and the error hints. No network, no browser.
 *
 * Run: node test/youtube-upload.js
 */
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, 'tools/marketing/youtube-upload.mjs');
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failed++; };

// The stand-in. `mode` changes how it answers.
let mode = 'ok';
const seen = [];
let nextId = 1;
const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });
    const json = (code, obj, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
    if (req.url === '/token') {
      if (mode === 'revoked') return json(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
      return json(200, { access_token: 'ACCESS', expires_in: 3599 });
    }
    if (req.url.startsWith('/upload?')) {
      if (mode === 'quota') return json(403, { error: { message: 'Quota exceeded', errors: [{ reason: 'quotaExceeded' }] } });
      return json(200, {}, { location: `http://127.0.0.1:${server.address().port}/session/${nextId}` });
    }
    if (req.url.startsWith('/session/')) return json(200, { id: `vid${nextId++}`, kind: 'youtube#video' });
    res.writeHead(404); res.end();
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

function run(args, env = {}) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [TOOL, ...args], {
      cwd: ROOT,
      env: { ...process.env, YT_CLIENT_ID: 'CID', YT_CLIENT_SECRET: 'CSECRET', YT_REFRESH_TOKEN: 'REFRESH', YT_TOKEN_URL: `${base}/token`, YT_UPLOAD_URL: `${base}/upload`, ...env },
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => ok({ code, out }));
  });
}

function makeQueue() {
  const dir = mkdtempSync(join(tmpdir(), 'yt-'));
  const queue = join(dir, 'queue'), posted = join(dir, 'posted');
  mkdirSync(queue);
  writeFileSync(join(queue, '002-second.mp4'), Buffer.alloc(2048, 2));
  writeFileSync(join(queue, '001-first.mp4'), Buffer.alloc(1024, 1));
  writeFileSync(join(queue, '001-first.json'), JSON.stringify({ title: 'Sorting cash', description: 'Play {app}: {playUrl}', tags: ['puzzle'] }));
  return { dir, queue, posted, args: ['--queue', queue, '--posted', posted] };
}

// 1. Dry run: lists, uploads nothing, touches nothing.
{
  const q = makeQueue();
  const r = await run([...q.args, '--dry-run']);
  check(r.code === 0 && /→ 001-first\.mp4/.test(r.out) && !/→ 002/.test(r.out), 'dry run marks only the first video by name order');
  check(seen.length === 0 && readdirSync(q.queue).length === 3, 'dry run sends nothing and moves nothing');
  rmSync(q.dir, { recursive: true });
}

// 2. A real run: token, resumable start, PUT, then the move.
{
  const q = makeQueue();
  const r = await run(q.args);
  check(r.code === 0, `upload succeeds (${r.out.trim().split('\n').pop()})`);
  const [tok, start, put] = seen;
  check(tok?.url === '/token' && new URLSearchParams(tok.body.toString()).get('grant_type') === 'refresh_token'
    && new URLSearchParams(tok.body.toString()).get('refresh_token') === 'REFRESH', 'refreshes the access token');
  const meta = start && JSON.parse(start.body.toString());
  check(start?.url === '/upload?uploadType=resumable&part=snippet,status' && start.headers.authorization === 'Bearer ACCESS'
    && start.headers['x-upload-content-length'] === '1024' && start.headers['x-upload-content-type'] === 'video/mp4', 'starts a resumable upload with the size and type');
  check(meta?.snippet.title === 'Sorting cash #Shorts', `adds #Shorts to the title (${meta?.snippet.title})`);
  check(/^Play .+: https:\/\/play\.google\.com\/store\/apps\/details\?id=/.test(meta?.snippet.description || ''), 'fills {app} and {playUrl} from app.config.js');
  check(meta?.status.privacyStatus === 'public' && meta?.status.selfDeclaredMadeForKids === false && meta?.snippet.categoryId === '20', 'public, not made for kids, Gaming');
  check(put?.method === 'PUT' && put.url === '/session/1' && put.body.length === 1024, 'sends the whole file to the session');
  const rec = JSON.parse(readFileSync(join(q.posted, '001-first.json'), 'utf8'));
  check(existsSync(join(q.posted, '001-first.mp4')) && !existsSync(join(q.queue, '001-first.mp4')) && !existsSync(join(q.queue, '001-first.json')), 'moves the video and its JSON out of the queue');
  check(rec.videoId === 'vid1' && rec.url === 'https://youtube.com/shorts/vid1' && rec.tags[0] === 'puzzle' && rec.postedAt, 'records the video ID and link in posted/');
  check(existsSync(join(q.queue, '002-second.mp4')), 'leaves the rest for the next run');

  // The second one has no JSON: the title comes from its name.
  seen.length = 0;
  const r2 = await run(q.args);
  const meta2 = seen[1] && JSON.parse(seen[1].body.toString());
  check(r2.code === 0 && meta2?.snippet.title === 'second #Shorts', `a video without JSON is named from its file (${meta2?.snippet.title})`);

  seen.length = 0;
  const r3 = await run(q.args);
  check(r3.code === 0 && /Nothing to upload/.test(r3.out) && seen.length === 0, 'an empty queue is not an error');
  rmSync(q.dir, { recursive: true });
}

// 3. --count, and publishAt scheduling.
{
  const q = makeQueue();
  writeFileSync(join(q.queue, '002-second.json'), JSON.stringify({ title: 'Later', publishAt: new Date(Date.now() + 864e5).toISOString() }));
  seen.length = 0;
  const r = await run([...q.args, '--count', '5']);
  const starts = seen.filter((s) => s.url.startsWith('/upload?')).map((s) => JSON.parse(s.body.toString()));
  check(r.code === 0 && starts.length === 2 && readdirSync(q.queue).length === 0, '--count uploads several in one run');
  check(starts[1]?.status.privacyStatus === 'private' && starts[1]?.status.publishAt, 'publishAt uploads private with a publish time');
  rmSync(q.dir, { recursive: true });
}

// 4. Refusals and errors keep the queue as it was.
{
  const q = makeQueue();
  writeFileSync(join(q.queue, '001-first.json'), JSON.stringify({ title: 'x'.repeat(101) }));
  seen.length = 0;
  let r = await run(q.args);
  check(r.code === 1 && /100 max/.test(r.out) && seen.length === 0, 'refuses a title over 100 characters before sending anything');

  writeFileSync(join(q.queue, '001-first.json'), JSON.stringify({ title: 'ok', publishAt: '2020-01-01T00:00:00Z' }));
  r = await run(q.args);
  check(r.code === 1 && /not a future date/.test(r.out), 'refuses a publishAt in the past');

  writeFileSync(join(q.queue, '001-first.json'), JSON.stringify({ title: 'ok' }));
  r = await run(q.args, { YT_REFRESH_TOKEN: '' });
  check(r.code === 1 && /missing YT_REFRESH_TOKEN/.test(r.out), 'says which secret is missing');

  mode = 'revoked';
  r = await run(q.args);
  check(r.code === 1 && /invalid_grant/.test(r.out) && /7 days/.test(r.out), 'explains a revoked token');

  mode = 'quota';
  r = await run(q.args);
  check(r.code === 1 && /quotaExceeded/.test(r.out) && /next run/.test(r.out), 'explains a used-up quota');
  check(readdirSync(q.queue).length === 3 && !existsSync(q.posted) || readdirSync(q.posted).length === 0, 'a failed upload moves nothing');
  rmSync(q.dir, { recursive: true });
}

server.close();
console.log(failed ? `\n✗ ${failed} check(s) failed` : '\n✓ YouTube uploader');
process.exit(failed ? 1 : 0);

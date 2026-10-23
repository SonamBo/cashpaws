#!/usr/bin/env node
/**
 * Uploads videos from a queue folder to YouTube, oldest first, and moves each
 * one to a "posted" folder with its video ID, so nothing goes up twice.
 * .github/workflows/youtube.yml runs it on a schedule; set-up is in
 * tools/marketing/YOUTUBE.md.
 *
 *   node tools/marketing/youtube-upload.mjs              the next video in the queue
 *   node tools/marketing/youtube-upload.mjs --count 3    up to three
 *   node tools/marketing/youtube-upload.mjs --dry-run    check the queue, upload nothing
 *        [--queue marketing/shorts/queue] [--posted marketing/shorts/posted]
 *
 * Needs YT_CLIENT_ID, YT_CLIENT_SECRET and YT_REFRESH_TOKEN in the
 * environment (repository secrets in CI; tools/marketing/youtube-token.mjs
 * makes the refresh token). No npm packages.
 *
 * The queue: each video is <name>.mp4 with an optional <name>.json beside it.
 * Names sort in upload order, so start them with a number or a date.
 *
 *   {
 *     "title": "Sorting cash with cats #Shorts",        up to 100 characters
 *     "description": "...\n{playUrl}",                  {app} and {playUrl} are filled in
 *     "tags": ["puzzle", "cats"],
 *     "privacy": "public",                             public | unlisted | private
 *     "publishAt": "2026-11-01T13:00:00Z",             optional: uploads private, YouTube publishes then
 *     "categoryId": "20",                              20 is Gaming
 *     "madeForKids": false
 *   }
 *
 * Without a .json, the title comes from the file name and the description is
 * the app's name and Play link. "#Shorts" is added to a title that lacks it.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry-run');
const COUNT = Math.max(1, Number(arg('--count', 1)) || 1);
const QUEUE = resolve(ROOT, arg('--queue', 'marketing/shorts/queue'));
const POSTED = resolve(ROOT, arg('--posted', 'marketing/shorts/posted'));
// Overridable only so test/youtube-upload.js can point them at a stand-in server.
const TOKEN_URL = process.env.YT_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = process.env.YT_UPLOAD_URL || 'https://www.googleapis.com/upload/youtube/v3/videos';

const config = (() => {
  try {
    const text = readFileSync(join(ROOT, 'www/app.config.js'), 'utf8');
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch { return {}; }
})();
const APP = config.name || 'our game';
const PLAY_URL = config.applicationId ? `https://play.google.com/store/apps/details?id=${config.applicationId}` : '';

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

/** The videos waiting, in upload order, each with its metadata checked. */
function readQueue() {
  if (!existsSync(QUEUE)) return [];
  return readdirSync(QUEUE).filter((f) => f.toLowerCase().endsWith('.mp4')).sort().map((file) => {
    const name = file.slice(0, -4);
    const jsonPath = join(QUEUE, `${name}.json`);
    let meta = {};
    if (existsSync(jsonPath)) {
      try { meta = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch (e) { fail(`${name}.json is not valid JSON: ${e.message}`); }
    }
    const fill = (s) => String(s).replaceAll('{app}', APP).replaceAll('{playUrl}', PLAY_URL);
    let title = fill(meta.title || name.replace(/^[\d-]+/, '').replace(/[-_]+/g, ' ').trim() || APP);
    if (!/#shorts/i.test(title) && title.length + 8 <= 100) title += ' #Shorts';
    const description = fill(meta.description ?? `${APP}${PLAY_URL ? `, free on Google Play: ${PLAY_URL}` : ''}`);
    const privacy = meta.publishAt ? 'private' : (meta.privacy || 'public');
    const problems = [];
    if (title.length > 100) problems.push(`title is ${title.length} characters (100 max)`);
    if (/[<>]/.test(title + description)) problems.push('YouTube refuses < and > in titles and descriptions');
    if (description.length > 5000) problems.push(`description is ${description.length} characters (5000 max)`);
    if (!['public', 'unlisted', 'private'].includes(privacy)) problems.push(`privacy "${privacy}" is not public, unlisted or private`);
    if (meta.publishAt && !(Date.parse(meta.publishAt) > Date.now())) problems.push(`publishAt ${meta.publishAt} is not a future date`);
    if (problems.length) fail(`${file}: ${problems.join('; ')}`);
    return {
      file, name, path: join(QUEUE, file), jsonPath, meta, bytes: statSync(join(QUEUE, file)).size,
      resource: {
        snippet: { title, description, tags: meta.tags || [], categoryId: String(meta.categoryId || '20') },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: meta.madeForKids ?? false,
          ...(meta.publishAt ? { publishAt: new Date(meta.publishAt).toISOString() } : {}),
        },
      },
    };
  });
}

/** Turns a Google error into one line, with what to do about the common ones. */
async function googleError(res, what) {
  let body = await res.text();
  let reason = '';
  try {
    const j = JSON.parse(body);
    reason = j.error?.errors?.[0]?.reason || j.error || '';
    body = j.error?.message || j.error_description || body;
  } catch { /* plain text */ }
  const hints = {
    invalid_grant: 'the refresh token was revoked or expired. If the OAuth app is still in "Testing", tokens die after 7 days: publish it, then run youtube-token.mjs again',
    invalid_client: 'YT_CLIENT_ID or YT_CLIENT_SECRET is wrong',
    quotaExceeded: 'the daily API quota is used up; the next run will try again',
    uploadLimitExceeded: 'the channel has hit its daily upload limit; the next run will try again',
    youtubeSignupRequired: 'the Google account has no YouTube channel yet',
    forbidden: 'the token has no upload permission: run youtube-token.mjs again',
  };
  return `${what} failed (${res.status}${reason ? `, ${reason}` : ''}): ${body}${hints[reason] ? `\n  → ${hints[reason]}` : ''}`;
}

async function accessToken() {
  const { YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret, YT_REFRESH_TOKEN: refresh } = process.env;
  const missing = Object.entries({ YT_CLIENT_ID: id, YT_CLIENT_SECRET: secret, YT_REFRESH_TOKEN: refresh }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) fail(`missing ${missing.join(', ')}: see tools/marketing/YOUTUBE.md`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  if (!res.ok) fail(await googleError(res, 'Getting an access token'));
  return (await res.json()).access_token;
}

/** YouTube's resumable upload: announce the video, then send the file. */
async function upload(item, token) {
  const start = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(item.bytes),
      'x-upload-content-type': 'video/mp4',
    },
    body: JSON.stringify(item.resource),
  });
  if (!start.ok) throw new Error(await googleError(start, 'Starting the upload'));
  const session = start.headers.get('location');
  if (!session) throw new Error('YouTube gave no upload address');
  const put = await fetch(session, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'video/mp4', 'content-length': String(item.bytes) },
    body: readFileSync(item.path),
  });
  if (!put.ok) throw new Error(await googleError(put, 'Sending the video'));
  return put.json();
}

const queue = readQueue();
if (!queue.length) { console.log(`Nothing to upload: no .mp4 in ${QUEUE.replace(ROOT + '/', '')}`); process.exit(0); }
const batch = queue.slice(0, COUNT);

if (DRY) {
  for (const it of queue) {
    const s = it.resource.status;
    console.log(`${batch.includes(it) ? '→' : ' '} ${it.file}  (${(it.bytes / 1e6).toFixed(1)} MB)\n    "${it.resource.snippet.title}"  ${s.privacyStatus}${s.publishAt ? `, publishes ${s.publishAt}` : ''}`);
  }
  console.log(`\nDry run: ${queue.length} in the queue, the next run uploads the one${batch.length > 1 ? 's' : ''} marked →.`);
  process.exit(0);
}

const token = await accessToken();
mkdirSync(POSTED, { recursive: true });
let uploaded = 0;
for (const item of batch) {
  let video;
  try { video = await upload(item, token); } catch (e) { fail(`${item.file}: ${e.message}`); }
  const url = `https://youtube.com/shorts/${video.id}`;
  // The record of what went up, beside the video in posted/.
  writeFileSync(join(POSTED, `${item.name}.json`), JSON.stringify({ ...item.meta, videoId: video.id, url, postedAt: new Date().toISOString() }, null, 2) + '\n');
  renameSync(item.path, join(POSTED, item.file));
  if (existsSync(item.jsonPath)) unlinkSync(item.jsonPath);     // its contents are in the posted record
  console.log(`✓ ${item.file} → ${url} (${item.resource.status.privacyStatus})`);
  uploaded++;
}
console.log(`${uploaded} uploaded, ${queue.length - uploaded} left in the queue.`);

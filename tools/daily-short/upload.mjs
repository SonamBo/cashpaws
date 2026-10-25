#!/usr/bin/env node
/**
 * Upload a rendered Puzzle of the Day Short to YouTube.
 *
 *   node tools/daily-short/upload.mjs dist/short/puzzle-2026-10-26.json
 *
 * Reads three secrets from the environment (see tools/daily-short/README.md):
 *   YT_CLIENT_ID, YT_CLIENT_SECRET   the Google Cloud OAuth client
 *   YT_REFRESH_TOKEN                 the channel's permission, made once with auth.mjs
 * Optional: YT_PRIVACY = public (default) | unlisted | private.
 *
 * Without the secrets it says so and exits cleanly, so the daily job still
 * renders and keeps the video as a download. Never uploads the same puzzle
 * twice: it looks at the channel's latest uploads first.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const metaPath = process.argv[2];
if (!metaPath) { console.error('usage: upload.mjs <puzzle-YYYY-MM-DD.json>'); process.exit(2); }
const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const video = resolve(ROOT, meta.video);

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const PRIVACY = process.env.YT_PRIVACY || 'public';
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.log('No YouTube secrets (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN): not uploading. The video is in the run\'s artifacts.');
  process.exit(0);
}

async function json(res, what) {
  const body = await res.text();
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : {};
}

// 1. A short-lived access token from the refresh token.
const token = await json(await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token' }),
}), 'token');
const auth = { authorization: `Bearer ${token.access_token}` };

// 2. Already up? The channel's uploads playlist, newest first (1 quota unit each).
const prefix = meta.title.split(':')[0] + ':';
try {
  const ch = await json(await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', { headers: auth }), 'channel');
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (uploads) {
    const list = await json(await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${uploads}`, { headers: auth }), 'uploads');
    const dup = list.items?.find((it) => it.snippet?.title?.startsWith(prefix));
    if (dup) {
      console.log(`Already on YouTube: https://youtube.com/shorts/${dup.snippet.resourceId.videoId} (${dup.snippet.title}). Not uploading again.`);
      process.exit(0);
    }
  }
} catch (e) {
  // A token made with the upload scope only can't read the channel: upload anyway.
  console.log(`Couldn't check earlier uploads (${e.message.split(':')[0]}); uploading.`);
}

// 3. A resumable upload: the details first, then the file.
const size = statSync(video).size;
const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
  method: 'POST',
  headers: { ...auth, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size) },
  body: JSON.stringify({
    snippet: { title: meta.title.slice(0, 100), description: meta.description, tags: meta.tags, categoryId: '20' },   // 20: Gaming
    status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false },
  }),
});
if (!start.ok) throw new Error(`upload start: HTTP ${start.status} ${(await start.text()).slice(0, 400)}`);
const where = start.headers.get('location');
const done = await json(await fetch(where, {
  method: 'PUT',
  headers: { ...auth, 'content-type': 'video/mp4', 'content-length': String(size) },
  body: readFileSync(video),
}), 'upload');
console.log(`Uploaded puzzle #${meta.number} (${meta.date}) as ${PRIVACY}: https://youtube.com/shorts/${done.id}`);

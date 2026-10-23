#!/usr/bin/env node
/**
 * Run once, on your own computer, to let the uploader post to your channel.
 * Opens a Google sign-in, then prints the refresh token to store as the
 * YT_REFRESH_TOKEN repository secret. Full set-up: tools/marketing/YOUTUBE.md.
 *
 *   node tools/marketing/youtube-token.mjs client_secret_XXXX.json
 *   (or with YT_CLIENT_ID and YT_CLIENT_SECRET set instead of the file)
 *
 * The JSON file is the one the Google Cloud console offers to download for an
 * OAuth client of type "Desktop app". Nothing is saved anywhere; the token is
 * only printed. Asks only for permission to upload videos (youtube.upload).
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { exec } from 'node:child_process';

const file = process.argv[2];
let id = process.env.YT_CLIENT_ID, secret = process.env.YT_CLIENT_SECRET;
if (file) {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const c = j.installed || j.web || j;
  id = c.client_id; secret = c.client_secret;
  if (j.web) console.warn('! This is a "Web application" client. Make a "Desktop app" one if sign-in fails with redirect_uri_mismatch.');
}
if (!id || !secret) {
  console.error('Give the client JSON file, or set YT_CLIENT_ID and YT_CLIENT_SECRET. See tools/marketing/YOUTUBE.md.');
  process.exit(2);
}

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
  const page = (msg) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(`<body style="font:18px system-ui;margin:3em">${msg}</body>`); };
  if (url.searchParams.get('state') !== state) return page('This sign-in link is stale. Run the script again.');
  if (url.searchParams.get('error')) { page(`Sign-in stopped: ${url.searchParams.get('error')}`); return done(1, `Sign-in stopped: ${url.searchParams.get('error')}`); }
  const res2 = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code'), client_id: id, client_secret: secret,
      redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier,
    }),
  });
  const tok = await res2.json();
  if (!tok.refresh_token) {
    page('Google gave no refresh token. See the terminal.');
    return done(1, `No refresh token in Google's answer: ${JSON.stringify(tok)}\nRemove the app's access at https://myaccount.google.com/permissions and run this again.`);
  }
  page('Done. You can close this tab and go back to the terminal.');
  done(0, `
✓ Signed in. Add these three repository secrets
  (GitHub → Settings → Secrets and variables → Actions → New repository secret):

  YT_CLIENT_ID       ${id}
  YT_CLIENT_SECRET   ${secret}
  YT_REFRESH_TOKEN   ${tok.refresh_token}

Or with the GitHub CLI, from the repo folder:

  gh secret set YT_CLIENT_ID --body '${id}'
  gh secret set YT_CLIENT_SECRET --body '${secret}'
  gh secret set YT_REFRESH_TOKEN --body '${tok.refresh_token}'

Treat the refresh token like a password: it can upload to your channel.`);
});

function done(code, msg) {
  (code ? console.error : console.log)(msg);
  server.close();
  setTimeout(() => process.exit(code), 200);
}

let redirect;
server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}/`;
  const auth = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    access_type: 'offline', prompt: 'consent', state,
    code_challenge: challenge, code_challenge_method: 'S256',
  });
  console.log(`Opening Google sign-in. If no browser opens, paste this link into one:\n\n${auth}\n`);
  console.log('Pick the Google account that owns the YouTube channel. A "Google hasn\'t verified this app" screen is expected:');
  console.log('it is your own app. Choose Advanced, then "Go to … (unsafe)", then allow uploads.\n');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${auth}"`, () => {});
});

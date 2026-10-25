# Puzzle of the Day: the daily Short

Every evening `.github/workflows/daily-short.yml` renders the day's puzzle
solution as a 1080×1920 YouTube Short with the game's sounds and music, and
uploads it at about 22:05 India time, in the day's last two hours.

| File | What it does |
|---|---|
| `make-puzzles.mjs` | Makes `www/games/money-sort/puzzles.js`, the puzzle for every date to the end of 2029. Re-run with a later end date before then. |
| `render.mjs` | Draws the Short with the game's own `clip.js` and encodes it with ffmpeg: `dist/short/puzzle-<date>.mp4` and `.json` (title, description, tags). |
| `upload.mjs` | Uploads it to your channel. Skips a puzzle already posted. |
| `auth.mjs` | One-time: gets the refresh token that lets the job post. Run on your own computer. |

Try a render locally: `node tools/daily-short/render.mjs --date 2026-10-26`.
Run the job by hand: GitHub → Actions → Daily Short → Run workflow (any date;
untick "Upload" to only render).

## Turning on the upload (once, about 15 minutes)

You do these steps yourself: they sign in to your Google account.

1. **Google Cloud project.** Go to console.cloud.google.com, create a project
   (e.g. "Cash Paws Shorts").
2. **Turn on the API.** APIs & Services → Library → "YouTube Data API v3" →
   Enable.
3. **Consent screen.** APIs & Services → OAuth consent screen: External; app
   name "Cash Paws Shorts"; your email for both contacts. Add yourself as a
   test user. Then **Publish app** (status "In production"). Without that
   step, Google expires the token after 7 days and uploads stop. Google
   doesn't need to verify an app only you use; you'll see a
   "Google hasn't verified this app" screen once, and can continue past it.
4. **Client.** APIs & Services → Credentials → Create credentials → OAuth
   client ID → type **Desktop app**. Copy the client ID and secret.
5. **Refresh token.** On your computer, in this repo:
   ```bash
   YT_CLIENT_ID=… YT_CLIENT_SECRET=… node tools/daily-short/auth.mjs
   ```
   Open the link, sign in with the Google account that owns the channel,
   pick the channel, allow. Copy the token it prints.
6. **GitHub secrets.** Repo → Settings → Secrets and variables → Actions →
   New repository secret, three times: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`,
   `YT_REFRESH_TOKEN`.
7. **Test.** Actions → Daily Short → Run workflow. The log ends with the
   Short's link.

Optional: a repository *variable* `YT_PRIVACY` = `unlisted` or `private` to
check a few before they go public (default `public`).

Instagram isn't automatic: download the video from the run's artifacts (or
from YouTube Studio) and post it as a Reel.

## Notes

- **Timing.** The puzzle changes at each player's own midnight. At 22:05 in
  India it's still morning in the US, so US players can see the answer before
  they play. Posting for the US day instead means changing both the cron
  in the workflow (UTC) and `TZ` in `render.mjs`.
- **GitHub schedules** run only from the default branch, and can start late
  when GitHub is busy.
- **Quota.** One upload a day is far inside YouTube's free daily quota.

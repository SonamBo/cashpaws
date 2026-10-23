# Posting Shorts to YouTube automatically

Drop videos into `marketing/shorts/queue/` and push. Once a day,
`.github/workflows/youtube.yml` uploads the next one and commits it into
`marketing/shorts/posted/` with its YouTube link.

```
marketing/shorts/
  queue/                    waiting, uploaded in name order
    003-bank-it.mp4
    003-bank-it.json        title, description, tags (optional)
  posted/                   done: the video, plus a .json with its link
```

## One-time set-up (about 20 minutes)

### 1. A Google Cloud project with the YouTube API

1. Go to <https://console.cloud.google.com/>, sign in with the Google account
   that owns the YouTube channel, and create a project (any name).
2. **APIs & Services → Library**: search for **YouTube Data API v3** and
   click **Enable**.

### 2. The OAuth consent screen

1. **APIs & Services → OAuth consent screen** (called **Google Auth
   Platform** in newer consoles). Choose **External** and fill in the app
   name and your email. Skip logo and domains.
2. **Audience → Test users**: add your own Gmail.
3. **Publish the app**, so its status says **In production**.
   - This step matters. While the app is in **Testing**, Google lets the
     sign-in last only 7 days, and then uploads stop with `invalid_grant`.
   - Publishing doesn't make anything public. You'll see a "Google hasn't
     verified this app" warning when you sign in, and that's fine: you are
     its only user.

### 3. An OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- application type **Desktop app**, any name;
- **Download JSON** (a `client_secret_….json` file);
- keep that file out of the repo.

### 4. The refresh token

On your own computer, from the repo folder:

```bash
node tools/marketing/youtube-token.mjs ~/Downloads/client_secret_XXXX.json
```

1. A browser opens. Pick the account that owns the channel.
2. On the unverified-app screen, choose **Advanced → Go to … (unsafe)**.
3. Allow **Manage your YouTube videos** (upload only).

The terminal then prints three values.

### 5. Three repository secrets

GitHub → the repo → **Settings → Secrets and variables → Actions → New
repository secret**:

| Secret | Value |
|---|---|
| `YT_CLIENT_ID` | printed by the script |
| `YT_CLIENT_SECRET` | printed by the script |
| `YT_REFRESH_TOKEN` | printed by the script; treat it like a password |

### 6. Try it

**Actions → YouTube → Run workflow**. The next video in the queue goes up, and
a commit moves it to `posted/`. After that it runs by itself every day at
13:00 UTC (6:30 pm IST). Change the `cron` line in the workflow for another
time.

## The metadata file

A `.json` beside the video, with the same name:

```json
{
  "title": "Can you sort the cash? 🐱💰",
  "description": "A cosy cat puzzle where you sort coins and notes.\n\nFree on Google Play: {playUrl}\n\n#Shorts #puzzle #cats",
  "tags": ["puzzle game", "sort puzzle", "cat game", "mobile game"],
  "privacy": "public",
  "publishAt": "2026-11-01T13:00:00Z"
}
```

All fields are optional.

| Field | What it does |
|---|---|
| `title` | Up to 100 characters. `#Shorts` is added if it's missing |
| `description` | `{app}` and `{playUrl}` are filled in from `www/app.config.js` |
| `privacy` | `public` (the default), `unlisted` or `private` |
| `publishAt` | Uploads the video as private and YouTube publishes it at that time. Use it to upload a whole week at once (`--count 7` from **Run workflow**) |
| `categoryId` | `20` (Gaming) by default |
| `madeForKids` | `false` by default |

With no `.json`, the title is the file name and the description is the app
name with its Play link.

## Running it yourself

```bash
node tools/marketing/youtube-upload.mjs --dry-run     # what would go up, in order
YT_CLIENT_ID=… YT_CLIENT_SECRET=… YT_REFRESH_TOKEN=… node tools/marketing/youtube-upload.mjs
```

`node test/youtube-upload.js` tests the uploader against a stand-in for
Google. CI runs it with the other tests.

## Good to know

- **Limits.** The API allows 100 uploads a day per project, far more than a
  daily Short needs. A failed run leaves the video in the queue, and the next
  run tries again.
- **What makes a Short.** YouTube files any vertical video up to 3 minutes
  as a Short. `#Shorts` in the title helps.
- **Sound.** The API can't add YouTube's library music. Put the audio in the
  file before it goes in the queue.
- **Keeping the schedule alive.** GitHub pauses scheduled workflows in a repo
  with no activity for 60 days. The workflow's own commits count as activity
  while the queue has videos in it.
- **Starting over.** If uploads fail with `invalid_grant`:
  1. check the consent screen is **In production**;
  2. run step 4 again;
  3. update `YT_REFRESH_TOKEN`.

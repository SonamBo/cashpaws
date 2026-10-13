# CrazyGames

The installed game, packaged for [CrazyGames](https://developer.crazygames.com).
Self-contained: the Android build never reads this folder, and the build works
on a copy of `www/`, so nothing here can change the app.

```bash
node platforms/crazygames/build.mjs            # → dist/crazygames/<app>-crazygames-{basic,full}.zip
node platforms/crazygames/build.mjs --serve    # play the full build at http://localhost:8090
node platforms/crazygames/test/crazygames.mjs  # the shell on the web, with any game (needs Playwright)
```

CI: `.github/workflows/crazygames.yml` builds and tests both zips on every
push, separately from the Android build, and attaches them to the run.

## Two zips

| Zip | For | Ads |
|---|---|---|
| `…-basic.zip` | **Basic Launch**, the first submission | None. CrazyGames has ads off then, so no ad buttons appear at all |
| `…-full.zip` | **Full Launch**, when CrazyGames invites the game | CrazyGames rewarded ads in every rewarded placement; the Ad break plays a midgame ad, only right after a level-up and at most every 3 minutes |

Both report gameplay start/stop and loading to CrazyGames, open straight into
the game, fill any window, and save progress to the player's CrazyGames
account (the Data module) as well as the browser.

## How it works

| File | Job |
|---|---|
| `page/index.html` | The web page: CrazyGames SDK, adapter, PC layer, then the shell |
| `page/adapter.js` | Provides `window.CashPawsAds`, the ad bridge the shell already looks for (Android's is AdMob). Reports gameplay and loading, restores and mirrors saves, skips the lobby |
| `page/pc.js`, `page/pc.css` | Keyboard and mouse: Enter/Space/P on the shell's cards, pause and lobby, plus the game's own keys |
| `page/privacy.html` | The web privacy page, shipped inside the zip |
| `overrides.json` | Shell wording changed for the web (Settings note, "Click to continue") |
| `build.mjs` | Copy `www/`, apply wording, add the page, check what CrazyGames checks, zip |
| `test/` | The stand-in SDK, a harness, and the generic test |

## What a game adds: `www/games/<id>/web.json`

Optional, read only by this build:

```json
{
  "keys": [
    { "key": "1-9", "click": ".tube[data-col=\"{i}\"]" },
    { "key": "z", "click": "[data-undo]" }
  ],
  "keysHelp": "Keys: 1–9 pick a tube, Z undo, P pause.",
  "numberLabels": { "selector": ".tube[data-col]", "attr": "data-col" },
  "css": "web.css",
  "levelPattern": "Level (\\d+)",
  "mustBeVisible": ["[data-undo]", ".tube"],
  "overrides": [
    { "why": "PC wording", "file": "games/<id>/tutorial.js", "find": "Tap a tube", "replace": "Click a tube" }
  ]
}
```

| Field | Meaning |
|---|---|
| `keys` | Each key clicks a selector while the game is up. `"1-9"` is a range: `{i}` is the digit − 1, `{n}` the digit |
| `keysHelp` | Shown in Settings on the web |
| `numberLabels` | Show 1–9 under these elements once the keyboard is used (`attr` holds a 0-based index) |
| `css` | The game's PC styles in its folder: hover on its pieces, wide-screen tweaks |
| `levelPattern` | How to read the level from the header title, for Ad breaks after level-ups. Default: the first number |
| `mustBeVisible` | The layout test checks these stay on screen at every window size |
| `overrides` | The game's wording for PC. Each `find` must appear exactly once, or the build stops |

Put the game's own web checks in `test/games/<id>/crazygames.mjs`, using
`platforms/crazygames/test/harness.mjs` (Money Sort's is an example). CI runs
it when it exists.

## Submitting

The listing text, covers and preview videos belong in the game's
`marketing/` folder: see `marketing/README.md` and the `tools/marketing/`
tools. Steps:

1. Developer account at developer.crazygames.com.
2. Upload `…-basic.zip` to the portal's Preview/QA tool. Check it opens in the
   game, clicks and keys work, and progress survives a reload.
3. Submit `…-basic.zip` with the listing, three covers and two videos.
4. Basic Launch runs at least 7 days and 500 plays (21 days at most). It is
   judged on playtime, how many visitors start playing, and retention.
5. If invited to Full Launch, upload `…-full.zip` as the new version.

## CrazyGames rules this keeps

- Ads only through their SDK.
- Midgame ads only at natural breaks, at most one every 3 minutes.
- Rewards only on `adFinished`.
- No ad offer that can't play (Basic Launch, ad blocker, unfilled).
- Gameplay start/stop around every break.
- Playable with an ad blocker.
- Relative paths, no outside scripts.
- At most 1500 files and 50 MB.

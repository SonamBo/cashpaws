# Working in this repo

This is a mobile game built on a reusable **shell**: an Android app (a WebView
around plain HTML/JS) that already has analytics, ads, a coin economy, cats,
daily tasks, a Rewards Box, Bell Quest, reminders, a tutorial system, a save
system and a CI pipeline that builds a Play-ready bundle. It also builds for
the web (CrazyGames) from the same code, and has tools for store art and
trailers. The **game** is one folder that plugs into it. Cash Paws (Money Sort) is the original app; other
apps are made from the starter repo, which is Cash Paws with its game and
identity taken out.

Read `docs/GAME-MODULE.md` before writing any game code. It is the contract
between the shell and a game, and everything below assumes it.

## Who owns what

The rule that keeps updates painless: **an app built from the starter changes
only the files it owns.** Shell fixes arrive with `git pull upstream main`, and
they merge cleanly only if the shared files were left alone.

| Yours: change freely | Shared: don't edit in an app built from the starter |
|---|---|
| `www/app.config.js`: name, package, version, privacy URL | `www/shell/`: the shell |
| `www/games/<your-id>/`: your game, its art, styles, events, `web.json` and `web.css` | `www/games/template/`: the reference game; copy it, don't edit it |
| `www/games/active.js`: which game is installed | `www/index.html`, `www/css/` |
| `test/games/<your-id>/`: your game's tests | `android/` except the files listed on the left |
| `www/img/logo.png`, `www/img/tagline.png` | `.github/workflows/android.yml` |
| Launcher icons: `android/app/src/main/res/mipmap-*/`, `drawable/ic_launcher_foreground.xml` | `test/*.js`, `test/*.mjs`, `test/preflight.js` |
| `android/app/google-services.json` (Firebase) | `docs/GAME-MODULE.md`, `docs/ANALYTICS.md`, `docs/BELL-QUEST.md`, `docs/DESIGN-SYSTEM.md` |
| `android/ads.properties` (AdMob IDs) | `BUILDING.md`, `RELEASING.md`, `SETUP.md`, this file |
| `README.md`, `docs/PRIVACY-POLICY.md`, `play-assets/` | `tools/` (including `tools/marketing/`), `serve.js`, `build-single.mjs` |
| `marketing/`: brand kit, references, trailer script, store listings and art | `platforms/`: the web build (CrazyGames), and `.github/workflows/crazygames.yml` |

If a task seems to need a shell change, first look for a way through the
contract (`host`, the manifest fields, `host.track`, `host.cards`). If there is
none, stop and tell the person: the change belongs in Cash Paws, from where it
reaches every app. A local edit to a shared file is a merge conflict waiting
for the next update. If they still want it, keep it as small as possible and
say which file was changed, so they know to expect the conflict.

**Internal names stay as they are.** The JS bridges (`window.CashPawsAds`,
`CashPawsAnalytics`, `CashPawsNotify`, `window.CashPaws`), the Java/Kotlin
package `com.pixelartgames.cashpaw`, `Theme.CashPaws` and the `cashpaws.*`
storage keys are the shell's plumbing. Players never see them, and the published
package name comes from `applicationId` in `www/app.config.js`, not from the
code's package. Renaming them breaks every future update.

## Making a new game

1. Copy `www/games/template/` to `www/games/<id>/`, set `id: '<id>'` in its
   `index.js` (it must equal the folder name), and point `www/games/active.js`
   at it.
2. Build the game inside `create(host, root)`. Import only from your own folder;
   everything else arrives through `host`. Load art with `host.asset('img/…')`.
3. Wire it into the shell so the shared features light up:

| To get | The game does |
|---|---|
| The header, lobby line and best-level tracking | `host.progress({ title, fraction, figure, sub, level, summary })` on every change |
| Ad breaks (interstitials, at each level's end past level 10) | report each win with `host.levelWon({ level })` (the level reached) and `await host.levelBreak()` before the next level starts |
| Short of coins | `await host.shortOf({ price, what, ad, adLabel })`: coin packs first, then a rewarded ad; `host.shortHelps(ad)` keeps a button tappable |
| `level_up` / `level_lost` analytics and Bell Quest steps | `host.levelWon(info)` / `host.levelLost(info)`; `await host.levelBreak()` between a level's celebration and the next |
| Bell Quest at all | `quest: { unlockLevel, steps }` in the manifest; `await host.confirmLevelLoss()` before any loss the player chooses |
| Daily tasks | a `tasks` catalogue in the manifest, and `host.stat(key)` as things happen |
| Rewards Box value | `rewardValue()` on the instance, growing with the game's costs |
| Rewarded ads | `host.rewarded.available(placement)` then `await host.rewarded.show(placement)` |
| Cat perks and Shop cosmetics | `perks` and `cosmetics` in the manifest, `setPerk` / `setCosmetic` on the instance |
| A first-time tutorial | `host.coach.*` with `host.flag` / `host.setFlag` to remember it ran |
| The game's own events | `host.track(name, params)`. List them in `www/games/<id>/EVENTS.md`, not in `docs/ANALYTICS.md` |
| Coins | `host.wallet.earn(n, reason)` / `spend(n, reason)`; never keep a separate currency |
| Coin packs (real money) | nothing: the shell sells them in the Shop when `www/app.config.js` lists `coinPacks` (`SETUP.md` 7b). Coins bought arrive in the same wallet; a game never talks to billing |
| Sound | `host.sound(name)` on the game's own moments (lift, drop, bank, levelup, flow, sort, undo, error…: `www/shell/sound.js`). The shell already plays music, button ticks, celebrations and rewards, honours the Settings switches, and goes quiet during ads and in the background |

The shell already sends `app_ready`, `screen_view`, the economy events, daily
task, Rewards Box, Bell Quest, ad and reminder events for any game (full list:
`docs/ANALYTICS.md`). Don't duplicate them.

4. For the web (CrazyGames), add `www/games/<id>/web.json`: the game's keys,
   PC wording and styles, and what must stay on screen. See
   `platforms/crazygames/README.md`; copy the template's.

## On the web: CrazyGames

`platforms/crazygames/` packages the installed game for CrazyGames, without
touching `www/` or `android/`. It is a copy with a web page around it:
- The ad bridge the shell already looks for, backed by the CrazyGames SDK
  instead of AdMob.
- Gameplay and loading events, sent to CrazyGames.
- Cloud saves through the CrazyGames Data module.
- Opening straight into the game.
- Mouse and keyboard.

```bash
node platforms/crazygames/build.mjs                 # dist/crazygames/<app>-crazygames-{basic,full}.zip
node platforms/crazygames/test/crazygames.mjs       # the shell on the web (Playwright)
node test/games/<id>/crazygames.mjs                 # the game's own web checks, if any
```

CI does both in `.github/workflows/crazygames.yml`, separately from the
Android build. Submit the **basic** zip first (Basic Launch has ads off). Send
the **full** one when CrazyGames invites the game to Full Launch. The game
adds keys and PC wording through `web.json`; never edit `platforms/` for one
game.

## Marketing

Store art, trailers and listing text live in `marketing/`. Each store has its
own folder, for example `marketing/crazygames/LISTING.md`, `COVER-PROMPTS.md`
and `covers/`.
- **Read `marketing/BRAND.md` first:** title lettering, characters, palette,
  voice and references.
- **Images:** the person generates them with an image model from the prompts.
  `python3 tools/marketing/make-covers.py <store> <images…>` crops and sizes
  them exactly, and warns if one was enlarged or cut too much.
- **Trailers:** `node tools/marketing/record-preview.mjs` records real
  gameplay at store sizes (no sound, no cursor), following
  `marketing/showcase.mjs`, the game's scripted trailer. Build the web version
  first.
- If the `marketing-creatives` skill is available, follow it: it has every
  store's specs and rules.

## Identity and releases

- Everything that names the app is in `www/app.config.js`. Gradle and the shell
  both read it. It must stay strict JSON after `export default`.
- `applicationId` is permanent once the app is on Play. `com.example.*` is
  refused by Play; the pre-flight warns until it's changed.
- **Bump `versionCode` in `www/app.config.js` for every Play upload**, even a
  one-line fix. Play rejects a number it has seen. `versionName` is cosmetic.
- Debug builds always use Google's test ads. Release builds use
  `android/ads.properties`; with no file there, release builds show no ads.
- Firebase is on when `android/app/google-services.json` exists, off otherwise.
- Never commit a keystore. Signing comes from four GitHub secrets (`SETUP.md`).

## Before every push

```bash
node test/preflight.js   # 2 s: missing files, contract breaks, leftover Cash Paws IDs
node test/run.js         # the shell's rule tests plus test/games/<id>/*.js
```

CI runs both, then builds. After changing `www/shell/sound.js`, run
`node tools/sound-preview.mjs` (with the dev server up): it renders every
effect and the music to `dist/sound/sound-preview.wav` and fails on clipping
or silence. `test/sound.mjs` checks unlocking, the switches and ad silence.
`test/billing.mjs` checks coin packs against a stand-in for Google Play: paid
once, saved before consuming, pending, cancelled, restarts. To play it in a browser: `node serve.js 8080` and
open `http://localhost:8080/?dev=1` (the dev panel shows the game's `dev`
buttons and readout). With that server running, `node test/shell.mjs` checks
the shell still works around the game (needs Playwright); put the game's own
browser tests in `test/games/<id>/` too.

If a CI build fails, ask the person for the log zip from the failed run and
read the "What went wrong" section of the failing step.

## Pulling shell updates

```bash
git pull upstream main
node test/preflight.js && node test/run.js
```

`SHELL-VERSION` says which Cash Paws release the shell came from. A conflict
means a shared file was edited locally: keep upstream's version unless the
person knows why theirs differs.

## In the Cash Paws repo itself

Here the game is `www/games/money-sort/`, and shell changes are welcome: after
each green build, `.github/workflows/starter.yml` runs
`tools/export-starter.mjs` and pushes the result to the starter repo, which is
how fixes reach every other app. Keep the shell and `platforms/` game-agnostic
(nothing about tubes, chips or Money Sort outside its folder: Money Sort's web
keys and wording are in its `web.json`), and add any new Cash Paws-only file
to the `PRIVATE` list in `tools/export-starter.mjs`. Cash Paws' `marketing/`
stays private; the starter gets a template from `tools/starter/marketing/`.
Files under `tools/starter/` become each app's own once they have it: adding
new ones is fine, but editing existing ones makes `git pull upstream`
conflict in every app. Put new guidance in shared files (this one, `SETUP.md`,
the READMEs under `platforms/`) instead. The export refuses to
run if a Cash Paws ID would leak.

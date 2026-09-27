# Releasing a new version

Everything you need to ship an update, in one place. Keep this file — it is the
project's memory, since a fresh chat with me starts with none.

## The only file you must edit

`android/app/build.gradle`, two lines near the top:

```gradle
versionCode 2          // a whole number. MUST go up every upload.
versionName "1.0.1"    // what players see. Yours to choose.
```

**`versionCode` is the one that matters.** Play permanently reserves every
number it has seen, including uploads to internal or closed tracks, and rejects
any repeat. It never goes down and never reuses a number, even for a build that
was rejected. Just add one each time: 2, 3, 4.

`versionName` is cosmetic. The usual convention is `1.0.1` for a fix, `1.1.0`
for new features, `2.0.0` for something substantial.

Currently set to **versionCode 13, versionName 1.8.0**, ready for your next
upload. Skipping a number is harmless; reusing one is not.

**`versionName` appears twice** — in `build.gradle` and as `APP_VERSION` in
`www/shell/main.js`. The pre-flight fails if they disagree.

## Then

```bash
node test/preflight.js     # two seconds, catches missing files
git add . && git commit -m "v1.0.1" && git push
```

Actions builds it. When the run finishes, download the **`cashpaws-release-aab`**
artifact from the bottom of the run page, unzip, and upload `app-release.aab` to
the Play Console.

## Current state

| | |
|---|---|
| Package | `com.pixelartgames.cashpaw` — permanent, never change it |
| Target API | 36 (Play's floor; raise when Google raises it) |
| Toolchain | AGP 8.7.3, Gradle 8.9, Kotlin 2.2.21 |
| Signing | four repo secrets, see `PLAY-STORE.md` |
| Privacy policy | https://pixelartgames000.github.io/privacy-policy/ — lobby gear, Settings |

## When Play raises the API floor again

It happens most years, and three things move together — changing `targetSdk`
alone fails the build:

- `compileSdk` and `targetSdk` in `android/app/build.gradle`
- the AGP version in `android/build.gradle`
- the Gradle version in `.github/workflows/android.yml`, in two places

Each compileSdk needs a minimum AGP, and each AGP needs a minimum Gradle.

## The privacy link and the no-internet promise

The privacy policy opens from the lobby gear. Because the app has no internet
permission, the Activity hands any outside address to the phone's browser rather
than loading it — `shouldOverrideUrlLoading` in `MainActivity.kt`.

The pre-flight fails if the link is removed, if that browser hand-off is
removed, or if anyone adds the `INTERNET` permission — the store listing
promises the app has none, and that promise is only true while the manifest
says so.

## Ads (since 1.5.0)

Keys live in `android/ads.properties` — the AppLovin **SDK key** and the Android
**rewarded ad unit ID**. They are not secret (both end up inside the APK), so the
file is committed. **Blank keys build an app with no ads at all**: no ad buttons,
no US opt-out, and Settings says "No ads". The pre-flight prints which you are
about to build.

AppLovin SDK is pinned at 13.6.3. Update it deliberately, and re-run a build.

Before an ads release reaches Play, all of these must match the build:
store listing (`docs/store-listing.md`), Data safety and Ads declaration
(`PLAY-STORE.md`), and the privacy policy (`docs/PRIVACY-POLICY.md`, published
on your GitHub Pages site). The pre-flight fails if the listing still claims
the app is ad-free.

## Workflow maintenance

GitHub deprecates action versions and runner images on its own schedule, and the
warnings show up as annotations on runs that still succeeded. They are not
errors. Everything is pinned in `.github/workflows/android.yml`:

| | pinned to |
|---|---|
| runner | `ubuntu-24.04` — not `ubuntu-latest`, which becomes Ubuntu 26 on 19 Oct 2026 |
| checkout, setup-node, setup-java | `v5` |

`setup-android` is **not in the workflow**: it tried to download API 36 preview
cmdline-tools and then accept its licence unattended, which the preview SDK
refuses. The runner already has API 35 tools pre-installed and AGP 8.7.3 builds
`targetSdk 36` with `compileSdk 35` — no download needed.

## Toolchain

| | |
|---|---|
| compileSdk | 35 (pre-installed on runner, no download) |
| targetSdk | 36 (Play's floor — this is the one that matters) |
| AGP | 8.7.3 |
| Gradle | 8.9 |
| Kotlin | 2.2.21 — bumped from 2.0.21 because Firebase's `play-services-measurement-impl` ships metadata version 2.2.0, which older compilers can't read |

When Play raises the floor again: bump `targetSdk` first. If the build still
passes with `compileSdk` one below, leave it there. Only bump `compileSdk` (and
with it AGP and Gradle) when the new API level's tools are no longer a preview
— otherwise you hit the unattended licence problem again.

When a warning names a new action version, bump just that one line. If a bumped
version does not exist, the run fails immediately with "unable to resolve
action", and reverting that one line fixes it.

## Code layout (since 1.1.0)

The app is a shell plus a swappable game — see `docs/GAME-MODULE.md`.

| | |
|---|---|
| `www/shell/` | lobby, header, tabs, cats, coins, save, settings, ads stub |
| `www/games/active.js` | **the one line that picks the installed game** |
| `www/games/money-sort/` | the shipping game |
| `www/games/template/` | Coin Catch — copy it to start a new game |

Before a release, check the pre-flight's "installed game" line says
`money-sort`. The swap test rewrites `active.js` while it runs and always puts
it back, but it is worth a glance.

## If a build fails

Open the failed step in Actions and read the first error, not the last. If the
**Pre-flight** or **Rule tests** step failed it is a game problem, not a build
problem, and points somewhere completely different.

## Plans

`docs/ROADMAP.md` — daily tasks, the rewards box, AppLovin.
`docs/ANALYTICS.md` — every analytics event, and the one-time Firebase console setup.
`docs/BELL-QUEST.md` — the Bell Quest event and how its prize was sized.
`docs/LEVEL-DESIGN.md` — level pacing, Hard levels, face-down chips, and how to retune them with `tools/tune.mjs`.

## Still open

- **Soot has no artwork** and plays as Patch. Four poses needed; see
  `docs/CAT-ART-PROMPTS.md`.
- **The peek pose** for the newer cats is a full body where Patch's is cropped
  at the chest, so worn cats sit smaller on the ledge than Patch does.
- **No bundled font.** Android falls back to Roboto, which reads flatter than
  the mockup. Drop a `.ttf` into `www/fonts/` and it is a one-line change.

# Publishing to the Play Store

The build now produces an `.aab` as well as an `.apk`. Everything below that I
could prepare is done; the rest needs a Play Console account, which only you
have.

## Identity

**Package name: `com.pixelartgames.cashpaw`** — matching the app already created
in the Play Console. The Kotlin package, the Gradle namespace and the
applicationId all agree, and `test/preflight.js` fails if they ever drift apart.

Debug builds install as `com.pixelartgames.cashpaw.debug`, so a test build and a
release build can sit on the same phone at once.

## Decide these before you upload

**Upload key.** You generate a keystore and Google holds the real signing key
(Play App Signing). Losing the upload key is recoverable; losing it *and*
declining Play App Signing is not. Keep the `.jks` somewhere you would keep a
passport.

**Version.** Currently `versionCode 1`, `versionName "1.0.0"`. Play rejects any
upload with a versionCode it has seen, so bump it every single time — even for
a one-line fix.

## 1. Make the upload key

```bash
keytool -genkeypair -v -keystore cashpaws-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias cashpaws
```

Then base64 it and add four repository secrets — Settings, Secrets and
variables, Actions:

```bash
base64 -w0 cashpaws-upload.jks     # macOS: base64 -i cashpaws-upload.jks
```

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the string above |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | `cashpaws` |
| `KEY_PASSWORD` | key password |

Never commit the `.jks`. `.gitignore` already excludes `*.jks`.

## 2. Build

Push. With `KEYSTORE_BASE64` present the workflow builds and uploads
**`cashpaws-release-aab`** alongside the APK. Download the artifact, unzip, and
you have `app-release.aab`.

The APK is built from the same code, so you can sideload and test exactly what
you are about to publish.

## 3. Store listing

Ready in `play-assets/`:

- `play-icon-512.png` — 512×512 icon, no transparency, square. Play applies its
  own mask, so do not round the corners yourself.
- `play-feature-1024x500.png` — feature graphic.

Still needed from you:

- **Two to eight phone screenshots**, 16:9 or 9:16, minimum 320px on the short
  side. Take them on a device; the ones in `docs/shots/` are desktop renders at
  the wrong aspect and will look off.
- **Short description**, 80 characters.
- **Full description**, up to 4000.
- **Privacy policy URL.** Play requires one for every app, including those that
  collect nothing.

## 4. Data safety — changed in 1.5.0

Since 1.5.0 the app serves ads through AppLovin MAX, so the Data safety form
changes from "no data collected". **The game's own data** — progress, coins,
cats — still stays on the phone and is not collected.

**AppLovin collects and shares data for advertising.** AppLovin does not publish
a definitive Data safety list, so confirm these against their current guidance
and your dashboard configuration. Ad SDKs of this kind typically require:

- **Device or other IDs** — the Advertising ID. Collected, shared.
- **Location: approximate** — derived from the IP address. Collected, shared.
- **App activity: app interactions** — which ads were seen and tapped.
- **App info and performance: crash logs, diagnostics.**

Purposes: advertising or marketing, analytics, fraud prevention. Data is
encrypted in transit. Users can opt out of interest-based ads through the
Advertising ID settings on their phone, and US users through the in-app
"Do not sell or share my personal information" switch.

Elsewhere in the Play Console:

- **App content → Ads:** "Yes, my app contains ads."
- **Target audience:** 13 and over. Apps aimed at children may not use AppLovin
  at all, so do not include under-13 age groups.
- **Advertising ID declaration:** yes, for advertising.

## 4a. app-ads.txt

AppLovin gives you the exact line under Account in their dashboard. It must be
served from the root of the developer website on your Play listing. For
`https://pixelartgames000.github.io`, that means a file named `app-ads.txt` at
the top level of the `pixelartgames000.github.io` repository.

## 5. Content rating

A sorting puzzle with no violence, no user content, no chat and no purchases.
Since 1.5.0, answer yes to ads when the questionnaire asks.

**One thing to declare honestly:** the game has an in-game shop that spends
coins earned by playing. There are no real-money purchases and no in-app billing
library. If Play asks about in-app purchases, the answer is no.

## Target API level

Set to **36**, which is Play's current floor. Raising it meant moving three
things together — bumping `targetSdk` alone fails the build:

| | was | now |
|---|---|---|
| compileSdk / targetSdk | 35 | 36 |
| Android Gradle Plugin | 8.7.3 | 8.9.2 |
| Gradle | 8.9 | 8.11.1 |

Google raises the floor most years. When it next moves, all three go up together.

## Before the first upload, check

- That the app opens to the lobby on a real device, plays, and keeps your
  progress after a force-close.
- Rotate the phone. Android 16 ignores portrait locks on larger screens, so
  landscape is no longer optional; the board lays its tubes in a single row
  there.

## What I cannot do

Build the `.aab` — this environment has no Android SDK and no network — and
anything that needs your Play Console. Send me the build log if CI fails.

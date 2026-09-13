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

## 4. Data safety

The honest answers are unusually simple, and worth getting right rather than
over-declaring:

- **Collects no data.** No analytics, no ads, no accounts, no crash reporting.
- **No data leaves the device.** The app has no `INTERNET` permission at all —
  the whole game is served from inside the APK. Worth stating in the listing.
- **One permission: `VIBRATE`**, for the tap when a tube banks.
- Saves are in the WebView's local storage, on the device only.

So: "No data collected", "No data shared", and data is not encrypted in transit
because none is transmitted.

## 5. Content rating

A sorting puzzle with no violence, no user content, no chat and no purchases.
The questionnaire should return everyone / PEGI 3.

**One thing to declare honestly:** the game has an in-game shop that spends
coins earned by playing. There are no real-money purchases and no in-app billing
library. If Play asks about in-app purchases, the answer is no.

## Before the first upload, check

- Whether Play's required `targetSdk` has moved past 35. It is set in
  `android/app/build.gradle`, and Google raises the floor most years; an upload
  below it is rejected outright.
- That the app opens to the lobby on a real device, plays, and keeps your
  progress after a force-close.

## What I cannot do

Build the `.aab` — this environment has no Android SDK and no network — and
anything that needs your Play Console. Send me the build log if CI fails.

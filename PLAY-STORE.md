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
**`app-release-aab`** alongside the APK. Download the artifact, unzip, and
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

## 4. Data safety: ads (Google AdMob since 1.12.0)

The app serves rewarded ads through Google AdMob, so the Data safety form is
not "no data collected". **The game's own data** (progress, coins, cats)
still stays on the phone and is not collected.

**The Google Mobile Ads SDK collects and shares data for advertising.** Google
publishes the exact list in "Data disclosure for the Google Mobile Ads SDK"
(search that title in the AdMob help centre); match the form to it. It
currently comes down to:

- **Device or other IDs** — the Advertising ID. Collected, shared.
- **Location: approximate** — derived from the IP address. Collected, shared.
- **App activity: app interactions** — which ads were seen and tapped.
- **App info and performance: crash logs, diagnostics.**

Purposes: advertising or marketing, analytics, fraud prevention. Data is
encrypted in transit. Users can opt out of interest-based ads through the
Advertising ID settings on their phone. US users get Google's "do not sell or
share" choice, set up in AdMob under Privacy & messaging, and reachable any
time from the game's Settings.

Elsewhere in the Play Console:

- **App content → Ads:** "Yes, my app contains ads."
- **Target audience:** 13 and over. Do not include under-13 age groups: the
  app isn't built for Google's Families ad rules.
- **Advertising ID declaration:** yes, for advertising.

## 4b. Data safety — added in 1.8.0: Firebase

Firebase Analytics and Crashlytics are built in, so the form gains these.
Google processes this data for you as a service provider, which Play does not
count as "sharing", so mark each one **collected, not shared**:

- **App activity → App interactions:** levels, Sorts, taps on features. Purpose:
  Analytics.
- **App activity → Other actions:** in-game coins earned and spent. Purpose:
  Analytics.
- **App info and performance → Crash logs** and **Diagnostics.** Purpose:
  Analytics.
- **Device or other IDs:** the Firebase app-instance ID. Purpose: Analytics.
  This is already ticked for ads, as collected and shared; keep that.

Then answer:
- Is data encrypted in transit? **Yes.**
- Can users request deletion? **Yes**, by email, per the privacy policy.
- Is collection optional? **No** for analytics, since it runs when the app does.

Republish the privacy policy (`docs/PRIVACY-POLICY.md`) **before** releasing
1.8.0, because it now names Firebase.

## 4c. Data safety: purchases (1.16.0)

Google Play processes the payment itself; the app never sees payment details.
Firebase Analytics logs each purchase automatically (`in_app_purchase`: the
pack, price and currency), so add:

- **Financial info → Purchase history.** Collected, not shared. Purpose:
  Analytics. Not optional.

Leave **Financial info → User payment info** unticked: card, bank and UPI
details stay with Google. Republish the privacy policy (it gained a Purchases
section) before releasing 1.16.0.

## 4d. Data safety: Play Games, rating, share (1.18.0)

- **Play Games Saved Games** stores the player's progress in their Google
  account. Google publishes what the Play Games SDK collects ("Data
  disclosure" in the Play Games services docs): match the form to it. Our own
  part: **App activity → Other actions** (game progress), collected, not
  shared, purpose **App functionality**.
- **In-app review** and **share** send nothing of ours: Google's sheet and the
  phone's share menu.

Republish the privacy policy (new sections: Play Games backups, ratings and
sharing) before releasing 1.18.0.

## 4a. app-ads.txt

AdMob shows the exact line under Apps → View all apps → app-ads.txt. For this
account it should be:

```
google.com, pub-5379524261124242, DIRECT, f08c47fec0942fa0
```

Copy it from the console rather than from here, in case it differs. It must be
served from the root of the developer website on your Play listing. Remove any
line left over from an earlier ad network: it's no longer used. For
`https://pixelartgames000.github.io`, that means a file named `app-ads.txt` at
the top level of the `pixelartgames000.github.io` repository.

## 5. Content rating

A sorting puzzle with no violence, no user content and no chat. Since 1.5.0,
answer yes to ads when the questionnaire asks.

**Since 1.16.0 there are real-money purchases:** coin packs, through Google
Play Billing. When the questionnaire asks whether users can buy digital goods,
the answer is **yes**. The coins can't be cashed out or traded, and nothing
is random (no loot boxes), so the other purchase questions are no. The store
listing shows "In-app purchases" by itself once a product is active.

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

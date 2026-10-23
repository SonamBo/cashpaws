# Setting up a new app from the starter

The starter is a complete Android game with a placeholder game (Coin Catch) in
it. It builds as-is. This page turns it into **your** app: your repo, your
name, your Firebase, your ads, your signing key. Allow an afternoon; most of
it is waiting for consoles.

Your Claude reads `CLAUDE.md` for how to work in the code. This page is the
part only a person can do, because it needs your accounts.

## 1. Your own repo, linked to the starter for updates

Use `git clone`, not GitHub's "Use this template" button. A template copy has
no shared history with the starter, so shell updates could never be pulled.

1. On GitHub, create an **empty** repository for your game (no README).
2. On your computer:

```bash
git clone https://github.com/<starter-owner>/<starter-repo>.git my-game
cd my-game
git remote rename origin upstream        # the starter: you pull updates from it
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

Every push builds a debug APK in GitHub Actions (Actions tab, then the run,
then the **app-debug** artifact). Install it on a phone to see the starter
running with Google's test ads.

**Getting shell updates later:** `git pull upstream main`, then push. That's
all. It merges cleanly as long as you only changed the files `CLAUDE.md` marks
as yours.

## 2. Name the app

Edit `www/app.config.js`:

| Field | What to put |
|---|---|
| `name` | The name under the icon and in Settings |
| `applicationId` | Your package, e.g. `com.yourstudio.yourgame`. Lowercase, dots, permanent once on Play. Must match the app you create in Play Console. |
| `versionCode` / `versionName` | Start at 1 / "1.0.0". Bump `versionCode` for every upload. |
| `privacyUrl` | Where your privacy policy will live (step 6) |
| `contactEmail` | The support address on your Play listing |

Then replace the placeholders: `www/img/logo.png` (199×132) and
`www/img/tagline.png` (180×17) for the lobby; the launcher icons in
`android/app/src/main/res/mipmap-*/` (`ic_fg.png` is the adaptive foreground
on a 108 dp canvas, keep the art inside the middle 66 dp);
`drawable/ic_launcher_foreground.xml` for the themed (monochrome) icon; and
`play-assets/play-icon-512.png` for the store.

## 3. Firebase (analytics and crash reports)

Optional: without it the app runs and sends nothing.

1. [console.firebase.google.com](https://console.firebase.google.com): Add
   project. Turn Google Analytics on.
2. Add an Android app with your `applicationId`. Add a second one with
   `.debug` on the end; that's your test builds, kept apart from real players.
3. Download `google-services.json` (it covers both apps once both exist) and
   put it at `android/app/google-services.json`. It's safe to commit.
4. Analytics → Admin → Data settings → Data retention: 14 months.
5. Then work through "Set up once in the Firebase console" in
   `docs/ANALYTICS.md`.

## 4. AdMob (ads)

Optional: without it, release builds show no ads. Debug builds always show
Google's test ads, so you can build everything before this.

1. [admob.google.com](https://admob.google.com): Apps → Add app → Android.
   Once it's on Play, link it to the store listing (App settings).
2. Create two ad units: **Rewarded** (used for every rewarded placement) and
   **Interstitial** (the Ad breaks).
3. Create `android/ads.properties`:

```properties
appId=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
rewardedAdUnit=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
interstitialAdUnit=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
```

4. Privacy & messaging: create the **US state regulations** message (and a
   GDPR one if you'll ship in Europe). The game shows "Do not sell or share
   my personal information" in Settings whenever Google says it applies.
5. app-ads.txt: AdMob shows a line under Apps → app-ads.txt. Serve it at the
   root of the developer website on your Play listing.
6. AdMob → Settings → Linked services: link to your Firebase project, so ad
   revenue appears in Analytics.
7. Add your own phone under Settings → Test devices before testing a release
   build. Tapping your own real ads can get the account suspended.

To see why an ad isn't showing on a phone: Settings in the game, tap the
version line five times.

## 5. Signing key (for Play)

Generate it once and keep it as safe as a passport. Losing it without Play
App Signing means you can never update the app.

```bash
keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release
base64 -w0 release.jks     # macOS: base64 -i release.jks
```

In your GitHub repo: Settings → Secrets and variables → Actions → New
repository secret, four times:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the base64 output |
| `KEYSTORE_PASSWORD` | the keystore password |
| `KEY_ALIAS` | `release` (or whatever you chose) |
| `KEY_PASSWORD` | the key password |

Never commit the `.jks`. From the next push, the run also has
**app-release-aab**: that's what you upload to Play.

## 6. Privacy policy

Fill in every «placeholder» in `docs/PRIVACY-POLICY.md` and publish it at your
`privacyUrl`. A free GitHub Pages repo works. Play needs it before any upload,
and the game links it from Settings.

## 7. Play Console

1. Create the app with exactly your `applicationId` as the package name.
2. App content:
   - **Ads:** yes.
   - **Target audience:** 13 and over (the ads aren't set up for children).
   - **Advertising ID:** yes, for advertising and analytics.
   - **Data safety:** device or other IDs, approximate location, app
     interactions, crash logs and diagnostics. Collected and shared for ads
     (AdMob), collected for analytics (Firebase). Encrypted in transit; users
     can ask for deletion by email.
   - **Content rating:** answer for your game; say yes to ads. If you sell
     coin packs (section 7b), say yes to buying digital goods.
   - **Data safety, with coin packs:** add Financial info → Purchase history,
     collected for analytics (Firebase logs each purchase).
3. Upload `app-release.aab` to Internal testing first and try it on a phone.

## 7b. Coin packs (optional)

Players can buy coins with real money through Google Play. The code is all
in the shell (`www/shell/billing.js`, `android/.../Billing.java`); an app
turns it on by listing its packs in `www/app.config.js`:

```json
"coinPacks": [
  { "id": "coins_500", "coins": 500, "name": "Pocket change" },
  { "id": "coins_3500", "coins": 3500, "name": "Piggy bank", "tag": "Most popular" }
]
```

`id` is the product ID in Play Console (lowercase, permanent once created),
`coins` what the pack adds, `tag` an optional ribbon. Prices are set in Play
Console, never in code; the Shop shows Play's price in the player's currency
and works out "+N% extra" from them. Without `coinPacks` nothing is for sale
and the Shop says so. Then:

1. **Payments profile:** Play Console → Settings → Payments profile. Needed
   before any product can be created (a merchant account; Google asks for
   bank and tax details).
2. **Upload a build that has `coinPacks`** to Internal testing. Play only lets
   you create products after it has seen the billing library in a bundle.
3. **Create the products:** Monetize with Play → Products → One-time
   products → Create, once per pack, with exactly the IDs from
   `coinPacks`. Give each a name, description and price, then **Activate**.
4. **Testers:** Settings → License testing: add your Google account. Testers
   see test cards ("always approves", "always declines", "slow") and are
   never charged.
5. **Test on a phone** with the app **installed from the internal testing
   link**, signed in as a tester. A debug build, or a release APK installed
   by hand, finds no products. Settings → tap the version 5 times → the
   testing card's **Purchases** line says what Play answered.

## 8. CrazyGames (optional, any time)

The same game runs on CrazyGames with no extra code. Every push runs the
**CrazyGames** workflow, which attaches `crazygames-zips` to the run.

1. Account at [developer.crazygames.com](https://developer.crazygames.com).
2. Fill in `marketing/BRAND.md` and add the reference images it lists.
3. Fill in `marketing/crazygames/LISTING.md` (the form text) and use
   `COVER-PROMPTS.md` in an image model for the three covers. Size them with
   `python3 tools/marketing/make-covers.py crazygames landscape.png portrait.png square.png`.
4. Adjust `marketing/showcase.mjs` so the trailer shows your game at its best.
   Then run `node platforms/crazygames/build.mjs` and
   `node tools/marketing/record-preview.mjs` (with `--cover-landscape` and
   `--cover-portrait`) for the two videos.
5. Preview the **basic** zip in their QA tool, then submit it with the
   listing, covers and videos. Upload the **full** zip only when CrazyGames
   invites the game to Full Launch.

Details: `platforms/crazygames/README.md`.

## Checklist

- [ ] Own repo, `upstream` pointing at the starter
- [ ] `www/app.config.js` filled in; `node test/preflight.js` has no IDENTITY or WARNING lines
- [ ] Logo, tagline and icons replaced
- [ ] Firebase: two apps, `google-services.json` committed
- [ ] AdMob: app, two units, `ads.properties`, US message, app-ads.txt, Firebase link
- [ ] Four signing secrets; the run produces `app-release-aab`
- [ ] Privacy policy published at `privacyUrl`
- [ ] Play Console app created with the same package; Data safety done
- [ ] (Optional) CrazyGames: brand kit, listing, covers, videos, basic zip submitted

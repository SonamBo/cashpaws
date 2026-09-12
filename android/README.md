# Cash Paws — Android shell

A single WebView hosting `../www`. No Capacitor, no Cordova, no npm.

## Why not Capacitor

Capacitor is the obvious choice and it was the plan, but it could not be
installed offline, and on inspection it buys very little here: this game is one
screen of HTML with no native APIs beyond vibration. A hand-written shell is
about 250 lines, has no JavaScript toolchain, no plugin versions to keep in
step, and produces a smaller APK.

The tradeoff is real and worth knowing: if you later want AdMob or in-app
purchases, Capacitor's plugin ecosystem would have saved you work. Adding
either here means Google Play Billing or the AdMob SDK natively, or migrating
to Capacitor at that point. Nothing in `www/` would change.

## The one thing that shapes the design

The game uses ES modules and `localStorage`. Both break on a `file://` origin in
a WebView: modules are refused as cross-origin, and storage gets an opaque
origin that does not persist. So assets are served through
`WebViewAssetLoader` from `https://appassets.androidplatform.net/assets/www/`.
That is a real origin with no network behind it — the loader reads straight out
of the APK.

## Source of truth

`www/` is the only copy of the game. Gradle's `copyWebApp` task syncs it into
`app/src/main/assets/www/` before every build, and that folder is gitignored.
Never edit it by hand.

## Build

See `../BUILDING.md`. The short version: push to GitHub and the workflow builds
it for you, or open this folder in Android Studio.

Versions are pinned in `build.gradle` to AGP 8.7.3 and Kotlin 2.0.21, compiling
against SDK 35 with a minimum of 24 (Android 7, roughly 98% of devices). If
Android Studio offers to upgrade AGP, accepting is safe.

## What the shell does

- Portrait locked, zoom disabled, system font scaling ignored so the board
  never reflows.
- Draws edge to edge, then pads the WebView by the system bar and cutout
  insets. Safe areas are handled natively, so the CSS does not have to guess.
- Back is routed into the game first. An open panel closes; an open decision
  card swallows the press so a choice cannot be skipped; an idle board lets
  back leave the app.
- `onPause` tells the game to flush its save before the process can be killed.
- Adaptive launcher icon and splash, drawn from the same cat as the game.

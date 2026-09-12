# Building the APK

Three ways, in order of how little you need installed.

## 1. GitHub Actions — nothing installed

Push the repo to GitHub. `.github/workflows/android.yml` runs on every push and
can also be triggered by hand from the Actions tab.

It runs the engine's rule tests first and fails fast if they break, then builds
the APK. When it finishes, the `cashpaws-debug` artifact on the run page is your
installable APK. Roughly four minutes cold, under two once Gradle's cache warms.

No signing setup is needed for the debug build, and a fresh clone or a fork
builds without any secrets at all.

## 2. Android Studio

Open the `android/` folder — not the repo root. Android Studio supplies Gradle,
writes the wrapper, and downloads the SDK on first sync. Then press Run, or
Build > Build Bundle(s) / APK(s) > Build APK(s).

## 3. Command line

Needs a JDK 17 and the Android SDK, with `ANDROID_HOME` set.

```bash
cd android
gradle wrapper --gradle-version 8.9   # only needed once
./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`.

There is no `gradlew` committed because a Gradle wrapper needs a binary jar that
could not be produced in the offline environment this was built in. All three
routes above generate it.

## Signing a release

Debug APKs install fine for testing but cannot go on Play. For a release you
need your own keystore. Generate it once and keep it somewhere safe — losing it
means you can never update the app on Play again:

```bash
keytool -genkeypair -v -keystore cashpaws-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias cashpaws
```

### Signing in CI

Never commit the keystore. Base64 it and store it as a secret:

```bash
base64 -w0 cashpaws-release.jks     # macOS: base64 -i cashpaws-release.jks
```

In the repo, Settings > Secrets and variables > Actions, add four secrets:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the base64 string above |
| `KEYSTORE_PASSWORD` | the keystore password |
| `KEY_ALIAS` | `cashpaws` |
| `KEY_PASSWORD` | the key password |

With `KEYSTORE_BASE64` present the workflow also builds and uploads
`cashpaws-release`. With it absent those steps are skipped, so nothing breaks.

### Signing locally

The build reads the same four values from the environment:

```bash
cd android
KEYSTORE_FILE=/absolute/path/cashpaws-release.jks \
KEYSTORE_PASSWORD=... KEY_ALIAS=cashpaws KEY_PASSWORD=... \
./gradlew assembleRelease
```

With `KEYSTORE_FILE` unset, the release build is simply unsigned rather than
failing.

## Expect the first build to fail

The Kotlin in `android/` has never been compiled. It was written without an
Android SDK available, so while it has been reviewed statically — balanced
syntax, no unused imports, every resource reference resolving — the first real
compile is the first honest test of it.

If it fails, the error will almost certainly be one of:

- **A dependency version that has moved on.** `androidx.webkit`, `core-ktx`,
  `activity-ktx` and `core-splashscreen` are pinned in `app/build.gradle`.
- **AGP or Kotlin version.** Pinned to AGP 8.7.3 and Kotlin 2.0.21 in
  `android/build.gradle`. Android Studio will offer an upgrade; taking it is
  safe.
- **A compileSdk that does not exist yet on the runner.** Set to 35.

Paste the error and it is usually a one-line fix.

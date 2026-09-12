# Getting your APK

You need a GitHub account. Nothing else — no Android Studio, no SDK, no Java.

## 0. Check before you push

```bash
node test/preflight.js
```

It verifies every file the build needs is actually present. Two seconds, and it
catches the class of mistake that broke the first attempt.

## 1. Create an empty repo

github.com > New repository. Private is fine. Do not add a README or a
.gitignore; the repo already has one.

## 2. Push this folder

From inside the unzipped `cashpaws` folder:

```bash
git init
git add .
git commit -m "Cash Paws"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/cashpaws.git
git push -u origin main
```

## 3. Collect the APK

The push starts the build. Open the **Actions** tab, click the running job, and
wait — about four minutes the first time, under two after that.

When it finishes, scroll to **Artifacts** at the bottom of the run page and
download **cashpaws-debug**. Unzip it and you have `app-debug.apk`.

## 4. Install it

Copy the APK to your phone and open it. Android will ask you to allow installs
from that source; that is normal for an APK outside the Play Store.

---

## If the build fails

It may well fail the first time. The Kotlin in `android/` has never been
compiled — this project was built in an environment with no Android SDK and no
network, so CI is its first real compiler.

Open the failed step, copy the error, and send it to me. The likely causes are
all one-line fixes: a dependency version that has moved, an AGP or Kotlin
mismatch, or a compileSdk not yet on the runner. Pinned versions live in
`android/build.gradle` and `android/app/build.gradle`.

The engine job runs first and is pure Node, so if that one fails it is a game
logic problem, not a build problem.

## Signing a release

Only needed for the Play Store. `BUILDING.md` covers it.

// Everything that makes this app this app. The Android build (app/build.gradle)
// and the shell both read it, so nothing else needs renaming. Keep it strict
// JSON after "export default": Gradle parses it with a JSON reader.
// versionCode must go up for every Play upload.
export default {
  "name": "Cash Paws",
  "applicationId": "com.pixelartgames.cashpaw",
  "versionCode": 28,
  "versionName": "1.17.0",
  "privacyUrl": "https://pixelartgames000.github.io/privacy-policy/",
  "contactEmail": "pixelartgames000@gmail.com",
  "coinPacks": [
    { "id": "coins_500", "coins": 500, "name": "Pocket change" },
    { "id": "coins_1200", "coins": 1200, "name": "Coin purse" },
    { "id": "coins_3500", "coins": 3500, "name": "Piggy bank", "tag": "Most popular" },
    { "id": "coins_8000", "coins": 8000, "name": "Treasure chest", "tag": "Best value" }
  ]
};

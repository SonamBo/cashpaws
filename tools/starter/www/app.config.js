// Everything that makes this app this app. The Android build (app/build.gradle)
// and the shell both read it, so nothing else needs renaming. Keep it strict
// JSON after "export default": Gradle parses it with a JSON reader.
// versionCode must go up for every Play upload.
export default {
  "name": "My Game",
  "applicationId": "com.example.mygame",
  "versionCode": 1,
  "versionName": "1.0.0",
  "privacyUrl": "https://example.com/privacy-policy/",
  "contactEmail": "you@example.com"
};

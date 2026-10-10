# The web layer is the app; nothing calls into Kotlin by reflection.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

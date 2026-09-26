# The web layer is the app; nothing calls into Kotlin by reflection.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AppLovin bundles IAB's Open Measurement SDK, which optionally references
# Amazon's Privacy Pass attestation classes for Amazon's ad stack. We don't
# depend on that stack, so the classes are genuinely absent, not a real bug —
# without this, R8 treats the missing reference as fatal instead of a warning.
-dontwarn com.amazon.privacypass.**

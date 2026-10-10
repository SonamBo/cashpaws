package com.pixelartgames.cashpaw;

import android.content.Context;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

import org.json.JSONObject;

import java.util.Iterator;

/**
 * The bridge between the game and Firebase (Analytics and Crashlytics). The
 * page sees it as window.CashPawsAnalytics; shell/analytics.js is the only
 * code that talks to it, and it has already cleaned names and values.
 *
 * Firebase starts itself from google-services.json before onCreate. Nothing
 * here can crash the app: a bad event is dropped, never thrown.
 *
 * Ad revenue: AdMob reports it to Firebase itself (ad_impression) once the
 * AdMob app is linked to the Firebase project, so nothing here logs it.
 * Consent for ads is handled by Google's UMP in Ads.java.
 */
public final class Analytics {

    private final FirebaseAnalytics fa;

    public Analytics(Context context) {
        fa = FirebaseAnalytics.getInstance(context);
    }

    /* ---------------- called from the page ---------------- */

    @JavascriptInterface
    public boolean isEnabled() {
        return true;
    }

    /** `params` is a flat JSON object of strings and numbers. */
    @JavascriptInterface
    public void logEvent(String name, String params) {
        try {
            Bundle b = new Bundle();
            JSONObject o = new JSONObject(params == null || params.isEmpty() ? "{}" : params);
            for (Iterator<String> it = o.keys(); it.hasNext(); ) {
                String k = it.next();
                Object v = o.get(k);
                if (v instanceof Integer || v instanceof Long) b.putLong(k, ((Number) v).longValue());
                else if (v instanceof Number) b.putDouble(k, ((Number) v).doubleValue());
                else if (v instanceof Boolean) b.putLong(k, ((Boolean) v) ? 1 : 0);
                else b.putString(k, String.valueOf(v));
            }
            fa.logEvent(name, b);
            FirebaseCrashlytics.getInstance().log(name);       // breadcrumbs before a crash
        } catch (Throwable ignored) { }
    }

    @JavascriptInterface
    public void setUserProperty(String name, String value) {
        try {
            fa.setUserProperty(name, value);
            FirebaseCrashlytics.getInstance().setCustomKey(name, value == null ? "" : value);
        } catch (Throwable ignored) { }
    }

    /** A JavaScript error in the game, sent to Crashlytics as a non-fatal. */
    @JavascriptInterface
    public void reportError(String message, String stack) {
        try {
            Exception e = new Exception("JS: " + message);
            FirebaseCrashlytics.getInstance().log(stack == null ? "" : stack);
            FirebaseCrashlytics.getInstance().recordException(e);
        } catch (Throwable ignored) { }
    }
}

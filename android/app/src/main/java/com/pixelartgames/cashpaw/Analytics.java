package com.pixelartgames.cashpaw;

import android.content.Context;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

import org.json.JSONObject;

import java.util.EnumMap;
import java.util.Iterator;
import java.util.Map;

/**
 * The bridge between the game and Firebase (Analytics and Crashlytics). The
 * page sees it as window.CashPawsAnalytics; shell/analytics.js is the only
 * code that talks to it, and it has already cleaned names and values.
 *
 * Firebase starts itself from google-services.json before onCreate. Nothing
 * here can crash the app: a bad event is dropped, never thrown.
 *
 * The US "do not sell or share" switch is stored by Ads under its prefs, and
 * applied here too: ad personalisation and ad user data are denied, and the
 * matching user property is set, so Google does not use the data for ads.
 */
public final class Analytics {

    private static final String PREFS = "cashpaws.ads";      // shared with Ads
    private static final String DO_NOT_SELL = "doNotSell";

    private final FirebaseAnalytics fa;

    public Analytics(Context context) {
        fa = FirebaseAnalytics.getInstance(context);
        applyDoNotSell(context,
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(DO_NOT_SELL, false));
    }

    /** Also called by Ads when the player flips the switch in Settings. */
    public static void applyDoNotSell(Context context, boolean optOut) {
        try {
            FirebaseAnalytics fa = FirebaseAnalytics.getInstance(context);
            Map<FirebaseAnalytics.ConsentType, FirebaseAnalytics.ConsentStatus> consent =
                new EnumMap<>(FirebaseAnalytics.ConsentType.class);
            FirebaseAnalytics.ConsentStatus ads = optOut
                ? FirebaseAnalytics.ConsentStatus.DENIED
                : FirebaseAnalytics.ConsentStatus.GRANTED;
            consent.put(FirebaseAnalytics.ConsentType.AD_PERSONALIZATION, ads);
            consent.put(FirebaseAnalytics.ConsentType.AD_USER_DATA, ads);
            consent.put(FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE,
                FirebaseAnalytics.ConsentStatus.GRANTED);
            fa.setConsent(consent);
            fa.setUserProperty(FirebaseAnalytics.UserProperty.ALLOW_AD_PERSONALIZATION_SIGNALS,
                optOut ? "false" : "true");
        } catch (Throwable ignored) { /* never let analytics break the app */ }
    }

    /** Ad revenue from AppLovin MAX, in the shape Firebase reports as ad revenue. */
    public static void adImpression(Context context, String network, String format,
                                    String unit, String placement, double revenue) {
        try {
            Bundle b = new Bundle();
            b.putString(FirebaseAnalytics.Param.AD_PLATFORM, "appLovin");
            b.putString(FirebaseAnalytics.Param.AD_SOURCE, network);
            b.putString(FirebaseAnalytics.Param.AD_FORMAT, format);
            b.putString(FirebaseAnalytics.Param.AD_UNIT_NAME, unit);
            if (placement != null) b.putString("placement", placement);
            b.putDouble(FirebaseAnalytics.Param.VALUE, revenue);
            b.putString(FirebaseAnalytics.Param.CURRENCY, "USD");   // MAX always reports USD
            FirebaseAnalytics.getInstance(context).logEvent(FirebaseAnalytics.Event.AD_IMPRESSION, b);
        } catch (Throwable ignored) { }
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

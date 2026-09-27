package com.pixelartgames.cashpaw;

import android.app.Activity;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.applovin.mediation.MaxAd;
import com.applovin.mediation.MaxAdRevenueListener;
import com.applovin.mediation.MaxError;
import com.applovin.mediation.MaxReward;
import com.applovin.mediation.MaxRewardedAdListener;
import com.applovin.mediation.ads.MaxRewardedAd;
import com.applovin.sdk.AppLovinMediationProvider;
import com.applovin.sdk.AppLovinPrivacySettings;
import com.applovin.sdk.AppLovinSdk;
import com.applovin.sdk.AppLovinSdkInitializationConfiguration;

/**
 * The bridge between the game and AppLovin MAX. The page sees it as
 * window.CashPawsAds; shell/ads.js is the only code that talks to it.
 *
 * Written in Java on purpose: the MAX listener's parameters carry nullability
 * annotations that the published samples disagree about, and Kotlin refuses to
 * compile an override whose nullability does not match. Java does not care.
 *
 * With no SDK key or ad unit in android/ads.properties, nothing here starts:
 * isEnabled() reports false and the game shows no ad buttons at all.
 *
 * SDK: com.applovin:applovin-sdk 13.6.3. Uses MaxRewardedAd.getInstance(id),
 * the form without a Context; the Context-taking APIs are deprecated in 13.x.
 */
public final class Ads implements MaxRewardedAdListener, MaxAdRevenueListener {

    private static final String PREFS = "cashpaws.ads";
    private static final String DO_NOT_SELL = "doNotSell";

    private final Activity activity;
    private final WebView webView;
    private MaxRewardedAd rewarded;
    private String pendingCallback;
    private boolean earned;
    private int retryAttempt;

    public Ads(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public boolean enabled() {
        return !BuildConfig.ADS_SDK_KEY.isEmpty() && !BuildConfig.ADS_REWARDED_UNIT.isEmpty();
    }

    /** Call once from onCreate. The US opt-out must be set before the SDK starts. */
    public void start() {
        if (!enabled()) return;
        AppLovinPrivacySettings.setDoNotSell(prefs().getBoolean(DO_NOT_SELL, false));
        AppLovinSdkInitializationConfiguration config =
            AppLovinSdkInitializationConfiguration.builder(BuildConfig.ADS_SDK_KEY)
                .setMediationProvider(AppLovinMediationProvider.MAX)
                .build();
        AppLovinSdk.getInstance(activity).initialize(config, sdkConfig -> {
            rewarded = MaxRewardedAd.getInstance(BuildConfig.ADS_REWARDED_UNIT);
            rewarded.setListener(this);
            rewarded.setRevenueListener(this);     // ad revenue into Firebase
            rewarded.loadAd();
        });
    }

    private SharedPreferences prefs() {
        return activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    /* ---------------- called from the page ---------------- */

    @JavascriptInterface
    public boolean isEnabled() {
        return enabled();
    }

    @JavascriptInterface
    public boolean rewardedReady() {
        MaxRewardedAd ad = rewarded;
        return ad != null && ad.isReady();
    }

    /**
     * Show a rewarded ad. The result comes back asynchronously through
     * window.__adResult(callbackId, earned) once the ad is closed.
     */
    @JavascriptInterface
    public void showRewarded(String placement, String callbackId) {
        activity.runOnUiThread(() -> {
            MaxRewardedAd ad = rewarded;
            if (ad == null || !ad.isReady() || pendingCallback != null) {
                reply(callbackId, false);
                return;
            }
            pendingCallback = callbackId;
            earned = false;
            ad.showAd(activity);
        });
    }

    /** The US "do not sell or share" choice from Settings. Remembered across launches. */
    @JavascriptInterface
    public void setDoNotSell(boolean value) {
        prefs().edit().putBoolean(DO_NOT_SELL, value).apply();
        if (enabled()) AppLovinPrivacySettings.setDoNotSell(value);
        Analytics.applyDoNotSell(activity, value);
    }

    @JavascriptInterface
    public boolean getDoNotSell() {
        return prefs().getBoolean(DO_NOT_SELL, false);
    }

    private void reply(String callbackId, boolean ok) {
        final String js = "window.__adResult && window.__adResult("
            + org.json.JSONObject.quote(callbackId) + ", " + ok + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void finish(boolean ok) {
        String id = pendingCallback;
        pendingCallback = null;
        if (id != null) reply(id, ok);
    }

    /* ---------------- MAX callbacks ---------------- */
    // No @Override on these: if a future SDK drops one, this still compiles.

    public void onAdLoaded(MaxAd ad) {
        retryAttempt = 0;
    }

    /** Retry with growing delays, capped at 64 seconds, as AppLovin recommends. */
    public void onAdLoadFailed(String adUnitId, MaxError error) {
        retryAttempt++;
        long delay = 1000L * (1L << Math.min(6, retryAttempt));
        webView.postDelayed(() -> {
            if (rewarded != null) rewarded.loadAd();
        }, delay);
    }

    public void onAdDisplayed(MaxAd ad) { }

    public void onAdClicked(MaxAd ad) { }

    public void onUserRewarded(MaxAd ad, MaxReward reward) {
        earned = true;
    }

    /** Closed. Pay out only if the reward was earned, then load the next one. */
    public void onAdHidden(MaxAd ad) {
        finish(earned);
        if (rewarded != null) rewarded.loadAd();
    }

    /** What the impression earned, reported as Firebase's ad_impression. */
    public void onAdRevenuePaid(MaxAd ad) {
        Analytics.adImpression(activity, ad.getNetworkName(), ad.getFormat().getLabel(),
            ad.getAdUnitId(), ad.getPlacement(), ad.getRevenue());
    }

    public void onAdDisplayFailed(MaxAd ad, MaxError error) {
        finish(false);
        if (rewarded != null) rewarded.loadAd();
    }
}

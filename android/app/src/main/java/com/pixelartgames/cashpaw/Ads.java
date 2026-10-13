package com.pixelartgames.cashpaw;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.google.firebase.analytics.FirebaseAnalytics;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * The bridge between the game and Google AdMob. The page sees it as
 * window.CashPawsAds; shell/ads.js is the only code that talks to it.
 *
 * SDK: com.google.android.gms:play-services-ads (Google Mobile Ads), with the
 * User Messaging Platform (UMP) for consent: the US state privacy message
 * ("do not sell or share") and, if the app ever ships to Europe, GDPR. AdMob's
 * own Privacy & messaging settings decide which message anyone sees; this code
 * only asks UMP and does what it says.
 *
 * One rewarded ad unit serves every placement (Rescue Sort, Rewards Box);
 * the placement name only travels to analytics. One interstitial unit is
 * shown at natural breaks; when is the page's call (shell/ads.js): after
 * level 10, at most once per 2.5 minutes of actual play.
 *
 * Debug builds always use Google's test app ID and test ad unit (set in
 * build.gradle), so testing can never put the real account at risk.
 * A release build with no ad unit in android/ads.properties has ads off.
 *
 * Mediation: none yet. To add a network later, add its adapter dependency and
 * set it up in the AdMob console; nothing here changes.
 */
public final class Ads {

    private final Activity activity;
    private final WebView webView;
    private final ConsentInformation consent;
    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private RewardedAd rewarded;
    private boolean loading;
    private InterstitialAd interstitial;
    private boolean loadingInterstitial;
    private int interstitialRetry;
    private String pendingCallback;
    private boolean earned;
    private int retryAttempt;

    // What went wrong last, for the Ad status card (5 taps on the version in
    // Settings) and for Logcat (tag CashPawsAds).
    private static final String TAG = "CashPawsAds";
    private String consentError = "";
    private String rewardedError = "";
    private String interstitialError = "";
    private final Set<String> reported = new HashSet<>();

    public Ads(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    public boolean enabled() {
        return !BuildConfig.ADS_REWARDED_UNIT.isEmpty();
    }

    /**
     * Call once from onCreate. Consent comes first: UMP shows its message if
     * this user needs one, and ads start only once it says they may.
     */
    public void start() {
        if (!enabled()) return;
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
            .setTagForUnderAgeOfConsent(false)
            .build();
        consent.requestConsentInfoUpdate(
            activity,
            params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
                if (formError != null) {
                    consentError = "form " + formError.getErrorCode() + ": " + formError.getMessage();
                    Log.w(TAG, "consent form failed " + consentError);
                }
                if (consent.canRequestAds()) initAds();
            }),
            requestError -> {
                // Offline or a config problem: fall back on what was known before.
                consentError = requestError.getErrorCode() + ": " + requestError.getMessage();
                Log.w(TAG, "consent update failed " + consentError);
                if (consent.canRequestAds()) initAds();
            });
        // A returning user who already answered can start straight away.
        if (consent.canRequestAds()) initAds();
    }

    private void initAds() {
        if (!initialized.compareAndSet(false, true)) return;
        // Off the main thread, as Google recommends; loading waits for it.
        new Thread(() -> MobileAds.initialize(activity, status ->
            activity.runOnUiThread(() -> { load(); loadInterstitial(); }))).start();
    }

    private boolean interstitialEnabled() {
        return !BuildConfig.ADS_INTERSTITIAL_UNIT.isEmpty();
    }

    private void loadInterstitial() {
        if (!interstitialEnabled() || interstitial != null || loadingInterstitial) return;
        loadingInterstitial = true;
        InterstitialAd.load(activity, BuildConfig.ADS_INTERSTITIAL_UNIT, new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    loadingInterstitial = false;
                    interstitialRetry = 0;
                    interstitialError = "";
                    interstitial = ad;
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    loadingInterstitial = false;
                    interstitial = null;
                    interstitialError = describe(error);
                    failed("interstitial", error);
                    interstitialRetry++;
                    long delay = 1000L * (1L << Math.min(6, interstitialRetry));
                    webView.postDelayed(Ads.this::loadInterstitial, delay);
                }
            });
    }

    private void load() {
        if (rewarded != null || loading) return;
        loading = true;
        RewardedAd.load(activity, BuildConfig.ADS_REWARDED_UNIT, new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    loading = false;
                    retryAttempt = 0;
                    rewardedError = "";
                    rewarded = ad;
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    loading = false;
                    rewarded = null;
                    rewardedError = describe(error);
                    failed("rewarded", error);
                    // Back off: 2, 4, 8 … up to 64 seconds.
                    retryAttempt++;
                    long delay = 1000L * (1L << Math.min(6, retryAttempt));
                    webView.postDelayed(Ads.this::load, delay);
                }
            });
    }

    /* ---------------- called from the page ---------------- */

    @JavascriptInterface
    public boolean isEnabled() {
        return enabled();
    }

    @JavascriptInterface
    public boolean rewardedReady() {
        return rewarded != null;
    }

    /**
     * Show a rewarded ad. The result comes back asynchronously through
     * window.__adResult(callbackId, earned) once the ad is closed.
     */
    @JavascriptInterface
    public void showRewarded(String placement, String callbackId) {
        activity.runOnUiThread(() -> {
            RewardedAd ad = rewarded;
            if (ad == null || pendingCallback != null) {
                reply(callbackId, false);
                load();
                return;
            }
            rewarded = null;                 // an ad shows once
            pendingCallback = callbackId;
            earned = false;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    finish(earned);
                    load();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                    finish(false);
                    load();
                }
            });
            ad.show(activity, rewardItem -> earned = true);
        });
    }

    @JavascriptInterface
    public boolean interstitialReady() {
        return interstitial != null;
    }

    /**
     * Show an interstitial. window.__adResult(callbackId, shown) answers once
     * it closes (true) or if there was nothing to show (false), so the game
     * waits for it before carrying on.
     */
    @JavascriptInterface
    public void showInterstitial(String placement, String callbackId) {
        activity.runOnUiThread(() -> {
            InterstitialAd ad = interstitial;
            if (ad == null || pendingCallback != null) {
                reply(callbackId, false);
                loadInterstitial();
                return;
            }
            interstitial = null;
            pendingCallback = callbackId;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    finish(true);
                    loadInterstitial();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                    finish(false);
                    loadInterstitial();
                }
            });
            ad.show(activity);
        });
    }

    /**
     * True when UMP says this user must be able to revisit their privacy
     * choice (for the US state message, that's the "do not sell or share"
     * link). Settings shows the row only then.
     */
    @JavascriptInterface
    public boolean privacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus()
            == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    /** Google's own privacy form, from Settings. */
    @JavascriptInterface
    public void showPrivacyOptions() {
        activity.runOnUiThread(() ->
            UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> { }));
    }

    /**
     * Everything the Ad status card shows, as JSON. Read it on the phone:
     * Settings, then tap the version line 5 times.
     */
    @JavascriptInterface
    public String status() {
        try {
            JSONObject o = new JSONObject();
            o.put("build", BuildConfig.DEBUG ? "debug (Google test ads)" : "release (your AdMob units)");
            o.put("rewardedUnit", BuildConfig.ADS_REWARDED_UNIT);
            o.put("interstitialUnit", BuildConfig.ADS_INTERSTITIAL_UNIT);
            o.put("consent", consentName(consent.getConsentStatus()));
            o.put("canRequestAds", consent.canRequestAds());
            o.put("consentError", consentError);
            o.put("started", initialized.get());
            o.put("rewarded", rewarded != null ? "ready" : loading ? "loading" : rewardedError.isEmpty() ? "idle" : rewardedError);
            o.put("interstitial", interstitial != null ? "ready" : loadingInterstitial ? "loading" : interstitialError.isEmpty() ? "idle" : interstitialError);
            return o.toString();
        } catch (Throwable t) {
            return "{}";
        }
    }

    private static String consentName(int s) {
        switch (s) {
            case ConsentInformation.ConsentStatus.NOT_REQUIRED: return "not required";
            case ConsentInformation.ConsentStatus.REQUIRED: return "required, not given yet";
            case ConsentInformation.ConsentStatus.OBTAINED: return "given";
            default: return "unknown";
        }
    }

    private static String describe(LoadAdError e) {
        return "error " + e.getCode() + ": " + e.getMessage();
    }

    /** Logcat always; Firebase once per format and error code per session. */
    private void failed(String format, LoadAdError e) {
        Log.w(TAG, format + " failed to load: " + describe(e));
        if (!reported.add(format + e.getCode())) return;
        try {
            Bundle b = new Bundle();
            b.putString("format", format);
            b.putLong("code", e.getCode());
            String msg = e.getMessage();
            b.putString("message", msg == null ? "" : msg.length() > 100 ? msg.substring(0, 100) : msg);
            FirebaseAnalytics.getInstance(activity).logEvent("ad_load_failed", b);
        } catch (Throwable ignored) { }
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
}

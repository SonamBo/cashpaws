package com.pixelartgames.cashpaw;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.webkit.JavascriptInterface;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.remoteconfig.FirebaseRemoteConfig;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigInfo;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings;
import com.google.firebase.remoteconfig.FirebaseRemoteConfigValue;

import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Firebase Remote Config, as the page sees it: window.CashPawsConfig.
 * shell/config.js is the only code that talks to it, and it owns every
 * default, type and limit; this side only hands over strings.
 *
 * When values change: values fetched during one launch apply from the next,
 * so nothing changes under a player mid-session. The exception is a brand-new
 * install, which has nothing cached: its first launch waits briefly for a
 * fetch, so a new player (the one A/B tests on first-day retention are about)
 * plays their first session with the values meant for them. If that fetch is
 * slow or offline, the page's own defaults are used.
 *
 * Firebase A/B Testing works through this without extra code: activating
 * fetched values records which experiment variant the player is in.
 *
 * Nothing here can crash the app or block the page for long.
 */
public final class RemoteConfig {

    /** How long a first launch waits for its first fetch. */
    private static final long FIRST_FETCH_WAIT_MS = 1500;
    /** How long any launch waits for cached values to apply (a disk read). */
    private static final long ACTIVATE_WAIT_MS = 600;

    private final FirebaseRemoteConfig rc;
    private final boolean firstRun;
    private final Task<Boolean> ready;
    private volatile String source = "default";
    private final long started = System.currentTimeMillis();

    public RemoteConfig(Context context) {
        rc = FirebaseRemoteConfig.getInstance();
        boolean debuggable = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        // Debug builds fetch every launch, so console changes can be tried at once.
        // Release: at most hourly (Firebase's own default is 12 h).
        rc.setConfigSettingsAsync(new FirebaseRemoteConfigSettings.Builder()
            .setMinimumFetchIntervalInSeconds(debuggable ? 0 : 3600)
            .build());

        firstRun = rc.getInfo().getFetchTimeMillis() <= 0;
        if (firstRun) {
            // Nothing cached yet: fetch and apply now, before the page asks.
            ready = rc.fetchAndActivate();
        } else {
            // Apply what the last launch fetched, then fetch for the next one.
            ready = rc.activate();
            rc.fetch();
        }
    }

    /* ---------------- called from the page (on the JavaBridge thread) ---------------- */

    @JavascriptInterface
    public boolean isEnabled() {
        return true;
    }

    /**
     * Every value Firebase has, as JSON:
     * { "values": { key: "string", ... }, "source": "remote"|"cached"|"default",
     *   "fetched": epoch ms of the last successful fetch (0 if never), "waited": ms }
     * Values from the console come back as strings; the page parses and checks them.
     */
    @JavascriptInterface
    public String getAll() {
        long t0 = System.currentTimeMillis();
        try {
            long left = (firstRun ? FIRST_FETCH_WAIT_MS : ACTIVATE_WAIT_MS) - (t0 - started);
            if (left > 0 && !ready.isComplete()) Tasks.await(ready, left, TimeUnit.MILLISECONDS);
        } catch (Throwable ignored) {
            // Timed out or failed: whatever is active (possibly nothing) is used.
        }
        try {
            JSONObject values = new JSONObject();
            boolean anyRemote = false;
            for (Map.Entry<String, FirebaseRemoteConfigValue> e : rc.getAll().entrySet()) {
                FirebaseRemoteConfigValue v = e.getValue();
                if (v.getSource() != FirebaseRemoteConfig.VALUE_SOURCE_REMOTE) continue;
                values.put(e.getKey(), v.asString());
                anyRemote = true;
            }
            FirebaseRemoteConfigInfo info = rc.getInfo();
            source = !anyRemote ? "default" : (firstRun ? "remote" : "cached");
            JSONObject out = new JSONObject();
            out.put("values", values);
            out.put("source", source);
            out.put("fetched", Math.max(0, info.getFetchTimeMillis()));
            out.put("waited", System.currentTimeMillis() - t0);
            return out.toString();
        } catch (Throwable t) {
            return "{\"values\":{},\"source\":\"default\",\"fetched\":0,\"waited\":0}";
        }
    }

    /** For the dev/testing card: the last fetch's outcome. */
    @JavascriptInterface
    public String status() {
        try {
            FirebaseRemoteConfigInfo info = rc.getInfo();
            String last;
            switch (info.getLastFetchStatus()) {
                case FirebaseRemoteConfig.LAST_FETCH_STATUS_SUCCESS: last = "success"; break;
                case FirebaseRemoteConfig.LAST_FETCH_STATUS_THROTTLED: last = "throttled"; break;
                case FirebaseRemoteConfig.LAST_FETCH_STATUS_FAILURE: last = "failure"; break;
                default: last = "none";
            }
            JSONObject o = new JSONObject();
            o.put("last", last);
            o.put("fetched", Math.max(0, info.getFetchTimeMillis()));
            o.put("source", source);
            o.put("firstRun", firstRun);
            return o.toString();
        } catch (Throwable t) {
            return "{}";
        }
    }
}

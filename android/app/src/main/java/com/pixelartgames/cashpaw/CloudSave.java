package com.pixelartgames.cashpaw;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

/**
 * Google Play Games: automatic sign-in and a cloud copy of the save (Saved
 * Games). The page sees it as window.CashPawsPlay; shell/cloud.js is the only
 * code that talks to it.
 *
 * Off until the Play Games project ID is in www/app.config.js
 * (playGamesAppId); Gradle turns it into the APP_ID meta-data. The .debug
 * build can't sign in (its package isn't the one registered with Play Games).
 *
 * One snapshot holds the whole save as JSON. The page decides what to do with
 * what comes back (restore, keep); this class only reads and writes it.
 */
public final class CloudSave {

    private static final String TAG = "CashPawsPlay";
    private static final String SLOT = "save";

    private final Activity activity;
    private final WebView webView;
    private final boolean configured;
    private boolean started;
    private boolean signedIn;
    private String player = "";
    private String lastError = "";
    private boolean writing;
    private String[] queued;          // the newest save waiting while one is being written

    public CloudSave(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        String id = activity.getString(R.string.game_services_project_id);
        this.configured = id != null && !id.trim().isEmpty();
    }

    /** True when this build has a Play Games project. */
    @JavascriptInterface
    public boolean isEnabled() { return configured; }

    /** Start the SDK and check the automatic sign-in. Answers with an 'auth' event. */
    @JavascriptInterface
    public void start() {
        if (!configured) return;
        activity.runOnUiThread(() -> {
            if (!started) {
                try { PlayGamesSdk.initialize(activity); } catch (Exception e) { fail("init", e); return; }
                started = true;
            }
            GamesSignInClient c = PlayGames.getGamesSignInClient(activity);
            c.isAuthenticated().addOnCompleteListener(t ->
                    afterAuth(t.isSuccessful() && t.getResult().isAuthenticated(), t.getException()));
        });
    }

    /** The Settings button, for a player who wasn't signed in automatically. */
    @JavascriptInterface
    public void signIn() {
        if (!configured || !started) return;
        activity.runOnUiThread(() -> PlayGames.getGamesSignInClient(activity).signIn()
                .addOnCompleteListener(t -> afterAuth(t.isSuccessful() && t.getResult().isAuthenticated(), t.getException())));
    }

    /** Read the cloud save. Answers with a 'loaded' event: data is "" when there is none. */
    @JavascriptInterface
    public void load(String requestId) {
        if (!signedIn) { send(event("loaded").put("id", requestId).put("ok", false)); return; }
        activity.runOnUiThread(() -> client().open(SLOT, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnCompleteListener(t -> {
                    if (!t.isSuccessful()) {
                        fail("load", t.getException());
                        send(event("loaded").put("id", requestId).put("ok", false));
                        return;
                    }
                    SnapshotsClient.DataOrConflict<Snapshot> dc = t.getResult();
                    Snapshot s = dc.isConflict() ? dc.getConflict().getSnapshot() : dc.getData();
                    String data = "";
                    try {
                        byte[] b = s.getSnapshotContents().readFully();
                        data = b == null ? "" : new String(b, StandardCharsets.UTF_8);
                    } catch (Exception e) {
                        fail("read", e);
                    }
                    client().discardAndClose(s);
                    send(event("loaded").put("id", requestId).put("ok", true).put("data", data));
                }));
    }

    /** Write the cloud save (the whole save, as JSON). Saves arriving mid-write are coalesced. */
    @JavascriptInterface
    public void save(String json, String description, String progress) {
        if (!signedIn) return;
        activity.runOnUiThread(() -> {
            if (writing) { queued = new String[] { json, description, progress }; return; }
            write(json, description, progress);
        });
    }

    @JavascriptInterface
    public String status() {
        try {
            return new JSONObject().put("configured", configured).put("signedIn", signedIn)
                    .put("player", player).put("error", lastError).toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /* ---------------- inside ---------------- */

    private SnapshotsClient client() { return PlayGames.getSnapshotsClient(activity); }

    private void write(String json, String description, String progress) {
        writing = true;
        client().open(SLOT, true, SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED)
                .addOnCompleteListener(t -> {
                    if (!t.isSuccessful()) { fail("open", t.getException()); done(false); return; }
                    SnapshotsClient.DataOrConflict<Snapshot> dc = t.getResult();
                    Snapshot s = dc.isConflict() ? dc.getConflict().getSnapshot() : dc.getData();
                    s.getSnapshotContents().writeBytes(json.getBytes(StandardCharsets.UTF_8));
                    long p = 0;
                    try { p = Long.parseLong(progress); } catch (Exception ignored) { /* 0 */ }
                    SnapshotMetadataChange change = new SnapshotMetadataChange.Builder()
                            .setDescription(description)
                            .setProgressValue(p)
                            .build();
                    client().commitAndClose(s, change).addOnCompleteListener(c -> {
                        if (!c.isSuccessful()) fail("commit", c.getException());
                        done(c.isSuccessful());
                    });
                });
    }

    private void done(boolean ok) {
        writing = false;
        send(event("saved").put("ok", ok));
        if (queued != null) {
            String[] q = queued;
            queued = null;
            write(q[0], q[1], q[2]);
        }
    }

    private void afterAuth(boolean ok, Exception e) {
        signedIn = ok;
        if (e != null) fail("auth", e);
        if (!ok) { send(event("auth").put("signedIn", false)); return; }
        PlayGames.getPlayersClient(activity).getCurrentPlayer().addOnCompleteListener(t -> {
            player = t.isSuccessful() && t.getResult() != null ? t.getResult().getDisplayName() : "";
            send(event("auth").put("signedIn", true).put("player", player));
        });
    }

    private void fail(String where, Exception e) {
        lastError = where + ": " + (e == null ? "unknown" : e.getMessage());
        Log.w(TAG, lastError, e);
    }

    private Json event(String type) { return new Json().put("type", type); }

    private void send(Json e) {
        final String js = "window.__cloud && window.__cloud(" + e.o + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    /** JSONObject without the checked exception on every put. */
    private static final class Json {
        final JSONObject o = new JSONObject();
        Json put(String k, Object v) {
            try { o.put(k, v); } catch (Exception ignored) { /* never for these keys */ }
            return this;
        }
    }
}

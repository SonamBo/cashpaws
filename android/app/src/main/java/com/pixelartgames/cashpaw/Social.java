package com.pixelartgames.cashpaw;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Sharing and the Play rating sheet. The page sees it as window.CashPawsSocial;
 * shell/social.js is the only code that talks to it.
 *
 * share(): the phone's own share sheet (WhatsApp, Instagram, Telegram…) with
 * a line of text, the Play link, and the app's share image (shareImage in
 * www/app.config.js, a PNG or JPEG under www/) when it has one. The image is copied out of the APK to the cache and handed
 * over through a FileProvider (see AndroidManifest.xml, res/xml/share_paths.xml).
 *
 * review(): Google Play's in-app review sheet. Google decides whether it
 * actually appears (it has a quota) and never says whether the player rated,
 * so the page only learns that the request finished.
 */
public final class Social {

    private static final String TAG = "CashPawsSocial";
    private final Activity activity;
    private final WebView webView;

    public Social(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void share(String text, String imagePath) {
        activity.runOnUiThread(() -> {
            Intent send = new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, text);
            Uri image = imagePath == null || imagePath.isEmpty() ? null : copyImage(imagePath);
            if (image != null) {
                send.setType(imagePath.endsWith(".png") ? "image/png" : "image/jpeg")
                        .putExtra(Intent.EXTRA_STREAM, image)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                send.setClipData(ClipData.newRawUri("", image));
            } else {
                send.setType("text/plain");
            }
            try {
                activity.startActivity(Intent.createChooser(send, null));
            } catch (Exception e) {
                Log.w(TAG, "no share target", e);
            }
        });
    }

    @JavascriptInterface
    public void review(String requestId) {
        activity.runOnUiThread(() -> {
            ReviewManager manager = ReviewManagerFactory.create(activity);
            manager.requestReviewFlow().addOnCompleteListener(t -> {
                if (!t.isSuccessful()) { reviewDone(requestId, false); return; }
                manager.launchReviewFlow(activity, t.getResult())
                        .addOnCompleteListener(f -> reviewDone(requestId, true));
            });
        });
    }

    /** www/<path> from the APK's assets into the cache, as a content:// URI. Null if missing. */
    private Uri copyImage(String path) {
        try (InputStream in = activity.getAssets().open("www/" + path)) {
            File dir = new File(activity.getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File out = new File(dir, path.endsWith(".png") ? "share.png" : "share.jpg");
            try (OutputStream o = new FileOutputStream(out)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            }
            return FileProvider.getUriForFile(activity, activity.getPackageName() + ".share", out);
        } catch (Exception e) {
            Log.i(TAG, "no share image, sharing text only: " + e.getMessage());
            return null;
        }
    }

    private void reviewDone(String id, boolean asked) {
        final String js = "window.__reviewDone && window.__reviewDone(" + org.json.JSONObject.quote(id) + "," + asked + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}

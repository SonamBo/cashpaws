package com.pixelartgames.cashpaw;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/**
 * Local reminders. The page sees this as window.CashPawsNotify; shell/notify.js
 * is the only code that talks to it and decides what to say and when.
 *
 * Each reminder has an id ('box', 'quest'); scheduling an id again replaces
 * the one before. WorkManager keeps them across restarts and reboots, and
 * ReminderWorker posts them. Nothing is posted while the app is on screen.
 *
 * Android 13+ needs the POST_NOTIFICATIONS permission at runtime. The page
 * asks the player first in its own words, then calls requestPermission(),
 * and hears back through window.__notifyPermission(granted).
 */
public final class Notify {

    public interface PermissionAsker { void ask(); }

    private final Activity activity;
    private final WebView webView;
    private final PermissionAsker asker;
    public static volatile boolean foreground = false;
    private String launchSource;

    public Notify(Activity activity, WebView webView, PermissionAsker asker) {
        this.activity = activity;
        this.webView = webView;
        this.asker = asker;
    }

    /** The reminder id the app was opened from, if any; read once by the page. */
    public void setLaunchSource(String id) { launchSource = id; }

    public void onPermissionResult(boolean granted) {
        final String js = "window.__notifyPermission && window.__notifyPermission(" + granted + ")";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    /* ---------------- called from the page ---------------- */

    @JavascriptInterface
    public boolean isEnabled() { return true; }

    /** 'granted', 'denied' (turned off in system settings) or 'ask' (not asked yet, Android 13+). */
    @JavascriptInterface
    public String permission() {
        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
               != PackageManager.PERMISSION_GRANTED) {
            return activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
                || !asked() ? "ask" : "denied";
        }
        return NotificationManagerCompat.from(activity).areNotificationsEnabled() ? "granted" : "denied";
    }

    @JavascriptInterface
    public void requestPermission() {
        if (Build.VERSION.SDK_INT < 33) { onPermissionResult(permission().equals("granted")); return; }
        activity.getSharedPreferences("cashpaws.notify", Activity.MODE_PRIVATE)
            .edit().putBoolean("asked", true).apply();
        activity.runOnUiThread(asker::ask);
    }

    private boolean asked() {
        return activity.getSharedPreferences("cashpaws.notify", Activity.MODE_PRIVATE)
            .getBoolean("asked", false);
    }

    /** Post `title`/`body` at `atMillis` (epoch ms). Replaces any earlier one with this id. */
    @JavascriptInterface
    public void schedule(String id, double atMillis, String title, String body) {
        try {
            long delay = Math.max(0L, (long) atMillis - System.currentTimeMillis());
            Data data = new Data.Builder()
                .putString(ReminderWorker.KEY_ID, id)
                .putString(ReminderWorker.KEY_TITLE, title)
                .putString(ReminderWorker.KEY_BODY, body)
                .build();
            OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(ReminderWorker.class)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .setInputData(data)
                .addTag("reminder")
                .build();
            WorkManager.getInstance(activity).enqueueUniqueWork("reminder-" + id, ExistingWorkPolicy.REPLACE, req);
        } catch (Throwable ignored) { /* a reminder is never worth a crash */ }
    }

    @JavascriptInterface
    public void cancel(String id) {
        try { WorkManager.getInstance(activity).cancelUniqueWork("reminder-" + id); } catch (Throwable ignored) { }
    }

    @JavascriptInterface
    public String takeLaunchSource() {
        String s = launchSource;
        launchSource = null;
        return s == null ? "" : s;
    }
}

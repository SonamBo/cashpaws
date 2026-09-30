package com.pixelartgames.cashpaw;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Posts one reminder that Notify scheduled. Skips it if the game is on screen. */
public final class ReminderWorker extends Worker {

    static final String KEY_ID = "id";
    static final String KEY_TITLE = "title";
    static final String KEY_BODY = "body";
    static final String CHANNEL = "reminders";
    public static final String EXTRA_FROM = "fromReminder";

    public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            if (Notify.foreground) return Result.success();          // they're already playing
            Context ctx = getApplicationContext();
            if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                   != PackageManager.PERMISSION_GRANTED) {
                return Result.success();
            }
            String id = getInputData().getString(KEY_ID);
            String title = getInputData().getString(KEY_TITLE);
            String body = getInputData().getString(KEY_BODY);

            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Reminders",
                    NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Rewards Box ready, and Bell Quest");
                ctx.getSystemService(NotificationManager.class).createNotificationChannel(ch);
            }

            Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_FROM, id);
            PendingIntent tap = PendingIntent.getActivity(ctx, id == null ? 0 : id.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_notify)
                .setColor(0xFFE5A64B)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
            NotificationManagerCompat.from(ctx).notify(id == null ? 1 : id.hashCode(), n.build());
        } catch (SecurityException ignored) {
            // permission revoked between the check and the post
        } catch (Throwable ignored) { }
        return Result.success();
    }
}

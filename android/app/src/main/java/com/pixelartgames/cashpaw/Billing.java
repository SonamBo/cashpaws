package com.pixelartgames.cashpaw;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The bridge between the game and Google Play Billing: coin packs bought
 * with real money. The page sees it as window.CashPawsBilling; shell/billing.js
 * is the only code that talks to it.
 *
 * Coin packs are consumable one-time products. Their IDs come from the page
 * (coinPacks in www/app.config.js), so nothing here names a product.
 *
 * The order of events is what keeps a purchase from being lost or paid twice:
 *  1. Play reports a purchase (here, or on the next start if the app died).
 *  2. This class hands it to the page, which adds the coins, records the
 *     purchase token and saves.
 *  3. Only then does the page call consume(token), which tells Play the coins
 *     were delivered. Play refunds a purchase not consumed within 3 days.
 * A purchase that comes back after step 2 (the app closed before consuming)
 * carries a token the page has already recorded, so it is consumed without
 * paying again.
 *
 * Pending payments (cash or slow bank methods) are reported as pending and
 * delivered once they clear, through the same path.
 *
 * Products are only found for the package Play knows: the .debug build finds
 * none, so test purchases with a release build from the internal testing
 * track, signed in as a license tester.
 */
public final class Billing implements PurchasesUpdatedListener {

    private static final String TAG = "CashPawsBilling";

    private final Activity activity;
    private final WebView webView;
    private final BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private List<String> productIds = Collections.emptyList();
    private boolean started;
    private boolean connecting;
    private String state = "idle";          // idle, connecting, ready, unavailable
    private String lastError = "";
    private String pendingRequest;          // the page's id for the purchase in progress
    private String pendingProduct;

    public Billing(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    /* ---------------- called by the page ---------------- */

    /** The page lists its coin packs; connect and look up their prices. */
    @JavascriptInterface
    public void start(String idsJson) {
        List<String> ids = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(idsJson);
            for (int i = 0; i < a.length(); i++) ids.add(a.getString(i));
        } catch (Exception e) {
            Log.w(TAG, "bad product list", e);
        }
        activity.runOnUiThread(() -> {
            productIds = ids;
            started = true;
            connect();
        });
    }

    /** Products Play knows, with prices in the player's currency. */
    @JavascriptInterface
    public String products() {
        JSONArray out = new JSONArray();
        synchronized (details) {
            for (String id : productIds) {
                ProductDetails d = details.get(id);
                if (d == null) continue;
                ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                if (offer == null) continue;
                try {
                    out.put(new JSONObject()
                            .put("id", id)
                            .put("price", offer.getFormattedPrice())
                            .put("micros", offer.getPriceAmountMicros())
                            .put("currency", offer.getPriceCurrencyCode())
                            .put("title", d.getName()));
                } catch (Exception ignored) { /* skip it */ }
            }
        }
        return out.toString();
    }

    /** For the Purchases line of the testing card, and Logcat. */
    @JavascriptInterface
    public String status() {
        try {
            return new JSONObject()
                    .put("state", state)
                    .put("error", lastError)
                    .put("asked", new JSONArray(productIds))
                    .put("found", details.size())
                    .toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Open Google Play's purchase sheet for one pack. */
    @JavascriptInterface
    public void buy(String productId, String requestId) {
        activity.runOnUiThread(() -> {
            ProductDetails d;
            synchronized (details) { d = details.get(productId); }
            if (d == null || !client.isReady()) {
                result(requestId, "error", "unavailable");
                return;
            }
            pendingRequest = requestId;
            pendingProduct = productId;
            List<BillingFlowParams.ProductDetailsParams> list = new ArrayList<>();
            list.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build());
            BillingResult r = client.launchBillingFlow(activity,
                    BillingFlowParams.newBuilder().setProductDetailsParamsList(list).build());
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                finishRequest(r);
            }
            // Otherwise the answer arrives in onPurchasesUpdated.
        });
    }

    /** The page has added the coins and saved: tell Play they were delivered. */
    @JavascriptInterface
    public void consume(String token) {
        activity.runOnUiThread(() -> client.consumeAsync(
                ConsumeParams.newBuilder().setPurchaseToken(token).build(),
                (r, t) -> {
                    boolean ok = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                    if (!ok) note("consume", r);
                    send(event("consumed").put("token", t).put("ok", ok));
                }));
    }

    /** Collect purchases that finished while the app was away (or pending ones that cleared). */
    @JavascriptInterface
    public void refresh() {
        activity.runOnUiThread(() -> {
            if (!started) return;
            if (client.isReady()) queryPurchases();
            else connect();
        });
    }

    /* ---------------- Play's side ---------------- */

    private void connect() {
        if (client.isReady()) {
            queryProducts();
            queryPurchases();
            return;
        }
        if (connecting) return;
        connecting = true;
        state = "connecting";
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult r) {
                activity.runOnUiThread(() -> {
                    connecting = false;
                    if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        state = "ready";
                        queryProducts();
                        queryPurchases();
                    } else {
                        state = "unavailable";
                        note("setup", r);
                        send(event("products"));
                    }
                });
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() reconnects on the next call.
                activity.runOnUiThread(() -> connecting = false);
            }
        });
    }

    private void queryProducts() {
        if (productIds.isEmpty()) { send(event("products")); return; }
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : productIds) {
            list.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(list).build(),
                (r, result) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) note("products", r);
                    synchronized (details) {
                        for (ProductDetails d : result.getProductDetailsList()) details.put(d.getProductId(), d);
                    }
                    if (details.isEmpty()) {
                        lastError = "Play found none of " + productIds + ". Create them in Play Console "
                                + "(Monetize > Products > One-time products), make them active, and test with a "
                                + "build installed from Play.";
                        Log.w(TAG, lastError);
                    }
                    send(event("products"));
                });
    }

    private void queryPurchases() {
        client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { note("purchases", r); return; }
                    for (Purchase p : purchases) deliver(p);
                });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, @Nullable List<Purchase> purchases) {
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) deliver(p);
            return;
        }
        // An earlier purchase of this pack was never consumed: deliver it now.
        if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryPurchases();
        finishRequest(r);
    }

    /** Hand one purchase to the page; it adds the coins, then calls consume(). */
    private void deliver(Purchase p) {
        int s = p.getPurchaseState();
        if (s != Purchase.PurchaseState.PURCHASED && s != Purchase.PurchaseState.PENDING) return;
        String how = s == Purchase.PurchaseState.PURCHASED ? "purchased" : "pending";
        JSONArray products = new JSONArray(p.getProducts());
        send(event("purchase")
                .put("token", p.getPurchaseToken())
                .put("products", products)
                .put("quantity", p.getQuantity())
                .put("orderId", p.getOrderId() == null ? "" : p.getOrderId())
                .put("state", how));
        if (pendingRequest != null && p.getProducts().contains(pendingProduct)) {
            result(pendingRequest, how, "");
            pendingRequest = null;
            pendingProduct = null;
        }
    }

    private void finishRequest(BillingResult r) {
        if (pendingRequest == null) return;
        int code = r.getResponseCode();
        String how = code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancelled"
                : code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ? "owned"
                : "error";
        if (!"cancelled".equals(how)) note("purchase", r);
        result(pendingRequest, how, "code " + code);
        pendingRequest = null;
        pendingProduct = null;
    }

    /* ---------------- to the page ---------------- */

    private void result(String id, String status, String detail) {
        send(event("result").put("id", id).put("status", status).put("detail", detail));
    }

    private void note(String where, BillingResult r) {
        lastError = where + ": code " + r.getResponseCode() + " " + r.getDebugMessage();
        Log.w(TAG, lastError);
    }

    private Json event(String type) { return new Json().put("type", type); }

    private void send(Json e) {
        final String js = "window.__billing && window.__billing(" + e.o + ")";
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

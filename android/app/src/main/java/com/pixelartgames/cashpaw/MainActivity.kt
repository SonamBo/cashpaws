package com.pixelartgames.cashpaw

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.ComponentActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * A single WebView hosting the game.
 *
 * Assets are served through WebViewAssetLoader rather than loaded from
 * file://. On a file:// origin the WebView blocks ES modules as cross-origin
 * and gives localStorage an opaque origin, so both the game's module graph and
 * its save would break. Serving from https://appassets.androidplatform.net
 * gives a normal, stable origin with no network involved.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var safeTop = 0f
    private var safeBottom = 0f

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Draw behind the system bars, then pad the WebView back out. Doing the
        // insets natively means the CSS never has to guess at safe areas.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val loader = WebViewAssetLoader.Builder()
            .setDomain(ASSET_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(GROUND)
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true          // the save lives here
                databaseEnabled = true
                loadWithOverviewMode = false
                useWideViewPort = false
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
                textZoom = 100                    // ignore system font scaling
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false           // everything goes via the loader
                allowContentAccess = false
                cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            }

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

                // The page is only there to receive the insets after it loads.
                override fun onPageFinished(view: WebView, url: String) = pushSafeArea()
            }
        }

        setContentView(webView)

        /*
         * Hand the insets to the page as CSS variables rather than padding the
         * WebView. Padding would cut the room background off at the status bar;
         * this way the art runs edge to edge and only the content is inset.
         */
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            safeTop = bars.top / density
            safeBottom = bars.bottom / density
            pushSafeArea()
            insets
        }

        // Insets may already have been dispatched before the listener existed,
        // in which case it never fires and the app sits under the status bar.
        ViewCompat.requestApplyInsets(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = routeBack()
        })

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl("https://$ASSET_DOMAIN/assets/www/index.html")
    }

    private fun pushSafeArea() {
        webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--safe-top','${safeTop}px');" +
                "document.documentElement.style.setProperty('--safe-bottom','${safeBottom}px');",
            null,
        )
    }

    /**
     * Back belongs to the game first. The web layer closes a panel and reports
     * that it handled it; an open decision card swallows back so the player
     * cannot skip a choice. Only an idle board lets back leave the app.
     */
    private fun routeBack() {
        webView.evaluateJavascript(
            "(window.CashPaws && window.CashPaws.onBack && window.CashPaws.onBack()) ? 1 : 0"
        ) { result ->
            if (result?.trim() != "1") moveTaskToBack(true)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        // Flush the save before the process can be killed in the background.
        webView.evaluateJavascript("window.CashPaws && window.CashPaws.flush()", null)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val ASSET_DOMAIN = "appassets.androidplatform.net"
        val GROUND = Color.parseColor("#fcf5e6")
    }
}

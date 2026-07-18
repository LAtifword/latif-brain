package com.latif.ni.ui

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.latif.ni.BuildConfig
import com.latif.ni.R
import com.latif.ni.databinding.ActivityDashboardBinding
import com.latif.ni.service.BackendService
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * LATIF NI Dashboard Activity
 * Displays enterprise dashboard with real-time agent monitoring and system metrics
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDashboardBinding
    private lateinit var webView: WebView
    private var backendUrl: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        webView = binding.webView
        setupWebView()
        loadDashboard()
    }

    private fun setupWebView() {
        webView.apply {
            // Enable JavaScript
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true

                // Cache settings
                cacheMode = WebSettings.LOAD_DEFAULT
                setAppCacheEnabled(true)
                setAppCachePath(cacheDir.absolutePath)

                // Performance
                mixedContentMode = WebSettings.MIXED_CONTENT_ALLOW_ALL
                useWideViewPort = true
                loadWithOverviewMode = true

                // User agent for compatibility
                val userAgent = settings.userAgentString
                userAgent?.let {
                    settings.userAgentString = "$it LATIF-NI-Android/${BuildConfig.VERSION_NAME}"
                }

                // Files access
                setAllowFileAccess(true)
                setAllowContentAccess(true)
            }

            // Zoom settings
            settings.builtInZoomControls = false
            settings.displayZoomControls = false

            // WebView client
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Timber.d("Dashboard page loaded: $url")

                    // Inject backend URL into page
                    injectBackendConfiguration()
                }

                override fun onReceivedError(
                    view: WebView?,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String?
                ) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    Timber.e("WebView error: $errorCode - $description - $failingUrl")

                    Toast.makeText(
                        this@DashboardActivity,
                        "Error loading dashboard: $description",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            // Chrome client for console messages
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: String?, lineNumber: Int, sourceID: String?) {
                    super.onConsoleMessage(message, lineNumber, sourceID)
                    Timber.d("WebView Console: $message (line $lineNumber)")
                }
            }
        }
    }

    private fun loadDashboard() {
        lifecycleScope.launch {
            try {
                val prefs = getSharedPreferences("latif_settings", Context.MODE_PRIVATE)
                val host = prefs.getString("backend_host", BuildConfig.BACKEND_HOST) ?: BuildConfig.BACKEND_HOST
                val port = prefs.getInt("backend_port", BuildConfig.BACKEND_PORT)
                val protocol = prefs.getString("backend_protocol", BuildConfig.BACKEND_PROTOCOL) ?: BuildConfig.BACKEND_PROTOCOL

                backendUrl = "$protocol://$host:$port"

                // Try to load dashboard from remote backend
                Timber.d("Loading dashboard from: $backendUrl")
                webView.loadUrl(backendUrl)

            } catch (e: Exception) {
                Timber.e(e, "Failed to load dashboard")
                Toast.makeText(
                    this@DashboardActivity,
                    "Error loading dashboard: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    private fun injectBackendConfiguration() {
        val jsCode = """
            window.latifConfig = {
                backendUrl: '$backendUrl',
                version: '${BuildConfig.VERSION_NAME}',
                platform: 'Android',
                locale: '${getCurrentLocale()}',
                isNative: true
            };
            console.log('LATIF Configuration injected:', window.latifConfig);
        """

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webView.evaluateJavascript(jsCode) { result ->
                Timber.d("Configuration injection result: $result")
            }
        } else {
            @Suppress("DEPRECATION")
            webView.loadUrl("javascript:$jsCode")
        }
    }

    private fun getCurrentLocale(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            resources.configuration.locales[0].toString()
        } else {
            @Suppress("DEPRECATION")
            resources.configuration.locale.toString()
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        webView.pauseTimers()
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

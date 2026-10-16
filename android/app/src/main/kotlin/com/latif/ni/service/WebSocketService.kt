package com.latif.ni.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import timber.log.Timber

/**
 * LATIF NI WebSocket Service
 * Handles real-time WebSocket connections to backend for live metric updates
 */
class WebSocketService : Service() {

    private val binder = LocalBinder()
    private var webSocket: WebSocket? = null
    private var connectionJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    private val httpClient = OkHttpClient.Builder()
        .readTimeout(0, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private var messageListener: ((String) -> Unit)? = null
    private var connectionListener: ((Boolean) -> Unit)? = null

    override fun onBind(intent: Intent?): IBinder = binder

    inner class LocalBinder : Binder() {
        fun getService(): WebSocketService = this@WebSocketService
    }

    fun connect(context: Context) {
        disconnect()

        connectionJob = scope.launch {
            try {
                val prefs = context.getSharedPreferences("latif_settings", Context.MODE_PRIVATE)
                val host = prefs.getString("backend_host", "localhost") ?: "localhost"
                val port = prefs.getInt("backend_port", 3001)
                val protocol = prefs.getString("ws_protocol", "ws") ?: "ws"

                val wsUrl = "$protocol://$host:$port"
                Timber.d("Connecting to WebSocket: $wsUrl")

                val request = Request.Builder()
                    .url(wsUrl)
                    .addHeader("User-Agent", "LATIF-NI-Android")
                    .build()

                webSocket = httpClient.newWebSocket(request, WebSocketListener())

                connectionListener?.invoke(true)

            } catch (e: Exception) {
                Timber.e(e, "WebSocket connection failed")
                connectionListener?.invoke(false)
            }
        }
    }

    fun disconnect() {
        try {
            webSocket?.close(1000, "Closing")
            webSocket = null
            connectionJob?.cancel()
            connectionListener?.invoke(false)
            Timber.d("WebSocket disconnected")
        } catch (e: Exception) {
            Timber.e(e, "Error disconnecting WebSocket")
        }
    }

    fun setMessageListener(listener: (String) -> Unit) {
        messageListener = listener
    }

    fun setConnectionListener(listener: (Boolean) -> Unit) {
        connectionListener = listener
    }

    fun sendMessage(message: String) {
        webSocket?.send(message)
    }

    private inner class WebSocketListener : WebSocketListener() {

        override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
            Timber.d("WebSocket opened")
            connectionListener?.invoke(true)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            Timber.d("WebSocket message: $text")
            messageListener?.invoke(text)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Timber.d("WebSocket closing: $code - $reason")
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            Timber.d("WebSocket closed: $code - $reason")
            connectionListener?.invoke(false)
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
            Timber.e(t, "WebSocket error")
            connectionListener?.invoke(false)
        }
    }

    override fun onDestroy() {
        disconnect()
        scope.cancel()
        super.onDestroy()
    }
}

package com.latif.suite

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * Native, in-process AI runtime exposed to the bundled GX/NI web UI.
 *
 * There is deliberately no HTTP server here. The model is shipped as an APK asset,
 * copied once into the app-private model directory, and loaded directly by LiteRT-LM.
 */
class EmbeddedAiBridge(
    private val activity: Activity,
    private val webView: WebView,
) : AutoCloseable {

    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val busy = AtomicBoolean(false)

    @Volatile private var state = if (BuildConfig.LOCAL_AI_ENABLED) "preparing" else "disabled"
    @Volatile private var detail = if (BuildConfig.LOCAL_AI_ENABLED) "Preparing embedded model" else "Local AI disabled for this flavor"
    @Volatile private var backend = "none"
    @Volatile private var progress = 0
    @Volatile private var modelBytes = 0L

    private var engine: Engine? = null
    private var conversation: Conversation? = null

    private var previousCpuIdle = 0L
    private var previousCpuTotal = 0L

    init {
        if (BuildConfig.LOCAL_AI_ENABLED) {
            worker.execute { initialize() }
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean = BuildConfig.LOCAL_AI_ENABLED

    @JavascriptInterface
    fun modelLabel(): String = BuildConfig.MODEL_LABEL

    @JavascriptInterface
    fun status(): String = JSONObject().apply {
        put("enabled", BuildConfig.LOCAL_AI_ENABLED)
        put("state", state)
        put("detail", detail)
        put("progress", progress)
        put("ready", state == "ready")
        put("busy", busy.get())
        put("backend", backend)
        put("model", BuildConfig.MODEL_LABEL)
        put("modelBytes", modelBytes)
    }.toString()

    /**
     * Starts a real local model turn. The method returns immediately to JavaScript; the result is
     * delivered through window.LATIF_NATIVE_AI_CALLBACKS.{onChunk,onDone,onError}.
     *
     * LiteRT-LM's synchronous Android path is used deliberately for stability. We progressively
     * reveal the completed response to the existing UI so the web layer keeps its streaming UX,
     * while avoiding a known terminal-callback failure in older async Android runtime builds.
     */
    @JavascriptInterface
    fun chat(
        requestId: String,
        messagesJson: String,
        systemPrompt: String,
        maxOutputTokens: Int,
        temperature: Double,
        topP: Double,
    ): Boolean {
        if (state != "ready" || engine == null) {
            emitError(requestId, "Embedded AI is not ready: $detail")
            return false
        }
        if (!busy.compareAndSet(false, true)) {
            emitError(requestId, "The local model is already generating a response")
            return false
        }

        worker.execute {
            try {
                val parsed = parseConversation(messagesJson)
                val sampler = SamplerConfig(
                    topK = 40,
                    topP = topP.coerceIn(0.05, 1.0),
                    temperature = temperature.coerceIn(0.0, 2.0),
                    seed = 0,
                )
                val config = ConversationConfig(
                    systemInstruction = Contents.of(systemPrompt),
                    initialMessages = parsed.history,
                    samplerConfig = sampler,
                    automaticToolCalling = true,
                    maxOutputToken = maxOutputTokens.coerceIn(32, 2048),
                    thinkingConfig = ThinkingConfig(enableThinking = false, thinkingTokenBudget = 0),
                )

                val localConversation = requireNotNull(engine).createConversation(config)
                conversation = localConversation
                val response = localConversation.sendMessage(
                    parsed.lastUserMessage,
                    maxOutputToken = maxOutputTokens.coerceIn(32, 2048),
                    thinkingConfig = ThinkingConfig(enableThinking = false, thinkingTokenBudget = 0),
                ).toString()

                // Preserve the existing token-streaming UI contract without depending on an HTTP server.
                revealResponse(requestId, response)
                emitDone(requestId, response)
            } catch (t: Throwable) {
                emitError(requestId, t.message ?: t.javaClass.simpleName)
            } finally {
                try {
                    conversation?.close()
                } catch (_: Throwable) {
                }
                conversation = null
                busy.set(false)
            }
        }
        return true
    }

    @JavascriptInterface
    fun cancel(requestId: String): Boolean {
        // Synchronous LiteRT-LM generation cannot be safely interrupted on every Android backend.
        // Marking the request as cancelled is handled in JS; this hook is kept so a runtime with
        // reliable cancellation can be enabled without changing the UI protocol.
        emitError(requestId, "Generation cancellation will take effect after the current local decode finishes")
        return false
    }

    /** Real device telemetry for LATIF NI. No random/demo values. */
    @JavascriptInterface
    fun deviceStats(): String {
        val activityManager = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        val usedMemory = max(0L, memInfo.totalMem - memInfo.availMem)
        val ramPercent = if (memInfo.totalMem > 0) usedMemory * 100.0 / memInfo.totalMem else 0.0

        val batteryIntent = activity.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val batteryLevel = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val batteryScale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val batteryPercent = if (batteryLevel >= 0 && batteryScale > 0) batteryLevel * 100.0 / batteryScale else -1.0
        val batteryTemp = batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0)?.div(10.0) ?: 0.0

        return JSONObject().apply {
            put("cpuPercent", readCpuPercent())
            put("ramPercent", ramPercent)
            put("ramUsedBytes", usedMemory)
            put("ramTotalBytes", memInfo.totalMem)
            put("batteryPercent", batteryPercent)
            put("temperatureC", batteryTemp)
            put("cpuCores", Runtime.getRuntime().availableProcessors())
            put("aiBackend", backend)
            put("aiReady", state == "ready")
            put("aiBusy", busy.get())
            put("model", BuildConfig.MODEL_LABEL)
            put("modelBytes", modelBytes)
            put("gpuPercent", readGpuPercent())
        }.toString()
    }

    private fun initialize() {
        try {
            setState("extracting", "Installing embedded model from APK", 2)
            val model = extractBundledModel(BuildConfig.MODEL_ASSET)
            modelBytes = model.length()
            setState("loading", "Loading ${BuildConfig.MODEL_LABEL}", 80)

            val gpuAttempt = tryCreateEngine(model, Backend.GPU(), "GPU")
            if (gpuAttempt != null) {
                engine = gpuAttempt
                backend = "GPU"
            } else {
                setState("loading", "GPU unavailable; loading optimized CPU backend", 88)
                engine = requireNotNull(tryCreateEngine(model, Backend.CPU(), "CPU")) {
                    "No supported LiteRT-LM backend could initialize the embedded model"
                }
                backend = "CPU"
            }
            setState("ready", "${BuildConfig.MODEL_LABEL} ready on $backend", 100)
        } catch (t: Throwable) {
            state = "error"
            detail = t.message ?: t.javaClass.simpleName
            progress = 0
            emitStatus()
        }
    }

    private fun tryCreateEngine(model: File, candidate: Backend, label: String): Engine? {
        return try {
            val created = Engine(
                EngineConfig(
                    modelPath = model.absolutePath,
                    backend = candidate,
                    maxNumTokens = 4096,
                    cacheDir = File(activity.cacheDir, "litertlm").apply { mkdirs() }.absolutePath,
                )
            )
            created.initialize()
            detail = "$label inference initialized"
            created
        } catch (_: Throwable) {
            null
        }
    }

    private fun extractBundledModel(assetPath: String): File {
        require(assetPath.isNotBlank()) { "No embedded model configured for this app flavor" }
        val modelDir = File(activity.filesDir, "models").apply { mkdirs() }
        val target = File(modelDir, File(assetPath).name)

        val expectedLength = try {
            activity.assets.openFd(assetPath).use { it.length }
        } catch (_: Throwable) {
            -1L
        }
        if (target.isFile && target.length() > 0 && (expectedLength <= 0 || target.length() == expectedLength)) {
            progress = 78
            return target
        }

        val partial = File(modelDir, target.name + ".partial")
        if (partial.exists()) partial.delete()
        activity.assets.open(assetPath).use { input ->
            partial.outputStream().buffered(8 * 1024 * 1024).use { output ->
                val buffer = ByteArray(4 * 1024 * 1024)
                var copied = 0L
                while (true) {
                    val count = input.read(buffer)
                    if (count <= 0) break
                    output.write(buffer, 0, count)
                    copied += count
                    if (expectedLength > 0) {
                        progress = (2 + (copied * 75 / expectedLength)).toInt().coerceIn(2, 77)
                    }
                }
            }
        }
        require(partial.length() > 0) { "Bundled model asset is empty: $assetPath" }
        if (expectedLength > 0) {
            require(partial.length() == expectedLength) {
                "Embedded model extraction failed: expected $expectedLength bytes, got ${partial.length()}"
            }
        }
        if (target.exists()) target.delete()
        require(partial.renameTo(target)) { "Could not finalize embedded model installation" }
        return target
    }

    private data class ParsedConversation(
        val history: List<Message>,
        val lastUserMessage: String,
    )

    private fun parseConversation(json: String): ParsedConversation {
        val array = JSONArray(json)
        require(array.length() > 0) { "Conversation is empty" }

        var lastUserIndex = -1
        for (i in array.length() - 1 downTo 0) {
            if (array.getJSONObject(i).optString("role") == "user") {
                lastUserIndex = i
                break
            }
        }
        require(lastUserIndex >= 0) { "No user message found" }

        val history = ArrayList<Message>()
        for (i in 0 until lastUserIndex) {
            val item = array.getJSONObject(i)
            val text = item.optString("content").trim()
            if (text.isEmpty()) continue
            when (item.optString("role")) {
                "user" -> history.add(Message.user(text))
                "assistant" -> history.add(Message.model(text))
            }
        }
        val lastText = array.getJSONObject(lastUserIndex).optString("content").trim()
        require(lastText.isNotEmpty()) { "Latest user message is empty" }
        return ParsedConversation(history, lastText)
    }

    private fun revealResponse(requestId: String, text: String) {
        if (text.isEmpty()) return
        var index = 0
        while (index < text.length) {
            val next = (index + 28).coerceAtMost(text.length)
            emit("onChunk", requestId, text.substring(index, next))
            index = next
        }
    }

    private fun setState(newState: String, message: String, newProgress: Int) {
        state = newState
        detail = message
        progress = newProgress
        emitStatus()
    }

    private fun emitStatus() {
        main.post {
            val script = "window.LATIF_NATIVE_AI_CALLBACKS&&window.LATIF_NATIVE_AI_CALLBACKS.onStatus&&window.LATIF_NATIVE_AI_CALLBACKS.onStatus(${JSONObject.quote(status())});"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun emitDone(requestId: String, fullText: String) = emit("onDone", requestId, fullText)
    private fun emitError(requestId: String, message: String) = emit("onError", requestId, message)

    private fun emit(method: String, requestId: String, payload: String) {
        main.post {
            val script = "window.LATIF_NATIVE_AI_CALLBACKS&&window.LATIF_NATIVE_AI_CALLBACKS.$method&&window.LATIF_NATIVE_AI_CALLBACKS.$method(${JSONObject.quote(requestId)},${JSONObject.quote(payload)});"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun readCpuPercent(): Double {
        return try {
            val parts = FileInputStream("/proc/stat").bufferedReader().use { it.readLine() }
                .trim().split(Regex("\\s+"))
            if (parts.size < 5 || parts[0] != "cpu") return -1.0
            val values = parts.drop(1).mapNotNull { it.toLongOrNull() }
            if (values.size < 4) return -1.0
            val idle = values[3] + (values.getOrNull(4) ?: 0L)
            val total = values.sum()
            val deltaTotal = total - previousCpuTotal
            val deltaIdle = idle - previousCpuIdle
            previousCpuTotal = total
            previousCpuIdle = idle
            if (deltaTotal <= 0) -1.0 else ((deltaTotal - deltaIdle) * 100.0 / deltaTotal).coerceIn(0.0, 100.0)
        } catch (_: Throwable) {
            -1.0
        }
    }

    private fun readGpuPercent(): Double {
        val candidates = listOf(
            "/sys/class/kgsl/kgsl-3d0/gpubusy",
            "/sys/class/misc/mali0/device/utilization",
            "/sys/devices/platform/13000000.mali/utilization",
        )
        for (path in candidates) {
            try {
                val raw = File(path).readText().trim()
                if (path.endsWith("gpubusy")) {
                    val p = raw.split(Regex("\\s+")).mapNotNull { it.toDoubleOrNull() }
                    if (p.size >= 2 && p[1] > 0) return (p[0] * 100.0 / p[1]).coerceIn(0.0, 100.0)
                } else {
                    raw.filter { it.isDigit() || it == '.' }.toDoubleOrNull()?.let { return it.coerceIn(0.0, 100.0) }
                }
            } catch (_: Throwable) {
            }
        }
        return -1.0
    }

    override fun close() {
        try {
            conversation?.close()
        } catch (_: Throwable) {
        }
        conversation = null
        try {
            engine?.close()
        } catch (_: Throwable) {
        }
        engine = null
        worker.shutdownNow()
    }
}

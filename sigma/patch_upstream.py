#!/usr/bin/env python3
"""Apply the SIGMA standalone overlay to a pinned web-to-app checkout.

The overlay intentionally keeps the mature WebToApp agent/tool/runtime code and replaces
its LLM choke point with an in-process llama.cpp Android binding. It also injects an
immutable built-in model configuration so the agent never needs an API key/provider.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "web-to-app").resolve()


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def replace_exact(rel: str, old: str, new: str, expected: int = 1) -> None:
    text = read(rel)
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{rel}: expected {expected} copies of replacement anchor, found {count}: {old[:80]!r}")
    write(rel, text.replace(old, new, expected))


def replace_regex(rel: str, pattern: str, repl: str, expected: int = 1) -> None:
    text = read(rel)
    new, count = re.subn(pattern, repl, text, count=expected, flags=re.S)
    if count != expected:
        raise SystemExit(f"{rel}: expected {expected} regex replacements, found {count}: {pattern[:100]!r}")
    write(rel, new)


# ---------------------------------------------------------------------------
# Gradle / Android integration
# ---------------------------------------------------------------------------
replace_exact(
    "build.gradle.kts",
    '    id("com.android.application") version "9.2.0" apply false\n',
    '    id("com.android.application") version "9.2.0" apply false\n'
    '    id("com.android.library") version "9.2.0" apply false\n',
)

replace_exact(
    "settings.gradle.kts",
    'include(":clone-host")\n',
    'include(":clone-host")\n'
    'include(":llama-android-lib")\n'
    'project(":llama-android-lib").projectDir = file("vendor/llama.cpp/examples/llama.android/lib")\n',
)

app_gradle = "app/build.gradle.kts"
replace_exact(app_gradle, '    namespace = "com.webtoapp"\n    compileSdk = 36\n',
              '    namespace = "com.webtoapp"\n    compileSdk = 36\n    ndkVersion = "29.0.13113456"\n')
replace_exact(app_gradle, '        applicationId = "com.webtoapp"\n        minSdk = 23\n',
              '        applicationId = "com.latif.sigma"\n        minSdk = 33\n')
replace_exact(app_gradle, '        versionCode = 66\n        versionName = "2.6.4"\n',
              '        versionCode = 1\n        versionName = "0.1.0-alpha1"\n')
replace_exact(app_gradle,
              '            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")\n',
              '            abiFilters += listOf("arm64-v8a")\n')
replace_exact(app_gradle, '    androidResources {\n',
              '    androidResources {\n        noCompress += listOf("ggufpart", "sha256")\n')
replace_exact(app_gradle, '\ndependencies {\n',
              '\ndependencies {\n    implementation(project(":llama-android-lib"))\n')

replace_exact(
    "app/src/main/res/values/strings.xml",
    '<string name="app_name" translatable="false">WebToApp</string>',
    '<string name="app_name" translatable="false">SIGMA</string>',
)

# The official llama.cpp Android lib uses the llama.cpp repo's version catalog. Because
# SIGMA includes that module inside another Gradle root, make it self-contained instead.
write(
    "vendor/llama.cpp/examples/llama.android/lib/build.gradle.kts",
    r'''plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.arm.aichat"
    compileSdk = 36
    ndkVersion = "29.0.13113456"

    defaultConfig {
        minSdk = 33
        consumerProguardFiles("consumer-rules.pro")
        ndk { abiFilters += listOf("arm64-v8a") }
        externalNativeBuild {
            cmake {
                arguments += "-DCMAKE_BUILD_TYPE=Release"
                arguments += "-DBUILD_SHARED_LIBS=ON"
                arguments += "-DLLAMA_BUILD_APP=OFF"
                arguments += "-DLLAMA_BUILD_COMMON=ON"
                arguments += "-DLLAMA_OPENSSL=OFF"
                arguments += "-DGGML_NATIVE=OFF"
                arguments += "-DGGML_BACKEND_DL=ON"
                arguments += "-DGGML_CPU_ALL_VARIANTS=ON"
                arguments += "-DGGML_LLAMAFILE=OFF"
            }
        }
        aarMetadata { minCompileSdk = 35 }
    }

    externalNativeBuild {
        cmake {
            path("src/main/cpp/CMakeLists.txt")
            version = "3.31.6"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.datastore:datastore-preferences:1.0.0")
}
''',
)

# llama.cpp already has a native reset path in processSystemPrompt(). The stock Kotlin
# facade only allows system prompts immediately after load; SIGMA deliberately resets the
# full KV/chat state before every independent agent inference request, so permit that while
# the model is ModelReady.
replace_exact(
    "vendor/llama.cpp/examples/llama.android/lib/src/main/java/com/arm/aichat/internal/InferenceEngineImpl.kt",
    '''            check(_readyForSystemPrompt) { "System prompt must be set ** RIGHT AFTER ** model loaded!" }\n''',
    '''            // SIGMA: processSystemPrompt() resets native chat/KV state, so a new\n            // system prompt is also our explicit per-request context reset.\n''',
)

# ---------------------------------------------------------------------------
# Built-in local model identity: no API key/provider setup required.
# ---------------------------------------------------------------------------
write(
    "app/src/main/java/com/webtoapp/core/sigma/SigmaBuiltins.kt",
    r'''package com.webtoapp.core.sigma

import com.webtoapp.data.model.AiFeature
import com.webtoapp.data.model.AiModel
import com.webtoapp.data.model.AiProvider
import com.webtoapp.data.model.ApiKeyConfig
import com.webtoapp.data.model.ModelCapability
import com.webtoapp.data.model.SavedModel

/** Immutable local identity used to satisfy the host app's mature model-selection plumbing. */
object SigmaBuiltins {
    const val KEY_ID = "sigma-local-key"
    const val MODEL_ID = "sigma-qwen3-4b-q4km"

    // OLLAMA is used only as a non-key-requiring enum carrier. No Ollama process, socket,
    // endpoint or HTTP request is used: DefaultLlmGateway is replaced by SigmaLocalProvider.
    val API_KEY = ApiKeyConfig(
        id = KEY_ID,
        provider = AiProvider.OLLAMA,
        apiKey = "",
        baseUrl = null,
        alias = "SIGMA Local",
        isActive = true,
    )

    val MODEL = SavedModel(
        id = MODEL_ID,
        model = AiModel(
            id = "Qwen3-4B-Q4_K_M.gguf",
            name = "SIGMA 4B Local",
            provider = AiProvider.OLLAMA,
            capabilities = listOf(ModelCapability.TEXT),
            contextLength = 8192,
            inputPrice = 0.0,
            outputPrice = 0.0,
            isCustom = true,
        ),
        apiKeyId = KEY_ID,
        alias = "SIGMA 4B Local",
        capabilities = listOf(ModelCapability.TEXT),
        featureMappings = mapOf(
            ModelCapability.TEXT to setOf(
                AiFeature.AGENT,
                AiFeature.MODULE_DEVELOPMENT,
                AiFeature.LRC_GENERATION,
                AiFeature.TRANSLATION,
                AiFeature.GENERAL,
            )
        ),
        isDefault = true,
        userContextLength = 8192,
    )
}
''',
)

# Inject the immutable built-in identity into existing flows so all mature AgentViewModel /
# ToolContext paths resolve a model immediately on a clean install.
ai_cfg = "app/src/main/java/com/webtoapp/core/ai/AiConfigManager.kt"
replace_exact(ai_cfg, 'import com.webtoapp.core.logging.AppLogger\n',
              'import com.webtoapp.core.logging.AppLogger\nimport com.webtoapp.core.sigma.SigmaBuiltins\n')
replace_regex(
    ai_cfg,
    r'    val apiKeysFlow: Flow<List<ApiKeyConfig>> = context\.aiConfigDataStore\.data\.map \{ prefs ->.*?\n    val savedModelsFlow:',
    '''    val apiKeysFlow: Flow<List<ApiKeyConfig>> = context.aiConfigDataStore.data.map { prefs ->\n        val stored = getApiKeys(prefs) ?: emptyList()\n        listOf(SigmaBuiltins.API_KEY) + stored.filterNot { it.id == SigmaBuiltins.KEY_ID }\n    }\n\n    val savedModelsFlow:''',
)
replace_regex(
    ai_cfg,
    r'    val savedModelsFlow: Flow<List<SavedModel>> = context\.aiConfigDataStore\.data\.map \{ prefs ->.*?\n    val defaultModelIdFlow:',
    '''    val savedModelsFlow: Flow<List<SavedModel>> = context.aiConfigDataStore.data.map { prefs ->\n        val stored = getSavedModels(prefs)\n        listOf(SigmaBuiltins.MODEL) + stored.filterNot { it.id == SigmaBuiltins.MODEL_ID }\n    }\n\n    val defaultModelIdFlow:''',
)
replace_regex(
    ai_cfg,
    r'    val defaultModelIdFlow: Flow<String\?> = context\.aiConfigDataStore\.data\.map \{ prefs ->\n        prefs\[KEY_DEFAULT_MODEL\]\n    \}',
    '''    val defaultModelIdFlow: Flow<String?> = context.aiConfigDataStore.data.map {\n        SigmaBuiltins.MODEL_ID\n    }''',
)
replace_exact(
    ai_cfg,
    '''    suspend fun getApiKeyById(id: String): ApiKeyConfig? {\n\n        val prefs = context.aiConfigDataStore.data.first()\n        return (getApiKeys(prefs) ?: emptyList()).find { it.id == id }\n    }\n''',
    '''    suspend fun getApiKeyById(id: String): ApiKeyConfig? {\n        if (id == SigmaBuiltins.KEY_ID) return SigmaBuiltins.API_KEY\n        val prefs = context.aiConfigDataStore.data.first()\n        return (getApiKeys(prefs) ?: emptyList()).find { it.id == id }\n    }\n''',
)
replace_exact(
    ai_cfg,
    '''    suspend fun getSavedModelById(id: String): SavedModel? {\n        val prefs = context.aiConfigDataStore.data.first()\n        return getSavedModels(prefs).find { it.id == id }\n    }\n''',
    '''    suspend fun getSavedModelById(id: String): SavedModel? {\n        if (id == SigmaBuiltins.MODEL_ID) return SigmaBuiltins.MODEL\n        val prefs = context.aiConfigDataStore.data.first()\n        return getSavedModels(prefs).find { it.id == id }\n    }\n''',
)

# ---------------------------------------------------------------------------
# Embedded model store. The model is chunked inside the APK, reassembled locally, and
# verified before the path is ever passed to llama.cpp.
# ---------------------------------------------------------------------------
write(
    "app/src/main/java/com/webtoapp/core/sigma/SigmaModelStore.kt",
    r'''package com.webtoapp.core.sigma

import android.content.Context
import android.content.res.AssetManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.nio.file.Files
import java.nio.file.StandardCopyOption

object SigmaModelStore {
    const val EXPECTED_SHA256 = "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5"
    private const val ASSET_DIR = "sigma/model"
    private const val MANIFEST_ASSET = "$ASSET_DIR/MODEL-MANIFEST.txt"
    private const val MODEL_FILE = "Qwen3-4B-Q4_K_M.gguf"

    data class Manifest(val sha256: String, val size: Long, val parts: Int)

    suspend fun ensureModelFile(context: Context): File = withContext(Dispatchers.IO) {
        val manifest = readManifest(context.assets)
        require(manifest.sha256.equals(EXPECTED_SHA256, ignoreCase = true)) {
            "SIGMA model manifest SHA mismatch"
        }

        val dir = File(context.filesDir, "sigma/model").apply { mkdirs() }
        val target = File(dir, MODEL_FILE)
        val marker = File(dir, "$MODEL_FILE.verified")
        val expectedMarker = "${manifest.sha256.lowercase()} ${manifest.size}"

        if (target.isFile && target.length() == manifest.size && marker.readTextOrNull() == expectedMarker) {
            return@withContext target
        }

        val parts = context.assets.list(ASSET_DIR)
            ?.filter { it.endsWith(".ggufpart") }
            ?.sorted()
            .orEmpty()
        require(parts.size == manifest.parts) {
            "SIGMA model parts missing: found ${parts.size}, expected ${manifest.parts}"
        }

        val tmp = File(dir, "$MODEL_FILE.tmp")
        tmp.delete()
        marker.delete()
        val digest = MessageDigest.getInstance("SHA-256")
        var total = 0L
        val buffer = ByteArray(8 * 1024 * 1024)

        try {
            BufferedOutputStream(FileOutputStream(tmp), buffer.size).use { output ->
                for (name in parts) {
                    context.assets.open("$ASSET_DIR/$name", AssetManager.ACCESS_STREAMING).use { input ->
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            if (n == 0) continue
                            output.write(buffer, 0, n)
                            digest.update(buffer, 0, n)
                            total += n
                        }
                    }
                }
                output.flush()
            }

            val actualSha = digest.digest().joinToString("") { "%02x".format(it) }
            require(total == manifest.size) { "SIGMA model size mismatch: $total != ${manifest.size}" }
            require(actualSha.equals(manifest.sha256, ignoreCase = true)) {
                "SIGMA model SHA-256 mismatch: $actualSha"
            }

            Files.move(
                tmp.toPath(),
                target.toPath(),
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE,
            )
            marker.writeText(expectedMarker)
            target
        } catch (t: Throwable) {
            tmp.delete()
            marker.delete()
            throw t
        }
    }

    private fun readManifest(assets: AssetManager): Manifest {
        val values = assets.open(MANIFEST_ASSET).bufferedReader().useLines { lines ->
            lines.mapNotNull { line ->
                val i = line.indexOf('=')
                if (i <= 0) null else line.substring(0, i).trim() to line.substring(i + 1).trim()
            }.toMap()
        }
        return Manifest(
            sha256 = requireNotNull(values["sha256"]) { "SIGMA manifest missing sha256" },
            size = requireNotNull(values["size"]) { "SIGMA manifest missing size" }.toLong(),
            parts = requireNotNull(values["parts"]) { "SIGMA manifest missing parts" }.toInt(),
        )
    }

    private fun File.readTextOrNull(): String? = runCatching { if (isFile) readText() else null }.getOrNull()
}
''',
)

write(
    "app/src/main/java/com/webtoapp/core/sigma/SigmaRuntime.kt",
    r'''package com.webtoapp.core.sigma

import android.content.Context
import com.arm.aichat.AiChat
import com.arm.aichat.InferenceEngine
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.sync.Mutex

/** One in-process model instance shared by SIGMA; there is no localhost/HTTP model server. */
class SigmaRuntime private constructor(private val context: Context) {
    private val mutex = Mutex()
    private val engine: InferenceEngine by lazy { AiChat.getInferenceEngine(context.applicationContext) }
    @Volatile private var modelLoaded = false

    fun generate(systemPrompt: String, userPrompt: String, maxTokens: Int): Flow<String> = flow {
        mutex.lock()
        try {
            ensureLoaded()
            // Patched llama.cpp binding: processSystemPrompt resets chat messages + KV cache.
            engine.setSystemPrompt(systemPrompt.ifBlank { "You are SIGMA, a local on-device AI." })
            engine.sendUserPrompt(userPrompt, maxTokens.coerceIn(64, 4096)).collect { emit(it) }
        } finally {
            mutex.unlock()
        }
    }

    private suspend fun ensureLoaded() {
        if (modelLoaded && engine.state.value is InferenceEngine.State.ModelReady) return

        val stable = when (val now = engine.state.value) {
            is InferenceEngine.State.Uninitialized,
            is InferenceEngine.State.Initializing -> engine.state.first {
                it is InferenceEngine.State.Initialized || it is InferenceEngine.State.Error
            }
            else -> now
        }

        when (stable) {
            is InferenceEngine.State.Error -> {
                runCatching { engine.cleanUp() }
                modelLoaded = false
            }
            is InferenceEngine.State.ModelReady -> {
                modelLoaded = true
                return
            }
            else -> Unit
        }

        if (!modelLoaded) {
            val model = SigmaModelStore.ensureModelFile(context)
            engine.loadModel(model.absolutePath)
            modelLoaded = true
        }
    }

    companion object {
        @Volatile private var instance: SigmaRuntime? = null
        fun get(context: Context): SigmaRuntime = instance ?: synchronized(this) {
            instance ?: SigmaRuntime(context.applicationContext).also { instance = it }
        }
    }
}
''',
)

# ---------------------------------------------------------------------------
# LLM gateway replacement. It speaks the existing native LlmEvent tool protocol, so the
# mature AgentEngine/ToolRegistry does not know or care that cloud providers disappeared.
# ---------------------------------------------------------------------------
write(
    "app/src/main/java/com/webtoapp/core/agent/llm/SigmaLocalProvider.kt",
    r'''package com.webtoapp.core.agent.llm

import android.content.Context
import com.google.gson.JsonParser
import com.webtoapp.core.sigma.SigmaRuntime
import com.webtoapp.data.model.AiProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.util.UUID

internal class SigmaLocalProvider(context: Context) : LlmProvider {
    private val runtime = SigmaRuntime.get(context.applicationContext)

    override fun supports(provider: AiProvider): Boolean = true
    override fun supports(req: ChatRequest): Boolean = true

    override fun chatStream(req: ChatRequest): Flow<LlmEvent> = flow {
        emit(LlmEvent.Started)
        try {
            val systemPrompt = buildSystemPrompt(req)
            val transcript = buildTranscript(req)
            val raw = StringBuilder()
            runtime.generate(systemPrompt, transcript, req.maxTokens ?: 1536).collect { token ->
                raw.append(token)
            }
            emitParsed(raw.toString())
        } catch (t: Throwable) {
            emit(LlmEvent.Error(t.message ?: t.javaClass.simpleName, recoverable = false))
        }
    }

    private fun buildSystemPrompt(req: ChatRequest): String = buildString {
        val hostSystem = req.messages.filter { it.role == LlmMessage.Role.SYSTEM }
            .joinToString("\n\n") { it.content }
        if (hostSystem.isNotBlank()) append(hostSystem).append("\n\n")

        append(
            """
            You are SIGMA, the AI reasoning core running entirely inside this Android app.
            You have no need for an API key or remote inference service.

            TOOL PROTOCOL:
            - When a tool is required, output exactly one tool request and no prose after it.
            - Format it exactly as:
              <SIGMA_TOOL>{"name":"tool_name","arguments":{...}}</SIGMA_TOOL>
            - The name must exactly match one available tool below.
            - arguments must satisfy that tool's JSON schema.
            - Never invent a tool result. After a tool result arrives, reason from that result.
            - If no tool is needed, answer normally without SIGMA_TOOL tags.
            """.trimIndent()
        )

        if (req.useTools && req.tools.isNotEmpty()) {
            append("\n\nAVAILABLE TOOLS:\n")
            req.tools.forEach { tool ->
                append("- ").append(tool.name).append(": ").append(tool.description).append('\n')
                append("  schema: ").append(tool.parametersSchema.toString()).append('\n')
            }
        }
    }

    private fun buildTranscript(req: ChatRequest): String = buildString {
        append("Continue this conversation as the assistant. Respect the exact role boundaries.\n\n")
        req.messages.filterNot { it.role == LlmMessage.Role.SYSTEM }.forEach { msg ->
            when (msg.role) {
                LlmMessage.Role.USER -> append("<USER>\n").append(msg.content).append("\n</USER>\n")
                LlmMessage.Role.ASSISTANT -> {
                    append("<ASSISTANT>\n").append(msg.content)
                    if (msg.toolCalls.isNotEmpty()) {
                        append("\nPrevious tool calls:\n")
                        msg.toolCalls.forEach { call ->
                            append(call.name).append('(').append(call.argumentsJson).append(")\n")
                        }
                    }
                    append("\n</ASSISTANT>\n")
                }
                LlmMessage.Role.TOOL -> {
                    append("<TOOL_RESULT")
                    msg.name?.let { append(" name=\"").append(it).append('\"') }
                    msg.toolCallId?.let { append(" id=\"").append(it).append('\"') }
                    append(">\n").append(msg.content).append("\n</TOOL_RESULT>\n")
                }
                LlmMessage.Role.SYSTEM -> Unit
            }
        }
        append("\n<ASSISTANT>\n")
    }

    private suspend fun kotlinx.coroutines.flow.FlowCollector<LlmEvent>.emitParsed(rawOutput: String) {
        var text = rawOutput.trim()

        // Qwen thinking content, when enabled by its template, maps onto the host's existing UI.
        while (true) {
            val s = text.indexOf("<think>")
            if (s < 0) break
            val e = text.indexOf("</think>", s + 7)
            if (e < 0) break
            val thinking = text.substring(s + 7, e).trim()
            if (thinking.isNotEmpty()) emit(LlmEvent.ThinkingDelta(thinking))
            text = (text.substring(0, s) + text.substring(e + 8)).trim()
        }

        val open = text.indexOf("<SIGMA_TOOL>")
        val close = if (open >= 0) text.indexOf("</SIGMA_TOOL>", open + 12) else -1
        if (open >= 0 && close > open) {
            val before = text.substring(0, open).trim()
            if (before.isNotEmpty()) emit(LlmEvent.TextDelta(before))

            val jsonText = text.substring(open + "<SIGMA_TOOL>".length, close).trim()
            val obj = runCatching { JsonParser.parseString(jsonText).asJsonObject }.getOrNull()
            val name = obj?.get("name")?.takeIf { it.isJsonPrimitive }?.asString
            val argsElement = obj?.get("arguments")
            if (!name.isNullOrBlank() && argsElement != null) {
                val args = if (argsElement.isJsonPrimitive && argsElement.asJsonPrimitive.isString) {
                    argsElement.asString
                } else {
                    argsElement.toString()
                }
                val id = "sigma-${UUID.randomUUID()}"
                emit(LlmEvent.ToolCallBegin(id, name))
                emit(LlmEvent.ToolCallArgsDelta(id, args))
                emit(LlmEvent.ToolCallEnd(id, name, args))
                emit(LlmEvent.Done(FinishReason.TOOL_CALLS))
                return
            }
        }

        if (text.isNotBlank()) emit(LlmEvent.TextDelta(text))
        emit(LlmEvent.Done(FinishReason.STOP))
    }
}
''',
)

# Replace provider routing entirely. No remote provider can be selected by the agent path.
write(
    "app/src/main/java/com/webtoapp/core/agent/llm/LlmGateway.kt",
    r'''package com.webtoapp.core.agent.llm

import android.content.Context
import com.webtoapp.data.model.AiProvider
import kotlinx.coroutines.flow.Flow

interface LlmGateway {
    fun chatStream(req: ChatRequest): Flow<LlmEvent>
}

internal interface LlmProvider {
    fun supports(provider: AiProvider): Boolean
    fun supports(req: ChatRequest): Boolean = supports(req.apiKey.provider)
    fun chatStream(req: ChatRequest): Flow<LlmEvent>
}

class DefaultLlmGateway internal constructor(private val providers: List<LlmProvider>) : LlmGateway {
    override fun chatStream(req: ChatRequest): Flow<LlmEvent> = providers.first().chatStream(req)

    companion object {
        fun create(context: Context): LlmGateway = DefaultLlmGateway(
            listOf(SigmaLocalProvider(context))
        )
    }
}
''',
)

# Build identity / provenance bundled with the application.
write(
    "app/src/main/assets/sigma/SIGMA-BUILD.txt",
    """SIGMA standalone alpha\nHost: shiaho777/web-to-app @ eafd07e4c6aa488f123f82eae37f6799a0cb03d4\nInference: ggml-org/llama.cpp v0.4.1\nModel: Qwen/Qwen3-4B-GGUF Qwen3-4B-Q4_K_M.gguf\nModel SHA256: 7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5\nCore inference: in-process JNI, no HTTP server\n""",
)

print("SIGMA overlay applied successfully to", ROOT)

package com.latif.ni.service

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * LATIF NI Backend Service
 * Handles all API communication with the backend service running on port 3001
 */
object BackendService {

    private const val HEALTH_ENDPOINT = "/api/health"
    private const val DASHBOARD_ENDPOINT = "/api/dashboard"
    private const val METRICS_ENDPOINT = "/api/metrics"
    private const val AGENTS_ENDPOINT = "/api/agents"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    /**
     * Check if backend service is healthy
     */
    suspend fun checkHealth(context: Context): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, HEALTH_ENDPOINT)
            return@withContext makeRequest(url) != null
        } catch (e: Exception) {
            Timber.e(e, "Health check failed")
            false
        }
    }

    /**
     * Check if backend service is healthy at specific URL
     */
    suspend fun checkHealthURL(context: Context, baseUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl$HEALTH_ENDPOINT"
            return@withContext makeRequest(url) != null
        } catch (e: Exception) {
            Timber.e(e, "Health check failed for URL: $baseUrl")
            false
        }
    }

    /**
     * Get dashboard state
     */
    suspend fun getDashboard(context: Context): DashboardState? = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, DASHBOARD_ENDPOINT)
            val response = makeRequest(url) ?: return@withContext null

            return@withContext gson.fromJson(response, DashboardState::class.java)
        } catch (e: Exception) {
            Timber.e(e, "Failed to get dashboard state")
            null
        }
    }

    /**
     * Get system metrics
     */
    suspend fun getMetrics(context: Context): SystemMetrics? = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, METRICS_ENDPOINT)
            val response = makeRequest(url) ?: return@withContext null

            return@withContext gson.fromJson(response, SystemMetrics::class.java)
        } catch (e: Exception) {
            Timber.e(e, "Failed to get metrics")
            null
        }
    }

    /**
     * Get agents list
     */
    suspend fun getAgents(context: Context): List<Agent>? = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, AGENTS_ENDPOINT)
            val response = makeRequest(url) ?: return@withContext null

            val agentArray = gson.fromJson(response, Array<Agent>::class.java)
            return@withContext agentArray.toList()
        } catch (e: Exception) {
            Timber.e(e, "Failed to get agents")
            null
        }
    }

    /**
     * Execute agent task
     */
    suspend fun executeAgent(context: Context, agentId: String, task: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, "/api/agents/$agentId/execute")
            val payload = JsonObject().apply {
                addProperty("task", task)
            }

            return@withContext makePostRequest(url, payload.toString()) != null
        } catch (e: Exception) {
            Timber.e(e, "Failed to execute agent")
            false
        }
    }

    /**
     * Check Ollama status
     */
    suspend fun checkOllamaStatus(context: Context): OllamaStatus? = withContext(Dispatchers.IO) {
        try {
            val url = buildBackendUrl(context, "/api/ollama-status")
            val response = makeRequest(url) ?: return@withContext null

            return@withContext gson.fromJson(response, OllamaStatus::class.java)
        } catch (e: Exception) {
            Timber.e(e, "Failed to check Ollama status")
            null
        }
    }

    /**
     * Build complete backend URL
     */
    private fun buildBackendUrl(context: Context, endpoint: String): String {
        val prefs = context.getSharedPreferences("latif_settings", Context.MODE_PRIVATE)
        val host = prefs.getString("backend_host", "localhost") ?: "localhost"
        val port = prefs.getInt("backend_port", 3001)
        val protocol = prefs.getString("backend_protocol", "http") ?: "http"

        return "$protocol://$host:$port$endpoint"
    }

    /**
     * Make HTTP GET request
     */
    private fun makeRequest(url: String): String? {
        return try {
            val request = Request.Builder()
                .url(url)
                .addHeader("Accept", "application/json")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    response.body?.string()
                } else {
                    Timber.w("Request failed with code ${response.code}: $url")
                    null
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Request failed: $url")
            null
        }
    }

    /**
     * Make HTTP POST request
     */
    private fun makePostRequest(url: String, body: String): String? {
        return try {
            val mediaType = okhttp3.MediaType.parse("application/json")
            val requestBody = okhttp3.RequestBody.create(mediaType, body)

            val request = Request.Builder()
                .url(url)
                .addHeader("Accept", "application/json")
                .post(requestBody)
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    response.body?.string()
                } else {
                    Timber.w("POST request failed with code ${response.code}: $url")
                    null
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "POST request failed: $url")
            null
        }
    }
}

// Data classes for API responses

data class DashboardState(
    val agents: Map<String, Agent>,
    val metrics: SystemMetrics,
    val tasksCompleted: Int,
    val successRate: Double,
    val activity: List<Activity>,
    val models: List<Model>,
    val timestamp: Long
)

data class Agent(
    val id: String,
    val name: String,
    val role: String,
    val status: String,
    val icon: String,
    val tasks: Int,
    val color: String
)

data class SystemMetrics(
    val cpu: Double,
    val ram: Int,
    val gpu: Double,
    val temp: Double,
    val uptime: Long,
    val storage: StorageInfo,
    val activeAgents: Int,
    val totalAgents: Int,
    val tasksCompleted: Int,
    val successRate: Double
)

data class StorageInfo(
    val total: Long,
    val used: Long,
    val percent: Int
)

data class Activity(
    val timestamp: Long,
    val type: String,
    val data: JsonObject
)

data class Model(
    val name: String,
    val size: String,
    val usage: Int
)

data class OllamaStatus(
    val status: String,
    val models: Int? = null,
    val error: String? = null
)

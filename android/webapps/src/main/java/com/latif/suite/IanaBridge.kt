package com.latif.suite

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Read-only offline IANA search. No shell, root, network or model permissions. */
class IanaBridge(private val context: Context) {
    private val lock = Any()
    private var database: SQLiteDatabase? = null

    private fun openDb(): SQLiteDatabase {
        synchronized(lock) {
            database?.let { if (it.isOpen) return it }
            val target = File(context.filesDir, "iana-registry-v1.db")
            val marker = File(context.filesDir, "iana-registry-v1.installed")
            val updated = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime.toString()
            if (!target.exists() || marker.takeIf { it.exists() }?.readText() != updated) {
                val temporary = File(context.filesDir, "iana-registry-v1.tmp")
                try {
                    context.assets.open("iana/registries.db").use { source ->
                        temporary.outputStream().use { dest -> source.copyTo(dest, 256 * 1024) }
                    }
                    require(temporary.length() > 4096) { "IANA offline database is empty" }
                    if (target.exists()) target.delete()
                    check(temporary.renameTo(target)) { "Unable to install IANA database" }
                    marker.writeText(updated)
                } finally {
                    temporary.delete()
                }
            }
            val db = SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READONLY)
            database = db
            return db
        }
    }

    @JavascriptInterface
    fun info(): String {
        return try {
            val db = openDb()
            synchronized(lock) {
                val result = JSONObject().put("available", true)
                db.rawQuery("SELECT key,value FROM meta", null).use { cursor ->
                    while (cursor.moveToNext()) result.put(cursor.getString(0), cursor.getString(1))
                }
                result.toString()
            }
        } catch (err: Exception) {
            JSONObject().put("available", false).put("error", err.message ?: "Unavailable").toString()
        }
    }

    @JavascriptInterface
    fun search(query: String, limit: Int): String {
        val tokens = Regex("[\\p{L}\\p{N}]+").findAll(query).map { it.value }.take(6).toList()
        if (tokens.isEmpty() || query.length > 120) return "[]"
        val expression = tokens.joinToString(" AND ") { "\"" + it.replace("\"", "") + "\"" }
        return try {
            val db = openDb()
            val output = JSONArray()
            synchronized(lock) {
                db.rawQuery(
                    """SELECT g.title, g.source_url, r.text, r.fields
                       FROM fts JOIN records r ON r.id=fts.docid
                       JOIN registries g ON g.id=r.registry_id
                       WHERE fts.text MATCH ? LIMIT ?""",
                    arrayOf(expression, limit.coerceIn(1, 60).toString())
                ).use { cursor ->
                    while (cursor.moveToNext()) {
                        output.put(JSONObject()
                            .put("registry", cursor.getString(0))
                            .put("source", cursor.getString(1))
                            .put("summary", cursor.getString(2))
                            .put("fields", JSONObject(cursor.getString(3))))
                    }
                }
            }
            output.toString()
        } catch (err: Exception) {
            JSONArray().toString()
        }
    }

    @JavascriptInterface
    fun registryList(offset: Int): String {
        return try {
            val output = JSONArray()
            synchronized(lock) {
                openDb().rawQuery(
                    "SELECT title, grp, count, source_url FROM registries WHERE count>0 ORDER BY title LIMIT 70 OFFSET ?",
                    arrayOf(offset.coerceIn(0, 2000).toString())
                ).use { cursor ->
                    while (cursor.moveToNext()) {
                        output.put(JSONObject()
                            .put("name", cursor.getString(0))
                            .put("family", cursor.getString(1))
                            .put("records", cursor.getInt(2))
                            .put("source", cursor.getString(3)))
                    }
                }
            }
            output.toString()
        } catch (err: Exception) {
            "[]"
        }
    }

    fun close() {
        synchronized(lock) {
            database?.close()
            database = null
        }
    }
}

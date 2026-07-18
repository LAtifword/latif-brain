package com.latif.ni.ui

import android.content.Context
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.latif.ni.BuildConfig
import com.latif.ni.databinding.ActivitySettingsBinding
import com.latif.ni.service.BackendService
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * LATIF NI Settings Activity
 * Manages backend connection settings and app preferences
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        loadSettings()
    }

    private fun setupUI() {
        binding.apply {
            // Toolbar
            setSupportActionBar(toolbar)
            supportActionBar?.setDisplayHomeAsUpEnabled(true)
            supportActionBar?.title = "Settings"

            // Save button
            saveButton.setOnClickListener {
                saveSettings()
            }

            // Test connection button
            testButton.setOnClickListener {
                testConnection()
            }

            // Reset to defaults button
            resetButton.setOnClickListener {
                resetToDefaults()
            }
        }
    }

    private fun loadSettings() {
        val prefs = getSharedPreferences("latif_settings", Context.MODE_PRIVATE)

        binding.apply {
            hostInput.setText(prefs.getString("backend_host", BuildConfig.BACKEND_HOST))
            portInput.setText(prefs.getInt("backend_port", BuildConfig.BACKEND_PORT).toString())
            protocolInput.setText(prefs.getString("backend_protocol", BuildConfig.BACKEND_PROTOCOL))
            timeoutInput.setText(prefs.getInt("connection_timeout", 30000).toString())
            autoConnectSwitch.isChecked = prefs.getBoolean("auto_connect", false)
            debugLogsSwitch.isChecked = prefs.getBoolean("debug_logs", false)
        }
    }

    private fun saveSettings() {
        binding.apply {
            val host = hostInput.text.toString().trim()
            val port = portInput.text.toString().trim()
            val protocol = protocolInput.text.toString().trim()
            val timeout = timeoutInput.text.toString().trim()

            // Validation
            if (host.isEmpty() || port.isEmpty() || protocol.isEmpty()) {
                Toast.makeText(this@SettingsActivity, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return
            }

            try {
                val portNum = port.toInt()
                if (portNum !in 1..65535) {
                    Toast.makeText(this@SettingsActivity, "Port must be between 1 and 65535", Toast.LENGTH_SHORT).show()
                    return
                }

                val prefs = getSharedPreferences("latif_settings", Context.MODE_PRIVATE)
                prefs.edit().apply {
                    putString("backend_host", host)
                    putInt("backend_port", portNum)
                    putString("backend_protocol", protocol)
                    putInt("connection_timeout", timeout.toIntOrNull() ?: 30000)
                    putBoolean("auto_connect", autoConnectSwitch.isChecked)
                    putBoolean("debug_logs", debugLogsSwitch.isChecked)
                    apply()
                }

                Toast.makeText(this@SettingsActivity, "✓ Settings saved", Toast.LENGTH_SHORT).show()
                Timber.d("Settings saved: $host:$portNum")

            } catch (e: NumberFormatException) {
                Toast.makeText(this@SettingsActivity, "Invalid port number", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun testConnection() {
        binding.apply {
            val host = hostInput.text.toString().trim()
            val port = portInput.text.toString().trim()
            val protocol = protocolInput.text.toString().trim()

            if (host.isEmpty() || port.isEmpty()) {
                Toast.makeText(this@SettingsActivity, "Please enter host and port", Toast.LENGTH_SHORT).show()
                return
            }

            testButton.isEnabled = false
            testStatus.text = "Testing connection..."

            lifecycleScope.launch {
                try {
                    val url = "$protocol://$host:${port.toInt()}"
                    val connected = BackendService.checkHealthURL(this@SettingsActivity, url)

                    if (connected) {
                        testStatus.text = "✓ Connection successful!"
                        testStatus.setTextColor(getColor(android.R.color.holo_green_light))
                        Toast.makeText(this@SettingsActivity, "Connected successfully", Toast.LENGTH_SHORT).show()
                    } else {
                        testStatus.text = "✗ Connection failed"
                        testStatus.setTextColor(getColor(android.R.color.holo_red_light))
                        Toast.makeText(this@SettingsActivity, "Could not connect to backend", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    testStatus.text = "✗ Error: ${e.message}"
                    testStatus.setTextColor(getColor(android.R.color.holo_red_light))
                    Toast.makeText(this@SettingsActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    Timber.e(e, "Connection test failed")
                } finally {
                    testButton.isEnabled = true
                }
            }
        }
    }

    private fun resetToDefaults() {
        binding.apply {
            hostInput.setText(BuildConfig.BACKEND_HOST)
            portInput.setText(BuildConfig.BACKEND_PORT.toString())
            protocolInput.setText(BuildConfig.BACKEND_PROTOCOL)
            timeoutInput.setText("30000")
            autoConnectSwitch.isChecked = false
            debugLogsSwitch.isChecked = false

            Toast.makeText(this@SettingsActivity, "Reset to defaults", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressed()
        return true
    }
}

package com.latif.ni.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.latif.ni.databinding.ActivityMainBinding
import com.latif.ni.service.BackendService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * LATIF NI Main Activity
 * Entry point for the application with splash screen and server connection check
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        checkBackendConnection()
    }

    private fun setupUI() {
        binding.apply {
            appTitle.text = "LATIF NI"
            appSubtitle.text = "Enterprise AI Operating System"

            connectButton.setOnClickListener {
                checkBackendConnection()
            }

            settingsButton.setOnClickListener {
                navigateToSettings()
            }
        }
    }

    private fun checkBackendConnection() {
        lifecycleScope.launch {
            binding.apply {
                statusText.text = "Checking connection..."
                statusIndicator.setBackgroundColor(getColor(android.R.color.holo_yellow))
                connectButton.isEnabled = false
            }

            try {
                val connected = BackendService.checkHealth(this@MainActivity)

                if (connected) {
                    binding.apply {
                        statusText.text = "✓ Connected to LATIF NI Backend"
                        statusIndicator.setBackgroundColor(getColor(android.R.color.holo_green_light))
                    }

                    // Delay to show connection status
                    delay(1500)
                    navigateToDashboard()
                } else {
                    binding.apply {
                        statusText.text = "✗ Could not connect to backend"
                        statusIndicator.setBackgroundColor(getColor(android.R.color.holo_red_light))
                        connectButton.isEnabled = true
                    }

                    Toast.makeText(
                        this@MainActivity,
                        "Failed to connect. Check server is running.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                Timber.e(e, "Connection check failed")

                binding.apply {
                    statusText.text = "✗ Error: ${e.message}"
                    statusIndicator.setBackgroundColor(getColor(android.R.color.holo_red_light))
                    connectButton.isEnabled = true
                }

                Toast.makeText(
                    this@MainActivity,
                    "Connection error: ${e.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun navigateToDashboard() {
        startActivity(Intent(this, DashboardActivity::class.java))
        finish()
    }

    private fun navigateToSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }
}

# LATIF NI — Android Application

Enterprise AI Operating System Dashboard for Android devices.

## Overview

LATIF NI Android is a native Android application that provides a responsive dashboard to monitor and control your enterprise AI infrastructure from your mobile device.

**Features:**
- 📱 Responsive WebView-based dashboard
- 🎨 Dark-themed modern UI optimized for Android
- 🔄 Real-time WebSocket updates
- 📊 System metrics monitoring (CPU, RAM, GPU, temperature)
- 🤖 Agent orchestration and execution
- ⚙️ Configurable backend connection
- 🌐 LAN and localhost connectivity support
- 📵 Graceful offline handling

## Architecture

### Technology Stack

- **Language:** Kotlin 1.9+
- **API:** Android API 26+ (Android 8.0 Oreo)
- **Build System:** Gradle 8.1+
- **UI Framework:** Android AppCompat + Material Components
- **Networking:** Retrofit 2 + OkHttp 4 + WebSocket
- **Async:** Kotlin Coroutines
- **Database:** Room (optional for caching)

### Project Structure

```
android/
├── app/
│   ├── build.gradle              (App-level configuration)
│   ├── proguard-rules.pro         (ProGuard/R8 rules)
│   ├── src/
│   │   ├── main/
│   │   │   ├── kotlin/com/latif/ni/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── MainActivity.kt
│   │   │   │   │   ├── DashboardActivity.kt
│   │   │   │   │   └── SettingsActivity.kt
│   │   │   │   ├── service/
│   │   │   │   │   ├── BackendService.kt
│   │   │   │   │   └── WebSocketService.kt
│   │   │   │   └── receiver/
│   │   │   │       └── NotificationReceiver.kt
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── activity_main.xml
│   │   │   │   │   ├── activity_dashboard.xml
│   │   │   │   │   └── activity_settings.xml
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   └── styles.xml
│   │   │   │   └── drawable/
│   │   │   └── AndroidManifest.xml
│   │   ├── test/
│   │   └── androidTest/
│   └── .gitignore
├── build.gradle                  (Root-level configuration)
├── settings.gradle               (Multi-module setup)
├── local.properties              (SDK configuration)
├── gradle.properties             (Gradle configuration)
└── README.md                      (This file)
```

## Setup & Build

### Prerequisites

1. **Android Studio** (Arctic Fox or newer)
   - Download: https://developer.android.com/studio
   - Install: Follow official installation guide

2. **Android SDK**
   - API Level 34 (target)
   - API Level 26 (minimum)
   - Build Tools 34.0.0+

3. **JDK**
   - Java 11 or higher (JDK 17 recommended)

4. **Gradle**
   - Version 8.1+ (included in Android Studio)

### Step 1: Clone Repository

```bash
git clone https://github.com/LAtifword/latif-brain.git
cd latif-brain/android
```

### Step 2: Configure Android SDK

Create `local.properties` with your SDK path:

```properties
sdk.dir=/path/to/Android/sdk
ndk.dir=/path/to/Android/ndk
```

### Step 3: Configure Backend Connection

Edit `app/build.gradle` and update default values:

```gradle
buildConfigField "String", "BACKEND_HOST", '"192.168.1.100"'  // Your machine IP
buildConfigField "int", "BACKEND_PORT", '3001'
```

### Step 4: Build Application

**Using Android Studio:**
1. Open project in Android Studio
2. Click "Build" → "Make Project"
3. Wait for build to complete

**Using Gradle CLI:**

Debug APK:
```bash
./gradlew clean assembleDebug
```

Release APK:
```bash
./gradlew clean assembleRelease
```

Output APK locations:
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

## Installation

### On Physical Device

1. **Connect via USB**
   - Enable Developer Mode (tap Build Number 7 times in About)
   - Enable USB Debugging
   - Connect via USB

2. **Install via ADB**
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

   Or via Android Studio:
   - Click "Run" → "Run 'app'"

### On Emulator

1. **Create Emulator**
   - Android Studio → Device Manager
   - Create Virtual Device (Pixel 4 recommended)
   - Select API 34

2. **Install APK**
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

## Configuration

### Backend Connection Settings

Access via Settings screen in app:

**Fields:**
- **Backend Host:** IP address or hostname (default: `localhost`)
- **Backend Port:** Port number (default: `3001`)
- **Protocol:** HTTP or HTTPS (default: `http`)
- **Timeout:** Connection timeout in milliseconds (default: `30000`)

### Example Configurations

**Local Machine (Termux on same device):**
```
Host: localhost
Port: 3001
Protocol: http
```

**LAN Connection (Windows PC):**
```
Host: 192.168.1.100
Port: 3001
Protocol: http
```

**Remote with HTTPS:**
```
Host: remote.example.com
Port: 443
Protocol: https
```

### Preferences Storage

Settings are persisted in SharedPreferences:
- Location: `SharedPreferences("latif_settings", MODE_PRIVATE)`
- Keys: `backend_host`, `backend_port`, `backend_protocol`, `connection_timeout`, `auto_connect`, `debug_logs`

## Features

### Main Activity

- **Splash Screen:** Shows connection status
- **Connect Button:** Initiates backend health check
- **Settings Button:** Opens configuration screen
- **Status Indicator:** Visual feedback (green=connected, red=failed, yellow=checking)

### Dashboard Activity

- **WebView:** Hosts responsive HTML dashboard
- **Auto-updates:** Real-time metrics via WebSocket
- **Back Navigation:** Swipe back to dismiss
- **Error Handling:** Graceful failure messages

### Settings Activity

- **Backend Configuration:** Edit connection details
- **Test Connection:** Verify backend availability
- **Auto Connect:** Automatically connect on app start
- **Debug Logs:** Enable detailed logging
- **Reset to Defaults:** Restore default settings

## API Integration

### BackendService

Provides high-level API access:

```kotlin
// Check health
val isHealthy = BackendService.checkHealth(context)

// Get dashboard state
val dashboard = BackendService.getDashboard(context)

// Get system metrics
val metrics = BackendService.getMetrics(context)

// List agents
val agents = BackendService.getAgents(context)

// Execute agent task
val success = BackendService.executeAgent(context, "chat-agent", "Your task")

// Check Ollama status
val ollamaStatus = BackendService.checkOllamaStatus(context)
```

### WebSocketService

Real-time updates via WebSocket:

```kotlin
// Bind to service
val connection = ServiceConnection { componentName, binder ->
    val service = (binder as WebSocketService.LocalBinder).getService()
    
    // Set listeners
    service.setMessageListener { message ->
        // Handle WebSocket message
        println("WebSocket: $message")
    }
    
    service.setConnectionListener { connected ->
        // Handle connection status
        println("WebSocket connected: $connected")
    }
    
    // Connect
    service.connect(context)
    
    // Send message
    service.sendMessage("""{"type": "execute-agent", "agentId": "chat-agent"}""")
}

bindService(
    Intent(this, WebSocketService::class.java),
    connection,
    Context.BIND_AUTO_CREATE
)
```

## Responsive Dashboard

The embedded dashboard automatically adapts to Android screen sizes:

**Desktop Layout (wide screens):**
- Sidebar navigation on left
- Dashboard content on right

**Mobile Layout (narrow screens):**
- Full-width content
- Bottom navigation tabs
- Collapsible sidebar

**Responsive Features:**
- Flexible grid layouts
- Adaptive font sizes
- Touch-optimized buttons (48dp minimum)
- Scrollable content areas

## Logging

Application uses Timber for structured logging:

```kotlin
// Debug log
Timber.d("Message: %s", data)

// Warning
Timber.w("Warning: %s", message)

// Error
Timber.e(exception, "Error occurred")

// Info
Timber.i("Info message")
```

Debug logs appear in:
- Logcat (Android Studio)
- System logs: `adb logcat`

## Permissions

Required permissions (declared in `AndroidManifest.xml`):

- `INTERNET` — Network access
- `ACCESS_NETWORK_STATE` — Network state checking
- `ACCESS_WIFI_STATE` — WiFi state checking
- `READ_EXTERNAL_STORAGE` — File access
- `WRITE_EXTERNAL_STORAGE` — File storage
- `POST_NOTIFICATIONS` — Notifications (Android 13+)

## Proguard/R8 Configuration

Release builds use R8 for code shrinking and obfuscation:

Configuration in `app/proguard-rules.pro`:
- Keeps API model classes
- Keeps Retrofit/OkHttp classes
- Keeps Kotlin coroutines

## Testing

### Unit Tests
```bash
./gradlew test
```

### Instrumented Tests (on device/emulator)
```bash
./gradlew connectedAndroidTest
```

### Manual Testing Checklist

- [ ] App launches without crashes
- [ ] Connect button works
- [ ] Backend connection successful
- [ ] Dashboard loads and displays
- [ ] Settings accessible
- [ ] Backend URL configuration works
- [ ] Test connection button verifies endpoint
- [ ] WebSocket receives updates
- [ ] Agents display with correct status
- [ ] Metrics charts render smoothly
- [ ] Navigation between screens works
- [ ] App handles offline gracefully
- [ ] Orientation changes work smoothly

## Troubleshooting

### App Won't Install
```bash
# Check device storage
adb shell df -h /data

# Uninstall old version
adb uninstall com.latif.ni

# Reinstall
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Backend Connection Fails
1. Verify backend is running: `curl http://[HOST]:[PORT]/api/health`
2. Check firewall allows port 3001
3. Verify network connectivity
4. Try different protocol (http vs https)
5. Check backend logs for errors

### WebView Doesn't Load Dashboard
1. Verify JavaScript is enabled (should be by default)
2. Check backend URL in settings
3. Monitor logcat: `adb logcat | grep WebView`
4. Verify HTML dashboard is accessible via browser

### Crashes on Startup
1. Check logcat for stack traces: `adb logcat`
2. Verify Android API level (minimum 26)
3. Ensure all permissions granted
4. Clear app cache: `adb shell pm clear com.latif.ni`

## Performance Tips

1. **Network:**
   - Use localhost if backend on same device
   - Minimize WebSocket message frequency
   - Enable request compression

2. **UI:**
   - Reduce metric update frequency (2s default)
   - Disable animations if slow
   - Close unused tabs/windows

3. **Memory:**
   - Monitor logcat for memory leaks
   - Clear app cache periodically
   - Use smaller dashboard updates

## Building for Release

```bash
# Create keystore (one-time)
keytool -genkey -v -keystore release.keystore \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias latif-ni

# Build signed APK
./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file=release.keystore \
    -Pandroid.injected.signing.store.password=PASSWORD \
    -Pandroid.injected.signing.key.alias=latif-ni \
    -Pandroid.injected.signing.key.password=PASSWORD

# Output: app/build/outputs/apk/release/app-release-signed.apk
```

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test on device/emulator
5. Submit pull request

## License

MIT - See LICENSE file

## Support

- **Issues:** https://github.com/LAtifword/latif-brain/issues
- **Documentation:** See parent README.md
- **Backend Setup:** See ENTERPRISE_INFRASTRUCTURE.md

---

**Status: Ready for Development & Testing** 🚀

Android application fully integrated with LATIF NI enterprise infrastructure.

Last Updated: July 17, 2026

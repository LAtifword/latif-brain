# LATIF NI Android — Complete Build & Deployment Guide

Build and deploy the LATIF NI mobile application for Android devices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Building APK](#building-apk)
5. [Installation Methods](#installation-methods)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **OS:** Windows, macOS, or Linux
- **RAM:** Minimum 8 GB (16 GB recommended)
- **Disk Space:** 50 GB for Android SDK and build artifacts
- **Network:** Internet connection for downloading SDK components

### Software Requirements

#### 1. Java Development Kit (JDK)

**Minimum:** Java 11  
**Recommended:** Java 17 LTS

**Installation:**

Windows:
```powershell
# Using Chocolatey
choco install openjdk17

# Or download from https://adoptium.net/
```

macOS:
```bash
# Using Homebrew
brew install openjdk@17

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Linux:
```bash
sudo apt-get install openjdk-17-jdk
```

Verify:
```bash
java -version
```

#### 2. Android Studio

Download from: https://developer.android.com/studio

**Installation Steps:**
1. Download Android Studio for your OS
2. Run installer and follow setup wizard
3. Choose "Custom" setup
4. Select API Level 34 (target)
5. Select API Level 26 (minimum - Android 8.0)
6. Select Android SDK Build Tools 34.0.0
7. Select Android Emulator (optional)
8. Complete installation

**First Launch:**
- Accept licenses
- Download SDK components
- Wait for indexing to complete

#### 3. Git

Download from: https://git-scm.com/

Verify:
```bash
git --version
```

### Android SDK Requirements

Minimum components:
- **SDK Platform:** API 34
- **SDK Tools:** Latest
- **Build Tools:** 34.0.0+
- **Android Emulator** (optional)
- **Kotlin Plugin:** 1.9.0+

### Device Requirements (for testing)

- **Minimum Android:** 8.0 (API 26)
- **Recommended:** 10+ (API 29+)
- **RAM:** 2 GB minimum
- **Storage:** 200 MB free space
- **USB Debugging:** Enabled

---

## Quick Start

### 1-Minute Setup (assuming prerequisites installed)

```bash
# Clone repository
git clone https://github.com/LAtifword/latif-brain.git
cd latif-brain/android

# Create local.properties with your SDK path
echo "sdk.dir=$ANDROID_HOME" > local.properties

# Build debug APK
./gradlew clean assembleDebug

# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Install on Device

```bash
# Connect device via USB
adb devices

# Install APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Launch app
adb shell am start -n com.latif.ni/.ui.MainActivity
```

---

## Detailed Setup

### Step 1: Install Java JDK

**Verify Java is working:**

```bash
java -version
javac -version
```

Expected output:
```
openjdk version "17.0.x" ...
javac 17.0.x
```

### Step 2: Install Android Studio

1. **Download** from https://developer.android.com/studio
2. **Run installer** and complete setup wizard
3. **Launch Android Studio**
4. **Accept licenses:**
   - Go to Tools → SDK Manager
   - Accept all license agreements
5. **Install components:**
   - API 34 SDK
   - Build Tools 34.0.0
   - Android Emulator (optional)
   - Kotlin plugin

### Step 3: Clone Repository

```bash
# Clone
git clone https://github.com/LAtifword/latif-brain.git

# Navigate to Android project
cd latif-brain/android
```

### Step 4: Configure Android SDK Path

**Option A: Automatic (recommended)**

```bash
# On macOS/Linux
export ANDROID_HOME=$HOME/Android/Sdk
echo "sdk.dir=$ANDROID_HOME" > local.properties

# On Windows (PowerShell)
$env:ANDROID_HOME = "$env:USERPROFILE\AppData\Local\Android\Sdk"
"sdk.dir=$env:ANDROID_HOME" | Out-File local.properties
```

**Option B: Manual**

Create `local.properties`:

Windows:
```
sdk.dir=C:\Users\YourName\AppData\Local\Android\Sdk
ndk.dir=C:\Users\YourName\AppData\Local\Android\Ndk
```

macOS/Linux:
```
sdk.dir=/home/username/Android/Sdk
ndk.dir=/home/username/Android/Ndk
```

### Step 5: Configure Backend Connection

Edit `android/app/build.gradle`:

```gradle
buildConfigField "String", "BACKEND_HOST", '"192.168.1.100"'  // Your PC IP
buildConfigField "int", "BACKEND_PORT", '3001'
buildConfigField "String", "BACKEND_PROTOCOL", '"http"'
```

### Step 6: Verify Setup

```bash
# Test Gradle wrapper
./gradlew --version

# Check dependencies
./gradlew dependencies

# Verify configuration
./gradlew tasks
```

---

## Building APK

### Debug Build (Development)

```bash
# Clean and build
./gradlew clean assembleDebug

# Output: app/build/outputs/apk/debug/app-debug.apk
# Size: ~10-15 MB
# Signing: Automatic (debug key)
# Time: 2-5 minutes
```

### Release Build (Production)

**Step 1: Create keystore (one-time)**

```bash
keytool -genkey -v -keystore release.keystore \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -alias latif-ni \
    -storepass YourStorePassword \
    -keypass YourKeyPassword
```

**Step 2: Build signed APK**

```bash
./gradlew clean assembleRelease \
    -Pandroid.injected.signing.store.file=release.keystore \
    -Pandroid.injected.signing.store.password=YourStorePassword \
    -Pandroid.injected.signing.key.alias=latif-ni \
    -Pandroid.injected.signing.key.password=YourKeyPassword
```

**Output:**
```
app/build/outputs/apk/release/app-release-signed.apk
Size: ~8-12 MB
Signing: Production keystore
```

### Build Variants

```bash
# Debug APK
./gradlew assembleDebug

# Release APK (unsigned)
./gradlew assembleRelease

# Both flavors
./gradlew assemble

# Bundle for Google Play (AAB format)
./gradlew bundleRelease
```

### Build Optimization Flags

```bash
# Enable code shrinking (reduces size by 30-40%)
minifyEnabled = true

# Enable resource shrinking
shrinkResources = true

# Enable optimization
optimization = true

# Example:
./gradlew clean assembleRelease \
    -Dorg.gradle.workers.max=8 \
    -Dorg.gradle.parallel=true
```

### Monitor Build Progress

```bash
# Verbose output
./gradlew assembleDebug --stacktrace

# Show dependency download progress
./gradlew assembleDebug --console=verbose

# Build with specific module
./gradlew :app:assembleDebug
```

---

## Installation Methods

### Method 1: Android Studio (Easiest)

1. Open project in Android Studio
2. Connect device via USB or start emulator
3. Click "Run" → "Run 'app'" (or press Shift+F10)
4. Select target device
5. Wait for installation and launch

### Method 2: ADB Command Line

**Prerequisites:** USB Debugging enabled on device

```bash
# List connected devices
adb devices

# Install APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Reinstall (uninstall first)
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch app
adb shell am start -n com.latif.ni/.ui.MainActivity

# View logs
adb logcat | grep "latif"

# Uninstall
adb uninstall com.latif.ni
```

### Method 3: Using Emulator

**Create Emulator (Android Studio):**
1. Tools → Device Manager
2. Create Virtual Device
3. Select Pixel 4 (recommended)
4. Select API 34
5. Click "Create"

**Run app:**
```bash
# Start emulator
emulator -avd Pixel_4_API_34

# Install APK
./gradlew installDebug

# Launch
adb shell am start -n com.latif.ni/.ui.MainActivity
```

### Method 4: Direct File Installation

1. Copy APK to device storage via USB
2. Open file manager on device
3. Navigate to APK file
4. Tap to install
5. Grant permissions
6. Launch app

### Method 5: Google Play Store (Distribution)

**Preparation:**
1. Create Google Play account
2. Create application listing
3. Build and sign release APK
4. Upload to Play Console
5. Configure release notes
6. Submit for review

```bash
# Build for Play Store (AAB format)
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

---

## Configuration

### Backend Connection

**In-App Settings:**
1. Launch app
2. Tap "Settings" button
3. Configure:
   - Backend Host (IP or hostname)
   - Backend Port (default: 3001)
   - Protocol (http/https)
   - Connection Timeout

**Programmatic (SharedPreferences):**
```kotlin
val prefs = context.getSharedPreferences("latif_settings", Context.MODE_PRIVATE)
prefs.edit().apply {
    putString("backend_host", "192.168.1.100")
    putInt("backend_port", 3001)
    putString("backend_protocol", "http")
    apply()
}
```

### Build Configuration

Edit `android/app/build.gradle`:

```gradle
buildConfigField "String", "BACKEND_HOST", '"192.168.1.100"'
buildConfigField "int", "BACKEND_PORT", '3001'
buildConfigField "String", "BACKEND_PROTOCOL", '"http"'

// Target different backends based on build variant
flavorDimensions "backend"

productFlavors {
    localhost {
        dimension "backend"
        buildConfigField "String", "BACKEND_HOST", '"127.0.0.1"'
    }
    
    network {
        dimension "backend"
        buildConfigField "String", "BACKEND_HOST", '"192.168.1.100"'
    }
}

// Build specific flavor:
// ./gradlew assembleLocalhostDebug
// ./gradlew assembleNetworkDebug
```

### Logging Configuration

Enable debug logging:

```kotlin
if (BuildConfig.DEBUG) {
    Timber.plant(Timber.DebugTree())
} else {
    Timber.plant(ReleaseTree())  // Custom release tree
}
```

### Resource Customization

Colors: `android/app/src/main/res/values/colors.xml`
```xml
<color name="primary">#8b5cf6</color>  <!-- LATIF purple -->
<color name="secondary">#06b6d4</color>  <!-- Cyan accent -->
```

Strings: `android/app/src/main/res/values/strings.xml`
```xml
<string name="app_name">LATIF NI</string>
<string name="backend_default_host">localhost</string>
```

---

## Troubleshooting

### Build Issues

**Error: "SDK location not found"**

Solution:
```bash
# Create local.properties
echo "sdk.dir=$ANDROID_HOME" > local.properties

# Or set ANDROID_HOME environment variable
export ANDROID_HOME=/path/to/Android/Sdk
```

**Error: "Unable to resolve dependency"**

Solution:
```bash
# Clean Gradle cache
./gradlew clean

# Update dependencies
./gradlew build --refresh-dependencies

# Check internet connection
```

**Error: "Gradle wrapper failed"**

Solution:
```bash
# Delete cached wrapper
rm -rf .gradle gradle/wrapper

# Regenerate wrapper
gradle wrapper --gradle-version 8.1

# Rebuild
./gradlew clean build
```

### Installation Issues

**Error: "adb not found"**

Solution:
```bash
# Add Android SDK platform-tools to PATH
export PATH="$ANDROID_HOME/platform-tools:$PATH"

# Verify
adb version
```

**Error: "Device not authorized"**

Solution:
1. Disconnect device
2. On device: Revoke USB Debugging authorization (Settings → Developer Options)
3. Reconnect device
4. Authorize connection popup
5. Retry: `adb devices`

**Error: "Unknown failure: [INSTALL_FAILED_INVALID_APK]"**

Solution:
```bash
# Rebuild APK
./gradlew clean assembleDebug

# Check APK signature
jarsigner -verify app/build/outputs/apk/debug/app-debug.apk

# Uninstall old version
adb uninstall com.latif.ni

# Reinstall
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Connection Issues

**Backend not connecting**

Debug steps:
```bash
# Verify backend running
curl http://192.168.1.100:3001/api/health

# Check firewall (Windows)
netstat -ano | findstr :3001

# Test from device
adb shell
curl http://192.168.1.100:3001/api/health
exit

# Monitor logs
adb logcat | grep "latif"
```

**WebSocket connection fails**

Solution:
1. Check backend WebSocket listening: `netstat -an | grep 3001`
2. Verify protocol (ws vs wss)
3. Check firewall rules
4. Verify backend logs
5. Try different protocol in settings

### Performance Issues

**App crashes on startup**

Solution:
```bash
# Check logcat
adb logcat | grep "FATAL"

# Check device memory
adb shell "cat /proc/meminfo | head -1"

# Increase heap size in manifest (if needed)
android:largeHeap="true"
```

**Dashboard loads slowly**

Solution:
1. Reduce metric update frequency (settings)
2. Disable animations
3. Use localhost instead of LAN IP
4. Monitor CPU/memory in Settings
5. Clear app cache: `adb shell pm clear com.latif.ni`

**WebView renders incorrectly**

Solution:
1. Clear WebView cache: `adb shell pm clear com.latif.ni`
2. Verify HTML dashboard loads in Chrome
3. Check JavaScript console for errors (F12)
4. Update Chrome on device
5. Test in emulator

### Testing Issues

**Emulator won't start**

Solution:
```bash
# List emulators
emulator -list-avds

# Start with more RAM
emulator -avd Pixel_4_API_34 -memory 2048

# Use snapshots to speed up
emulator -avd Pixel_4_API_34 -snapshot my-snapshot
```

**Tests fail on device**

Solution:
```bash
# Run instrumentation tests
./gradlew connectedAndroidTest

# Run specific test
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.latif.ni.ui.MainActivityTest

# Check device compatibility
adb shell getprop ro.build.version.release
```

---

## Deployment Checklist

- [ ] Java JDK 11+ installed
- [ ] Android Studio latest version
- [ ] Android SDK API 34 installed
- [ ] Build Tools 34.0.0+ installed
- [ ] local.properties configured
- [ ] Backend host/port configured
- [ ] Device connected with USB Debugging enabled
- [ ] APK builds without errors
- [ ] APK installs successfully
- [ ] App launches without crashes
- [ ] Settings screen accessible
- [ ] Backend connection working
- [ ] Dashboard loads and displays
- [ ] WebSocket updates received
- [ ] Agent controls responsive
- [ ] Metrics charts render smoothly
- [ ] App handles offline gracefully

---

## Next Steps

1. **Development:** Make code changes and test via `./gradlew installDebug`
2. **Testing:** Run tests with `./gradlew connectedAndroidTest`
3. **Release:** Build production APK with `./gradlew assembleRelease`
4. **Distribution:** Upload to Google Play Store

---

**Status: Ready for Build & Deployment** 🚀

Last Updated: July 17, 2026

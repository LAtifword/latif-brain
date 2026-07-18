# LATIF v5 Installation Guide for Android/Termux

Complete guide for running LATIF v5 on Android devices using Termux.

## Overview

LATIF v5 runs on Android via **Termux**, a terminal emulator that provides a Linux-like environment. This guide walks through:

1. Installing Termux
2. Setting up Node.js
3. Installing LATIF v5
4. Running as background service
5. Accessing from other apps

**Estimated Time**: 20-30 minutes  
**Storage Required**: 500MB-1GB (Node.js + LATIF + node_modules)  
**RAM Recommended**: 2GB minimum, 4GB+ preferred

---

## Step 1: Install Termux

### Option A: Play Store (Recommended)
1. Open Google Play Store on your Android device
2. Search for "Termux"
3. Install the official app by "Fredrik Fornwall"

### Option B: F-Droid (Alternative)
1. Install F-Droid app store (https://f-droid.org)
2. Search for "Termux"
3. Install the official app

### Option C: Direct APK
1. Download from: https://github.com/termux/termux-app/releases
2. Install the .apk file

**After Installation**:
- Open Termux
- Let it initialize (first startup downloads base files)
- You should see a prompt: `$`

---

## Step 2: Update and Install Dependencies

```bash
# Update package lists
pkg update

# Upgrade installed packages
pkg upgrade
```

Answer "y" to any prompts to confirm installation.

---

## Step 3: Install Node.js

```bash
# Install Node.js and npm
pkg install nodejs npm

# Verify installation
node --version
npm --version
```

You should see version numbers (e.g., `v18.x.x`).

---

## Step 4: Extract and Install LATIF v5

### 4a: Transfer the ZIP file to your device

**Option 1: Via computer**
1. Connect Android device to computer via USB
2. Copy `latif-v5.0.0.zip` to device storage
3. In Termux, locate the file:
```bash
# List files in storage
ls ~/storage/downloads/
```

**Option 2: Via cloud storage**
1. Upload zip file to Google Drive/Dropbox
2. Download to device
3. Move to accessible location

### 4b: Extract the ZIP file

```bash
# Create directory for LATIF
mkdir -p ~/latif-v5
cd ~/latif-v5

# Extract zip (adjust path if needed)
unzip ~/storage/downloads/latif-v5.0.0.zip
# Or if in Downloads:
unzip ~/storage/downloads/latif-v5.0.0.zip -d .

# List extracted files
ls -la
```

You should see: `src/`, `config/`, `docs/`, `package.json`, etc.

### 4c: Install Node dependencies

```bash
# Install npm packages
npm install
```

**This takes 3-5 minutes.** Do not interrupt.

```
npm notice
npm notice New minor version of npm available!
npm notice ...
```

You can ignore these notices. Installation is complete when you see:
```
added XXX packages in XXm
```

---

## Step 5: Configure for Termux

Create a `.env` file optimized for Termux/Android:

```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
APP_DEBUG=true
APP_PORT=3000
DB_PATH=~/latif-v5/latif.db
LOG_LEVEL=info
LOG_DIR=~/latif-v5/logs
EOF
```

---

## Step 6: Test LATIF v5

```bash
# Start the server
npm run dev
```

**Expected output**:
```
[INFO] Logger initialized
[INFO] Configuration loaded
[INFO] Database initialized
[INFO] Job queue initialized
[INFO] API server started at 0.0.0.0:3000
```

**Test it's working**:
1. Open second Termux window (swipe from left edge, or use Menu → New Session)
2. Test the API:
```bash
curl http://localhost:3000/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 12.34,
  "version": "5.0.0"
}
```

If you see the JSON response, LATIF v5 is working! ✅

---

## Step 7: Access from Other Android Apps

LATIF v5 runs on `localhost:3000` within Termux. To access from other apps:

### Option A: Same-Device Access

**From browser on Android**:
1. Open browser (Chrome, Firefox, etc.)
2. Go to: `http://localhost:3000`
3. You should see API documentation

**From other Termux sessions**:
```bash
curl http://localhost:3000/api
```

### Option B: From Wi-Fi Network

1. Find your device's IP address:
```bash
ifconfig
# Look for inet address under wlan0 (e.g., 192.168.1.100)
```

2. Modify configuration to allow external access:
```bash
# Edit config
cat > config/development.json << 'EOF'
{
  "app": {
    "port": 3000,
    "host": "0.0.0.0"
  }
}
EOF
```

3. Restart LATIF and access from another device on same Wi-Fi:
```
http://192.168.1.100:3000
```

⚠️ **Warning**: Only do this on trusted networks. LATIF v5 has no authentication in development mode.

---

## Step 8: Run as Background Service (Optional)

### Using `nohup` (simple)

```bash
# In Termux window 1
nohup npm run dev > latif.log 2>&1 &
# Note the PID printed

# Server runs in background
# Check logs:
tail -f latif.log
```

### Using `tmux` (advanced)

```bash
# Install tmux
pkg install tmux

# Create session
tmux new-session -d -s latif npm\ run\ dev

# Check session
tmux ls

# View output
tmux capture-pane -s latif -p

# Kill session
tmux kill-session -t latif
```

### Using `screen` (alternative)

```bash
# Install screen
pkg install screen

# Start screen session
screen -S latif npm run dev

# Detach: Press Ctrl+A then D
# Reattach: screen -r latif
# List: screen -ls
```

---

## Step 9: Keep Termux Running

To keep LATIF running when screen is off:

### Option A: Disable sleep timeout (Best)
1. Open Settings app
2. Battery → Battery Optimization
3. Find Termux, set to "Don't optimize"
4. Also disable background restrictions for Termux

### Option B: Use Termux API service
```bash
# Install Termux API
pkg install termux-api

# Request screen wake lock
termux-wake-lock

# Release:
termux-wake-lock release
```

### Option C: Use phone while LATIF runs
- Keep screen on while LATIF is needed
- Or use keyboard to wake screen periodically

---

## Troubleshooting

### "Command not found: npm"
**Solution**: Node.js not installed or PATH not updated
```bash
pkg install nodejs npm
# Log out and back in:
exit
# Then reopen Termux
```

### "EACCES: Permission denied"
**Solution**: SQLite database file permissions
```bash
cd ~/latif-v5
chmod 755 .
chmod 644 latif.db 2>/dev/null || true
npm run dev
```

### "ENOSPC: No space left on device"
**Solution**: Insufficient storage
```bash
# Check available space
df -h

# Clean npm cache
npm cache clean --force

# Remove node_modules and reinstall (fresh)
rm -rf node_modules package-lock.json
npm install
```

### "Module not found: sqlite3"
**Solution**: Native module didn't compile
```bash
# Install build tools
pkg install clang make python

# Rebuild
npm rebuild sqlite3

# If still fails, clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Port 3000 already in use"
**Solution**: Another process using port
```bash
# Find process using port 3000
lsof -i :3000
# Or try different port:
APP_PORT=3001 npm run dev
```

### "Database locked"
**Solution**: Another LATIF instance is running
```bash
# Kill other processes
pkill -f "npm run dev"
# Or restart Termux
exit
# Reopen and restart
```

### Server starts but no API response
**Solution**: Firewall or binding issue
```bash
# Check if server is listening
netstat -tuln | grep 3000

# Test locally
curl http://localhost:3000/health

# If still no response, check logs
tail -50 logs/*.log
```

---

## Common Tasks

### Stop LATIF
```bash
# If in foreground: Press Ctrl+C

# If in background:
pkill -f "npm run dev"

# If using tmux:
tmux kill-session -t latif

# If using screen:
screen -r latif
# Then Ctrl+C
```

### View logs
```bash
# Real-time logs
tail -f logs/latif-*.log

# Last 100 lines
tail -100 logs/latif-*.log

# Specific error
grep ERROR logs/latif-*.log
```

### Update LATIF
```bash
cd ~/latif-v5

# Download new version
# Extract new zip
# Copy over src/ and config/

# Reinstall dependencies
npm install

# Restart
npm run dev
```

### Backup database and configuration
```bash
cd ~/latif-v5

# Create backup directory
mkdir -p backups

# Backup database
cp latif.db backups/latif-$(date +%Y%m%d).db

# Backup config
cp config/*.json backups/

# Backup logs
cp logs/* backups/
```

---

## Performance Tips

### 1. Reduce Log Level (save disk I/O)
```bash
# In .env
LOG_LEVEL=warn
```

### 2. Optimize Database
```bash
# In Termux (when LATIF not running)
sqlite3 latif.db "VACUUM; ANALYZE;"
```

### 3. Monitor Resource Usage
```bash
# In Termux (watch in real-time)
top
# Press 'q' to quit
```

### 4. Limit Job Queue Concurrency
```bash
# In config/development.json
"jobs": {
  "concurrency": 1
}
```

### 5. Use storage efficiently
```bash
# Delete old logs (keep last 3 days)
find logs/ -mtime +3 -delete

# Clean temp files
rm -rf temp/*

# Don't upload huge files
# (max: 100MB in development mode)
```

---

## Advanced: Access LATIF from PC/Laptop

### Using Android USB Reverse Port Forward

```bash
# On computer (with Android device connected via USB)
adb reverse tcp:3000 tcp:3000

# Now access from PC:
http://localhost:3000
```

### Using SSH through Termux

```bash
# In Termux
pkg install openssh

# Start SSH server
sshd

# Find your IP
ifconfig | grep "inet "

# From PC
ssh 192.168.1.100 -p 8022
# Then: npm run dev
```

### Using ngrok (expose to internet)

⚠️ **Caution**: Only for trusted scenarios

```bash
# Install ngrok binary
pkg install wget
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
tar xzf ngrok-v3-stable-linux-arm.tgz

# In Termux window 2
./ngrok http 3000

# You get public URL: https://xxxxx.ngrok.io
# Share this URL (valid for 2 hours free)
```

---

## FAQs

**Q: Will LATIF drain my battery?**
A: Yes, CPU usage will drain battery faster. Recommendations:
- Use while charging
- Disable unnecessary features
- Set screen timeout to 1 minute

**Q: How much storage does LATIF need?**
A: Approximately:
- Node.js: 100MB
- node_modules: 300-400MB
- LATIF source: 50MB
- Database: 10MB (grows with use)
- **Total: ~500MB minimum**

**Q: Can I run LATIF 24/7 on Android?**
A: Not recommended. Android OS will:
- Kill background processes
- Free up memory
- Throttle CPU

For continuous operation, use a Raspberry Pi or Linux server instead.

**Q: Is LATIF secure on Android?**
A: Moderate security:
- ✅ All data stays on device
- ✅ No cloud connections
- ❌ No authentication by default
- ❌ No HTTPS (local only)

For sensitive data, add authentication in production config.

**Q: Can I use LATIF with Ollama on Android?**
A: Yes, but requires:
1. Ollama installed and running
2. Correctly configured endpoint
3. Significant RAM (Ollama models are large)

See config for AI model settings.

**Q: Multiple LATIF instances?**
A: Yes, run on different ports:
```bash
# Instance 1
APP_PORT=3000 npm run dev

# Instance 2 (different Termux session)
APP_PORT=3001 npm run dev
```

---

## Getting Help

1. **Check logs**: `tail -50 logs/latif-*.log`
2. **Read documentation**: See docs/ directory
3. **GitHub Issues**: https://github.com/LAtifword/latif-brain/issues
4. **Review code comments**: Look in src/ for details

---

## Next Steps After Installation

1. ✅ LATIF v5 is running
2. Explore the API: `curl http://localhost:3000/api`
3. Read Phase 1 documentation: Open `PHASE1_FOUNDATION.md`
4. Experiment with job queues
5. Plan Phase 2 features

---

## Uninstall

To completely remove LATIF from your device:

```bash
# In Termux
cd ~
rm -rf latif-v5

# Uninstall Termux
# Settings → Apps → Termux → Uninstall
```

All data will be deleted. No traces remain.

---

**Version**: LATIF v5.0.0  
**Platform**: Android via Termux  
**Status**: Production Foundation (Phase 1)  
**Last Updated**: 2024

Happy coding! 🚀

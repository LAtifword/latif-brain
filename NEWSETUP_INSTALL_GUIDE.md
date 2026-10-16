# LATIF v5.0.0 - NEWSETUP Installation Guide

**For Android/Termux with /storage/emulated/0/NEWSETUP directory**

---

## 📱 Your Setup

Your LATIF files are located at:
```
/storage/emulated/0/NEWSETUP
├── src/                    (53 source files)
├── config/                 (Configuration)
├── package.json           (Dependencies)
└── ...other files
```

**Status**: 33 folders, 116 files, 1.20 MB (ready to deploy)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Open Termux

Open your Termux app on Android

### Step 2: Copy Installation Scripts

```bash
# Download the optimized scripts to your device
# These scripts work with /storage/emulated/0/NEWSETUP path

# Option A: If you have curl
curl -o ~/setup-termux-NEWSETUP.sh https://your-server/setup-termux-NEWSETUP.sh
curl -o ~/start-latif-NEWSETUP.sh https://your-server/start-latif-NEWSETUP.sh
curl -o ~/configure-ollama-NEWSETUP.sh https://your-server/configure-ollama-NEWSETUP.sh

# Option B: Copy manually from this project
# Get these files from the latif-brain project:
# - setup-termux-NEWSETUP.sh
# - start-latif-NEWSETUP.sh
# - configure-ollama-NEWSETUP.sh
```

### Step 3: Run Setup Script

```bash
# Make scripts executable
chmod +x ~/setup-termux-NEWSETUP.sh
chmod +x ~/start-latif-NEWSETUP.sh
chmod +x ~/configure-ollama-NEWSETUP.sh

# Run setup (this installs everything)
bash ~/setup-termux-NEWSETUP.sh

# Expected output:
# ✓ Found NEWSETUP on Android storage
# ✓ Node.js installed
# ✓ npm dependencies installed
# ✓ Runtime directories created
# Setup Complete!
```

### Step 4: Configure Ollama (Optional)

```bash
bash ~/configure-ollama-NEWSETUP.sh

# Enter when prompted:
# - Ollama host: localhost (or your desktop IP like 192.168.1.100)
# - Port: 11434
# - Model: qwen2.5:1.5b
```

### Step 5: Start LATIF

```bash
bash ~/start-latif-NEWSETUP.sh

# You should see:
# ✓ LATIF started (PID: 1234)
# ✓ Server is healthy
# LATIF Running Successfully!
# API Server: http://localhost:3000
```

### Step 6: Test

Open another Termux session or use curl:

```bash
curl http://localhost:3000/api/health

# Response:
# {"status":"ok","version":"5.0.0",...}
```

---

## 📂 How It Works

### File Locations

```
Your Android Device:
/storage/emulated/0/NEWSETUP/          ← Your unzipped files
  ├── src/                             ← Source code
  ├── config/                          ← Configuration
  ├── package.json                     ← npm packages
  └── node_modules/                    ← Installed packages (after npm install)

Your Termux Home:
$HOME/latif-v5 → symlink to NEWSETUP   ← For easy access
$HOME/.latif/                          ← Runtime data
  ├── data/                            ← Database files
  ├── logs/                            ← Log files
  ├── cache/                           ← Cache storage
  └── backups/                         ← Backup files
```

### What Each Script Does

**setup-termux-NEWSETUP.sh**
- Detects NEWSETUP directory at `/storage/emulated/0/NEWSETUP`
- Creates symlink at `~/latif-v5` for easy access
- Installs Node.js and npm
- Installs all npm dependencies
- Creates runtime directories
- Generates configuration file

**start-latif-NEWSETUP.sh**
- Finds NEWSETUP directory automatically
- Checks Node.js installation
- Starts LATIF server on port 3000
- Performs health check
- Shows logs and status

**configure-ollama-NEWSETUP.sh**
- Tests Ollama connection
- Updates configuration with Ollama settings
- Creates .env file
- Shows available models

---

## 🔌 Ollama Configuration for Android

### Option 1: Ollama on Desktop (Recommended)

If Ollama is running on your desktop computer:

```bash
# On your desktop, find your IP:
# Windows: ipconfig (look for IPv4 Address, e.g., 192.168.1.100)
# Mac/Linux: ifconfig (look for inet, e.g., 192.168.1.100)

# In Termux, run configure script:
bash ~/configure-ollama-NEWSETUP.sh

# When prompted for host, enter your desktop IP:
# Ollama host: 192.168.1.100
# Port: 11434
```

### Option 2: Ollama on Android (Local)

```bash
bash ~/configure-ollama-NEWSETUP.sh

# When prompted:
# Ollama host: localhost
# Port: 11434
```

### Option 3: No Ollama (Offline Mode)

If you don't have Ollama, LATIF can still run in limited mode:

```bash
bash ~/start-latif-NEWSETUP.sh

# You'll see warnings but API will be available
# Limited functionality without LLM backend
```

---

## 🛠️ Troubleshooting

### Issue: "NEWSETUP directory not found"

**Solution**: Make sure you extracted the zip file to `/storage/emulated/0/NEWSETUP`

```bash
# Check if it exists:
ls -la /storage/emulated/0/NEWSETUP/

# If not there, extract it:
cd /storage/emulated/0
unzip /path/to/latif-v5.0.0-complete.zip
# This creates NEWSETUP folder
```

### Issue: "Command not found: node"

**Solution**: Setup script didn't complete. Run it again:

```bash
bash ~/setup-termux-NEWSETUP.sh
```

### Issue: "Port 3000 already in use"

**Solution**: Kill existing process or use different port:

```bash
# Kill existing LATIF
pkill -f "node src/main.js"

# Or use different port:
LATIF_PORT=3001 bash ~/start-latif-NEWSETUP.sh
```

### Issue: "Cannot connect to Ollama"

**Solution**: Check your desktop IP and Ollama is running

```bash
# On Android, check network:
ifconfig

# Test Ollama connection:
curl http://192.168.1.100:11434/api/tags
# Replace 192.168.1.100 with your desktop IP

# If it fails:
# 1. Make sure Ollama is running on desktop
# 2. Check IP address is correct
# 3. Both devices must be on same WiFi network
```

### Issue: "Out of memory"

**Solution**: Use smaller model

```bash
# Edit config/android.json
nano config/android.json

# Change model line:
"model": "tinyllama:latest"

# Then restart:
bash ~/start-latif-NEWSETUP.sh
```

### Issue: "npm ERR! code EACCES"

**Solution**: Permission issue with node_modules

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Verification Checklist

After installation, verify:

```bash
# 1. Check Node.js
node --version
# Should show v18+

# 2. Check npm
npm --version
# Should show 9.0+

# 3. Check NEWSETUP files
ls -la /storage/emulated/0/NEWSETUP/src/
# Should list directories: ai, api, core, monitoring, utils, etc.

# 4. Check symlink
ls -la ~/latif-v5
# Should point to /storage/emulated/0/NEWSETUP

# 5. Check runtime directories
ls -la ~/.latif/
# Should show: data, logs, cache, backups, models

# 6. Check configuration
cat /storage/emulated/0/NEWSETUP/config/android.json
# Should show valid JSON with llm settings

# 7. Start and test
bash ~/start-latif-NEWSETUP.sh &
sleep 3
curl http://localhost:3000/api/health
# Should return: {"status":"ok",...}
```

---

## 🚀 Next Steps After Setup

### 1. Access LATIF API

```bash
# Health check
curl http://localhost:3000/api/health

# Get stats
curl http://localhost:3000/api/stats

# List agents
curl http://localhost:3000/api/agents
```

### 2. Try Example Queries

```bash
# Simple chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello LATIF"}]
  }'
```

### 3. Read Documentation

Inside NEWSETUP folder, read:
- `QUICK_START.md` - 5-minute overview
- `README_REORGANIZATION.md` - System overview
- `IMPLEMENTATION_ORDER.md` - Detailed guide

### 4. Keep LATIF Running

For production use, keep running in background:

```bash
# Start in background
nohup bash ~/start-latif-NEWSETUP.sh > ~/.latif/logs/latif.log 2>&1 &

# Check logs
tail -f ~/.latif/logs/latif.log

# Stop when needed
pkill -f "node src/main.js"
```

---

## 💡 Tips for Android/Termux

### Storage Location
- NEWSETUP is on Android internal storage: `/storage/emulated/0/NEWSETUP`
- Symlink in Termux home for convenience: `~/latif-v5`
- Use either path - they point to same files

### Network Access
- If Ollama on desktop: Both devices must be on same WiFi
- Check IP with: `ifconfig` (in Termux) or `ipconfig` (on desktop)
- Firewall must allow port 11434

### Performance
- Default model: `qwen2.5:1.5b` (good for mobile)
- Smaller models available: `tinyllama:latest`, `neural-chat:latest`
- Max 2 concurrent requests (configurable)

### Background Execution
- Use `nohup` to run in background
- Check status with `curl http://localhost:3000/api/health`
- Logs stored in `~/.latif/logs/latif.log`

---

## 📝 File Paths Reference

### Key Paths for Scripting

```bash
# NEWSETUP location (Android storage)
NEWSETUP="/storage/emulated/0/NEWSETUP"

# Termux symlink
LATIF_HOME="$HOME/latif-v5"

# Runtime data
LATIF_DATA="$HOME/.latif"
LATIF_LOGS="$HOME/.latif/logs"
LATIF_DB="$HOME/.latif/data"

# Configuration
CONFIG="$NEWSETUP/config/android.json"

# Source code
SRC="$NEWSETUP/src"
MAIN="$SRC/main.js"
```

---

## ✨ What's Included

Your NEWSETUP folder contains:

- **53 source files** (10 architectural layers)
- **6 documentation guides** (2,800+ lines)
- **3 setup scripts** (for Termux)
- **2 config files** (development & production)
- **100+ npm packages** (dependencies)

**Total**: 116 files, 33 folders, 1.20 MB

---

## 🎉 You're Ready!

Your LATIF v5.0.0 installation is complete and ready to use on Android/Termux!

**Start with**: `bash ~/setup-termux-NEWSETUP.sh`

Good luck! 🚀

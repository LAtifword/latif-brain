# LATIF AI — Local Model Configuration Guide

## Overview

LATIF AI is configured for **100% local inference** with automatic server detection and smart caching. No OpenAI API, no cloud services, no external dependencies.

## Key Features

### 🔍 Auto-Detection
The app automatically discovers local model servers on your network:
- **Ollama** (default): `127.0.0.1:11434`
- **llama.cpp**: `127.0.0.1:8000` or `127.0.0.1:8080`
- Fallback to Wi-Fi network discovery for secondary devices

### ⚡ Smart Caching
- Server connection info is cached locally in browser storage
- Model list cached for 1 minute to reduce polling
- Settings persist across sessions — no manual configuration after first setup
- Falls back gracefully if cached server becomes unavailable

### 🚫 No External APIs
- **No OpenAI**: Local models only
- **No Google Cloud Speech**: Browser's Web Speech API or local whisper.cpp
- **No cloud embeddings**: Local nomic-embed-text via Ollama
- **Zero dependencies**: All inference runs on your device

### 🔄 Easy Model Switching
- Switch between Ollama and llama.cpp from settings
- Model list updates automatically
- Per-chat model selection available

---

## Quick Start

### 1. Install Ollama (Recommended)

**macOS/Linux/Windows:**
```bash
# Visit https://ollama.ai and download
# Or on Linux:
curl https://ollama.ai/install.sh | sh
```

**Start Ollama:**
```bash
# macOS/Linux
ollama serve

# Windows
# The app runs in the system tray automatically
```

**Download a model:**
```bash
ollama pull llama2       # 7B model (~4GB)
ollama pull mistral      # 7B model (~5GB) — faster
ollama pull neural-chat  # 7B optimized for chat
```

**Allow network access (optional):**
```bash
# Make Ollama accessible on your local network (not the internet)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### 2. Open LATIF AI

The app will automatically detect Ollama running on your device.

If auto-detection doesn't work:
1. Open **Settings → Connection & Settings**
2. Click **🔍 Auto-Detect Server**
3. Or manually enter your server IP and port

### 3. Select a Model

The app will populate available models from your Ollama instance. Choose one and start chatting.

---

## Advanced Configuration

### Server Auto-Detection

On first load, LATIF scans for:
1. **127.0.0.1:11434** (Ollama, localhost)
2. **192.168.1.1:11434** (Ollama, Wi-Fi fallback)
3. **127.0.0.1:8000** (llama.cpp, OpenAI API compatible)
4. **127.0.0.1:8080** (llama.cpp, alternate port)

If found, the best match is selected automatically.

**Manual re-detection:**
Open Settings → Connection & Settings → Click **🔍 Auto-Detect Server**

### llama.cpp Backend

LATIF supports [llama.cpp](https://github.com/ggerganov/llama.cpp) as a lightweight alternative:

```bash
# Download llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Compile with OpenAI API server
make llama-server

# Run the server
./llama-server -m model.gguf --port 8000 -np 4
```

Then in LATIF Settings:
1. Set server to `127.0.0.1:8000`
2. Switch backend to **llama.cpp**

### Caching & Performance

**Model List Cache:**
- Fresh cache on first startup
- Refreshes every 60 seconds (configurable in `server-autodetect.js`)
- Manual refresh with "↻ Refresh model list" button

**Settings Cache:**
All configuration persists in localStorage:
- Server host/port
- Active model
- Temperature, context size, etc.
- Long-term memory
- Chat history

**Clear cache:**
```javascript
// Browser console
localStorage.clear();
// or selectively:
localStorage.removeItem("latif_host");
```

### Performance Optimization

#### Keep Model Loaded (Settings → Keep Model Loaded)
- **5 minutes** (default Ollama)
- **30 minutes** (recommended) — saves 10–30s reload time
- **2 hours** — higher RAM usage
- **Forever** — stays in VRAM until server restarts

#### Performance Mode (Settings → Performance Mode)
- **⚡ Fast**: 2K context, 256 tokens — responsive on CPU
- **⚖️ Balanced**: 4K context, 512 tokens (default)
- **💎 Quality**: 8K context, 1024 tokens — slower on CPU

#### Context Window
Limit based on your device's RAM:
- **Ollama auto-manages**: Leave at 4096+ unless you hit OOM
- **llama.cpp**: Set via `--ctx-size` when starting the server

---

## Features

### RAG (Retrieval-Augmented Generation)

Attach files to enrich answers with your own data:

1. Click **+ Attach** in the chat
2. Select **📎 Files** (txt, md, csv, json, pdf)
3. Files are chunked, embedded locally with `nomic-embed-text`
4. Relevant chunks retrieved per question

**Setup:**
```bash
ollama pull nomic-embed-text  # ~274MB
```

**Disabled for llama.cpp** — Ollama only (no embedding model support in OpenAI API compat layer).

### Tool Calling

Built-in tools available when enabled (Settings → Tool calling):
- **get_current_time**: Device date/time
- **calculator**: Math operations
- **system_stats**: CPU, RAM, battery
- **long_term_memory**: Persistent facts across chats

**Note:** Ollama only. llama.cpp doesn't support tool calling in the OpenAI API layer.

### Vision (Image Understanding)

If your model supports vision (e.g., `llava`):
1. Click **+ Attach**
2. Select **🖼️ Photos** or **📷 Camera**
3. Ask questions about images

Supported models:
- `llava` (LLaMA 2 7B with vision)
- `moondream` (lightweight vision)

### Voice Mode

**Transcription:**
- **Browser Web Speech API** (default): Uses device's speech engine
- **whisper.cpp** (Termux): Offline Arabic/English transcription

To set up whisper.cpp:

```bash
# In Termux on Android
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

# Run transcription server
python backend/transcribe.py
# or with uvicorn:
uvicorn backend.transcribe:app --port 8001
```

Then in LATIF Settings:
1. Toggle **Voice Backend** to **whisper.cpp**
2. Set URL to `http://127.0.0.1:8001`

---

## Troubleshooting

### "Connection error: Could not reach..."

**Check Ollama is running:**
```bash
curl http://127.0.0.1:11434/api/tags
# Should return: {"models": [...]}
```

**If not running:**
- macOS: `ollama serve` in terminal or check System Preferences
- Linux: `systemctl start ollama` or `ollama serve`
- Windows: Ollama should run in system tray

**Check firewall:** Allow port 11434 (Ollama) or 8000/8080 (llama.cpp)

### Auto-detection failing

**Try manual configuration:**
1. Settings → Connection & Settings
2. Enter server IP: `127.0.0.1`
3. Enter port: `11434`
4. Click **Test Connection**

**On Wi-Fi (multi-device):**
Find your Ollama device's IP:
```bash
# On the device running Ollama
ifconfig | grep "inet "
# Look for 192.168.x.x or 10.0.x.x
```

Enter that IP in LATIF on the other device.

### No models found

**Pull a model:**
```bash
ollama pull llama2
# or any other model from ollama.ai/library
```

**Verify models are installed:**
```bash
ollama list
# or via web:
curl http://127.0.0.1:11434/api/tags | jq .models
```

### Voice mode not working

**Browser Web Speech:**
- Chrome/Edge: Built-in (requires microphone permission)
- Safari: Supported on macOS 14.5+
- Firefox: Limited or unavailable

**Fallback to whisper.cpp** (see above).

### RAG not finding relevant chunks

**Embedding model quality:**
- `nomic-embed-text` (default): Good general-purpose embedding
- Alternatively: `mxbai-embed-large` (slower, higher quality)

**Index file correctly:**
- Plain text files work best
- Structured data (JSON, CSV) should be formatted clearly
- Large files (>1MB) are truncated to 30 chunks

---

## File Locations

### Configuration
- **Host/Port**: Stored in `localStorage.latif_host` and `localStorage.latif_port`
- **Chat history**: `localStorage.latif_chats` (entire chat database)
- **Settings**: Individual `localStorage.latif_*` keys

### Caching
- **Server detection cache**: In-memory, 60-second TTL
- **Models cache**: Updated every 30 seconds automatically

### Service Worker
- `sw.js`: Enables offline-first caching and PWA features

---

## Architecture

### Components

| Module | Purpose |
|--------|---------|
| `server-autodetect.js` | Auto-discovers Ollama/llama.cpp servers, caches results |
| `ai-core.js` | State management, RAG, tool calling, backend abstraction |
| `app.js` | Chat UI, message handling, settings wiring |
| `gx-settings.js` | Theme/mod settings (separate from connection settings) |
| `audio-engine.js` | Text-to-speech, voice UI |
| `voice-backend.js` | Web Speech API and whisper.cpp integration |

### Data Flow

```
UI (app.js)
   ↓
State (ai-core.js, server-autodetect.js cache)
   ↓
Endpoint selection (baseUrl(), getEndpoint())
   ↓
fetch() to local server
   ↓
Ollama API (http://host:port/api/chat)
    OR
OpenAI API (http://host:port/v1/chat/completions)
   ↓
Response streaming or JSON parsing
   ↓
Markdown render & UI update
```

---

## Privacy & Security

### What stays local:
- ✅ All chat conversations
- ✅ All model inference
- ✅ File embeddings and RAG data
- ✅ Voice transcription (if using whisper.cpp)
- ✅ Long-term memory facts

### What may leave your device:
- ❌ Nothing by design
- ⚠️ **Browser Web Speech API** uses Google's servers (if chosen for voice transcription)
  - **Alternative:** Use whisper.cpp for offline transcription

### Permissions
- `Microphone`: For voice input (only on demand)
- `Camera`: For image attachment (only on demand)
- `File System`: To read attached files

No location, contacts, calendar, or other sensitive data is accessed.

---

## Examples

### Run Ollama on Termux (Android)

```bash
# Install Termux: https://termux.dev

termux-setup-storage
pkg update && pkg upgrade
pkg install python build-essential

git clone https://github.com/ggerganov/ollama
cd ollama
# Build from source (takes ~30 min)

# or use pre-built:
pkg install ollama  # if available

# Start server
OLLAMA_HOST=127.0.0.1:11434 ollama serve

# From LATIF on the same device:
# Server: 127.0.0.1:11434
# Auto-detect should find it immediately
```

### Multi-Device Setup

**Device A (Server):**
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
# Now accessible to entire network
```

**Device B (Client with LATIF):**
1. Find Device A's IP: `192.168.1.100` (example)
2. Settings → Connection & Settings
3. Host: `192.168.1.100`
4. Port: `11434`
5. Click Test Connection

Auto-detection will also find this if you use 🔍 Auto-Detect Server.

### Performance Tuning

```bash
# Use GPU acceleration (if available)
# macOS: Metal auto-enabled
# Linux: CUDA if nvidia-docker installed
# Windows: DirectML auto-enabled

# Increase context size (requires more VRAM)
ollama serve --num-gpu 1

# Run on CPU only (slow but no VRAM requirement)
OLLAMA_NUM_GPU=0 ollama serve
```

---

## Support & Contributing

Found an issue or have a feature request?

1. Check this guide first
2. See troubleshooting section
3. Open an issue on GitHub with:
   - Browser type & version
   - Error message (browser console: F12)
   - Steps to reproduce
   - Your device specs

---

## License

LATIF AI is open source. See LICENSE file.

---

**LATIF AI v3 — 100% Local, Zero Cloud, No API Keys**

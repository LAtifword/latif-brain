# 🚀 LATIF GX Enterprise - Complete Setup Guide

Complete instructions to run the full LATIF GX enterprise AI system locally.

## System Requirements

- Python 3.8+
- 4GB+ RAM
- 20GB+ free disk space (for LLM models)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 3-Step Quick Start

### Step 1: Start Ollama (Local LLM)

```bash
# Download and install from https://ollama.ai
# On Linux:
curl https://ollama.ai/install.sh | sh

# Start Ollama server
ollama serve
```

**In another terminal, download a model:**
```bash
ollama pull llama2    # 7B, ~4GB
# or
ollama pull mistral   # Faster, ~5GB
```

### Step 2: Start Backend Server

```bash
cd latif-ai-config/backend

# Setup virtual environment
./start-server.sh

# Or manually:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Backend will be available at:**
- Dashboard API: http://127.0.0.1:8000
- Interactive Docs: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/health

### Step 3: Open Frontend Dashboard

```bash
# Open in browser
# File path: latif-ai-config/index-enterprise.html
# Or serve with Python
cd latif-ai-config
python -m http.server 3000
# Then open http://127.0.0.1:3000/index-enterprise.html
```

## Detailed Setup

### 1. Install Ollama

**macOS:**
```bash
# Download from https://ollama.ai/download/Ollama-darwin.zip
# Or via Homebrew
brew install ollama
```

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download/OllamaSetup.exe

**Verify installation:**
```bash
ollama --version
```

### 2. Download Models

```bash
# Chat models
ollama pull llama2      # Balanced (7B, ~4GB)
ollama pull mistral     # Fast (7B, ~5GB)
ollama pull neural-chat # Optimized (7B, ~4GB)

# Embedding model (for RAG)
ollama pull nomic-embed-text  # Embeddings (~274MB)

# Vision models (optional)
ollama pull llava       # Vision (7B, ~5GB)
```

**List installed models:**
```bash
ollama list
```

### 3. Start Ollama Server

```bash
# Default: http://127.0.0.1:11434
ollama serve

# Custom host/port
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Multi-device (allow network access)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**Verify Ollama is running:**
```bash
curl http://127.0.0.1:11434/api/tags
# Should return: {"models":[...]}
```

### 4. Setup Backend Server

```bash
cd latif-ai-config/backend

# Create virtual environment
python3 -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create data directories
mkdir -p data cache logs
```

### 5. Start Backend Server

**Option A: Using startup script (Linux/macOS)**
```bash
./start-server.sh
```

**Option B: Manual startup**
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Option C: Production deployment**
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Server output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### 6. Open Frontend Dashboard

**Option A: Direct file**
```bash
# Open in browser
file:///path/to/latif-ai-config/index-enterprise.html
```

**Option B: Local web server**
```bash
cd latif-ai-config
python -m http.server 3000
# Open http://127.0.0.1:3000/index-enterprise.html
```

**Option C: Live server (VS Code)**
- Install "Live Server" extension
- Right-click index-enterprise.html → "Open with Live Server"

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Web Browser                          │
│  ┌───────────────────────────────────────────────┐  │
│  │  LATIF GX Dashboard (index-enterprise.html)   │  │
│  │  - Chat Interface                             │  │
│  │  - Agent Monitoring                           │  │
│  │  - Workflow Management                        │  │
│  │  - Knowledge Browser                          │  │
│  │  - System Metrics                             │  │
│  └───────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────┘
                 │ HTTP/WebSocket
         http://127.0.0.1:8000
                 │
┌────────────────▼────────────────────────────────────┐
│       FastAPI Backend Server (main.py)              │
│  ┌─────────────────────────────────────────────┐   │
│  │ Agent Orchestrator                          │   │
│  │  - Planner, Researcher, Executor            │   │
│  │  - Critic, Memory                           │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Workflow Engine                             │   │
│  │  - Multi-step execution                     │   │
│  │  - Progress tracking                        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Hybrid RAG + Knowledge Graph                │   │
│  │  - Document search                          │   │
│  │  - Entity management                        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Metrics & Monitoring                        │   │
│  │  - CPU, Memory, Requests/min                │   │
│  └─────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────┘
                 │ HTTP
         http://127.0.0.1:11434
                 │
┌────────────────▼────────────────────────────────────┐
│         Ollama (Local LLM Server)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Language Models                             │   │
│  │  - llama2, mistral, neural-chat             │   │
│  │  - nomic-embed-text (embeddings)            │   │
│  │  - llava (vision)                           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

Configure via `.env` file or export:

```bash
# Server
export SERVER_HOST=127.0.0.1
export SERVER_PORT=8000

# Ollama
export OLLAMA_HOST=127.0.0.1
export OLLAMA_PORT=11434

# Model settings
export DEFAULT_MODEL=llama2
export TEMPERATURE=0.7
export MAX_TOKENS=2048

# RAG
export RAG_CHUNK_SIZE=500
export RAG_RELEVANCE_THRESHOLD=0.3

# Logging
export LOG_LEVEL=INFO
```

## API Testing

### Health Check

```bash
curl http://127.0.0.1:8000/health
```

### List Agents

```bash
curl http://127.0.0.1:8000/api/agents
```

### Send Chat Message

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello LATIF",
    "model": "llama2",
    "temperature": 0.7,
    "max_tokens": 2048
  }'
```

### Create Workflow

```bash
curl -X POST http://127.0.0.1:8000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "description": "Test workflow",
    "steps": [
      {"name": "Step 1", "description": "First step"},
      {"name": "Step 2", "description": "Second step"}
    ],
    "agents": ["planner", "executor"]
  }'
```

## Troubleshooting

### "Connection refused" at port 8000
```bash
# Check if backend is running
lsof -i :8000

# If not, start it:
cd latif-ai-config/backend
./start-server.sh
```

### "Connection refused" at port 11434
```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# If not, start it:
ollama serve
```

### Backend can't connect to Ollama
```bash
# Verify Ollama URL
export OLLAMA_HOST=127.0.0.1:11434

# Test connection
curl http://127.0.0.1:11434/api/tags

# Restart backend with correct URL
```

### Dashboard shows "Backend not available"
```bash
# This is normal fallback behavior
# Open browser console (F12) and check for errors
# Ensure backend is running on http://127.0.0.1:8000
```

### Models not found
```bash
# Pull models first
ollama pull llama2

# Verify they're installed
ollama list

# Select in dashboard settings
```

### Slow responses
```bash
# Check system resources
# On macOS/Linux: top
# On Windows: Task Manager

# Reduce context window in settings
# Use "Fast" performance mode
# Close other applications
```

## Performance Tuning

### For CPU (slower but lower resource)
```bash
# Settings → Performance Mode → "Fast"
# Context: 2K tokens
# Max Reply: 256 tokens
# Model: mistral (fastest)
```

### For balanced
```bash
# Settings → Performance Mode → "Balanced"
# Context: 4K tokens
# Max Reply: 512 tokens
# Model: llama2 or neural-chat
```

### For quality (needs good GPU/CPU)
```bash
# Settings → Performance Mode → "Quality"
# Context: 8K tokens
# Max Reply: 1024 tokens
# Model: dolphin-mixtral (if available)
```

## Multi-Device Setup

**On Ollama Server Machine:**
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**On LATIF Client:**
1. Find Ollama server IP: `192.168.1.100` (example)
2. Settings → Backend Server → `192.168.1.100:11434`
3. Test Connection

**Or in backend server:**
```bash
export OLLAMA_HOST=192.168.1.100:11434
./start-server.sh
```

## Next Steps

1. **Try chat**: Type a message in the Chat tab
2. **Monitor agents**: Watch agent status in Agents tab
3. **Create workflow**: Create a workflow in Workflows tab
4. **Upload files**: Use RAG to attach documents
5. **View metrics**: Check system health in Monitor tab
6. **Customize**: Adjust settings in Settings tab

## Files Overview

```
latif-ai-config/
├── index-enterprise.html      # Main dashboard UI
├── style-enterprise.css       # Dashboard styling
├── js/
│   ├── ui-framework.js        # UI component system
│   └── app-enterprise.js      # Dashboard logic (connects to backend)
├── backend/
│   ├── main.py                # FastAPI server
│   ├── config.py              # Configuration
│   ├── requirements.txt        # Dependencies
│   ├── start-server.sh         # Startup script
│   ├── agents/
│   │   ├── orchestrator.py     # Agent orchestration
│   │   ├── planner.py
│   │   ├── researcher.py
│   │   ├── executor.py
│   │   ├── critic.py
│   │   └── memory.py
│   ├── workflows/engine.py     # Workflow execution
│   ├── rag/hybrid_rag.py       # Document search
│   ├── knowledge/graph.py      # Knowledge management
│   └── monitoring/metrics.py   # System metrics
└── QUICK_START.md             # Quick reference
```

## Support & Resources

- **Ollama**: https://ollama.ai
- **FastAPI**: https://fastapi.tiangolo.com
- **Project**: This is a local-first, self-contained system
- **No cloud services required**: Everything runs on your machine

## Advanced: Docker Deployment

```bash
cd latif-ai-config

# Build image
docker build -f Dockerfile.backend -t latif-backend .

# Run backend
docker run -p 8000:8000 \
  -e OLLAMA_HOST=host.docker.internal:11434 \
  latif-backend

# Run Ollama separately (not in Docker for GPU support)
# ollama serve
```

---

**Ready to chat? 🚀**

Open your browser to `index-enterprise.html` and start using LATIF GX!

No API keys. No cloud. 100% local inference.

✨ **LATIF GX Enterprise - Full Control, Full Privacy**

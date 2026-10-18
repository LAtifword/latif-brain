# LATIF NI — Complete Enterprise Infrastructure Setup
## Windows Desktop Deployment (C:\Users\LATIF\Desktop\latif)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LATIF NI INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  BROWSER (Port 3000/3001)                                               │
│  ├─ Desktop Dashboard (web artifact)                                    │
│  ├─ Mobile Dashboard (responsive)                                       │
│  └─ Real-time WebSocket Connection                                      │
│                 ↓                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ LATIF NI BACKEND SERVICE (Port 3001)                            │   │
│  │ ├─ Agent Orchestration                                          │   │
│  │ ├─ System Monitoring (Real-time)                                │   │
│  │ ├─ Task Queue Management                                        │   │
│  │ ├─ Workflow Engine                                              │   │
│  │ ├─ WebSocket Server (ws://localhost:3001)                       │   │
│  │ └─ REST API (/api/*)                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           ↓           ↓           ↓           ↓                         │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ OLLAMA       │ │ LATIF V5    │ │ IndexedDB│ │ File System      │  │
│  │ LLM Backend  │ │ API Server  │ │ Storage  │ │ Knowledge Base   │  │
│  │ localhost:11434 │ localhost:3000 │ Local    │ │ /data directory  │  │
│  └──────────────┘ └─────────────┘ └──────────┘ └──────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (5 Minutes)

### Window 1: Ollama Server
```powershell
ollama serve
```
**Expected output:** `Listening on 127.0.0.1:11434`

### Window 2: LATIF V5 API + Frontend
```powershell
cd C:\Users\LATIF\Desktop\latif
npm start
```
**Expected output:**
```
✓ LATIF v5 starting
✓ API server listening on http://127.0.0.1:3000
✓ Frontend available at http://localhost:3000
✓ Ollama backend: http://127.0.0.1:11434
✓ Ready for chat!
```

### Window 3: LATIF NI Backend Service (Agent Orchestration)
```powershell
cd C:\Users\LATIF\Desktop\latif
node LATIF-NI-BACKEND-SERVICE.js
```
**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║           LATIF NI — Enterprise AI Operating System           ║
╚════════════════════════════════════════════════════════════════╝

✓ Backend API: http://localhost:3001/api
✓ WebSocket: ws://localhost:3001
✓ Dashboard API: http://localhost:3001/api/dashboard
✓ Agents: 9 running
✓ System monitoring: ACTIVE
```

### Window 4: Access Dashboard
```
Open browser: http://localhost:3001
```

---

## Installation Steps

### Step 0: Verify Prerequisites
```powershell
node --version      # Should be v18+
npm --version       # Should be v8+
ollama --version    # Should be v0.1+
```

### Step 1: Install Backend Dependencies (One-time)
```powershell
cd C:\Users\LATIF\Desktop\latif

# Add required packages to your existing package.json
npm install ws --save

# Verify installation
npm list ws
```

### Step 2: Copy Backend Service File
1. Save `LATIF-NI-BACKEND-SERVICE.js` to `C:\Users\LATIF\Desktop\latif\`
2. Verify file exists:
```powershell
dir LATIF-NI-BACKEND-SERVICE.js
```

### Step 3: Update package.json Scripts
Add these scripts to your `package.json`:
```json
{
  "scripts": {
    "start": "node main.js",
    "backend": "node LATIF-NI-BACKEND-SERVICE.js",
    "dev": "concurrently \"npm start\" \"npm run backend\"",
    "dev:full": "concurrently \"npm start\" \"npm run backend\" \"ollama serve\""
  }
}
```

### Step 4: Multi-Window Startup Script (Optional)
Create `start-all.ps1`:
```powershell
# start-all.ps1
$windowTitle = "LATIF NI"

# Window 1: Ollama
Start-Process powershell -ArgumentList "-NoExit -Command 'ollama serve'" -WindowStyle Normal

Start-Sleep -Seconds 2

# Window 2: LATIF V5 API
Start-Process powershell -ArgumentList "-NoExit -Command 'cd C:\Users\LATIF\Desktop\latif; npm start'" -WindowStyle Normal

Start-Sleep -Seconds 2

# Window 3: LATIF NI Backend
Start-Process powershell -ArgumentList "-NoExit -Command 'cd C:\Users\LATIF\Desktop\latif; node LATIF-NI-BACKEND-SERVICE.js'" -WindowStyle Normal

# Window 4: Open Dashboard
Start-Sleep -Seconds 3
Start-Process "http://localhost:3001"

Write-Host "✓ All LATIF NI services starting..."
Write-Host "  - Ollama: http://127.0.0.1:11434"
Write-Host "  - LATIF API: http://localhost:3000"
Write-Host "  - LATIF NI Dashboard: http://localhost:3001"
```

Run it:
```powershell
powershell -ExecutionPolicy Bypass -File start-all.ps1
```

---

## Component Details

### LATIF NI Backend Service (Port 3001)

**Agents (9 Running):**
- 💬 Chat Agent — AI Assistant
- 💻 Code Agent — Dev Assistant
- 🎨 Design Agent — UI/UX Creator
- ✈️ Aircraft Agent — Aviation Expert
- 📁 Project Agent — Project Manager
- 🎙️ Audio Agent — Transcribe AI
- 🎬 Video Agent — AI Video Gen
- 📚 Book Writer — AI Author
- 🎵 Music Agent — AI Composer

**API Endpoints:**
```
GET  /api/dashboard          # Full dashboard state
GET  /api/agents             # List all agents
POST /api/agents/:id/execute # Execute agent task
GET  /api/metrics            # System metrics history
GET  /api/workflows          # List workflows
POST /api/workflows          # Create workflow
GET  /api/tasks              # Task queue status
POST /api/tasks              # Add task
GET  /api/activity           # Activity log
GET  /api/health             # Service health
GET  /api/ollama-status      # Ollama connection status
```

**WebSocket Events:**
```javascript
// Real-time updates
ws.on('system-metrics')      // CPU, RAM, GPU, Temp
ws.on('agent-executing')     // Agent task started
ws.on('task-created')        // New task added
ws.on('workflow-created')    // Workflow created
ws.on('agent-added')         // New agent registered
```

### LATIF V5 API (Port 3000)

Remains unchanged:
- Chat endpoint: POST /api/chat
- Health check: GET /health
- Frontend static files: /
- Serves index.html and GX mods interface

### Dashboard Integration

**Desktop Access:**
```
http://localhost:3001
- Full agent network visualization
- Real-time system monitoring
- Workflow builder
- Task queue manager
- Activity timeline
- Model status
```

**Mobile Access (Responsive):**
```
http://localhost:3001 (from phone on same network)
- Automatically responsive
- Touch-optimized controls
- Same real-time updates
- All features available
```

---

## Monitoring & Troubleshooting

### Check Services Status
```powershell
# Check if ports are in use
netstat -ano | findstr :11434   # Ollama
netstat -ano | findstr :3000    # LATIF API
netstat -ano | findstr :3001    # LATIF NI Backend
```

### Real-time Monitoring
```powershell
# Monitor LATIF NI service
curl http://localhost:3001/api/health

# Monitor system metrics
curl http://localhost:3001/api/metrics

# Check agent status
curl http://localhost:3001/api/agents
```

### Common Issues

**"Port 3001 already in use"**
```powershell
# Find and kill process
$proc = Get-Process | Where-Object {$_.Name -eq 'node'}
Stop-Process -Id $proc.Id -Force

# Or use different port
$env:PORT=3002; node LATIF-NI-BACKEND-SERVICE.js
```

**"WebSocket connection failed"**
```powershell
# Verify WebSocket is running
curl http://localhost:3001/api/health

# Check firewall
# Allow localhost:3001 in Windows Firewall
```

**"Ollama disconnected"**
```powershell
# Restart Ollama in its window
# Or manually check:
curl http://127.0.0.1:11434/api/tags
```

---

## Performance Tuning

### Optimal Settings
```powershell
# Run LATIF NI with more memory
$env:NODE_OPTIONS="--max-old-space-size=4096"
node LATIF-NI-BACKEND-SERVICE.js

# Production mode (faster startup)
$env:NODE_ENV="production"
npm start
```

### System Resource Allocation
- **Ollama**: ~6-8 GB RAM (depends on model)
- **LATIF API**: ~500 MB RAM
- **LATIF NI Backend**: ~300 MB RAM
- **Browser**: ~400 MB RAM
- **Total**: ~7-9 GB (for 7B model)

### Dashboard Performance
- Real-time metrics: 2-second update interval
- Smooth animations: GPU-accelerated CSS
- WebSocket: Binary frames for efficiency
- Storage: IndexedDB for fast access

---

## Data Storage & Persistence

### Local Directories
```
C:\Users\LATIF\Desktop\latif\
├── data/                     # IndexedDB + runtime data
│   ├── chats/               # Conversation history
│   ├── workflows/           # Workflow definitions
│   ├── knowledge/           # Knowledge base
│   └── models/              # Model cache
├── node_modules/            # Dependencies
├── frontend/                # Web UI (GX mods)
├── backend-src/             # API server code
└── LATIF-NI-BACKEND-SERVICE.js  # Agent orchestration
```

### Database Schema
```javascript
// IndexedDB stores
{
  chats: { id, title, messages, timestamp, metadata },
  tasks: { id, agentId, description, status, progress, timestamp },
  workflows: { id, name, agents, definition, status, runs },
  activity: { id, type, data, timestamp },
  models: { name, size, type, location, metadata }
}
```

---

## Deployment Modes

### Development
```powershell
# All services with hot reload
npm install -g nodemon
nodemon LATIF-NI-BACKEND-SERVICE.js
```

### Production (Local)
```powershell
$env:NODE_ENV="production"
npm start
node LATIF-NI-BACKEND-SERVICE.js
```

### Headless (No Browser)
```powershell
# Just run services, access from network
# Useful for running on a dedicated machine
```

---

## Network Access (LAN)

### From Another Computer on Network
1. Get your IP: `ipconfig` (look for IPv4)
2. From other device: `http://<YOUR-IP>:3001`
3. Ensure Windows Firewall allows port 3001:
```powershell
# Admin PowerShell
netsh advfirewall firewall add rule name="LATIF NI" dir=in action=allow protocol=tcp localport=3001
```

---

## Updating LATIF NI

### Update Backend Service
1. Replace `LATIF-NI-BACKEND-SERVICE.js` with new version
2. Restart the service in its PowerShell window

### Update Frontend
```powershell
npm update
npm start  # Restarts frontend with new UI
```

### Update Main Application
```powershell
# Pull latest from your repo
git pull origin main

# Reinstall dependencies
npm install

# Restart all services
```

---

## Next Steps

1. ✅ **Run Quick Start** (3 PowerShell windows + browser)
2. ✅ **Access Dashboard** at http://localhost:3001
3. ✅ **Test Agent Execution** (click any agent)
4. ✅ **Check Real-time Updates** (watch metrics update)
5. ✅ **Create Workflow** (drag agents in builder)
6. ✅ **Monitor Tasks** (see them execute)
7. ✅ **Access from Mobile** (LAN IP:3001)

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `npm start` | Start LATIF API + Frontend (port 3000) |
| `node LATIF-NI-BACKEND-SERVICE.js` | Start Agent Orchestration (port 3001) |
| `ollama serve` | Start Ollama LLM server (port 11434) |
| `curl http://localhost:3001/api/dashboard` | Get dashboard state |
| `curl http://localhost:3001/api/agents` | List agents |
| `netstat -ano \| findstr :3001` | Check if port in use |
| `npm install ws` | Add WebSocket dependency |

---

## Architecture Benefits

✅ **Modular Design** — Each component independent
✅ **Real-time Sync** — WebSocket for instant updates
✅ **Scalable** — Easy to add more agents
✅ **Local-First** — No cloud dependencies
✅ **High Performance** — Optimized for desktop
✅ **Responsive UI** — Works on all devices
✅ **Enterprise-Ready** — Production architecture

---

## Troubleshooting Checklist

- [ ] Ollama running on 127.0.0.1:11434
- [ ] LATIF API running on localhost:3000
- [ ] LATIF NI Backend running on localhost:3001
- [ ] Browser can reach http://localhost:3001
- [ ] WebSocket connected (check browser console)
- [ ] All 9 agents showing as "Active"
- [ ] System metrics updating in real-time
- [ ] No port conflicts (netstat check)
- [ ] Firewall allows localhost traffic
- [ ] npm dependencies installed (`npm list ws`)

---

**Status: Ready for Production Deployment** 🚀

Your complete LATIF NI enterprise infrastructure is ready to run locally with full agent orchestration, real-time monitoring, and unified dashboard.

# LATIF NI — Enterprise AI Operating System Infrastructure

## Overview

LATIF NI is a complete enterprise-grade AI operating system with multi-agent orchestration, real-time system monitoring, and synchronized infrastructure. All components run locally with zero cloud dependencies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER (Port 3000/3001)                     │
│              ├─ Dashboard (http://localhost:3001)               │
│              └─ WebSocket Connection (ws://localhost:3001)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           LATIF NI BACKEND SERVICE (Port 3001)                  │
│  ├─ Agent Orchestration (9 agents)                              │
│  ├─ System Monitoring (Real-time metrics)                       │
│  ├─ Task Queue Management                                       │
│  ├─ Workflow Engine                                             │
│  ├─ REST API (/api/*)                                           │
│  └─ WebSocket Server (ws://localhost:3001)                      │
└─────────────────────────────────────────────────────────────────┘
        ↓           ↓           ↓           ↓
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
    │ OLLAMA │ │LATIF V5│ │IndexedB│ │File System │
    │ LLM    │ │API Srv │ │DB Data │ │Knowledge  │
    │11434   │ │3000    │ │Local   │ │/data      │
    └────────┘ └────────┘ └────────┘ └────────────┘
```

## Components

### 1. LATIF NI Backend Service (`src/services/LATIF-NI-BACKEND-SERVICE.js`)

Enterprise orchestration layer running on **port 3001**. Manages:

- **9 AI Agents** with real-time status and task tracking
- **System Metrics**: CPU, RAM, GPU, temperature, storage (updates every 2 seconds)
- **Task Queue**: Running, pending, failed task management
- **Workflow Engine**: DAG-based automation
- **WebSocket Server**: Real-time bidirectional updates to all connected clients
- **REST API**: Full dashboard state queries and agent execution

**Key Agents:**
- 💬 Chat Agent (AI Assistant)
- 💻 Code Agent (Dev Assistant)
- 🎨 Design Agent (UI/UX Creator)
- ✈️ Aircraft Agent (Aviation Expert)
- 📁 Project Agent (Project Manager)
- 🎙️ Audio Agent (Transcribe AI)
- 🎬 Video Agent (AI Video Gen)
- 📚 Book Writer (AI Author)
- 🎵 Music Agent (AI Composer)

**API Endpoints:**
```
GET  /api/dashboard          # Full dashboard state
GET  /api/agents             # List all agents
POST /api/agents/:id/execute # Execute agent task
GET  /api/metrics            # System metrics with history
GET  /api/workflows          # List workflows
POST /api/workflows          # Create workflow
GET  /api/tasks              # Task queue status
POST /api/tasks              # Add task
GET  /api/activity           # Activity log
GET  /api/health             # Service health
GET  /api/ollama-status      # Ollama connection status
```

**WebSocket Events:**
- `system-metrics` — CPU, RAM, GPU, temperature updates
- `agent-executing` — Agent task started
- `task-created` — New task added
- `workflow-created` — Workflow created
- `agent-added` — New agent registered

### 2. Enterprise Dashboard (`src/dashboards/latif-ni-dashboard.html`)

Complete web-based dashboard showing:

- **Agent Network**: Visual representation of 9 agents with status indicators
- **System Monitoring**: Real-time charts (CPU, RAM, GPU over 24 hours)
- **Workspace Cards**: 4 workspaces (Universal AI Chat, Arabic Novel AI, Proposal AI, Voice AI)
- **Quick Actions**: New Chat, Upload, Project, Voice, Tools, Settings
- **Activity Timeline**: Recent agent actions with timestamps
- **Model Status**: Active models with storage usage
- **Mobile Responsive**: Automatically adapts to any screen size

### 3. LATIF V5 API Server (`src/main.js`)

Frontend application server on **port 3000**:
- Serves web UI and GX mods interface
- Provides `/api/chat` endpoint for Ollama integration
- Maintains chat history and conversation state
- Integrates with backend service via WebSocket

### 4. Ollama LLM Backend (external, default: localhost:11434)

Local language model inference engine:
- Runs in separate process
- Provides model endpoints for chat, embedding, transcription
- Can be on same machine or accessible via network
- No internet required

## Quick Start

### Prerequisites
- Node.js v18+
- Ollama v0.1+ running at `localhost:11434`
- npm v8+

### Installation

1. **Install WebSocket dependency:**
```bash
npm install ws
```

2. **Verify setup:**
```bash
npm run backend  # Test backend service starts
npm start        # Test LATIF API server starts
```

### Running All Components

**Option 1: Separate Windows (Windows PowerShell)**

Window 1 - Ollama:
```powershell
ollama serve
```

Window 2 - LATIF API + Frontend:
```powershell
cd C:\Users\LATIF\Desktop\latif
npm start
```

Window 3 - LATIF NI Backend Service:
```powershell
cd C:\Users\LATIF\Desktop\latif
npm run backend
```

Window 4 - Access Dashboard:
```
Browser: http://localhost:3001
```

**Option 2: Combined Script (Development)**

```bash
npm run dev:full
```

This requires `concurrently` package to run multiple processes.

## Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Ollama backend
OLLAMA_HOST=127.0.0.1:11434
OLLAMA_TIMEOUT=30000

# Backend service
NI_PORT=3001
NI_HOST=0.0.0.0

# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
```

### Connecting to Different Ollama Instances

Edit dashboard settings (gear icon) to change Ollama connection:
- Default: `127.0.0.1:11434`
- LAN access: Use machine IP (e.g., `192.168.1.100:11434`)
- Custom port: Configure directly

## Monitoring

### Health Check

```bash
# Backend service health
curl http://localhost:3001/api/health

# Ollama status
curl http://localhost:3001/api/ollama-status

# System metrics
curl http://localhost:3001/api/metrics

# Dashboard state
curl http://localhost:3001/api/dashboard
```

### Real-time Monitoring

Dashboard automatically updates:
- System metrics: Every 2 seconds
- Agent status: Real-time via WebSocket
- Task queue: Real-time via WebSocket
- Activity log: Real-time via WebSocket

### Port Checks

```bash
# Windows PowerShell
netstat -ano | findstr :3001   # Backend service
netstat -ano | findstr :3000   # LATIF API
netstat -ano | findstr :11434  # Ollama
```

## Performance Tuning

### Memory Allocation

```bash
# Increase Node.js heap for backend service
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run backend

# Production mode
$env:NODE_ENV="production"
npm start
```

### Resource Requirements

- **Ollama**: 6-8 GB RAM (depends on model)
- **LATIF API**: ~500 MB RAM
- **LATIF NI Backend**: ~300 MB RAM
- **Browser**: ~400 MB RAM
- **Total**: 7-9 GB (for 7B model)

### Optimization Tips

1. Close unused dashboard browser tabs
2. Use smaller model sizes during development (1.5B-3B)
3. Monitor system metrics in dashboard for bottlenecks
4. Enable compression in browser DevTools

## Troubleshooting

### Backend Service Won't Start

```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill existing process
taskkill /PID <PID> /F

# Or use different port
$env:NI_PORT=3002
npm run backend
```

### WebSocket Connection Failed

1. Verify backend service is running: `http://localhost:3001/api/health`
2. Check firewall allows port 3001
3. Verify browser console for connection errors
4. Try refreshing dashboard page

### Ollama Disconnected

1. Verify Ollama is running: `http://127.0.0.1:11434/api/tags`
2. Restart Ollama if needed
3. Update connection settings in dashboard
4. Check Ollama logs for errors

### Dashboard Not Loading

1. Verify backend service running on 3001
2. Check browser console for errors
3. Clear browser cache and reload
4. Try accessing directly: `http://localhost:3001`

## Integration Points

### Frontend ↔ Backend Communication

1. **Initial Load**: Browser fetches dashboard state via `/api/dashboard`
2. **WebSocket Connection**: Browser connects to `ws://localhost:3001`
3. **Real-time Updates**: Backend broadcasts metrics every 2 seconds
4. **Agent Execution**: Dashboard sends execute-agent message via WebSocket
5. **Workflow Creation**: Dashboard sends create-workflow via WebSocket

### Backend ↔ Ollama Communication

1. Backend checks Ollama status on startup
2. Periodic health checks (can be configured)
3. Agent tasks can invoke Ollama endpoints
4. Metrics include Ollama connection status

### API Server ↔ Backend

1. Both services can be queried independently
2. Frontend can use LATIF API (3000) for chat
3. Frontend can use Backend Service (3001) for orchestration
4. WebSocket provides real-time sync

## Deployment

### Local Deployment (Development)

```bash
# Clone and setup
git clone https://github.com/LAtifword/latif-brain.git
cd latif-brain
npm install

# Run all services
npm run dev:full
```

### Production Deployment

```bash
# Build optimized packages
npm run build

# Run with production settings
NODE_ENV=production npm start
NODE_ENV=production npm run backend
```

### Network Access (LAN)

To access from another device on same network:

1. Get machine IP: `ipconfig` (Windows) or `ifconfig` (Linux)
2. Allow firewall: 
   ```powershell
   netsh advfirewall firewall add rule name="LATIF NI" dir=in action=allow protocol=tcp localport=3001
   ```
3. Access from other device: `http://<YOUR-IP>:3001`

## Data Storage

### IndexedDB (Client-side)

Stores conversation history, workflows, and cache:
- `chats` — Conversation history
- `messages` — Individual messages
- `workflows` — Workflow definitions
- `tasks` — Task history
- `models` — Model metadata

### File System

- `/data/` — Knowledge base and documents
- `/logs/` — Service logs and activity records

## Next Steps

1. ✅ Start all services using Quick Start commands
2. ✅ Access dashboard at `http://localhost:3001`
3. ✅ Verify all 9 agents show "Active" status
4. ✅ Check real-time system metrics updating
5. ✅ Execute an agent task to verify integration
6. ✅ Create and run a workflow
7. ✅ Monitor activity in real-time

## Support & Documentation

- **Full Setup Guide**: See `docs/deployment/LATIF-NI-COMPLETE-SETUP.md`
- **API Reference**: Query `/api/dashboard` or check code comments in `src/services/`
- **Troubleshooting**: See Troubleshooting section above
- **GitHub Issues**: https://github.com/LAtifword/latif-brain/issues

## License

MIT - See LICENSE file for details

---

**Status: Ready for Enterprise Deployment** 🚀

This infrastructure provides production-grade reliability, real-time synchronization, and comprehensive agent orchestration for your local AI operating system.

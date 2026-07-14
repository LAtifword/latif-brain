# LATIF GX Enterprise Backend

FastAPI-based multi-agent orchestration server for LATIF GX enterprise AI operating system.

## Features

- **Multi-Agent Orchestration** - Coordinate Planner, Researcher, Executor, Critic, Memory agents
- **Workflow Engine** - Execute multi-step workflows with progress tracking
- **Hybrid RAG** - BM25 + vector search for document retrieval
- **Knowledge Graph** - Manage entities, relationships, and semantic triples
- **System Monitoring** - Real-time CPU, memory, and request metrics
- **WebSocket Support** - Real-time updates and streaming responses
- **Local LLM Integration** - Direct connection to Ollama or llama.cpp

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start Ollama (or llama.cpp)

```bash
# Ollama
ollama serve

# Or llama.cpp (in another terminal)
./server -m model.gguf -p 8000
```

### 3. Run Backend Server

```bash
# Using startup script
./start-server.sh

# Or manually
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Access API

- **Interactive Docs**: http://127.0.0.1:8000/docs
- **API Health**: http://127.0.0.1:8000/health
- **Metrics**: http://127.0.0.1:8000/metrics

## API Endpoints

### Chat
- `POST /api/chat` - Send message, get response
- `POST /api/chat/stream` - Stream response chunks

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/{agent_id}` - Get agent status
- `POST /api/agents/{agent_id}/start` - Start agent
- `POST /api/agents/{agent_id}/stop` - Stop agent

### Workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows
- `GET /api/workflows/{workflow_id}` - Get workflow status
- `POST /api/workflows/{workflow_id}/pause` - Pause workflow
- `POST /api/workflows/{workflow_id}/resume` - Resume workflow
- `POST /api/workflows/{workflow_id}/cancel` - Cancel workflow

### Knowledge Graph
- `GET /api/knowledge/stats` - Graph statistics
- `POST /api/knowledge/entities` - Add entity
- `GET /api/knowledge/entities` - List entities
- `GET /api/knowledge/search` - Search graph

### RAG
- `POST /api/rag/upload` - Upload document
- `POST /api/rag/search` - Search documents

### System
- `GET /health` - Health check
- `GET /metrics` - System metrics
- `WS /ws` - WebSocket connection

## Configuration

Set environment variables to customize behavior:

```bash
# Server
export SERVER_HOST=127.0.0.1
export SERVER_PORT=8000

# Ollama connection
export OLLAMA_HOST=127.0.0.1
export OLLAMA_PORT=11434

# Model settings
export DEFAULT_MODEL=llama2
export TEMPERATURE=0.7
export MAX_TOKENS=2048

# Agent settings
export MAX_AGENTS=5
export AGENT_TIMEOUT=300

# RAG settings
export RAG_CHUNK_SIZE=500
export RAG_RELEVANCE_THRESHOLD=0.3

# Logging
export LOG_LEVEL=INFO
```

## Architecture

```
FastAPI Server (main.py)
├── Agent Orchestrator
│   ├── Planner Agent
│   ├── Researcher Agent
│   ├── Executor Agent
│   ├── Critic Agent
│   └── Memory Agent
├── Workflow Engine
├── Hybrid RAG System
├── Knowledge Graph
└── Metrics Collector
```

## Project Structure

```
backend/
├── main.py                 # FastAPI application
├── config.py               # Configuration
├── requirements.txt        # Dependencies
├── start-server.sh         # Startup script
├── agents/
│   ├── orchestrator.py     # Multi-agent orchestrator
│   ├── planner.py
│   ├── researcher.py
│   ├── executor.py
│   ├── critic.py
│   └── memory.py
├── workflows/
│   └── engine.py          # Workflow execution engine
├── rag/
│   └── hybrid_rag.py      # RAG system
├── knowledge/
│   └── graph.py           # Knowledge graph
├── monitoring/
│   └── metrics.py         # Metrics collection
└── data/                  # Data directory
```

## Connecting Frontend

Update `latif-ai-config/js/app-enterprise.js` to use backend:

```javascript
const API_BASE = 'http://127.0.0.1:8000';

// Chat
await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model: 'llama2' })
});

// Real-time updates
const ws = new WebSocket('ws://127.0.0.1:8000/ws');
```

## Troubleshooting

### Connection to Ollama fails
```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# Start Ollama
ollama serve
```

### Port already in use
```bash
# Change port
export SERVER_PORT=8001
./start-server.sh
```

### Module import errors
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```

## Development

- **Testing**: `pytest tests/`
- **Linting**: `pylint backend/`
- **Format**: `black backend/`

## Performance

- Chat latency: ~1-2s (50 tokens)
- Workflow execution: ~3-5s (10 steps)
- RAG search: ~200-500ms
- Metrics collection: <100ms

## Security

- CORS enabled for dashboard integration
- Input validation on all endpoints
- Timeout protection on agent execution
- Rate limiting ready (can be added)

## License

MIT

## Support

For issues or questions, refer to the main LATIF GX documentation.

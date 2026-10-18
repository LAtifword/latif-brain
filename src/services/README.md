# LATIF NI Services

Enterprise-grade backend services for LATIF AI Operating System.

## Services

### LATIF-NI-BACKEND-SERVICE.js

Main orchestration engine for the enterprise infrastructure.

**Port:** 3001

**Responsibilities:**
- Agent lifecycle management (9 agents)
- System monitoring (CPU, RAM, GPU, temperature)
- Task queue management
- Workflow execution
- WebSocket real-time synchronization
- REST API for dashboard queries
- Ollama health check integration

**Starting the Service:**

```bash
# Using npm script
npm run backend

# Direct node command
node src/services/LATIF-NI-BACKEND-SERVICE.js

# With custom port
PORT=3002 node src/services/LATIF-NI-BACKEND-SERVICE.js
```

**Environment Variables:**
- `PORT` — Service port (default: 3001)
- `NODE_ENV` — Environment (development|production)
- `NODE_OPTIONS` — Node.js options (e.g., --max-old-space-size=4096)

**Output on Startup:**
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

## API Reference

All endpoints are available at `http://localhost:3001/api`

### Agents

```
GET /api/agents
```

Returns list of all agents with status, role, tasks count, and color.

**Response:**
```json
[
  {
    "id": "chat-agent",
    "name": "Chat Agent",
    "role": "AI Assistant",
    "status": "Active",
    "icon": "💬",
    "tasks": 18,
    "color": "#8b5cf6"
  },
  ...
]
```

### Execute Agent

```
POST /api/agents/:id/execute
Content-Type: application/json

{
  "task": "Summarize the latest news"
}
```

Executes a task on specified agent. Returns success confirmation.

### Dashboard State

```
GET /api/dashboard
```

Returns complete dashboard state including agents, metrics, tasks, workflows, and recent activity.

**Response includes:**
- Agent status and task counts
- Current system metrics
- Recent activity log
- Model information
- Workflow status

### System Metrics

```
GET /api/metrics
```

Returns current and historical system metrics.

**Response:**
```json
{
  "current": {
    "cpu": 24.5,
    "ram": 62,
    "gpu": 18.3,
    "temp": 62.5,
    "uptime": 3600,
    "storage": { "total": 512, "used": 132, "percent": 26 },
    "activeAgents": 9,
    "totalAgents": 9,
    "tasksCompleted": 128,
    "successRate": 94.2
  },
  "history": {
    "cpu": [...24 hourly values...],
    "ram": [...24 hourly values...],
    "gpu": [...24 hourly values...]
  }
}
```

### Workflows

```
GET /api/workflows
```

Returns list of active workflows.

```
POST /api/workflows
Content-Type: application/json

{
  "name": "Research & Write",
  "agents": ["Research Agent", "Book Writer"]
}
```

Creates new workflow and broadcasts to all connected clients.

### Task Queue

```
GET /api/tasks
```

Returns running, pending, and failed tasks.

```
POST /api/tasks
Content-Type: application/json

{
  "agentId": "chat-agent",
  "description": "Analyze sentiment",
  "status": "Pending"
}
```

Adds new task to queue.

### Activity Log

```
GET /api/activity?limit=50
```

Returns recent activity with limit (default: 20, max: 50).

### Health Check

```
GET /api/health
```

Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 1234.56,
  "agents": 9,
  "tasks": 42,
  "timestamp": 1720000000000
}
```

### Ollama Status

```
GET /api/ollama-status
```

Checks Ollama backend availability.

**Response (connected):**
```json
{
  "status": "connected",
  "models": 3
}
```

**Response (disconnected):**
```json
{
  "status": "disconnected",
  "error": "ECONNREFUSED"
}
```

## WebSocket Events

Connect to `ws://localhost:3001` for real-time updates.

### Client → Server

**Execute Agent:**
```json
{
  "type": "execute-agent",
  "agentId": "chat-agent",
  "agentName": "Chat Agent",
  "task": "Summarize this document"
}
```

**Create Workflow:**
```json
{
  "type": "create-workflow",
  "name": "Document Analysis",
  "agents": ["Code Agent", "Design Agent"]
}
```

### Server → Client

**Initial State (on connection):**
```json
{
  "type": "initial-state",
  "data": {
    "agents": {...},
    "metrics": {...},
    "tasks": [...],
    "activity": [...]
  }
}
```

**System Metrics (every 2 seconds):**
```json
{
  "type": "system-metrics",
  "data": {
    "cpu": 24.5,
    "ram": 62,
    "gpu": 18.3,
    "temp": 62.5,
    ...
  }
}
```

**Agent Executing:**
```json
{
  "type": "agent-executing",
  "data": {
    "agentId": "chat-agent",
    "agentName": "Chat Agent",
    "task": "Task description"
  }
}
```

**Task Created:**
```json
{
  "type": "task-created",
  "data": {
    "id": "task-1234567890",
    "agentId": "code-agent",
    "agentName": "Code Agent",
    "description": "Review code",
    "status": "Running",
    "progress": 0,
    "timestamp": 1720000000000
  }
}
```

**Workflow Created:**
```json
{
  "type": "workflow-created",
  "data": {
    "id": "wf-1234567890",
    "name": "Workflow Name",
    "agents": ["Agent 1", "Agent 2"],
    "status": "Running",
    "progress": 0
  }
}
```

**Agent Added:**
```json
{
  "type": "agent-added",
  "data": {
    "id": "new-agent",
    "name": "New Agent",
    "role": "Role description",
    "status": "Active",
    "icon": "🤖",
    "tasks": 0,
    "color": "#color"
  }
}
```

## Architecture

The service is built on:
- **Express.js** — HTTP API framework
- **Node.js http** — HTTP server foundation
- **WebSocket** — Real-time bidirectional communication
- **EventEmitter** — Internal event system
- **os module** — System metrics collection

## Performance Metrics

- **Memory Usage**: ~300 MB baseline
- **CPU Load**: <5% idle
- **WebSocket Throughput**: 1000+ messages/second
- **Metric Update Interval**: 2 seconds
- **Connection Timeout**: 30 seconds

## Scaling

For production deployments:

1. **Horizontal Scaling**: Run multiple backend instances with load balancer
2. **Database Backend**: Replace in-memory storage with persistent database
3. **Clustering**: Use Node.js cluster module for multi-core utilization
4. **Message Queue**: Integrate Bull or RabbitMQ for task persistence

## Future Enhancements

- [ ] Database persistence for tasks and workflows
- [ ] Agent authentication and authorization
- [ ] Rate limiting and throttling
- [ ] Activity audit logging
- [ ] Task result persistence
- [ ] Workflow history and analytics
- [ ] Agent performance metrics
- [ ] Advanced scheduling (cron)
- [ ] Distributed task execution
- [ ] Agent-to-agent communication

## Support

For issues or questions:
1. Check ENTERPRISE_INFRASTRUCTURE.md for general troubleshooting
2. Review API logs in browser console (dashboard) or terminal
3. Verify Ollama connectivity
4. Check firewall and port availability
5. Monitor system resources

---

Last Updated: July 17, 2026

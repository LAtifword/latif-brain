# LATIF v5 Phase 1: Enterprise Foundation (Weeks 1-2)

**Status**: ✅ Complete - v5.0.0-alpha

## Overview

Phase 1 establishes the production-grade foundation for LATIF v5 Personal AI Operating System. This phase replaces the single-file architecture with a real backend system featuring persistence, background processing, configuration management, and comprehensive logging.

## What Was Built

### 1. Database Layer (`src/db/schema.sql`, `src/core/data-layer.js`)

**Schema**: Complete SQLite 3.8+ with 11 subsystems

| Subsystem | Tables | Purpose |
|-----------|--------|---------|
| **Agent Runtime** | agents, agent_runs, agent_memory | Autonomous agent execution and memory |
| **Knowledge & Memory** | kg_nodes, kg_edges, memory_store, document_chunks | Semantic knowledge storage and RAG |
| **Workflow & Automation** | workflows, workflow_executions, scheduled_jobs | DAG execution and cron scheduling |
| **Plugin System** | plugins, plugin_hooks, plugin_metrics, plugin_registry | Extensibility and plugin management |
| **Job Queue** | jobs, workers, job_executions, dead_letter_queue | Background task processing with retries |
| **Document Intelligence** | documents, document_pages, document_processing | PDF parsing, OCR, table extraction |
| **Browser Automation** | browser_sessions, browser_tasks, page_captures | Headless browser pooling and interaction |
| **Voice & Audio** | audio_files, transcriptions, synthesis_tasks | Speech-to-text and text-to-speech |
| **Vision & Image** | images, image_embeddings, image_analysis | Image classification and similarity search |
| **Configuration** | config, secrets, feature_flags, user_preferences | Runtime configuration and feature toggles |
| **Logging & Monitoring** | structured_logs, metrics, health_checks, error_events | Observability and analytics |

**Features**:
- WAL mode for concurrent access
- Foreign key enforcement
- Strategic indexes for performance
- Transaction support with rollback
- SQL views for common queries

**Data Layer**:
- Async/await Promise-based API
- Generic CRUD operations
- Repository pattern for domain access
- AgentRepository, WorkflowRepository, JobQueueRepository, MemoryRepository, KnowledgeGraphRepository
- Connection pooling and lifecycle management
- Comprehensive error handling and logging

### 2. Structured Logging (`src/core/logger.js`)

**Features**:
- JSON-based logging to file and console
- Log levels: error, warn, info, debug
- Automatic log rotation (configurable size limits)
- Buffered writes for performance
- Color-coded console output
- Event emission for monitoring
- Log statistics retrieval

**Storage**:
- Daily log files with timestamp rotation
- Automatic cleanup of old logs
- Configurable retention (default 10 files)

### 3. Configuration Management (`src/core/config.js`)

**Loading Order** (lowest to highest priority):
1. Hardcoded defaults (ConfigManager.getDefaults())
2. Environment-specific JSON file (config/development.json or config/production.json)
3. Environment variables (NODE_ENV, DB_PATH, LOG_LEVEL, etc.)

**Sections**:
- `app`: Application metadata, port, debug mode
- `database`: Connection, timeout, WAL settings
- `logging`: Level, directory, rotation, transports
- `jobs`: Queue concurrency, retry, timeout settings
- `agents`: Concurrency, memory limits, iteration caps
- `api`: CORS, rate limiting, authentication
- `features`: Feature flag toggles
- `storage`: Upload limits, directory paths
- `ai`: Model selection, embedding config
- `monitoring`: Metrics collection and health checks

**Validation**: Automatic validation of required fields and constraints

### 4. Job Queue System (`src/core/job-queue.js`)

**Architecture**:
- Per-queue worker pools
- Configurable concurrency per worker
- Job priority support
- Exponential backoff retries
- Dead letter queue for failed jobs
- Heartbeat monitoring

**Job Lifecycle**:
```
pending → processing → completed
    ↓
  failed → pending (retry) → completed
    ↓
  dead letter queue (max retries exceeded)
```

**Handler Registration**:
```javascript
jobQueue.registerHandler('process-document', async (job) => {
  // Handler receives job with payload, timeout, metadata
  // Return result or throw error
});
```

**Enqueuing**:
```javascript
const jobId = await jobQueue.enqueue('process-document', {
  file_path: '/path/to/doc.pdf'
}, {
  queue: 'background',      // default, background, priority
  priority: 1,               // Higher = earlier execution
  maxAttempts: 3,
  timeout: 300000,
  metadata: { user_id: '123' }
});
```

**Monitoring**:
- Per-queue statistics
- Worker status and load
- Dead letter queue inspection
- Job retry and resolution

### 5. API Server (`src/api/server.js`, `src/main.js`)

**REST Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Basic health check |
| `/ready` | GET | Readiness check (dependencies) |
| `/api` | GET | API documentation |
| `/api/config` | GET | Configuration (no secrets) |
| `/api/stats` | GET | System statistics |
| `/api/logs` | GET | Recent logs (query: lines=100) |
| `/api/jobs` | POST | Enqueue job |
| `/api/jobs/queues` | GET | All queue statistics |
| `/api/jobs/queues/:queue` | GET | Specific queue stats |
| `/api/jobs/dead-letter` | GET | Dead letter queue jobs |
| `/api/jobs/:jobId/retry` | POST | Retry job |
| `/api/jobs/:jobId/resolve` | POST | Resolve dead letter job |
| `/api/admin/vacuum` | POST | Database optimization |

**Middleware**:
- Helmet (security headers)
- CORS (configurable origins)
- Request ID tracking
- Structured request logging
- Optional JWT authentication

**Error Handling**:
- Async error catching
- Unhandled rejection monitoring
- Graceful shutdown (SIGTERM, SIGINT)

### 6. Initialization Pipeline

**Order**:
1. Logger initialization (console output enabled immediately)
2. Configuration loading (environment-specific)
3. Database initialization (schema load, connection)
4. Job queue initialization (worker pool setup)
5. API server startup (express listening)

**Graceful Shutdown**:
- SIGTERM/SIGINT trigger shutdown
- Job queue stops accepting new jobs
- Server closes cleanly
- Database connection closes

## Running the Application

### Development

```bash
# Install dependencies
npm install

# Start development server (debug mode enabled)
npm run dev

# Server starts at http://localhost:3000
# Logs written to ./logs/latif-*.log
# Database at ./latif.db
```

### Production

```bash
# Set environment
export NODE_ENV=production
export DB_PATH=/var/lib/latif/latif.db
export LOG_DIR=/var/log/latif
export JWT_SECRET=your-secret-here

# Start production server
npm start

# Or use Node directly
node src/main.js
```

### Configuration

Create `.env` file in project root (see `.env.example`):
```bash
NODE_ENV=development
DB_PATH=./latif.db
LOG_LEVEL=info
APP_PORT=3000
```

Or configure via environment-specific JSON:
```bash
# Development: config/development.json
# Production: config/production.json
```

## Testing the Foundation

### API Health

```bash
# Check server health
curl http://localhost:3000/health

# Check readiness
curl http://localhost:3000/ready

# Get configuration
curl http://localhost:3000/api/config

# Get system stats
curl http://localhost:3000/api/stats
```

### Enqueue a Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "process-document",
    "payload": {
      "file_path": "/path/to/document.pdf"
    },
    "queue": "background"
  }'

# Returns: {"job_id": "uuid..."}
```

### Monitor Job Queue

```bash
# All queues
curl http://localhost:3000/api/jobs/queues

# Specific queue
curl http://localhost:3000/api/jobs/queues/background
```

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite instead of PostgreSQL** | Single-user local system, simplifies deployment, zero external dependencies |
| **WAL mode** | Allows concurrent reads while writes complete |
| **Async/await throughout** | Clean, readable, prevents callback hell |
| **Repository pattern** | Domain-specific data access, easier testing |
| **JSON configuration** | Easy to version control, environment-specific overrides |
| **Buffered logging** | Performance optimization, batch disk writes |
| **Worker pool pattern** | Controlled concurrency, resource limits |
| **Dead letter queue** | Failed job visibility, manual intervention capability |

## Quality Metrics

✅ **Code Quality**:
- No placeholder implementations
- Full error handling
- Comprehensive logging
- Configuration-driven behavior
- Resource cleanup
- Transaction support

✅ **Reliability**:
- Persistent data storage
- Automatic retries with exponential backoff
- Dead letter queue for failures
- Health checks
- Graceful shutdown

✅ **Observability**:
- Structured JSON logging
- Request tracking with IDs
- Performance metrics
- Queue statistics
- Error aggregation

✅ **Maintainability**:
- Clear separation of concerns
- Repository pattern for data access
- Middleware architecture
- Configuration management
- Comprehensive API documentation

## Next Steps (Phase 2)

Phase 2 will build on this foundation with:

1. **Hybrid RAG System** (Weeks 3-5)
   - BM25 keyword search
   - Vector similarity search
   - Semantic caching
   - Cross-encoder reranking

2. **Agent Framework** (Weeks 6-9)
   - Base agent architecture
   - Planner, Researcher, Executor, Critic, Memory agents
   - Tool execution engine
   - Agent memory persistence

3. **Knowledge Graph** (Weeks 10-13)
   - Entity extraction
   - Relationship detection
   - Graph queries and reasoning
   - Semantic consolidation

Each phase ships a working v5.x release with new capabilities.

## Files Created

### Core Infrastructure
- `src/db/schema.sql` - SQLite schema (11 subsystems)
- `src/core/data-layer.js` - Async database access + repositories
- `src/core/logger.js` - Structured logging system
- `src/core/config.js` - Configuration management
- `src/core/job-queue.js` - Background job processing

### API Layer
- `src/api/server.js` - Express API server
- `src/main.js` - Application entry point

### Configuration
- `config/development.json` - Development configuration
- `config/production.json` - Production configuration
- `.env.example` - Environment variable template

### Package Configuration
- `package.json` - Updated with sqlite3, bull, npm start script

## Dependencies Added

- `sqlite3@^5.1.6` - Database access
- `bull@^4.11.0` - Optional: Advanced queue features (future)

All other dependencies (express, cors, helmet, uuid, pino, joi, axios) already present.

## Known Limitations & Future Work

**Current Limitations**:
- No multi-user authentication (single-user system)
- No distributed queue (local SQLite-backed only)
- No message streaming in API (responses are complete)
- No WebSocket support (could add for real-time updates)

**Future Enhancements**:
- GraphQL API alongside REST
- Real-time job monitoring via WebSocket
- API rate limiting per endpoint
- Database query optimization and query planner
- Backup and restore functionality
- Database replication for redundancy

## Troubleshooting

**Database locked error**:
- Check for other processes accessing latif.db
- WAL mode handles concurrent access; restart may help

**Port already in use**:
- Change APP_PORT in config or environment
- Or kill process on port 3000: `lsof -ti:3000 | xargs kill -9`

**Configuration not loading**:
- Check `NODE_ENV` is set correctly
- Verify config file exists (config/development.json or config/production.json)
- Check .env file is in project root
- Review logs for validation errors

**Jobs not processing**:
- Verify handlers are registered before job queue starts
- Check job queue is running: `curl http://localhost:3000/api/jobs/queues`
- Check dead letter queue for failed jobs

## Support

For issues or questions:
1. Check `/var/log/latif/` or `./logs/` for error messages
2. Review OPERATING_SYSTEM_ARCHITECTURE.md for design decisions
3. Check existing GitHub issues
4. Review code comments in source files

---

**Version**: v5.0.0-alpha  
**Date**: 2024  
**Status**: Ready for Phase 2

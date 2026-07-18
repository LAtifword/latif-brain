# Sprint 1 Execution Plan
## Week 1-4: De-duplication, Consolidation, Persistence

**Start Date**: July 18, 2026  
**End Date**: August 15, 2026  
**Branch**: `claude/latif-opera-gx-mods-sqog4e`  
**Target**: v5.0.0 release (same features, unified architecture)

---

## Phase 1A: Backend Verification & Frontend HTTP Client (Days 1-5)

### Day 1: API Audit & Missing Endpoints

**Verify existing endpoints** ✅
- ✅ POST `/api/chat` - Send message
- ✅ POST `/api/chat/stream` - Stream response
- ✅ GET `/api/chats` - List chats
- ✅ GET `/api/chats/:id` - Get chat
- ✅ DELETE `/api/chats/:id` - Delete chat
- ✅ POST `/api/agents/:agentId/execute` - Run agent
- ✅ GET `/api/agents` - List agents
- ✅ POST `/api/search/hybrid` - RAG search
- ✅ POST `/api/search/rerank` - Reranking
- ✅ POST `/api/knowledge/nodes` - Add entity
- ✅ POST `/api/workflows` - Create workflow
- ✅ POST `/api/audio/transcribe` - Speech-to-text
- ✅ POST `/api/audio/synthesize` - Text-to-speech
- ✅ GET `/api/stats` - System stats

**Add missing endpoints** (CRITICAL)
- [ ] GET `/api/chats/:id/messages` - Get messages with pagination
- [ ] POST `/api/messages` - Send message
- [ ] DELETE `/api/messages/:id` - Delete message
- [ ] PUT `/api/messages/:id` - Edit message
- [ ] GET `/api/models` - List available models
- [ ] POST `/api/knowledge/query` - Query knowledge graph
- [ ] DELETE `/api/knowledge/nodes/:id` - Remove entity
- [ ] GET `/api/workflows` - List workflows
- [ ] GET `/api/workflows/:id` - Get workflow definition
- [ ] POST `/api/workflows/:id/execute` - Execute workflow

**Implementation**: Day 1, ~2 hours

---

### Days 2-4: Create HTTP Client Layer

**Create** `/web/utils/api.js` (200 lines)
- Replace all local AI logic with backend API calls
- Single source for all HTTP communication
- Streaming response handling
- Error handling with retry logic

```javascript
// /web/utils/api.js - New unified API client
export class APIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.isConnected = false;
  }

  // Chat operations
  async sendMessage(chatId, content, options = {}) { ... }
  async streamMessage(chatId, content, options = {}) { ... }
  async getChats() { ... }
  async getChat(chatId) { ... }
  async getMessages(chatId, offset = 0, limit = 50) { ... }
  async deleteChat(chatId) { ... }

  // Agent operations
  async executeAgent(agentId, task, context = {}) { ... }
  async getAgents() { ... }
  async getAgentState(agentId) { ... }

  // RAG operations
  async search(query, options = {}) { ... }
  async rerank(results, query) { ... }

  // Knowledge graph operations
  async addEntity(type, name, attributes = {}) { ... }
  async queryKnowledge(pattern) { ... }
  async removeEntity(id) { ... }

  // Model operations
  async getModels() { ... }
  async setModel(modelName) { ... }

  // Workflow operations
  async createWorkflow(definition) { ... }
  async executeWorkflow(workflowId) { ... }
  async getWorkflows() { ... }

  // System operations
  async getStats() { ... }
  async checkHealth() { ... }

  // Helper methods
  async request(method, endpoint, body = null, options = {}) { ... }
  async stream(method, endpoint, body = null) { ... }
  async handleError(response) { ... }
}

export const api = new APIClient();
```

**Replace in** `/latif-ai/js/ai-core.js` (from 14KB to 2KB)
- Remove all model management logic
- Remove all chat logic
- Remove all RAG logic
- Keep only state tracking and formatting
- All operations delegate to `api` client

```javascript
// OLD: /latif-ai/js/ai-core.js (14KB) - Local implementation
// NEW: /latif-ai/js/ai-core.js (2KB) - Thin wrapper
import { api } from '../utils/api.js';

export class AICore {
  constructor() {
    this.model = 'qwen2.5:1.5b';
    this.temperature = 0.7;
    this.models = [];
  }

  async initialize() {
    this.models = await api.getModels();
  }

  async chat(messages, options = {}) {
    return api.sendMessage(null, messages[messages.length - 1].content, {
      ...options,
      messages
    });
  }

  async streamChat(messages, options = {}) {
    return api.streamMessage(null, messages[messages.length - 1].content, {
      ...options,
      messages
    });
  }

  setModel(name) {
    this.model = name;
  }
}
```

**Replace in** `/latif-ai/js/agent-framework.js` (from 10KB to 1KB)
- Remove local agent execution
- Delegate all to backend

**Replace in** `/latif-ai/js/hybrid-rag.js` (from 8KB to 1KB)
- Remove local search logic
- Use `api.search()`

**Replace in** `/latif-ai/js/reranker.js` (from 9KB to 1KB)
- Remove local reranking
- Use `api.rerank()`

**Files to Delete**: (Keep backups, these are now redundant)
- `/latif-ai/js/knowledge-graph.js` → Use backend API
- `/latif-ai/js/vision-ai.js` → Use backend API
- `/latif-ai/js/workflows.js` → Use backend API

**Result**: Frontend reduced by 40% code, all logic centralized in backend

**Implementation**: Days 2-4, ~12 hours

---

### Day 5: Testing & Verification

**Test each API endpoint** 
- [ ] Chat send/receive works
- [ ] Streaming works
- [ ] Agent execution works
- [ ] RAG search works
- [ ] Knowledge operations work
- [ ] Model selection works
- [ ] Error handling graceful

**Smoke test UI**
- [ ] All chat features work
- [ ] No errors in console
- [ ] Settings still work
- [ ] Sidebar updates

**Result**: Phase 1A complete, backend is source of truth

---

## Phase 1B: Frontend Component Refactoring (Days 6-14)

### Days 6-7: Component Structure Setup

**Create** `/web/components/` directory with:
- `ChatArea.js` (200 lines) - Message display
- `InputBar.js` (150 lines) - User input
- `Sidebar.js` (180 lines) - Chat history
- `TopBar.js` (120 lines) - Header with model picker
- `Settings.js` (150 lines) - Configuration
- `StatusBar.js` (80 lines) - Connection status

**Create** `/web/modules/` directory with:
- `markdown.js` (100 lines) - Markdown rendering
- `voice.js` (80 lines) - Voice recording/playback
- `files.js` (100 lines) - File handling
- `search.js` (80 lines) - Chat search

**Create** `/web/utils/` directory with:
- `api.js` (200 lines) - API client ✅ (done in Phase 1A)
- `storage.js` (100 lines) - IndexedDB access
- `state.js` (80 lines) - State management
- `formatting.js` (60 lines) - Text utils

**Refactor** `/web/app.js` (from 57KB to 200 lines)
- Remove all implementation logic
- Keep only initialization
- Wire up components
- Handle global event listeners

**Implementation**: Days 6-7, ~8 hours

---

### Days 8-12: Component Implementation

**ChatArea.js** - Message display with markdown
```javascript
export class ChatArea {
  constructor(container) {
    this.container = container;
    this.messages = [];
  }

  async loadChat(chatId) {
    const data = await api.getMessages(chatId);
    this.messages = data.messages;
    this.render();
  }

  render() {
    const html = this.messages
      .map(msg => this.renderMessage(msg))
      .join('');
    this.container.innerHTML = html;
    this.bindEventListeners();
  }

  renderMessage(msg) {
    const content = msg.role === 'assistant' 
      ? renderMarkdown(msg.content)
      : escapeHtml(msg.content);
    
    return `
      <div class="message ${msg.role}">
        <div class="content">${content}</div>
      </div>
    `;
  }
}
```

**InputBar.js** - User input with send button
```javascript
export class InputBar {
  constructor(container) {
    this.container = container;
    this.textarea = container.querySelector('textarea');
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.textarea.addEventListener('input', () => this.autoExpand());
    this.container.querySelector('.send-btn')
      .addEventListener('click', () => this.send());
  }

  async send() {
    const content = this.textarea.value.trim();
    if (!content) return;

    await api.sendMessage(State.activeChat, content);
    this.textarea.value = '';
    this.autoExpand();
  }

  autoExpand() {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = this.textarea.scrollHeight + 'px';
  }
}
```

**Sidebar.js** - Chat history with search
```javascript
export class Sidebar {
  async loadChats() {
    const chats = await api.getChats();
    this.render(chats);
  }

  async search(query) {
    const results = await api.search(query);
    this.renderResults(results);
  }

  render(chats) {
    const html = chats
      .map(chat => `
        <div class="chat-item" data-id="${chat.id}">
          <div class="chat-title">${escapeHtml(chat.title)}</div>
          <div class="chat-date">${formatDate(chat.createdAt)}</div>
        </div>
      `)
      .join('');
    
    this.container.innerHTML = html;
    this.bindEventListeners();
  }

  bindEventListeners() {
    this.container.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const chatId = item.dataset.id;
        State.activeChat = chatId;
        // Reload chat
      });
    });
  }
}
```

**Implementation**: Days 8-12, ~20 hours

---

### Days 13-14: Integration & Testing

**Wire components together in** `app.js` (200 lines)
```javascript
import { ChatArea } from './components/ChatArea.js';
import { InputBar } from './components/InputBar.js';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { Settings } from './components/Settings.js';

async function init() {
  // Initialize API
  await api.checkHealth();

  // Create components
  const chatArea = new ChatArea(document.getElementById('chatScroll'));
  const inputBar = new InputBar(document.getElementById('inputStage'));
  const sidebar = new Sidebar(document.getElementById('drawer'));
  const topBar = new TopBar(document.getElementById('topbar'));
  const settings = new Settings(document.getElementById('settingsModal'));

  // Load initial data
  const chats = await api.getChats();
  if (chats.length > 0) {
    State.activeChat = chats[0].id;
    await chatArea.loadChat(State.activeChat);
  } else {
    await api.createChat();
  }

  // Set up event listeners
  window.addEventListener('state-change', () => {
    // Re-render on state change
  });
}

init().catch(err => {
  console.error('Initialization failed:', err);
  showErrorMessage('Failed to initialize LATIF');
});
```

**Test each component**
- [ ] ChatArea renders messages correctly
- [ ] InputBar sends messages
- [ ] Sidebar loads chat list
- [ ] TopBar model selection works
- [ ] Settings save/load work
- [ ] No errors in console
- [ ] Performance acceptable

**Result**: Frontend refactored into testable components

---

## Phase 1C: Data Persistence (Days 15-18)

### Day 15: Database Schema

**Add tables to** `/src/core/schema.sql`:

```sql
-- Agent Memory
CREATE TABLE agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  memory_type TEXT,  -- 'working' | 'short_term' | 'long_term'
  key TEXT NOT NULL,
  value JSON,
  ttl_seconds INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES agents(id),
  UNIQUE(agent_id, session_id, memory_type, key),
  INDEX(agent_id, session_id)
);

-- Knowledge Graph Nodes
CREATE TABLE kg_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'person' | 'place' | 'concept' | 'event'
  name TEXT NOT NULL,
  aliases JSON,
  attributes JSON,
  confidence REAL DEFAULT 1.0,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(name),
  INDEX(type),
  UNIQUE(type, name)
);

-- Knowledge Graph Edges
CREATE TABLE kg_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  evidence JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(target_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
  INDEX(source_id, relation_type),
  INDEX(target_id, relation_type),
  UNIQUE(source_id, target_id, relation_type)
);

-- Message Full-Text Search
CREATE VIRTUAL TABLE messages_fts USING fts5(
  message_id UNINDEXED,
  chat_id UNINDEXED,
  content,
  role UNINDEXED,
  created_at UNINDEXED
);
```

**Implementation**: Day 15, ~2 hours

---

### Days 16-18: Persistence Implementation

**Add to** `src/ai/agents/agent-memory.js`:
```javascript
async saveMemory(agentId, sessionId, memoryType, key, value, ttl = null) {
  const id = uuid.v4();
  const now = new Date().toISOString();
  
  await getDatabase().run(
    `INSERT OR REPLACE INTO agent_memory 
     (id, agent_id, session_id, memory_type, key, value, ttl_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, agentId, sessionId, memoryType, key, JSON.stringify(value), ttl, now, now]
  );
  
  return id;
}

async getMemory(agentId, sessionId, memoryType) {
  const rows = await getDatabase().all(
    `SELECT key, value FROM agent_memory 
     WHERE agent_id = ? AND session_id = ? AND memory_type = ?
     ORDER BY updated_at DESC`,
    [agentId, sessionId, memoryType]
  );
  
  return Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
}

async deleteExpiredMemory() {
  await getDatabase().run(
    `DELETE FROM agent_memory 
     WHERE ttl_seconds IS NOT NULL 
     AND created_at < datetime('now', '-' || ttl_seconds || ' seconds')`
  );
}
```

**Add to** `src/ai/knowledge/graph.js`:
```javascript
async addNode(nodeData) {
  const id = nodeData.id || uuid.v4();
  const now = new Date().toISOString();
  
  await getDatabase().run(
    `INSERT OR REPLACE INTO kg_nodes 
     (id, type, name, aliases, attributes, confidence, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nodeData.type, nodeData.name, JSON.stringify(nodeData.aliases || []),
     JSON.stringify(nodeData.attributes || {}), nodeData.confidence || 1.0,
     nodeData.source, now, now]
  );
  
  return id;
}

async addEdge(sourceId, targetId, relationType, weight = 1.0, evidence = []) {
  const id = uuid.v4();
  const now = new Date().toISOString();
  
  await getDatabase().run(
    `INSERT INTO kg_edges 
     (id, source_id, target_id, relation_type, weight, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sourceId, targetId, relationType, weight, JSON.stringify(evidence), now]
  );
  
  return id;
}
```

**Add API endpoints** in `src/api/routes.js`:
```javascript
// Agent memory
router.post('/agents/:agentId/memory', async (req, res) => {
  const { sessionId, memoryType, key, value, ttl } = req.body;
  const id = await agentMemory.saveMemory(req.params.agentId, sessionId, memoryType, key, value, ttl);
  res.json({ id });
});

router.get('/agents/:agentId/memory', async (req, res) => {
  const { sessionId, memoryType } = req.query;
  const memory = await agentMemory.getMemory(req.params.agentId, sessionId, memoryType);
  res.json(memory);
});

// Knowledge graph
router.delete('/knowledge/nodes/:id', async (req, res) => {
  await knowledgeGraph.removeNode(req.params.id);
  res.json({ success: true });
});

router.put('/knowledge/edges/:id', async (req, res) => {
  const { weight, evidence } = req.body;
  await knowledgeGraph.updateEdge(req.params.id, weight, evidence);
  res.json({ success: true });
});
```

**Implementation**: Days 16-18, ~12 hours

---

## Phase 1D: Testing & Stabilization (Days 19-28)

### Days 19-22: Unit Tests

**Create** `/tests/unit/api-client.test.js` (200 lines)
- Test each API method
- Test error handling
- Test retry logic

**Create** `/tests/unit/components.test.js` (300 lines)
- Test ChatArea rendering
- Test InputBar send
- Test Sidebar filtering

**Create** `/tests/unit/persistence.test.js` (200 lines)
- Test agent memory save/load
- Test knowledge graph operations
- Test FTS search

**Implementation**: Days 19-22, ~16 hours

---

### Days 23-25: Integration Tests

**Test full workflows**
- [ ] Send message → appears in chat
- [ ] Create chat → shows in sidebar
- [ ] Search chat → finds messages
- [ ] Agent executes → stores memory
- [ ] Knowledge graph updated → can query

**Test data persistence**
- [ ] Agent memory survives restart
- [ ] Knowledge graph queries work
- [ ] FTS search returns results

**Implementation**: Days 23-25, ~12 hours

---

### Days 26-28: Bug Fixes & Optimization

**Fix any issues found**
- [ ] Memory leaks in components
- [ ] Slow rendering
- [ ] API timeout handling
- [ ] Error message clarity

**Performance optimization**
- [ ] Virtual scrolling for chat history
- [ ] Lazy component loading
- [ ] Request deduplication
- [ ] Database query optimization

**Documentation**
- [ ] Update API documentation
- [ ] Add component documentation
- [ ] Create migration guide

**Implementation**: Days 26-28, ~12 hours

---

## Deliverables

### Code Changes
- ✅ `/web/utils/api.js` - HTTP client (200 lines)
- ✅ `/web/components/` - 6 components (1000 lines)
- ✅ `/web/modules/` - 4 modules (400 lines)
- ✅ `/web/utils/` - 4 utilities (400 lines)
- ✅ `/web/app.js` - Refactored (200 lines)
- ✅ `/src/api/routes.js` - New endpoints (200 lines)
- ✅ `/src/ai/agents/agent-memory.js` - Persistence (150 lines)
- ✅ `/src/ai/knowledge/graph.js` - Persistence (150 lines)
- ✅ `/src/core/schema.sql` - New tables (100 lines)

### Tests
- ✅ `/tests/unit/` - 3 test files (700 lines)
- ✅ `/tests/integration/` - Workflow tests
- ✅ `/tests/e2e/` - End-to-end scenarios

### Documentation
- ✅ Updated API docs
- ✅ Component documentation
- ✅ Migration guide (v3 → v5)
- ✅ This execution plan

---

## Commits

```bash
# Day 1-5: De-duplication
git commit -m "feat: create HTTP client layer and replace local AI logic with backend API calls"
git commit -m "fix: remove redundant code in ai-core, hybrid-rag, agents modules"

# Day 6-14: Components
git commit -m "refactor: split monolithic app.js into modular components"
git commit -m "feat: implement ChatArea, InputBar, Sidebar, TopBar components"

# Day 15-18: Persistence
git commit -m "feat: add database tables for agent memory and knowledge graph"
git commit -m "feat: implement persistence layer for learning systems"

# Day 19-28: Tests
git commit -m "test: add unit tests for API client and components"
git commit -m "test: add integration tests for full workflows"
git commit -m "fix: resolve issues found during testing"

# Final
git commit -m "release: v5.0.0 - unified architecture, same features, improved maintainability"
```

---

## Success Criteria

- ✅ Code duplication reduced by 40%
- ✅ Frontend components testable in isolation
- ✅ Agent memory persists across restarts
- ✅ Knowledge graph queryable
- ✅ All original features working
- ✅ Test coverage >70%
- ✅ No regression in functionality
- ✅ Documentation complete

---

## Timeline Summary

| Phase | Days | Duration | Deliverable |
|-------|------|----------|------------|
| 1A | 1-5 | 1 week | HTTP client, de-duplication |
| 1B | 6-14 | 2 weeks | Components, refactoring |
| 1C | 15-18 | 1 week | Persistence, schema |
| 1D | 19-28 | 2 weeks | Tests, optimization |
| **Total** | **1-28** | **4 weeks** | **v5.0.0 release** |

---

## Next Steps

1. ✅ Review this plan
2. ✅ Approve execution
3. 🚀 Start Day 1: API audit
4. Commit regularly (at least daily)
5. Test continuously
6. Adjust as needed
7. Release v5.0.0

**Ready to start? Day 1 begins now.**

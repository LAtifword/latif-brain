# LATIF v5 Developer Guide

Quick reference for working with the refactored v5.0.0 architecture.

---

## Project Structure

```
latif-brain/
├── web/                          # Frontend PWA (v5.0.0)
│   ├── app.js                    # Main app (200 lines)
│   ├── index.html                # Entry point
│   ├── components/               # UI components (800 lines)
│   │   ├── ChatArea.js           # Message display
│   │   ├── InputBar.js           # Input handling
│   │   ├── Sidebar.js            # Chat history
│   │   ├── TopBar.js             # Header
│   │   ├── StatusBar.js          # Status
│   │   └── Settings.js           # Settings
│   ├── modules/                  # Feature modules (450 lines)
│   │   ├── markdown.js           # Rendering
│   │   ├── voice.js              # Audio
│   │   ├── files.js              # Files
│   │   └── search.js             # Search
│   └── utils/                    # Utilities (600 lines)
│       ├── api.js                # HTTP client
│       ├── state.js              # State mgmt
│       ├── storage.js            # IndexedDB
│       ├── formatting.js         # Helpers
│       └── ai-core.js            # AI wrapper
├── src/                          # Backend (Node.js)
│   ├── api/
│   │   ├── routes.js             # Main API routes
│   │   └── persistence-routes.js # Persistence endpoints
│   ├── ai/
│   │   ├── agents/
│   │   │   └── agent-persistence.js
│   │   └── knowledge/
│   │       └── graph-persistence.js
│   ├── core/
│   │   ├── schema.sql            # Database schema
│   │   ├── schema-init.js        # Schema init
│   │   ├── data-layer.js         # DB access
│   │   └── logger.js             # Logging
│   └── main.js                   # Entry point
└── tests/                        # Test suite (TBD)
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Key Changes from v3.0.0

### Frontend Architecture

**Before (v3.0.0)**: Monolithic 57KB app.js with everything mixed together
```javascript
// OLD: Everything in app.js
function sendMessage() { ... }  // 500 lines
function renderChat() { ... }    // 300 lines
function handleInput() { ... }   // 200 lines
// ... 10KB more of entangled code
```

**After (v5.0.0)**: Modular components with clear separation
```javascript
// NEW: app.js (200 lines bootstrap)
const chat = new ChatArea(container);
const input = new InputBar(inputContainer);
const sidebar = new Sidebar(sidebarContainer);
// Components handle their own logic

// NEW: Each component is independent
- ChatArea: renders messages
- InputBar: handles user input
- Sidebar: manages chat list
```

### API Pattern

**Before**: Direct local AI logic
```javascript
// OLD: Direct local calls
import { aiCore } from './ai-core.js';
const response = await aiCore.chat(messages);  // Local LLM
```

**After**: Centralized API client
```javascript
// NEW: API delegation
import { api } from './utils/api.js';
const response = await api.sendMessage(chatId, content);  // HTTP call
```

### State Management

**Before**: Global variables + localStorage
```javascript
// OLD: Scattered state
let State = { ... };
let messages = [];
let chats = [];
localStorage.setItem('...', JSON.stringify(...));
```

**After**: Centralized with events
```javascript
// NEW: State system
import { State, updateState, onStateChange } from './utils/state.js';

updateState({ activeChat: id });  // Updates state + emits event
onStateChange((updates) => {       // Listen for changes
  if (updates.activeChat) { ... }
});
```

### Data Persistence

**Before**: Lost on reload
```javascript
// Messages only in memory
State.messages = [];  // Cleared on refresh
```

**After**: Persistent database
```javascript
// Messages in IndexedDB + backend
await storage.saveMessage(message);
const messages = await storage.getMessages(chatId);
```

---

## Common Tasks

### Add a New Component

1. Create in `web/components/MyComponent.js`:
```javascript
export class MyComponent {
  constructor(container) {
    this.container = container;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Bind events
  }

  render() {
    // Update DOM
  }
}
```

2. Wire in `web/app.js`:
```javascript
const myComponent = new MyComponent(document.getElementById('my-container'));
```

3. Listen for changes:
```javascript
window.addEventListener('custom-event', (e) => {
  myComponent.update(e.detail);
});
```

### Add an API Endpoint

1. Create handler in `src/api/routes.js`:
```javascript
router.get('/api/my-endpoint', async (req, res) => {
  try {
    const result = await someOperation();
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

2. Add method to `web/utils/api.js`:
```javascript
async getMyEndpoint() {
  return this.get('/api/my-endpoint');
}
```

3. Use in component:
```javascript
const result = await api.getMyEndpoint();
```

### Store Data in Database

1. Create table in `src/core/schema.sql`:
```sql
CREATE TABLE my_data (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. Create persistence layer in `src/ai/my-feature/persistence.js`:
```javascript
export class MyPersistence {
  async save(data) {
    const db = getDatabase();
    await db.run('INSERT INTO my_data ...', [...]);
  }

  async load(id) {
    const db = getDatabase();
    return await db.get('SELECT * FROM my_data WHERE id = ?', [id]);
  }
}
```

3. Expose via API:
```javascript
router.post('/api/my-data', async (req, res) => {
  const id = await persistence.save(req.body);
  res.json({ id });
});
```

---

## State Flow

### Chat Selection Flow
```
User clicks chat in Sidebar
  ↓
Sidebar.selectChat(chatId)
  ↓
dispatch('chat-selected') event
  ↓
App listens and calls loadChat()
  ↓
ChatArea.loadChat(chatId)
  ↓
api.getMessages(chatId)
  ↓
Backend loads from database
  ↓
ChatArea.render() updates UI
```

### Message Sending Flow
```
User types and hits Enter
  ↓
InputBar.send()
  ↓
dispatch('message-added') event
  ↓
ChatArea adds message immediately
  ↓
api.sendMessage() to backend
  ↓
Backend calls LLM (Ollama)
  ↓
dispatch('message-updated') event
  ↓
ChatArea updates with response
```

---

## Testing

### Unit Test Example

```javascript
// tests/unit/components.test.js
describe('ChatArea', () => {
  test('renders messages', () => {
    const chat = new ChatArea(container);
    chat.messages = [{ id: '1', role: 'user', content: 'Hi' }];
    chat.render();

    expect(container.textContent).toContain('Hi');
  });

  test('scrolls to bottom on new message', () => {
    const chat = new ChatArea(container);
    chat.addMessage({ role: 'assistant', content: 'Hello' });

    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});
```

### Integration Test Example

```javascript
// tests/integration/workflows.test.js
describe('Send message workflow', () => {
  test('message sent and appears in chat', async () => {
    await app.initialize();
    const input = app.components.input;

    input.textarea.value = 'Hello';
    await input.send();

    // Wait for message to appear
    await waitFor(() => {
      expect(app.components.chat.messages.length).toBe(1);
    });
  });
});
```

---

## Debugging

### Check Component State
```javascript
// In browser console
app.components.chat.messages         // View messages
app.components.sidebar.allChats      // View chats
State                                 // View app state
```

### Check API Calls
```javascript
// Enable logging in api.js
// All requests logged in network tab
```

### Check Database
```bash
# View database contents
sqlite3 latif.db ".headers on"
sqlite3 latif.db "SELECT * FROM messages LIMIT 5;"
sqlite3 latif.db "SELECT COUNT(*) FROM agent_memory;"
```

### View Component Renders
```javascript
// In app.js
render() {
  console.log('ChatArea rendering', this.messages.length);
  // ... rest of render
}
```

---

## Performance Tips

1. **Virtual Scrolling**: For 10K+ messages, implement virtual scrolling
   - Only render visible messages
   - See `components/ChatArea.js` comments

2. **Debounce Search**: Search is debounced to 300ms
   - See `modules/search.js`

3. **Lazy Load Components**: Load Settings modal on demand
   - See `components/Settings.js`

4. **Cache API Responses**: Leverage built-in caching
   - See `utils/api.js` - cacheTTL option

5. **IndexedDB Indexes**: Database has proper indexes
   - See `schema.sql` - INDEX directives

---

## Common Issues

### Issue: "State not updating"
**Solution**: Use `updateState()` not direct assignment
```javascript
// ❌ Wrong
State.activeChat = id;

// ✅ Correct
updateState({ activeChat: id });
```

### Issue: "Component not re-rendering"
**Solution**: Manually call `render()` or wait for event
```javascript
// ✅ Listen for state changes
onStateChange((updates) => {
  if (updates.activeChat) {
    this.render();
  }
});
```

### Issue: "API endpoint not found"
**Solution**: Check routes are registered in backend
```bash
# In backend
npm run dev  # Check console for endpoint registration
curl http://localhost:3000/health  # Test connectivity
```

### Issue: "Database locked"
**Solution**: Check concurrent writes, use transactions
```javascript
// Use db.run() with transactions
await db.run('BEGIN TRANSACTION');
await db.run('INSERT ...');
await db.run('COMMIT');
```

---

## What's Next

### Phase 1D: Testing (Days 19-28)
- [ ] Write 700+ lines of unit tests
- [ ] Write 400+ lines of integration tests
- [ ] Fix any bugs found
- [ ] Optimize performance

### Phase 2: Advanced RAG (Weeks 5-6)
- Hybrid search (BM25 + vector)
- Cross-encoder reranking
- Semantic caching

### Phase 3: Multi-Agent Framework (Weeks 7-10)
- Agent collaboration
- Autonomous task execution
- Long-term learning

---

## Resources

- **API Docs**: See `PHASE-1-COMPLETION.md` for endpoint list
- **Architecture**: See original `ARCHITECTURE-ANALYSIS.md` for design decisions
- **Sprint Plan**: See `SPRINT-1-EXECUTION.md` for detailed timeline
- **Schema**: See `src/core/schema.sql` for database design

---

**Last Updated**: July 28, 2026  
**Status**: Phase 1A-C Complete, Phase 1D Pending  
**Target Release**: v5.0.0 by End of Month

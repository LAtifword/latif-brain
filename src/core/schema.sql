-- LATIF v5 Database Schema
-- Core tables for chats, messages, agents, knowledge graphs, and learning systems

-- ============================================================================
-- Chat Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  preview TEXT,
  model TEXT DEFAULT 'qwen2.5:1.5b',
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived INTEGER DEFAULT 0,
  INDEX(created_at),
  INDEX(updated_at),
  INDEX(model)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  model TEXT,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  INDEX(chat_id),
  INDEX(created_at),
  INDEX(role)
);

-- Full-Text Search Index
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  chat_id UNINDEXED,
  content,
  role UNINDEXED,
  created_at UNINDEXED
);

-- ============================================================================
-- Agent Memory & State
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'planner' | 'researcher' | 'executor' | 'critic' | 'memory'
  description TEXT,
  model TEXT,
  enabled INTEGER DEFAULT 1,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(type),
  INDEX(enabled)
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'working' | 'short_term' | 'long_term'
  key TEXT NOT NULL,
  value JSON NOT NULL,
  confidence REAL DEFAULT 1.0,
  ttl_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, session_id, memory_type, key),
  INDEX(agent_id),
  INDEX(session_id),
  INDEX(memory_type),
  INDEX(created_at)
);

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  task TEXT NOT NULL,
  context JSON,
  status TEXT DEFAULT 'pending', -- 'pending' | 'running' | 'success' | 'error'
  result JSON,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  INDEX(agent_id),
  INDEX(status),
  INDEX(created_at)
);

-- ============================================================================
-- Knowledge Graph
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'person' | 'place' | 'concept' | 'event' | 'organization'
  name TEXT NOT NULL,
  aliases JSON,
  attributes JSON,
  embeddings BLOB,
  confidence REAL DEFAULT 1.0,
  source TEXT,
  occurrences INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(type),
  INDEX(name),
  UNIQUE(type, name)
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  evidence JSON,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(target_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
  INDEX(source_id),
  INDEX(target_id),
  INDEX(relation_type),
  UNIQUE(source_id, target_id, relation_type)
);

-- ============================================================================
-- Embeddings & Semantic Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL, -- 'message' | 'document' | 'entity'
  content_id TEXT NOT NULL,
  content_text TEXT,
  embedding BLOB NOT NULL, -- Vector embedding (serialized)
  model TEXT DEFAULT 'bge-small-en-v1.5',
  dimensions INTEGER DEFAULT 384,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(content_id) REFERENCES messages(id) ON DELETE CASCADE,
  INDEX(content_type),
  INDEX(model),
  UNIQUE(content_id, model)
);

CREATE TABLE IF NOT EXISTS semantic_cache (
  id TEXT PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_embedding BLOB,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  model TEXT,
  similarity_threshold REAL DEFAULT 0.85,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  INDEX(similarity_threshold),
  INDEX(last_accessed)
);

-- ============================================================================
-- Workflows & Tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  definition JSON NOT NULL, -- DAG structure
  enabled INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(enabled)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  session_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'running' | 'success' | 'error' | 'cancelled'
  inputs JSON,
  outputs JSON,
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  INDEX(workflow_id),
  INDEX(status),
  INDEX(created_at)
);

-- ============================================================================
-- Files & Attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  chat_id TEXT,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  metadata JSON,
  processed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  INDEX(chat_id),
  INDEX(created_at)
);

-- ============================================================================
-- System & Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL, -- 'debug' | 'info' | 'warn' | 'error'
  message TEXT NOT NULL,
  context JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(level),
  INDEX(timestamp)
);

CREATE TABLE IF NOT EXISTS system_stats (
  id TEXT PRIMARY KEY,
  metric TEXT NOT NULL,
  value REAL,
  unit TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(metric),
  INDEX(recorded_at)
);

-- ============================================================================
-- Migrations Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Triggers for Full-Text Search
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS messages_ai_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(message_id, chat_id, content, role, created_at)
  VALUES (NEW.id, NEW.chat_id, NEW.content, NEW.role, NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS messages_ai_delete AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS messages_ai_update AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = NEW.content WHERE message_id = NEW.id;
END;

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS chats_update AFTER UPDATE ON chats BEGIN
  UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_memory_update AFTER UPDATE ON agent_memory BEGIN
  UPDATE agent_memory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kg_nodes_update AFTER UPDATE ON kg_nodes BEGIN
  UPDATE kg_nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kg_edges_update AFTER UPDATE ON kg_edges BEGIN
  UPDATE kg_edges SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

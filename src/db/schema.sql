-- LATIF v5 Enterprise Database Schema
-- Complete system persistence for all 11 subsystems
-- SQLite 3.8+

-- ============================================================================
-- SUBSYSTEM 1: AGENT RUNTIME
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  model TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'idle',
  memory_limit_mb INTEGER DEFAULT 256,
  timeout_seconds INTEGER DEFAULT 300,
  max_iterations INTEGER DEFAULT 10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  config JSON
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  result TEXT,
  error TEXT,
  tokens_used INTEGER,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  duration_ms INTEGER,
  metadata JSON,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);

-- ============================================================================
-- SUBSYSTEM 2: KNOWLEDGE & MEMORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  entity_name TEXT NOT NULL,
  entity_type TEXT,
  description TEXT,
  attributes JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confidence REAL DEFAULT 1.0,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  properties JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confidence REAL DEFAULT 1.0,
  metadata JSON,
  FOREIGN KEY (source_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_store (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  retention_days INTEGER DEFAULT 365,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  embedding BLOB,
  tokens INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_entity_type ON kg_nodes(entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_store_type ON memory_store(memory_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- ============================================================================
-- SUBSYSTEM 3: WORKFLOW & AUTOMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  definition JSON NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  node_states JSON,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  duration_ms INTEGER,
  result JSON,
  error TEXT,
  metadata JSON,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  next_run_at DATETIME,
  last_run_at DATETIME,
  last_status TEXT,
  failure_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at);

-- ============================================================================
-- SUBSYSTEM 4: PLUGIN & EXTENSION
-- ============================================================================

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  author TEXT,
  description TEXT,
  status TEXT DEFAULT 'inactive',
  entry_point TEXT,
  manifest JSON,
  permissions JSON,
  resource_limits JSON,
  sandbox_enabled BOOLEAN DEFAULT 1,
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  config JSON
);

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  hook_name TEXT NOT NULL,
  handler TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE,
  UNIQUE(plugin_id, hook_name)
);

CREATE TABLE IF NOT EXISTS plugin_metrics (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  execution_count INTEGER DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  memory_peak_mb REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plugin_registry (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL,
  api_version TEXT,
  capabilities JSON,
  dependencies JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plugins_name ON plugins(name);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin_id ON plugin_hooks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_metrics_plugin_id ON plugin_metrics(plugin_id);

-- ============================================================================
-- SUBSYSTEM 5: TASK SCHEDULING & JOB QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  queue TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  payload JSON NOT NULL,
  result JSON,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 5000,
  timeout_ms INTEGER DEFAULT 300000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  failed_at DATETIME,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  queue TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  processing_job_id TEXT,
  capacity INTEGER DEFAULT 1,
  current_load INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (processing_job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS job_executions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  worker_id TEXT,
  status TEXT DEFAULT 'running',
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,
  duration_ms INTEGER,
  logs TEXT,
  result JSON,
  error TEXT,
  metadata JSON,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  queue TEXT NOT NULL,
  error TEXT,
  payload JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT 0,
  resolved_at DATETIME,
  resolution_notes TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON jobs(queue, status);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_workers_queue_status ON workers(queue, status);
CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_job_id ON dead_letter_queue(job_id);

-- ============================================================================
-- SUBSYSTEM 6: DOCUMENT INTELLIGENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_size_bytes INTEGER,
  content_hash TEXT,
  source TEXT,
  extracted_text TEXT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT
);

CREATE TABLE IF NOT EXISTS document_pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER,
  content TEXT,
  image_path TEXT,
  extracted_tables JSON,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_processing (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  processing_type TEXT,
  result JSON,
  confidence REAL,
  processing_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_document_id ON document_processing(document_id);

-- ============================================================================
-- SUBSYSTEM 7: BROWSER AUTOMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active',
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  cookies JSON,
  storage_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS browser_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  url TEXT,
  actions JSON,
  status TEXT DEFAULT 'pending',
  result JSON,
  error TEXT,
  start_time DATETIME,
  end_time DATETIME,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (session_id) REFERENCES browser_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_captures (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  task_id TEXT,
  capture_type TEXT,
  content BLOB,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES browser_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES browser_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_status ON browser_sessions(status);
CREATE INDEX IF NOT EXISTS idx_browser_tasks_session_id ON browser_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_tasks_status ON browser_tasks(status);
CREATE INDEX IF NOT EXISTS idx_page_captures_session_id ON page_captures(session_id);

-- ============================================================================
-- SUBSYSTEM 8: VOICE & AUDIO
-- ============================================================================

CREATE TABLE IF NOT EXISTS audio_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds REAL,
  sample_rate INTEGER,
  channels INTEGER,
  format TEXT,
  file_path TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS transcriptions (
  id TEXT PRIMARY KEY,
  audio_file_id TEXT NOT NULL,
  transcript TEXT,
  language TEXT,
  confidence REAL,
  segments JSON,
  duration_ms INTEGER,
  model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (audio_file_id) REFERENCES audio_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS synthesis_tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  voice_id TEXT,
  language TEXT,
  emotion TEXT,
  status TEXT DEFAULT 'pending',
  result_file_path TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_audio_files_name ON audio_files(name);
CREATE INDEX IF NOT EXISTS idx_transcriptions_audio_id ON transcriptions(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_tasks_status ON synthesis_tasks(status);

-- ============================================================================
-- SUBSYSTEM 9: VISION & IMAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  format TEXT,
  file_path TEXT,
  thumbnail_path TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS image_embeddings (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  embedding BLOB NOT NULL,
  model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  UNIQUE(image_id, model)
);

CREATE TABLE IF NOT EXISTS image_analysis (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  analysis_type TEXT,
  result JSON,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_name ON images(name);
CREATE INDEX IF NOT EXISTS idx_image_embeddings_image_id ON image_embeddings(image_id);
CREATE INDEX IF NOT EXISTS idx_image_analysis_image_id ON image_analysis(image_id);

-- ============================================================================
-- SUBSYSTEM 10: CONFIGURATION & SECRETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  rotated_at DATETIME,
  expires_at DATETIME,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT 0,
  rollout_percentage INTEGER DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  UNIQUE(user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================================================
-- SUBSYSTEM 11: LOGGING & MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS structured_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  level TEXT NOT NULL,
  service TEXT,
  message TEXT NOT NULL,
  context JSON,
  stack_trace TEXT,
  request_id TEXT,
  user_id TEXT,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metric_name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value REAL,
  labels JSON,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown',
  last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
  check_duration_ms INTEGER,
  error_message TEXT,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS error_events (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_type TEXT NOT NULL,
  error_message TEXT,
  service TEXT,
  count INTEGER DEFAULT 1,
  first_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
  stack_trace TEXT,
  context JSON,
  resolved BOOLEAN DEFAULT 0,
  metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON structured_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON structured_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_service ON structured_logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON structured_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_events_type ON error_events(error_type);

-- ============================================================================
-- CHAT & CONVERSATION (Legacy v3 Support - Keep alongside v5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- ============================================================================
-- DATABASE METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  checksum TEXT
);

INSERT OR IGNORE INTO schema_version (version, description, checksum)
VALUES (1, 'Initial v5 enterprise schema - 11 subsystems', 'v5.0.0');

-- Create views for common queries

CREATE VIEW IF NOT EXISTS recent_errors AS
SELECT
  error_type,
  error_message,
  service,
  count,
  last_occurrence
FROM error_events
WHERE resolved = 0
ORDER BY last_occurrence DESC
LIMIT 100;

CREATE VIEW IF NOT EXISTS agent_performance AS
SELECT
  a.id,
  a.name,
  COUNT(ar.id) as total_runs,
  SUM(CASE WHEN ar.status = 'completed' THEN 1 ELSE 0 END) as successful_runs,
  AVG(CASE WHEN ar.duration_ms > 0 THEN ar.duration_ms ELSE NULL END) as avg_duration_ms,
  SUM(ar.tokens_used) as total_tokens
FROM agents a
LEFT JOIN agent_runs ar ON a.id = ar.agent_id
GROUP BY a.id;

CREATE VIEW IF NOT EXISTS job_queue_stats AS
SELECT
  queue,
  status,
  COUNT(*) as job_count,
  AVG(CASE WHEN duration_ms > 0 THEN duration_ms ELSE NULL END) as avg_duration_ms
FROM jobs
GROUP BY queue, status;

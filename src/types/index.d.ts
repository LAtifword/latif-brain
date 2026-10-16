/**
 * LATIF TypeScript Type Definitions
 * Complete type system for LATIF API and internal structures
 */

// ===== Core Types =====

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: TokenUsage;
  metadata?: Record<string, any>;
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  created: number;
  updated: number;
  metadata?: ChatMetadata;
}

export interface ChatMetadata {
  tags?: string[];
  folder?: string;
  pinned?: boolean;
  archived?: boolean;
  [key: string]: any;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  tokens: TokenUsage;
  timestamp: number;
}

// ===== AI Model Types =====

export interface Model {
  name: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  maxTokens: number;
  costPer1kTokens?: {
    prompt: number;
    completion: number;
  };
  capabilities: ModelCapability[];
  metadata?: Record<string, any>;
}

export type ModelCapability = 'chat' | 'embedding' | 'vision' | 'tools' | 'streaming';

export interface ModelParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stopSequences?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

// ===== Tool Types =====

export interface Tool {
  name: string;
  description: string;
  parameters?: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<any>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  id?: string;
}

export interface ToolResult {
  toolName: string;
  callId?: string;
  result: any;
  error?: string;
}

// ===== Memory & Knowledge Types =====

export interface MemoryEntry {
  key: string;
  value: any;
  created: number;
  updated: number;
  ttl?: number;
  tags?: string[];
}

export interface KnowledgeGraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  created: number;
  confidence?: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  weight?: number;
  created: number;
}

// ===== Agent Types =====

export interface Agent {
  name: string;
  description: string;
  type: 'planner' | 'researcher' | 'executor' | 'critic' | 'memory' | 'custom';
  model?: string;
  tools?: string[];
  systemPrompt?: string;
  config?: AgentConfig;
}

export interface AgentConfig {
  temperature?: number;
  maxIterations?: number;
  maxTokens?: number;
  timeout?: number;
  [key: string]: any;
}

export interface AgentTask {
  goal: string;
  context?: Record<string, any>;
  constraints?: string[];
  tools?: string[];
}

export interface AgentResult {
  status: 'completed' | 'failed' | 'timeout';
  result?: any;
  error?: string;
  iterations: number;
  tokensUsed: number;
}

// ===== Workflow Types =====

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers: WorkflowTrigger[];
  created: number;
  updated: number;
}

export interface WorkflowNode {
  id: string;
  type: 'task' | 'condition' | 'parallel' | 'merge';
  name: string;
  config: Record<string, any>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  config: Record<string, any>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  nodeRuns: NodeRun[];
  results?: Record<string, any>;
  error?: string;
}

export interface NodeRun {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  duration: number;
}

// ===== Plugin Types =====

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author: string;
  license?: string;
  requiredVersion?: string;
  capabilities?: PluginCapabilities;
  permissions?: PluginPermissions;
  config?: Record<string, any>;
}

export interface PluginCapabilities {
  tools?: string[];
  models?: string[];
  hooks?: string[];
  ui?: string[];
  api?: string[];
}

export interface PluginPermissions {
  memory?: ('read' | 'write' | 'delete')[];
  network?: string[];
  tools?: string[];
  models?: string[];
  ui?: ('sidebar' | 'modal' | 'settings')[];
}

export interface PluginContext {
  getModels(): Promise<Model[]>;
  runModel(modelName: string, params: ModelParams): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
  readMemory(key: string): Promise<any>;
  writeMemory(key: string, value: any): Promise<void>;
  registerTool(name: string, tool: Tool): void;
  registerHook(hookName: string, handler: Function): void;
  registerComponent(name: string, component: any): void;
  emit(eventName: string, data: any): void;
  on(eventName: string, handler: Function): void;
}

// ===== API Request/Response Types =====

export interface ChatRequest {
  messages: Message[];
  model: string;
  params?: ModelParams;
}

export interface ChatStreamResponse {
  type: 'start' | 'chunk' | 'complete' | 'error';
  content?: string;
  totalTokens?: number;
  error?: string;
}

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

// ===== Config Types =====

export interface LatifConfig {
  models?: ModelConfig[];
  ollama?: OllamaConfig;
  plugins?: PluginConfig[];
  memory?: MemoryConfig;
  api?: APIConfig;
  ui?: UIConfig;
  [key: string]: any;
}

export interface ModelConfig {
  name: string;
  endpoint?: string;
  apiKey?: string;
  [key: string]: any;
}

export interface OllamaConfig {
  baseURL: string;
  models: string[];
  timeout?: number;
}

export interface PluginConfig {
  id: string;
  enabled: boolean;
  source: string;
  config?: Record<string, any>;
}

export interface MemoryConfig {
  storage: 'indexeddb' | 'localstorage' | 'memory';
  maxSize?: number;
  ttl?: number;
}

export interface APIConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
  rateLimit?: RateLimitConfig;
  authentication?: AuthConfig;
}

export interface RateLimitConfig {
  window: number;
  maxRequests: number;
}

export interface AuthConfig {
  type: 'none' | 'apikey' | 'jwt';
  secretKey?: string;
}

export interface UIConfig {
  theme?: 'light' | 'dark' | 'auto';
  layout?: 'sidebar' | 'tabs' | 'split';
  plugins?: boolean;
  [key: string]: any;
}

// ===== Event Types =====

export type LatifEvent =
  | { type: 'chat:started'; data: { chatId: string; model: string } }
  | { type: 'chat:message'; data: { chatId: string; message: Message } }
  | { type: 'chat:completed'; data: { chatId: string; duration: number } }
  | { type: 'memory:updated'; data: { key: string; value: any } }
  | { type: 'workflow:started'; data: { workflowId: string; runId: string } }
  | { type: 'workflow:completed'; data: { workflowId: string; runId: string } }
  | { type: 'error'; data: { error: APIError } };

export interface EventListener {
  (event: LatifEvent): void | Promise<void>;
}

// ===== Utility Types =====

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

export interface Paginate {
  skip?: number;
  limit?: number;
}

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Partial<T> = { [P in keyof T]?: T[P] };
export type Required<T> = { [P in keyof T]-?: T[P] };

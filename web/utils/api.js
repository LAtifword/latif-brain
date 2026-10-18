/**
 * LATIF HTTP API Client
 * Single-source REST client for all backend communication
 * Replaces local AI logic with centralized backend APIs
 */

export class APIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.isConnected = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.cache = new Map();
  }

  /**
   * Core HTTP Methods
   */

  async request(method, endpoint, body = null, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const config = {
      method,
      headers,
      signal: options.signal
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await new Promise(r => setTimeout(r, this.retryDelay * attempt));
      }
    }
  }

  async get(endpoint, options = {}) {
    // Check cache first
    if (options.cache && this.cache.has(endpoint)) {
      return this.cache.get(endpoint);
    }

    const response = await this.request('GET', endpoint, null, options);
    const data = await response.json();

    // Cache if requested
    if (options.cache) {
      this.cache.set(endpoint, data);
      setTimeout(() => this.cache.delete(endpoint), options.cacheTTL || 60000);
    }

    return data;
  }

  async post(endpoint, body, options = {}) {
    const response = await this.request('POST', endpoint, body, options);
    return response.json();
  }

  async put(endpoint, body, options = {}) {
    const response = await this.request('PUT', endpoint, body, options);
    return response.json();
  }

  async delete(endpoint, options = {}) {
    const response = await this.request('DELETE', endpoint, null, options);
    return response.ok ? { success: true } : response.json();
  }

  async stream(method, endpoint, body = null) {
    const response = await this.request(method, endpoint, body);
    return response.body.getReader();
  }

  /**
   * Chat Operations
   */

  async sendMessage(chatId, content, options = {}) {
    const messages = options.messages || [{ role: 'user', content }];
    const model = options.model || 'qwen2.5:1.5b';
    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 2048;

    return this.post('/api/chat', {
      chatId,
      messages,
      model,
      temperature,
      maxTokens,
      stream: false
    });
  }

  async streamMessage(chatId, content, options = {}) {
    const messages = options.messages || [{ role: 'user', content }];
    const model = options.model || 'qwen2.5:1.5b';

    return this.stream('POST', '/api/chat/stream', {
      chatId,
      messages,
      model,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2048
    });
  }

  async getChats(limit = 50, offset = 0) {
    return this.get(`/api/chats?limit=${limit}&offset=${offset}`, {
      cache: false  // Chat list changes frequently
    });
  }

  async getChat(chatId) {
    return this.get(`/api/chats/${chatId}`, {
      cache: true,
      cacheTTL: 30000
    });
  }

  async createChat(title = 'New Chat') {
    return this.post('/api/chats', { title });
  }

  async updateChat(chatId, updates) {
    return this.put(`/api/chats/${chatId}`, updates);
  }

  async deleteChat(chatId) {
    return this.delete(`/api/chats/${chatId}`);
  }

  async getMessages(chatId, offset = 0, limit = 50) {
    return this.get(
      `/api/chats/${chatId}/messages?offset=${offset}&limit=${limit}`,
      { cache: false }
    );
  }

  async updateMessage(messageId, updates) {
    return this.put(`/api/messages/${messageId}`, updates);
  }

  async deleteMessage(messageId) {
    return this.delete(`/api/messages/${messageId}`);
  }

  /**
   * Agent Operations
   */

  async getAgents() {
    return this.get('/api/agents', {
      cache: true,
      cacheTTL: 60000
    });
  }

  async executeAgent(agentId, task, context = {}) {
    return this.post(`/api/agents/${agentId}/execute`, {
      task,
      context
    });
  }

  async getAgentState(agentId) {
    return this.get(`/api/agents/${agentId}/state`);
  }

  async getAgentMemory(agentId, sessionId, memoryType) {
    return this.get(
      `/api/agents/${agentId}/memory?sessionId=${sessionId}&memoryType=${memoryType}`
    );
  }

  async saveAgentMemory(agentId, sessionId, memoryType, key, value, ttl = null) {
    return this.post(`/api/agents/${agentId}/memory`, {
      sessionId,
      memoryType,
      key,
      value,
      ttl
    });
  }

  /**
   * RAG & Search Operations
   */

  async search(query, options = {}) {
    return this.post('/api/search/hybrid', {
      query,
      limit: options.limit || 10,
      model: options.model || 'bge-small',
      threshold: options.threshold || 0.5
    });
  }

  async rerank(results, query, topK = 5) {
    return this.post('/api/search/rerank', {
      results,
      query,
      topK
    });
  }

  async getSearchCache() {
    return this.get('/api/search/cache/stats');
  }

  /**
   * Knowledge Graph Operations
   */

  async addEntity(type, name, attributes = {}) {
    return this.post('/api/knowledge/nodes', {
      type,
      name,
      attributes
    });
  }

  async getEntity(nodeId) {
    return this.get(`/api/knowledge/nodes/${nodeId}`);
  }

  async removeEntity(nodeId) {
    return this.delete(`/api/knowledge/nodes/${nodeId}`);
  }

  async queryKnowledge(pattern) {
    return this.post('/api/knowledge/query', { pattern });
  }

  async addRelationship(sourceId, targetId, type, weight = 1.0) {
    return this.post('/api/knowledge/edges', {
      sourceId,
      targetId,
      type,
      weight
    });
  }

  async updateRelationship(edgeId, weight, evidence = []) {
    return this.put(`/api/knowledge/edges/${edgeId}`, {
      weight,
      evidence
    });
  }

  /**
   * Model Operations
   */

  async getModels() {
    return this.get('/api/models', {
      cache: true,
      cacheTTL: 30000
    });
  }

  async getModel(modelName) {
    return this.get(`/api/models/${modelName}`, {
      cache: true,
      cacheTTL: 60000
    });
  }

  /**
   * Workflow Operations
   */

  async createWorkflow(definition) {
    return this.post('/api/workflows', definition);
  }

  async getWorkflows() {
    return this.get('/api/workflows');
  }

  async getWorkflow(workflowId) {
    return this.get(`/api/workflows/${workflowId}`);
  }

  async executeWorkflow(workflowId, inputs = {}) {
    return this.post(`/api/workflows/${workflowId}/execute`, { inputs });
  }

  async getWorkflowRuns(workflowId, limit = 50) {
    return this.get(`/api/workflows/${workflowId}/runs?limit=${limit}`);
  }

  /**
   * Vision Operations
   */

  async processImage(imageData, task = 'analyze') {
    return this.post('/api/vision/process', {
      imageData,
      task
    });
  }

  async findSimilarImages(imageId, limit = 5) {
    return this.get(`/api/vision/similar/${imageId}?limit=${limit}`);
  }

  /**
   * Audio Operations
   */

  async transcribeAudio(audioData) {
    return this.post('/api/audio/transcribe', { audioData });
  }

  async synthesizeSpeech(text, voice = 'default') {
    return this.post('/api/audio/synthesize', {
      text,
      voice
    });
  }

  /**
   * System Operations
   */

  async checkHealth() {
    try {
      const response = await this.get('/api/health', {
        cache: false
      });
      this.isConnected = response.status === 'ok';
      return response;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  async getStats() {
    return this.get('/api/stats', {
      cache: false
    });
  }

  async getLogs(limit = 50) {
    return this.get(`/api/logs?limit=${limit}`);
  }

  /**
   * File Operations
   */

  async uploadFile(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', options.chatId || '');

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async processFile(fileId, operation) {
    return this.post(`/api/files/${fileId}/process`, {
      operation
    });
  }

  /**
   * Utility Methods
   */

  clearCache() {
    this.cache.clear();
  }

  setRetryPolicy(attempts, delayMs) {
    this.retryAttempts = attempts;
    this.retryDelay = delayMs;
  }

  isOnline() {
    return this.isConnected;
  }
}

// Export singleton instance
export const api = new APIClient();

// Export class for testing/multiple instances
export default APIClient;

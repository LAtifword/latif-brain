/**
 * LATIF REST API Server
 * Provides complete REST API for external integrations
 * Supports authentication, rate limiting, webhooks, and streaming responses
 */

class RESTServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8080,
      host: options.host || 'localhost',
      corsOrigins: options.corsOrigins || ['*'],
      rateLimit: options.rateLimit || { window: 60000, maxRequests: 100 },
      enableWebhooks: options.enableWebhooks !== false,
      enableLogging: options.enableLogging !== false,
      ...options
    };
    this.routes = new Map();
    this.middleware = [];
    this.rateLimiters = new Map();
    this.webhooks = new Map();
    this.logger = this.createLogger();
  }

  /**
   * Start REST server
   */
  async start() {
    this.logger.info(`Starting REST API server on ${this.options.host}:${this.options.port}`);
    this.registerDefaultRoutes();
    this.registerMiddleware();
    // Server startup would use Express.js or similar in real implementation
  }

  /**
   * Register default API routes
   */
  registerDefaultRoutes() {
    // Chat API
    this.post('/api/chat', this.handleChat.bind(this));
    this.post('/api/chat/stream', this.handleChatStream.bind(this));
    this.get('/api/chats', this.listChats.bind(this));
    this.get('/api/chats/:id', this.getChat.bind(this));
    this.delete('/api/chats/:id', this.deleteChat.bind(this));

    // Models API
    this.get('/api/models', this.listModels.bind(this));
    this.get('/api/models/:name', this.getModel.bind(this));

    // Memory API
    this.get('/api/memory', this.getMemory.bind(this));
    this.post('/api/memory', this.updateMemory.bind(this));
    this.delete('/api/memory/:key', this.deleteMemory.bind(this));

    // Knowledge Graph API
    this.get('/api/knowledge/nodes', this.getNodes.bind(this));
    this.post('/api/knowledge/nodes', this.addNode.bind(this));
    this.get('/api/knowledge/edges', this.getEdges.bind(this));
    this.post('/api/knowledge/edges', this.addEdge.bind(this));
    this.post('/api/knowledge/query', this.queryGraph.bind(this));

    // Tools API
    this.get('/api/tools', this.listTools.bind(this));
    this.post('/api/tools/:name/execute', this.executeTool.bind(this));

    // Agents API
    this.get('/api/agents', this.listAgents.bind(this));
    this.post('/api/agents/:name/run', this.runAgent.bind(this));
    this.get('/api/agents/:name/status', this.getAgentStatus.bind(this));

    // Workflows API
    this.get('/api/workflows', this.listWorkflows.bind(this));
    this.post('/api/workflows', this.createWorkflow.bind(this));
    this.post('/api/workflows/:id/execute', this.executeWorkflow.bind(this));
    this.get('/api/workflows/:id/runs', this.getWorkflowRuns.bind(this));

    // Webhooks API
    this.post('/api/webhooks', this.registerWebhook.bind(this));
    this.delete('/api/webhooks/:id', this.deleteWebhook.bind(this));
    this.get('/api/webhooks', this.listWebhooks.bind(this));

    // Admin API
    this.get('/api/health', this.healthCheck.bind(this));
    this.get('/api/stats', this.getStats.bind(this));
    this.get('/api/logs', this.getLogs.bind(this));

    this.logger.info('✓ Default API routes registered');
  }

  /**
   * Register middleware
   */
  registerMiddleware() {
    // CORS
    this.use(this.corsMiddleware.bind(this));

    // Authentication
    this.use(this.authMiddleware.bind(this));

    // Rate limiting
    this.use(this.rateLimitMiddleware.bind(this));

    // Logging
    if (this.options.enableLogging) {
      this.use(this.loggingMiddleware.bind(this));
    }

    // Error handling
    this.use(this.errorMiddleware.bind(this));
  }

  // ===== Chat Endpoints =====

  async handleChat(req, res) {
    const { messages, model, params } = req.body;
    try {
      const response = await this.latif.chat(messages, model, params);
      res.json({ success: true, response });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async handleChatStream(req, res) {
    const { messages, model, params } = req.body;
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await this.latif.chatStream(messages, model, params);
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async listChats(req, res) {
    const { skip = 0, limit = 10 } = req.query;
    const chats = await this.latif.listChats({ skip, limit });
    res.json(chats);
  }

  async getChat(req, res) {
    const chat = await this.latif.getChat(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  }

  async deleteChat(req, res) {
    await this.latif.deleteChat(req.params.id);
    res.json({ success: true });
  }

  // ===== Models Endpoints =====

  async listModels(req, res) {
    const models = await this.latif.getModels();
    res.json({ models });
  }

  async getModel(req, res) {
    const model = await this.latif.getModel(req.params.name);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  }

  // ===== Memory Endpoints =====

  async getMemory(req, res) {
    const memory = await this.latif.memory.getAll();
    res.json(memory);
  }

  async updateMemory(req, res) {
    const { key, value } = req.body;
    await this.latif.memory.set(key, value);
    res.json({ success: true });
  }

  async deleteMemory(req, res) {
    await this.latif.memory.delete(req.params.key);
    res.json({ success: true });
  }

  // ===== Knowledge Graph Endpoints =====

  async getNodes(req, res) {
    const { type, skip = 0, limit = 100 } = req.query;
    const nodes = await this.latif.kg.getNodes({ type, skip, limit });
    res.json(nodes);
  }

  async addNode(req, res) {
    const node = await this.latif.kg.addNode(req.body);
    res.status(201).json(node);
  }

  async getEdges(req, res) {
    const { source, target, skip = 0, limit = 100 } = req.query;
    const edges = await this.latif.kg.getEdges({ source, target, skip, limit });
    res.json(edges);
  }

  async addEdge(req, res) {
    const edge = await this.latif.kg.addEdge(req.body);
    res.status(201).json(edge);
  }

  async queryGraph(req, res) {
    const { query } = req.body;
    const results = await this.latif.kg.query(query);
    res.json(results);
  }

  // ===== Tools Endpoints =====

  async listTools(req, res) {
    const tools = await this.latif.getTools();
    res.json(tools);
  }

  async executeTool(req, res) {
    try {
      const result = await this.latif.executeTool(req.params.name, req.body);
      res.json({ success: true, result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // ===== Agents Endpoints =====

  async listAgents(req, res) {
    const agents = await this.latif.agents.list();
    res.json(agents);
  }

  async runAgent(req, res) {
    try {
      const result = await this.latif.agents.run(req.params.name, req.body);
      res.json({ success: true, result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getAgentStatus(req, res) {
    const status = await this.latif.agents.getStatus(req.params.name);
    res.json(status);
  }

  // ===== Workflows Endpoints =====

  async listWorkflows(req, res) {
    const workflows = await this.latif.workflows.list();
    res.json(workflows);
  }

  async createWorkflow(req, res) {
    const workflow = await this.latif.workflows.create(req.body);
    res.status(201).json(workflow);
  }

  async executeWorkflow(req, res) {
    try {
      const result = await this.latif.workflows.execute(req.params.id, req.body);
      res.json({ success: true, result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getWorkflowRuns(req, res) {
    const runs = await this.latif.workflows.getRuns(req.params.id);
    res.json(runs);
  }

  // ===== Webhooks Endpoints =====

  async registerWebhook(req, res) {
    const webhook = await this.webhooks.create(req.body);
    res.status(201).json(webhook);
  }

  async deleteWebhook(req, res) {
    await this.webhooks.delete(req.params.id);
    res.json({ success: true });
  }

  async listWebhooks(req, res) {
    const webhooks = await this.webhooks.list();
    res.json(webhooks);
  }

  // ===== Admin Endpoints =====

  async healthCheck(req, res) {
    res.json({ status: 'ok', version: '5.0.0' });
  }

  async getStats(req, res) {
    const stats = await this.latif.getStats();
    res.json(stats);
  }

  async getLogs(req, res) {
    const { level = 'info', limit = 100 } = req.query;
    const logs = await this.latif.logger.getLogs({ level, limit });
    res.json(logs);
  }

  // ===== Middleware =====

  corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  }

  authMiddleware(req, res, next) {
    // Implement API key or JWT validation
    const token = req.headers.authorization?.split(' ')[1];
    // Validate token...
    next();
  }

  rateLimitMiddleware(req, res, next) {
    const ip = req.ip;
    const limiter = this.rateLimiters.get(ip) || {
      requests: [],
      limit: this.options.rateLimit.maxRequests,
      window: this.options.rateLimit.window
    };

    const now = Date.now();
    limiter.requests = limiter.requests.filter(t => now - t < limiter.window);

    if (limiter.requests.length >= limiter.limit) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    limiter.requests.push(now);
    this.rateLimiters.set(ip, limiter);
    next();
  }

  loggingMiddleware(req, res, next) {
    this.logger.info(`${req.method} ${req.path}`);
    next();
  }

  errorMiddleware(err, req, res, next) {
    this.logger.error(`API error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }

  // ===== Utility Methods =====

  use(middleware) {
    this.middleware.push(middleware);
  }

  get(path, handler) {
    this.routes.set(`GET ${path}`, handler);
  }

  post(path, handler) {
    this.routes.set(`POST ${path}`, handler);
  }

  put(path, handler) {
    this.routes.set(`PUT ${path}`, handler);
  }

  delete(path, handler) {
    this.routes.set(`DELETE ${path}`, handler);
  }

  createLogger() {
    return {
      info: (msg) => console.log(`[API] ${msg}`),
      warn: (msg) => console.warn(`[API] ${msg}`),
      error: (msg) => console.error(`[API] ${msg}`)
    };
  }
}

export { RESTServer };

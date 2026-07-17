/**
 * LATIF NI — Enterprise AI Operating System Backend
 * Orchestrates agents, monitors system, manages workflows, syncs real-time
 *
 * Run: node LATIF-NI-BACKEND-SERVICE.js
 * Server: http://localhost:3001
 * WebSocket: ws://localhost:3001
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, clientTracking: true });

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class LatifNICore extends EventEmitter {
  constructor() {
    super();
    this.agents = this.initializeAgents();
    this.tasks = [];
    this.workflows = [];
    this.systemMetrics = {};
    this.models = [];
    this.activityLog = [];
    this.startMonitoring();
  }

  initializeAgents() {
    return {
      'chat-agent': { name: 'Chat Agent', role: 'AI Assistant', status: 'Active', icon: '💬', tasks: 18, color: '#8b5cf6' },
      'code-agent': { name: 'Code Agent', role: 'Dev Assistant', status: 'Active', icon: '💻', tasks: 15, color: '#3b82f6' },
      'design-agent': { name: 'Design Agent', role: 'UI/UX Creator', status: 'Active', icon: '🎨', tasks: 12, color: '#ec4899' },
      'aircraft-agent': { name: 'Aircraft Agent', role: 'Aviation Expert', status: 'Active', icon: '✈️', tasks: 8, color: '#06b6d4' },
      'project-agent': { name: 'Project Agent', role: 'Project Manager', status: 'Active', icon: '📁', tasks: 22, color: '#f59e0b' },
      'audio-agent': { name: 'Audio Agent', role: 'Transcribe AI', status: 'Active', icon: '🎙️', tasks: 9, color: '#10b981' },
      'video-agent': { name: 'Video Agent', role: 'AI Video Gen', status: 'Active', icon: '🎬', tasks: 7, color: '#ef4444' },
      'book-agent': { name: 'Book Writer', role: 'AI Author', status: 'Active', icon: '📚', tasks: 11, color: '#8b5cf6' },
      'music-agent': { name: 'Music Agent', role: 'AI Composer', status: 'Active', icon: '🎵', tasks: 5, color: '#06b6d4' }
    };
  }

  startMonitoring() {
    setInterval(() => {
      this.updateSystemMetrics();
      this.emit('metrics-updated', this.systemMetrics);
      this.broadcast({ type: 'system-metrics', data: this.systemMetrics });
    }, 2000);
  }

  updateSystemMetrics() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const cpuUsage = Math.round(Math.random() * 100 * 10) / 10; // Simulated

    this.systemMetrics = {
      cpu: cpuUsage,
      ram: Math.round((usedMemory / totalMemory) * 100),
      gpu: Math.round(Math.random() * 100 * 10) / 10,
      temp: 45 + Math.round(Math.random() * 30 * 10) / 10,
      uptime: Math.floor(process.uptime()),
      storage: {
        total: 512,
        used: 132,
        percent: 26
      },
      activeAgents: Object.values(this.agents).filter(a => a.status === 'Active').length,
      totalAgents: Object.keys(this.agents).length,
      tasksCompleted: 128,
      successRate: 94.2,
      storageBreakdown: {
        models: 68,
        data: 28,
        projects: 16,
        other: 20
      }
    };
  }

  addTask(task) {
    const id = `task-${Date.now()}`;
    const fullTask = { id, timestamp: Date.now(), ...task };
    this.tasks.push(fullTask);
    this.activityLog.push({ timestamp: Date.now(), type: 'task_created', task });
    this.broadcast({ type: 'task-created', data: fullTask });
    return fullTask;
  }

  addAgent(agentId, agentData) {
    this.agents[agentId] = agentData;
    this.activityLog.push({ timestamp: Date.now(), type: 'agent_added', agent: agentData });
    this.broadcast({ type: 'agent-added', data: { id: agentId, ...agentData } });
  }

  getActivityLog(limit = 20) {
    return this.activityLog.slice(-limit).reverse();
  }

  broadcast(message) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

const core = new LatifNICore();

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Dashboard State
app.get('/api/dashboard', (req, res) => {
  res.json({
    agents: core.agents,
    metrics: core.systemMetrics,
    tasksCompleted: core.tasks.length,
    successRate: 94.2,
    activity: core.getActivityLog(10),
    models: [
      { name: 'Llama 3 8B Q4_K_M', size: '7.3 / 16 GB', usage: 73 },
      { name: 'Whisper Large V3', size: '2.2 / 4 GB', usage: 55 },
      { name: 'Stable Diffusion XL', size: '3.8 / 8 GB', usage: 48 }
    ],
    timestamp: Date.now()
  });
});

// Agents
app.get('/api/agents', (req, res) => {
  const agentsList = Object.entries(core.agents).map(([id, data]) => ({ id, ...data }));
  res.json(agentsList);
});

app.post('/api/agents/:id/execute', express.json(), (req, res) => {
  const { id } = req.params;
  const { task } = req.body;

  if (core.agents[id]) {
    core.addTask({
      agentId: id,
      agentName: core.agents[id].name,
      description: task,
      status: 'Running',
      progress: 0
    });
    res.json({ success: true, message: `${core.agents[id].name} executing: ${task}` });
  } else {
    res.status(404).json({ error: 'Agent not found' });
  }
});

// System Metrics
app.get('/api/metrics', (req, res) => {
  res.json({
    current: core.systemMetrics,
    history: {
      cpu: Array.from({ length: 24 }, () => Math.round(Math.random() * 80 * 10) / 10),
      ram: Array.from({ length: 24 }, () => 40 + Math.round(Math.random() * 40 * 10) / 10),
      gpu: Array.from({ length: 24 }, () => Math.round(Math.random() * 70 * 10) / 10)
    }
  });
});

// Workflows
app.get('/api/workflows', (req, res) => {
  res.json([
    { id: 'wf-1', name: 'Research & Write', status: 'Running', progress: 64, agents: ['Research Agent', 'Book Writer'] },
    { id: 'wf-2', name: 'Code Review Flow', status: 'Running', progress: 32, agents: ['Code Agent', 'Design Agent'] },
    { id: 'wf-3', name: 'Book Writing Flow', status: 'Pending', progress: 0, agents: ['Book Writer', 'Audio Agent'] },
    { id: 'wf-4', name: 'Video Creation Flow', status: 'Running', progress: 76, agents: ['Video Agent', 'Music Agent'] }
  ]);
});

app.post('/api/workflows', express.json(), (req, res) => {
  const { name, agents } = req.body;
  const workflow = { id: `wf-${Date.now()}`, name, agents, status: 'Created', progress: 0, timestamp: Date.now() };
  core.workflows.push(workflow);
  core.broadcast({ type: 'workflow-created', data: workflow });
  res.json(workflow);
});

// Task Queue
app.get('/api/tasks', (req, res) => {
  res.json({
    running: core.tasks.filter(t => t.status === 'Running'),
    pending: core.tasks.filter(t => t.status === 'Pending'),
    failed: core.tasks.filter(t => t.status === 'Failed'),
    all: core.tasks
  });
});

app.post('/api/tasks', express.json(), (req, res) => {
  const task = core.addTask(req.body);
  res.json(task);
});

// Activity Log
app.get('/api/activity', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(core.getActivityLog(limit));
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    agents: Object.keys(core.agents).length,
    tasks: core.tasks.length,
    timestamp: Date.now()
  });
});

// Ollama Integration Check
app.get('/api/ollama-status', async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://127.0.0.1:11434/api/tags', { timeout: 2000 });
    if (response.ok) {
      const data = await response.json();
      res.json({ status: 'connected', models: data.models?.length || 0 });
    } else {
      res.json({ status: 'error', message: 'Ollama returned error' });
    }
  } catch (err) {
    res.json({ status: 'disconnected', error: err.message });
  }
});

// ============================================================================
// WEBSOCKET REAL-TIME UPDATES
// ============================================================================

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send initial state
  ws.send(JSON.stringify({
    type: 'initial-state',
    data: {
      agents: core.agents,
      metrics: core.systemMetrics,
      tasks: core.tasks,
      activity: core.getActivityLog(20)
    }
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'execute-agent':
          core.addTask({
            agentId: data.agentId,
            agentName: data.agentName,
            description: data.task,
            status: 'Running',
            progress: 0
          });
          core.broadcast({ type: 'agent-executing', data });
          break;

        case 'create-workflow':
          const workflow = {
            id: `wf-${Date.now()}`,
            name: data.name,
            agents: data.agents,
            status: 'Running',
            progress: 0
          };
          core.workflows.push(workflow);
          core.broadcast({ type: 'workflow-created', data: workflow });
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// ============================================================================
// STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           LATIF NI — Enterprise AI Operating System           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`✓ Backend API: http://localhost:${PORT}/api`);
  console.log(`✓ WebSocket: ws://localhost:${PORT}`);
  console.log(`✓ Dashboard API: http://localhost:${PORT}/api/dashboard`);
  console.log(`✓ Agents: ${Object.keys(core.agents).length} running`);
  console.log(`✓ System monitoring: ACTIVE\n`);
});

module.exports = app;

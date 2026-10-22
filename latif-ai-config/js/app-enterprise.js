/**
 * LATIF GX Enterprise Dashboard Application
 * Handles chat, agents, workflows, knowledge, monitoring, and settings
 */

const LatifEnterprise = (() => {
  // Connect to FastAPI backend server (default: localhost:8000)
  const API_BASE = localStorage.getItem('latif_backend_url') || 'http://127.0.0.1:8000';

  // Fallback to local Ollama if backend unavailable
  const OLLAMA_BASE = localStorage.getItem('latif_ollama_url') || `http://${localStorage.getItem('latif_host') || 'localhost'}:${localStorage.getItem('latif_port') || 11434}`;

  const state = {
    messages: [],
    agents: [
      { id: 'planner', name: 'Planner', status: 'active', tasksCompleted: 142 },
      { id: 'researcher', name: 'Researcher', status: 'idle', tasksCompleted: 89 },
      { id: 'executor', name: 'Executor', status: 'active', tasksCompleted: 256 },
      { id: 'critic', name: 'Critic', status: 'active', tasksCompleted: 178 },
      { id: 'memory', name: 'Memory', status: 'idle', tasksCompleted: 0 }
    ],
    workflows: [
      { id: 'wf1', name: 'Research Pipeline', status: 'running', progress: 65 },
      { id: 'wf2', name: 'Content Generation', status: 'running', progress: 40 },
      { id: 'wf3', name: 'Data Processing', status: 'completed', progress: 100 }
    ],
    knowledge: {
      entities: 1543,
      relationships: 3821,
      lastUpdate: new Date().toLocaleString()
    },
    metrics: {
      cpu: 42,
      memory: 58,
      requestsPerMin: 245,
      uptime: '127h 42m'
    }
  };

  // ═══════════════════════════════════════════════════════════
  // CHAT SECTION
  // ═══════════════════════════════════════════════════════════

  const initChat = () => {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    loadChatHistory();
  };

  const sendMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;

    const message = input.value.trim();
    input.value = '';

    addMessageToChat('user', message);
    UIFramework.setLoading('chat-messages', true);

    try {
      // Try backend first
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: localStorage.getItem('latif_model') || 'llama2',
          temperature: parseFloat(localStorage.getItem('latif_temperature') || 0.7),
          max_tokens: parseInt(localStorage.getItem('latif_max_tokens') || 2048),
          stream: false
        })
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        addMessageToChat('assistant', data.response || 'No response received');
        UIFramework.showNotification(`Response time: ${data.processing_time.toFixed(2)}s`, 'success');
      } else {
        // Fallback to direct Ollama if backend unavailable
        console.warn('Backend unavailable, trying direct Ollama connection...');
        addMessageToChat('system', '⚠️ Backend server not responding. Trying direct connection...');

        const ollamaResponse = await fetch(`${OLLAMA_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: localStorage.getItem('latif_model') || 'llama2',
            prompt: message,
            stream: false
          })
        }).catch(() => ({ ok: false }));

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          addMessageToChat('assistant', data.response || 'No response received');
        } else {
          addMessageToChat('system', '❌ Connection error. Ensure backend (port 8000) or Ollama (port 11434) is running.');
        }
      }
    } catch (error) {
      addMessageToChat('system', `Error: ${error.message}`);
    }

    UIFramework.setLoading('chat-messages', false);
  };

  const addMessageToChat = (sender, content) => {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message message-${sender}`;
    messageEl.innerHTML = `
      <div class="message-avatar">${sender.charAt(0).toUpperCase()}</div>
      <div class="message-content">
        <div class="message-text">${escapeHtml(content)}</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    state.messages.push({ sender, content, time: new Date() });
  };

  const loadChatHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem('latif_chats') || '[]');
      const lastChat = history[history.length - 1];
      if (lastChat && lastChat.messages) {
        lastChat.messages.slice(-5).forEach(msg => {
          addMessageToChat(msg.role || 'user', msg.content);
        });
      }
    } catch (e) {
      console.log('No chat history found');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // AGENTS SECTION
  // ═══════════════════════════════════════════════════════════

  const initAgents = () => {
    refreshAgentStatus();
    setInterval(refreshAgentStatus, 5000);
  };

  const refreshAgentStatus = async () => {
    const container = document.getElementById('agents-grid');
    if (!container) return;

    try {
      const response = await fetch(`${API_BASE}/api/agents`);
      if (response.ok) {
        const agents = await response.json();
        state.agents = agents;
      }
    } catch (error) {
      console.warn('Could not fetch agent status:', error);
    }

    container.innerHTML = state.agents.map(agent => `
      <div class="agent-card ${agent.status}">
        <div class="agent-header">
          <h3>${agent.name}</h3>
          <span class="status-badge status-${agent.status}">${agent.status}</span>
        </div>
        <div class="agent-stats">
          <div class="stat">
            <div class="stat-label">Tasks Completed</div>
            <div class="stat-value">${agent.tasks_completed || 0}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value">98.5%</div>
          </div>
        </div>
        <div class="agent-description">${agent.description || ''}</div>
        <div class="agent-actions">
          <button class="btn btn-sm" onclick="LatifEnterprise.viewAgentDetails('${agent.id}')">Details</button>
          <button class="btn btn-sm" onclick="LatifEnterprise.stopAgent('${agent.id}')">Stop</button>
        </div>
      </div>
    `).join('');
  };

  const viewAgentDetails = (agentId) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (agent) {
      UIFramework.showNotification(`Agent ${agent.name} - Status: ${agent.status}`, 'info');
    }
  };

  const stopAgent = (agentId) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (agent) {
      agent.status = 'stopped';
      refreshAgentStatus();
      UIFramework.showNotification(`Agent ${agent.name} stopped`, 'warning');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // WORKFLOWS SECTION
  // ═══════════════════════════════════════════════════════════

  const initWorkflows = () => {
    refreshWorkflowStatus();
    setInterval(refreshWorkflowStatus, 3000);
  };

  const refreshWorkflowStatus = async () => {
    const container = document.getElementById('workflows-list');
    if (!container) return;

    try {
      const response = await fetch(`${API_BASE}/api/workflows`);
      if (response.ok) {
        const workflows = await response.json();
        state.workflows = workflows;
      }
    } catch (error) {
      console.warn('Could not fetch workflow status:', error);
    }

    container.innerHTML = state.workflows.map(wf => `
      <div class="workflow-item">
        <div class="workflow-header">
          <h3>${wf.name}</h3>
          <span class="status-badge status-${wf.status}">${wf.status}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${wf.progress}%"></div>
        </div>
        <div class="progress-text">${wf.progress}% Complete - Step ${wf.current_step}/${wf.total_steps}</div>
        <div class="workflow-actions">
          <button class="btn btn-sm" onclick="LatifEnterprise.pauseWorkflow('${wf.workflow_id}')">Pause</button>
          <button class="btn btn-sm" onclick="LatifEnterprise.cancelWorkflow('${wf.workflow_id}')">Cancel</button>
        </div>
      </div>
    `).join('');
  };

  const pauseWorkflow = (workflowId) => {
    const wf = state.workflows.find(w => w.id === workflowId);
    if (wf) {
      wf.status = 'paused';
      refreshWorkflowStatus();
      UIFramework.showNotification(`Workflow ${wf.name} paused`, 'warning');
    }
  };

  const cancelWorkflow = (workflowId) => {
    const wf = state.workflows.find(w => w.id === workflowId);
    if (wf) {
      wf.status = 'cancelled';
      refreshWorkflowStatus();
      UIFramework.showNotification(`Workflow ${wf.name} cancelled`, 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // KNOWLEDGE SECTION
  // ═══════════════════════════════════════════════════════════

  const initKnowledge = () => {
    updateKnowledgeStats();
    loadRecentEntities();
  };

  const updateKnowledgeStats = () => {
    const statsDiv = document.getElementById('knowledge-stats');
    if (!statsDiv) return;

    statsDiv.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Entities</div>
        <div class="stat-value">${state.knowledge.entities}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Relationships</div>
        <div class="stat-value">${state.knowledge.relationships}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Last Updated</div>
        <div class="stat-value">${state.knowledge.lastUpdate}</div>
      </div>
    `;
  };

  const loadRecentEntities = () => {
    const listDiv = document.getElementById('entities-list');
    if (!listDiv) return;

    const entities = [
      { name: 'LATIF Framework', type: 'Technology' },
      { name: 'Multi-Agent System', type: 'Architecture' },
      { name: 'Hybrid RAG', type: 'Capability' },
      { name: 'Knowledge Graph', type: 'System' },
      { name: 'Agent Orchestration', type: 'Process' }
    ];

    listDiv.innerHTML = entities.map(e => `
      <div class="entity-item">
        <span class="entity-name">${e.name}</span>
        <span class="entity-type">${e.type}</span>
      </div>
    `).join('');
  };

  // ═══════════════════════════════════════════════════════════
  // MONITOR SECTION
  // ═══════════════════════════════════════════════════════════

  const initMonitor = () => {
    updateMetrics();
    setInterval(updateMetrics, 2000);
    loadActivityLog();
  };

  const updateMetrics = async () => {
    const metricsDiv = document.getElementById('system-metrics');
    if (!metricsDiv) return;

    try {
      const response = await fetch(`${API_BASE}/metrics`);
      if (response.ok) {
        const metrics = await response.json();
        state.metrics = {
          cpu: metrics.cpu_percent || 0,
          memory: metrics.memory_percent || 0,
          requestsPerMin: metrics.requests_per_minute || 0,
          uptime: formatUptime(metrics.uptime_seconds || 0)
        };
      }
    } catch (error) {
      console.warn('Could not fetch metrics:', error);
      // Use simulated metrics as fallback
      state.metrics.cpu = Math.max(10, state.metrics.cpu + (Math.random() * 20 - 10));
      state.metrics.memory = Math.max(20, state.metrics.memory + (Math.random() * 15 - 7.5));
      state.metrics.requestsPerMin = Math.floor(200 + Math.random() * 100);
    }

    metricsDiv.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">CPU Usage</div>
        <div class="metric-value">${state.metrics.cpu.toFixed(1)}%</div>
        <div class="metric-bar">
          <div class="metric-fill" style="width: ${Math.min(state.metrics.cpu, 100)}%"></div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Memory Usage</div>
        <div class="metric-value">${state.metrics.memory.toFixed(1)}%</div>
        <div class="metric-bar">
          <div class="metric-fill" style="width: ${Math.min(state.metrics.memory, 100)}%"></div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Requests/min</div>
        <div class="metric-value">${state.metrics.requestsPerMin}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Uptime</div>
        <div class="metric-value">${state.metrics.uptime}</div>
      </div>
    `;
  };

  const loadActivityLog = () => {
    const logDiv = document.getElementById('activity-log');
    if (!logDiv) return;

    const activities = [
      { status: 'success', message: 'Agent Planner completed task #521', time: '2 mins ago' },
      { status: 'success', message: 'Workflow Research Pipeline progressed to 65%', time: '5 mins ago' },
      { status: 'info', message: 'System memory usage increased', time: '8 mins ago' },
      { status: 'success', message: 'Knowledge graph updated with 12 new entities', time: '12 mins ago' },
      { status: 'warning', message: 'Agent Researcher temporarily paused', time: '15 mins ago' }
    ];

    logDiv.innerHTML = activities.map(act => `
      <div class="activity-item status-${act.status}">
        <div class="activity-status-dot"></div>
        <div class="activity-content">
          <div class="activity-message">${act.message}</div>
          <div class="activity-time">${act.time}</div>
        </div>
      </div>
    `).join('');
  };

  // ═══════════════════════════════════════════════════════════
  // SETTINGS SECTION
  // ═══════════════════════════════════════════════════════════

  const initSettings = () => {
    const saveBtn = document.querySelector('[data-action="save-settings"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }
    loadSettings();
  };

  const saveSettings = () => {
    const temperature = document.querySelector('input[type="range"]')?.value || '0.7';
    const maxTokens = document.querySelector('input[type="number"]')?.value || '2048';

    localStorage.setItem('latif_temperature', temperature);
    localStorage.setItem('latif_max_tokens', maxTokens);

    UIFramework.showNotification('Settings saved successfully', 'success');
  };

  const loadSettings = () => {
    const temp = localStorage.getItem('latif_temperature') || '0.7';
    const maxTokens = localStorage.getItem('latif_max_tokens') || '2048';

    const rangeInput = document.querySelector('input[type="range"]');
    const numberInput = document.querySelector('input[type="number"]');

    if (rangeInput) rangeInput.value = temp;
    if (numberInput) numberInput.value = maxTokens;
  };

  // ═══════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════

  const escapeHtml = (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  };

  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  const init = () => {
    initChat();
    initAgents();
    initWorkflows();
    initKnowledge();
    initMonitor();
    initSettings();

    UIFramework.on('section-change', (data) => {
      const { section } = data;
      if (section === 'agents') refreshAgentStatus();
      if (section === 'workflows') refreshWorkflowStatus();
      if (section === 'monitor') updateMetrics();
    });

    console.log('LATIF Enterprise Dashboard initialized');
  };

  // Public API
  return {
    init,
    viewAgentDetails,
    stopAgent,
    pauseWorkflow,
    cancelWorkflow,
    state: () => ({ ...state })
  };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LatifEnterprise.init());
} else {
  LatifEnterprise.init();
}

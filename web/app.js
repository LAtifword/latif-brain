/**
 * LATIF v5 Main Application
 * Refactored from 57KB monolithic to modular component-based architecture
 */

import { ChatArea } from './components/ChatArea.js';
import { InputBar } from './components/InputBar.js';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { StatusBar } from './components/StatusBar.js';
import { State, updateState, loadState, saveState, onStateChange } from './utils/state.js';
import { storage } from './utils/storage.js';
import { api } from './utils/api.js';
import { bindCodeCopyButtons } from './modules/markdown.js';

class LatifApp {
  constructor() {
    this.components = {};
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing LATIF v5...');

      // Initialize storage
      await storage.initialize();
      console.log('✓ Storage initialized');

      // Load saved state
      await loadState();
      console.log('✓ State loaded');

      // Initialize components
      this.initializeComponents();
      console.log('✓ Components initialized');

      // Setup event listeners
      this.setupEventListeners();
      console.log('✓ Event listeners setup');

      // Load initial data
      await this.loadInitialData();
      console.log('✓ Initial data loaded');

      this.initialized = true;
      console.log('✅ LATIF v5 Ready');

      updateState({ status: 'idle' });
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.showFatalError(error.message);
    }
  }

  initializeComponents() {
    // ChatArea - message display
    const chatContainer = document.getElementById('chat-area');
    if (chatContainer) {
      this.components.chat = new ChatArea(chatContainer);
    }

    // InputBar - message input
    const inputContainer = document.getElementById('input-bar');
    if (inputContainer) {
      this.components.input = new InputBar(inputContainer);
    }

    // Sidebar - chat history
    const sidebarContainer = document.getElementById('sidebar');
    if (sidebarContainer) {
      this.components.sidebar = new Sidebar(sidebarContainer);
    }

    // TopBar - header controls
    const topbarContainer = document.getElementById('top-bar');
    if (topbarContainer) {
      this.components.topbar = new TopBar(topbarContainer);
    }

    // StatusBar - connection status
    const statusContainer = document.getElementById('status-bar');
    if (statusContainer) {
      this.components.status = new StatusBar(statusContainer);
    }
  }

  setupEventListeners() {
    // Chat selection
    window.addEventListener('chat-selected', (e) => {
      this.selectChat(e.detail.chatId);
    });

    // Message added
    window.addEventListener('message-added', (e) => {
      if (this.components.chat) {
        this.components.chat.addMessage(e.detail);
      }
    });

    // Message updated (streaming)
    window.addEventListener('message-updated', (e) => {
      if (this.components.chat) {
        // Update message in chat area
        const msgEl = this.components.chat.container.querySelector(
          `[data-message-id="${e.detail.id}"]`
        );
        if (msgEl) {
          const content = msgEl.querySelector('.message-content');
          if (content) {
            content.innerHTML = e.detail.content;
            bindCodeCopyButtons(content);
          }
        }
      }
    });

    // Settings open
    window.addEventListener('settings-open', () => {
      this.openSettings();
    });

    // Connection status changed
    window.addEventListener('connection-status-changed', (e) => {
      if (this.components.status) {
        this.components.status.updateConnectionStatus(e.detail.connected);
      }
    });

    // State changes
    onStateChange((updates) => {
      if (updates.theme) {
        document.documentElement.setAttribute('data-theme', updates.theme);
      }
      if (updates.sidebarOpen !== undefined) {
        this.toggleSidebar(updates.sidebarOpen);
      }
    });

    // Save state periodically
    setInterval(() => saveState(), 30000);
  }

  async loadInitialData() {
    try {
      // Load models
      if (this.components.topbar) {
        await this.components.topbar.loadModels();
      }

      // Load chats
      if (this.components.sidebar) {
        await this.components.sidebar.loadChats();

        // Select first chat or create new
        if (State.activeChat) {
          await this.selectChat(State.activeChat);
        } else if (this.components.sidebar.allChats.length > 0) {
          await this.selectChat(this.components.sidebar.allChats[0].id);
        } else {
          await this.components.sidebar.createNewChat();
        }
      }

      // Check server health
      try {
        await api.checkHealth();
        updateState({ isConnected: true, status: 'idle' });
      } catch (error) {
        updateState({ isConnected: false, status: 'offline' });
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  async selectChat(chatId) {
    try {
      updateState({ activeChat: chatId });

      // Load chat messages
      if (this.components.chat) {
        await this.components.chat.loadChat(chatId);
        bindCodeCopyButtons(this.components.chat.container);
      }

      // Update sidebar highlight
      if (this.components.sidebar) {
        this.components.sidebar.selectChat(chatId);
      }

      // Focus input
      if (this.components.input) {
        this.components.input.focus();
      }
    } catch (error) {
      console.error('Failed to select chat:', error);
    }
  }

  toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar-container');
    if (sidebar) {
      sidebar.classList.toggle('hidden', !open);
    }
  }

  openSettings() {
    // Create or show settings modal
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('open');
      modal.querySelector('.modal-backdrop')?.classList.add('open');
    }
  }

  showFatalError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fatal-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <h1>⚠️ Error</h1>
        <p>${message}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }

  async destroy() {
    if (this.components.status) {
      this.components.status.destroy();
    }
    await saveState();
  }
}

// Global instance
let app;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    app = new LatifApp();
    await app.initialize();
  });
} else {
  app = new LatifApp();
  app.initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  if (app) {
    await app.destroy();
  }
});

export default app;

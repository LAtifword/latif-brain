/**
 * Status Bar Component
 * Connection status, token count, and system info
 */

import { State, onStateChange } from '../utils/state.js';
import { formatTokenCount } from '../utils/formatting.js';
import { api } from '../utils/api.js';

export class StatusBar {
  constructor(container) {
    this.container = container;
    this.statusDot = container.querySelector('.status-dot');
    this.statusText = container.querySelector('.status-text');
    this.tokenDisplay = container.querySelector('.token-display');
    this.versionDisplay = container.querySelector('.version-display');
    this.setupEventListeners();
  }

  setupEventListeners() {
    onStateChange((updates) => {
      if (updates.isConnected !== undefined) {
        this.updateConnectionStatus(updates.isConnected);
      }
      if (updates.status) {
        this.updateStatus(updates.status);
      }
    });

    // Periodically check server health
    this.healthCheckInterval = setInterval(() => this.checkHealth(), 30000);
  }

  async checkHealth() {
    try {
      const response = await api.checkHealth();
      this.setConnected(true);
    } catch (error) {
      this.setConnected(false);
    }
  }

  setConnected(connected) {
    if (connected !== State.isConnected) {
      window.dispatchEvent(new CustomEvent('connection-status-changed', {
        detail: { connected }
      }));
    }
  }

  updateConnectionStatus(connected) {
    if (this.statusDot) {
      this.statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
    }

    if (this.statusText) {
      this.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  updateStatus(status) {
    const statusMap = {
      'idle': '✓ Ready',
      'loading': '⟳ Loading...',
      'generating': '○ Generating...',
      'error': '✕ Error',
      'offline': '☁ Offline'
    };

    if (this.statusText) {
      this.statusText.textContent = statusMap[status] || status;
    }
  }

  updateTokenCount(count) {
    if (this.tokenDisplay) {
      this.tokenDisplay.textContent = `${formatTokenCount(count)} tokens`;
    }
  }

  setVersion(version) {
    if (this.versionDisplay) {
      this.versionDisplay.textContent = `v${version}`;
    }
  }

  showInfo(message, duration = 2000) {
    const notification = document.createElement('div');
    notification.className = 'status-notification info';
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  showWarning(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'status-notification warning';
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  showError(message, duration = 4000) {
    const notification = document.createElement('div');
    notification.className = 'status-notification error';
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

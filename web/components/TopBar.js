/**
 * Top Bar Component
 * Header with model selection and quick actions
 */

import { State, updateState } from '../utils/state.js';
import { api } from '../utils/api.js';

export class TopBar {
  constructor(container) {
    this.container = container;
    this.modelSelect = container.querySelector('.model-select');
    this.tempSlider = container.querySelector('.temperature-slider');
    this.tokensInput = container.querySelector('.max-tokens-input');
    this.settingsBtn = container.querySelector('.settings-btn');
    this.themeToggle = container.querySelector('.theme-toggle');
    this.models = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.modelSelect) {
      this.modelSelect.addEventListener('change', (e) => {
        this.selectModel(e.target.value);
      });
    }

    if (this.tempSlider) {
      this.tempSlider.addEventListener('change', (e) => {
        updateState({ temperature: parseFloat(e.target.value) });
        this.updateTempDisplay(e.target.value);
      });
    }

    if (this.tokensInput) {
      this.tokensInput.addEventListener('change', (e) => {
        updateState({ maxTokens: parseInt(e.target.value) });
      });
    }

    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('settings-open'));
      });
    }

    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  async loadModels() {
    try {
      const response = await api.getModels();
      this.models = response.models || [];
      this.populateModelSelect();
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }

  populateModelSelect() {
    if (!this.modelSelect) return;

    const options = this.models
      .map(model => {
        const name = typeof model === 'string' ? model : model.name;
        return `<option value="${name}">${name}</option>`;
      })
      .join('');

    this.modelSelect.innerHTML = options;
    this.modelSelect.value = State.model;
  }

  selectModel(modelName) {
    updateState({ model: modelName });
    if (this.modelSelect) {
      this.modelSelect.value = modelName;
    }
  }

  updateTempDisplay(value) {
    const display = this.container.querySelector('.temp-display');
    if (display) {
      display.textContent = parseFloat(value).toFixed(2);
    }
  }

  toggleTheme() {
    const newTheme = State.theme === 'dark' ? 'light' : 'dark';
    updateState({ theme: newTheme });

    document.documentElement.setAttribute('data-theme', newTheme);

    if (this.themeToggle) {
      this.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
  }

  setTitle(title) {
    const titleEl = this.container.querySelector('.title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  setStatus(status, message) {
    const statusEl = this.container.querySelector('.status');
    if (statusEl) {
      statusEl.className = `status ${status}`;
      statusEl.textContent = message;
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  disableControls() {
    if (this.modelSelect) this.modelSelect.disabled = true;
    if (this.tempSlider) this.tempSlider.disabled = true;
    if (this.tokensInput) this.tokensInput.disabled = true;
  }

  enableControls() {
    if (this.modelSelect) this.modelSelect.disabled = false;
    if (this.tempSlider) this.tempSlider.disabled = false;
    if (this.tokensInput) this.tokensInput.disabled = false;
  }
}

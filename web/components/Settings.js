/**
 * Settings Component
 * Application settings and preferences
 */

import { State, updateState } from '../utils/state.js';
import { storage } from '../utils/storage.js';

export class Settings {
  constructor(container) {
    this.container = container;
    this.modal = container.querySelector('.modal');
    this.backdrop = container.querySelector('.modal-backdrop');
    this.closeBtn = container.querySelector('.close-btn');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Temperature
    const tempInput = this.container.querySelector('#temp-input');
    if (tempInput) {
      tempInput.value = State.temperature;
      tempInput.addEventListener('change', (e) => {
        updateState({ temperature: parseFloat(e.target.value) });
      });
    }

    // Max tokens
    const tokensInput = this.container.querySelector('#max-tokens-input');
    if (tokensInput) {
      tokensInput.value = State.maxTokens;
      tokensInput.addEventListener('change', (e) => {
        updateState({ maxTokens: parseInt(e.target.value) });
      });
    }

    // Language
    const langSelect = this.container.querySelector('#language-select');
    if (langSelect) {
      langSelect.value = State.language;
      langSelect.addEventListener('change', (e) => {
        updateState({ language: e.target.value });
      });
    }

    // Theme
    const themeSelect = this.container.querySelector('#theme-select');
    if (themeSelect) {
      themeSelect.value = State.theme;
      themeSelect.addEventListener('change', (e) => {
        updateState({ theme: e.target.value });
        document.documentElement.setAttribute('data-theme', e.target.value);
      });
    }

    // Stream responses
    const streamToggle = this.container.querySelector('#stream-toggle');
    if (streamToggle) {
      streamToggle.checked = State.streamResponses;
      streamToggle.addEventListener('change', (e) => {
        updateState({ streamResponses: e.target.checked });
      });
    }

    // Auto save
    const autoSaveToggle = this.container.querySelector('#autosave-toggle');
    if (autoSaveToggle) {
      autoSaveToggle.checked = State.autoSave;
      autoSaveToggle.addEventListener('change', (e) => {
        updateState({ autoSave: e.target.checked });
      });
    }

    // Offline mode
    const offlineToggle = this.container.querySelector('#offline-toggle');
    if (offlineToggle) {
      offlineToggle.checked = State.offlineMode;
      offlineToggle.addEventListener('change', (e) => {
        updateState({ offlineMode: e.target.checked });
      });
    }

    // Clear cache button
    const clearCacheBtn = this.container.querySelector('#clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.clearCache());
    }

    // Export settings button
    const exportBtn = this.container.querySelector('#export-settings-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportSettings());
    }

    // Import settings button
    const importBtn = this.container.querySelector('#import-settings-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importSettings());
    }
  }

  open() {
    if (this.modal) {
      this.modal.classList.add('open');
    }
    if (this.backdrop) {
      this.backdrop.classList.add('open');
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
    }
  }

  async clearCache() {
    if (!confirm('Clear all cached data?')) return;

    try {
      // Clear settings storage
      const settings = await storage.getAllSettings();
      for (const key of Object.keys(settings)) {
        if (key !== 'theme' && key !== 'language') {
          await storage.saveSetting(key, null);
        }
      }

      this.showNotification('✓ Cache cleared');
    } catch (error) {
      this.showNotification('✗ Failed to clear cache', 'error');
    }
  }

  async exportSettings() {
    try {
      const settings = await storage.getAllSettings();
      const data = {
        version: '5.0.0',
        timestamp: new Date().toISOString(),
        settings: {
          ...settings,
          temperature: State.temperature,
          maxTokens: State.maxTokens,
          language: State.language,
          theme: State.theme,
          streamResponses: State.streamResponses,
          autoSave: State.autoSave,
          offlineMode: State.offlineMode
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `latif-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('✓ Settings exported');
    } catch (error) {
      this.showNotification('✗ Failed to export settings', 'error');
    }
  }

  async importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.settings) {
          throw new Error('Invalid settings file');
        }

        // Import settings
        for (const [key, value] of Object.entries(data.settings)) {
          await storage.saveSetting(key, value);
        }

        // Update state
        updateState({
          temperature: data.settings.temperature,
          maxTokens: data.settings.maxTokens,
          language: data.settings.language,
          theme: data.settings.theme,
          streamResponses: data.settings.streamResponses,
          autoSave: data.settings.autoSave,
          offlineMode: data.settings.offlineMode
        });

        this.setupEventListeners(); // Refresh UI
        this.showNotification('✓ Settings imported');
      } catch (error) {
        this.showNotification('✗ Failed to import settings', 'error');
      }
    };
    input.click();
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
}

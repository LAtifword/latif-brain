/**
 * LATIF AI Core - Browser Client
 * Thin wrapper around backend API
 * Replaces local LLM/RAG/agent logic with HTTP calls
 */

import { api } from './api.js';

export class AICore {
  constructor() {
    this.model = 'qwen2.5:1.5b';
    this.temperature = 0.7;
    this.maxTokens = 2048;
    this.models = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Check backend connectivity
      await api.checkHealth();

      // Load available models
      const response = await api.getModels();
      this.models = response.models || [];

      // Use first model as default if available
      if (this.models.length > 0) {
        this.model = this.models[0].name;
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('AI Core initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Send message and get response (non-streaming)
   */
  async chat(messages, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AI Core not initialized. Call initialize() first.');
    }

    try {
      const response = await api.sendMessage(null, messages[messages.length - 1]?.content, {
        messages,
        model: options.model || this.model,
        temperature: options.temperature || this.temperature,
        maxTokens: options.maxTokens || this.maxTokens
      });

      return response;
    } catch (error) {
      console.error('Chat request failed:', error);
      throw error;
    }
  }

  /**
   * Stream message and get response chunks
   */
  async *streamChat(messages, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AI Core not initialized. Call initialize() first.');
    }

    try {
      const reader = await api.streamMessage(null, messages[messages.length - 1]?.content, {
        messages,
        model: options.model || this.model,
        temperature: options.temperature || this.temperature,
        maxTokens: options.maxTokens || this.maxTokens
      });

      // Read stream chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode and parse chunks
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream chat failed:', error);
      throw error;
    }
  }

  /**
   * Model Management
   */

  setModel(modelName) {
    if (this.models.some(m => m.name === modelName)) {
      this.model = modelName;
      return true;
    }
    console.warn(`Model ${modelName} not found`);
    return false;
  }

  getModel() {
    return this.model;
  }

  getModels() {
    return this.models;
  }

  async refreshModels() {
    try {
      const response = await api.getModels();
      this.models = response.models || [];
      return this.models;
    } catch (error) {
      console.error('Failed to refresh models:', error);
      throw error;
    }
  }

  /**
   * Parameters
   */

  setTemperature(value) {
    if (value >= 0 && value <= 2) {
      this.temperature = value;
      return true;
    }
    console.warn('Temperature must be between 0 and 2');
    return false;
  }

  setMaxTokens(value) {
    if (value > 0 && value <= 32000) {
      this.maxTokens = value;
      return true;
    }
    console.warn('Max tokens must be between 1 and 32000');
    return false;
  }

  /**
   * Utility Methods
   */

  isReady() {
    return this.isInitialized && api.isOnline();
  }

  getStats() {
    return {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      isInitialized: this.isInitialized,
      isOnline: api.isOnline()
    };
  }
}

// Export singleton
export const aiCore = new AICore();

export default AICore;

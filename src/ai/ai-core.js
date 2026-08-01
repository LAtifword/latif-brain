/**
 * LATIF AI Core Module
 * Main LLM interface, model selection, streaming, and provider abstraction
 */

import { loggerProxy as logger } from '../core/logger.js';
import { getConfig } from '../core/config.js';

class AICore {
  constructor() {
    this.config = null;
    this.model = null;
    this.streaming = false;
    this.temperature = 0.7;
    this.maxTokens = 2048;
    this.modelList = [];

    // Auto-detection state
    this.serverAvailable = false;
    this.lastKnownWorkingServer = null;
    this.serverCheckInProgress = false;
    this.serverCheckTimestamp = 0;
    this.ollamaDiscoveryStatus = 'unchecked';
    this.discoveredOllamaHost = null;
  }

  async initialize() {
    try {
      this.config = getConfig();
      this.model = this.config.get('llm.model') || 'qwen2.5:1.5b';
      this.temperature = this.config.get('llm.temperature') || 0.7;
      this.maxTokens = this.config.get('llm.maxTokens') || 2048;
      this.streaming = this.config.get('llm.streaming') !== false;

      logger.info('AI Core initialized (Ollama)', {
        model: this.model,
        streaming: this.streaming,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });

      // Auto-detect server availability
      await this.autoDetectServer();

      // Fetch available models
      if (this.serverAvailable) {
        await this.refreshModels();
      } else {
        logger.warn('Ollama server not available - running in offline mode');
      }
    } catch (error) {
      logger.error('AI Core initialization failed', { error: error.message });
      throw error;
    }
  }

  async refreshModels() {
    try {
      const endpoint = this.ollamaEndpoint();
      const response = await fetch(`${endpoint}/api/tags`, {
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusCode}`);
      }

      const data = await response.json();
      this.modelList = data.models || data.results || [];

      logger.info('Models refreshed', {
        count: this.modelList.length
      });

      return this.modelList;
    } catch (error) {
      logger.warn('Failed to refresh models', { error: error.message });
      return this.modelList;
    }
  }

  ollamaEndpoint() {
    const host = this.config.get('llm.host') || 'localhost';
    const port = this.config.get('llm.port') || 11434;
    return `http://${host}:${port}`;
  }

  async autoDetectServer() {
    if (this.serverCheckInProgress) return;

    const now = Date.now();
    if (now - this.serverCheckTimestamp < 30000) return; // Rate limit: 30s

    this.serverCheckInProgress = true;
    this.serverCheckTimestamp = now;

    try {
      const fallbackChain = [
        `http://127.0.0.1:11434`,
        `http://localhost:11434`,
        `http://192.168.1.1:11434`, // Common router IP
        this.lastKnownWorkingServer
      ].filter(Boolean);

      for (const endpoint of fallbackChain) {
        try {
          const response = await fetch(`${endpoint}/api/tags`, {
            timeout: 2000
          });

          if (response.ok) {
            this.serverAvailable = true;
            this.lastKnownWorkingServer = endpoint;
            this.discoveredOllamaHost = endpoint;
            this.ollamaDiscoveryStatus = 'discovered';

            logger.info('Ollama server auto-detected', {
              endpoint,
              status: 'available'
            });
            return true;
          }
        } catch (err) {
          logger.debug('Server detection failed', {
            endpoint,
            error: err.message
          });
        }
      }

      this.serverAvailable = false;
      this.ollamaDiscoveryStatus = 'not-found';
      logger.warn('Ollama server not detected', {
        attemptedEndpoints: fallbackChain.length
      });
      return false;
    } finally {
      this.serverCheckInProgress = false;
    }
  }

  async chat(messages, options = {}) {
    try {
      const model = options.model || this.model;
      const streaming = options.streaming !== undefined ? options.streaming : this.streaming;
      const temperature = options.temperature || this.temperature;
      const maxTokens = options.maxTokens || this.maxTokens;

      const endpoint = this.discoveredOllamaHost || this.ollamaEndpoint();
      const requestBody = this.buildRequestBody(
        model,
        messages,
        temperature,
        maxTokens,
        streaming
      );

      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        timeout: 60000
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusCode}`);
      }

      if (streaming) {
        return this.handleStreamingResponse(response);
      } else {
        const data = await response.json();
        return {
          model: data.model || model,
          content: data.message?.content || '',
          stopReason: data.done ? 'stop' : 'length',
          tokens: {
            prompt: data.prompt_eval_count || 0,
            completion: data.eval_count || 0,
            total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
          }
        };
      }
    } catch (error) {
      logger.error('Chat failed', { error: error.message });
      // Attempt re-detection on error
      this.serverAvailable = false;
      await this.autoDetectServer();
      throw error;
    }
  }

  buildRequestBody(model, messages, temperature, maxTokens, streaming) {
    return {
      model,
      messages,
      stream: streaming,
      temperature,
      num_predict: maxTokens,
      options: {
        temperature,
        num_predict: maxTokens
      }
    };
  }

  async *handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const json = JSON.parse(line);

            if (json.message?.content) {
              yield {
                type: 'content',
                content: json.message.content
              };
            }
            if (json.done) {
              yield {
                type: 'done',
                model: json.model,
                tokens: {
                  prompt: json.prompt_eval_count || 0,
                  completion: json.eval_count || 0,
                  total: (json.prompt_eval_count || 0) + (json.eval_count || 0)
                }
              };
            }
          } catch (parseError) {
            logger.debug('Stream line parse error', { line, error: parseError.message });
          }
        }

        buffer = lines[lines.length - 1];
      }

      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer);
          if (json.message?.content) {
            yield {
              type: 'content',
              content: json.message.content
            };
          }
        } catch (parseError) {
          logger.debug('Final buffer parse error', { buffer, error: parseError.message });
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async embeddings(texts) {
    try {
      const endpoint = this.ollamaEndpoint();
      const results = [];

      for (const text of texts) {
        const response = await fetch(`${endpoint}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: text
          }),
          timeout: 30000
        });

        if (!response.ok) {
          throw new Error(`Embeddings failed: ${response.statusCode}`);
        }

        const data = await response.json();
        results.push({
          text,
          embedding: data.embedding || [],
          model: this.model
        });
      }

      return results;
    } catch (error) {
      logger.error('Embeddings failed', { error: error.message });
      throw error;
    }
  }

  setModel(modelName) {
    if (!this.modelList.find(m => m.name === modelName || m === modelName)) {
      throw new Error(`Model not found: ${modelName}`);
    }
    this.model = modelName;
    logger.info('Model changed', { model: modelName });
  }

  getModel() {
    return this.model;
  }

  getModels() {
    return this.modelList;
  }

  setStreaming(enabled) {
    this.streaming = !!enabled;
    logger.debug('Streaming changed', { enabled: this.streaming });
  }

  isStreaming() {
    return this.streaming;
  }

  setTemperature(value) {
    if (value < 0 || value > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.temperature = value;
    logger.debug('Temperature changed', { temperature: value });
  }

  getTemperature() {
    return this.temperature;
  }

  setMaxTokens(value) {
    if (value < 1 || value > 32768) {
      throw new Error('Max tokens must be between 1 and 32768');
    }
    this.maxTokens = value;
    logger.debug('Max tokens changed', { maxTokens: value });
  }

  getMaxTokens() {
    return this.maxTokens;
  }

  async healthCheck() {
    try {
      const endpoint = this.discoveredOllamaHost || this.ollamaEndpoint();
      const response = await fetch(`${endpoint}/api/tags`, {
        timeout: 5000
      });
      const ok = response.ok;
      if (ok) {
        this.serverAvailable = true;
      } else {
        this.serverAvailable = false;
      }
      return ok;
    } catch (error) {
      this.serverAvailable = false;
      return false;
    }
  }

  getServerStatus() {
    return {
      available: this.serverAvailable,
      lastKnownWorking: this.lastKnownWorkingServer,
      discoveredHost: this.discoveredOllamaHost,
      discoveryStatus: this.ollamaDiscoveryStatus,
      endpoint: this.discoveredOllamaHost || this.ollamaEndpoint()
    };
  }

  setServerAvailable(available) {
    this.serverAvailable = available;
    logger.debug('Server availability changed', { available });
  }

  isServerAvailable() {
    return this.serverAvailable;
  }
}

// Singleton instance
let instance = null;

export async function initializeAICore() {
  if (!instance) {
    instance = new AICore();
    await instance.initialize();
  }
  return instance;
}

export function getAICore() {
  if (!instance) {
    throw new Error('AI Core not initialized. Call initializeAICore() first.');
  }
  return instance;
}

export default new AICore();

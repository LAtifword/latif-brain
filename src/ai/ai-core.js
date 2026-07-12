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
    this.provider = null;
    this.streaming = false;
    this.temperature = 0.7;
    this.maxTokens = 2048;
    this.modelList = [];
  }

  async initialize() {
    try {
      this.config = getConfig();
      this.provider = this.config.get('llm.provider') || 'ollama';
      this.model = this.config.get('llm.model') || 'qwen2.5:1.5b';
      this.temperature = this.config.get('llm.temperature') || 0.7;
      this.maxTokens = this.config.get('llm.maxTokens') || 2048;
      this.streaming = this.config.get('llm.streaming') !== false;

      logger.info('AI Core initialized', {
        provider: this.provider,
        model: this.model,
        streaming: this.streaming,
        temperature: this.temperature,
        maxTokens: this.maxTokens
      });

      // Fetch available models
      await this.refreshModels();
    } catch (error) {
      logger.error('AI Core initialization failed', { error: error.message });
      throw error;
    }
  }

  async refreshModels() {
    try {
      const endpoint = this.getProviderEndpoint();
      const response = await fetch(`${endpoint}/api/tags`, {
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusCode}`);
      }

      const data = await response.json();
      this.modelList = data.models || data.results || [];

      logger.info('Models refreshed', {
        count: this.modelList.length,
        provider: this.provider
      });

      return this.modelList;
    } catch (error) {
      logger.warn('Failed to refresh models', { error: error.message });
      return this.modelList;
    }
  }

  getProviderEndpoint() {
    if (this.provider === 'ollama') {
      const host = this.config.get('llm.host') || 'localhost';
      const port = this.config.get('llm.port') || 11434;
      return `http://${host}:${port}`;
    } else if (this.provider === 'openai') {
      return 'https://api.openai.com/v1';
    }
    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  async chat(messages, options = {}) {
    try {
      const model = options.model || this.model;
      const streaming = options.streaming !== undefined ? options.streaming : this.streaming;
      const temperature = options.temperature || this.temperature;
      const maxTokens = options.maxTokens || this.maxTokens;

      const endpoint = this.getProviderEndpoint();
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
          content: data.message?.content || data.choices?.[0]?.message?.content || '',
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
      throw error;
    }
  }

  buildRequestBody(model, messages, temperature, maxTokens, streaming) {
    if (this.provider === 'ollama') {
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
    } else if (this.provider === 'openai') {
      return {
        model,
        messages,
        stream: streaming,
        temperature,
        max_tokens: maxTokens
      };
    }
    throw new Error(`Unsupported provider: ${this.provider}`);
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

            if (this.provider === 'ollama') {
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
            } else if (this.provider === 'openai') {
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                yield {
                  type: 'content',
                  content: delta.content
                };
              }
              if (json.choices?.[0]?.finish_reason) {
                yield {
                  type: 'done',
                  stopReason: json.choices[0].finish_reason
                };
              }
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
      if (this.provider !== 'ollama') {
        throw new Error('Embeddings only supported for Ollama');
      }

      const endpoint = this.getProviderEndpoint();
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

  setProvider(providerName) {
    if (!['ollama', 'openai', 'local'].includes(providerName)) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
    this.provider = providerName;
    logger.info('Provider changed', { provider: providerName });
  }

  getProvider() {
    return this.provider;
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
      const endpoint = this.getProviderEndpoint();
      const response = await fetch(`${endpoint}/api/tags`, {
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
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

import OpenAI from 'openai';
import { EventEmitter } from 'events';

/**
 * KimiAdapter - OpenAI-compatible adapter for LATIF-NI
 * Supports: Ollama (local), Moonshot API (cloud), any OpenAI-compatible endpoint
 * Backend-agnostic: switch at runtime without restarting
 */
export class KimiAdapter extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Primary backend
            apiKey: config.apiKey || process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY || 'ollama',
            baseURL: config.baseURL || process.env.KIMI_BASE_URL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
            model: config.model || process.env.KIMI_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:7b',

            // Fallback backend (auto-switch on failure)
            fallbackBaseURL: config.fallbackBaseURL || process.env.KIMI_FALLBACK_URL || null,
            fallbackModel: config.fallbackModel || process.env.KIMI_FALLBACK_MODEL || null,
            fallbackApiKey: config.fallbackApiKey || process.env.KIMI_FALLBACK_KEY || null,

            // Inference params (Kimi K2.6 defaults)
            temperature: config.temperature ?? 0.6,
            maxTokens: config.maxTokens || 2048,
            topP: config.topP ?? 0.9,

            // Behavior
            autoFallback: config.autoFallback !== false,
            retryCount: config.retryCount || 2,
            retryDelay: config.retryDelay || 1000,

            ...config
        };

        this.currentBackend = 'primary';
        this.client = this._createClient(this.config);

        this.emit('initialized', {
            backend: this.currentBackend,
            baseURL: this.config.baseURL,
            model: this.config.model
        });
    }

    _createClient(cfg) {
        return new OpenAI({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
            timeout: cfg.timeout || 30000,
            maxRetries: cfg.retryCount
        });
    }

    /**
     * Main chat method - supports streaming, tools, and fallback
     */
    async chat(messages, options = {}) {
        const opts = {
            model: options.model || this.config.model,
            messages: this._prepareMessages(messages),
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens || options.max_tokens || this.config.maxTokens,
            top_p: options.topP ?? this.config.topP,
            stream: options.stream || false,
            ...(options.tools ? { tools: options.tools, tool_choice: options.toolChoice || 'auto' } : {}),
            ...(options.thinking ? { extra_body: { thinking: { type: 'enabled' } } } : {})
        };

        try {
            const response = await this._executeWithRetry(() => this.client.chat.completions.create(opts));
            this.emit('response', { backend: this.currentBackend, model: opts.model });
            return response;
        } catch (error) {
            this.emit('error', { error: error.message, backend: this.currentBackend });

            if (this.config.autoFallback && this.currentBackend === 'primary' && this.config.fallbackBaseURL) {
                console.log(`[KimiAdapter] Primary failed, switching to fallback...`);
                this.switchBackend('fallback');
                return this.chat(messages, options);
            }
            throw error;
        }
    }

    /**
     * Streaming chat with real-time token delivery
     */
    async *streamChat(messages, options = {}) {
        const opts = {
            model: options.model || this.config.model,
            messages: this._prepareMessages(messages),
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            stream: true,
            ...(options.tools ? { tools: options.tools } : {})
        };

        try {
            const stream = await this.client.chat.completions.create(opts);

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                if (delta?.content) {
                    yield { type: 'token', content: delta.content };
                }
                if (delta?.tool_calls) {
                    yield { type: 'tool_call', data: delta.tool_calls };
                }
            }
            yield { type: 'done' };
        } catch (error) {
            this.emit('error', { error: error.message, backend: this.currentBackend });
            yield { type: 'error', error: error.message };
        }
    }

    /**
     * Tool-calling with execution loop (Kimi K2 style)
     */
    async chatWithTools(messages, tools, toolMap = {}, options = {}) {
        const conversation = [...messages];
        let iterations = 0;
        const maxIterations = options.maxIterations || 10;

        while (iterations < maxIterations) {
            iterations++;
            const response = await this.chat(conversation, { ...options, tools });
            const choice = response.choices[0];

            if (choice.finish_reason !== 'tool_calls') {
                return response; // Final answer
            }

            // Execute tools
            conversation.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                this.emit('tool_call', { name: toolName, args: toolArgs });

                let result;
                try {
                    if (toolMap[toolName]) {
                        result = await toolMap[toolName](toolArgs);
                    } else {
                        result = { error: `Tool "${toolName}" not found in toolMap` };
                    }
                } catch (e) {
                    result = { error: e.message };
                }

                conversation.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: JSON.stringify(result)
                });

                this.emit('tool_result', { name: toolName, result });
            }
        }

        return await this.chat(conversation, options);
    }

    /**
     * Switch backend at runtime
     */
    switchBackend(target = 'fallback') {
        if (target === 'fallback' && !this.config.fallbackBaseURL) {
            throw new Error('No fallback backend configured');
        }

        if (target === 'fallback') {
            this.currentBackend = 'fallback';
            this.client = this._createClient({
                apiKey: this.config.fallbackApiKey || this.config.apiKey,
                baseURL: this.config.fallbackBaseURL,
                model: this.config.fallbackModel || this.config.model
            });
        } else {
            this.currentBackend = 'primary';
            this.client = this._createClient(this.config);
        }

        this.emit('backend_switched', {
            backend: this.currentBackend,
            baseURL: target === 'fallback' ? this.config.fallbackBaseURL : this.config.baseURL,
            model: target === 'fallback' ? this.config.fallbackModel : this.config.model
        });
    }

    /**
     * Health check for current backend
     */
    async healthCheck() {
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 5
            });
            return { ok: true, backend: this.currentBackend, model: this.config.model };
        } catch (error) {
            return { ok: false, backend: this.currentBackend, error: error.message };
        }
    }

    _prepareMessages(messages) {
        // Ensure system prompt is first
        const hasSystem = messages.some(m => m.role === 'system');
        if (!hasSystem && this.config.systemPrompt) {
            return [{ role: 'system', content: this.config.systemPrompt }, ...messages];
        }
        return messages;
    }

    async _executeWithRetry(fn) {
        let lastError;
        for (let i = 0; i <= this.config.retryCount; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < this.config.retryCount) {
                    await new Promise(r => setTimeout(r, this.config.retryDelay * (i + 1)));
                }
            }
        }
        throw lastError;
    }

    get status() {
        return {
            backend: this.currentBackend,
            baseURL: this.currentBackend === 'primary' ? this.config.baseURL : this.config.fallbackBaseURL,
            model: this.currentBackend === 'primary' ? this.config.model : this.config.fallbackModel,
            config: this.config
        };
    }
}

export default KimiAdapter;

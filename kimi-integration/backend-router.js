import { KimiAdapter } from './kimi-adapter.js';

/**
 * BackendRouter - Intelligent routing between Local Ollama and Cloud API
 * Monitors health, latency, and auto-switches based on availability
 */
export class BackendRouter {
    constructor(config = {}) {
        this.backends = {
            local: {
                name: 'local',
                baseURL: config.localURL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
                model: config.localModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
                apiKey: 'ollama',
                priority: 1,
                enabled: config.localEnabled !== false
            },
            cloud: {
                name: 'cloud',
                baseURL: config.cloudURL || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
                model: config.cloudModel || process.env.KIMI_MODEL || 'kimi-k2.6',
                apiKey: config.cloudApiKey || process.env.KIMI_API_KEY || '',
                priority: 2,
                enabled: !!config.cloudApiKey || !!process.env.KIMI_API_KEY
            }
        };

        this.current = 'local';
        this.adapters = {};
        this.healthStatus = {};
        this.latencyLog = {};

        this._initAdapters();
    }

    _initAdapters() {
        for (const [key, backend] of Object.entries(this.backends)) {
            if (!backend.enabled) continue;

            this.adapters[key] = new KimiAdapter({
                baseURL: backend.baseURL,
                model: backend.model,
                apiKey: backend.apiKey,
                autoFallback: false
            });
        }
    }

    /**
     * Get the best available adapter
     */
    async getAdapter(preferred = null) {
        if (preferred && this.adapters[preferred]) {
            const health = await this.adapters[preferred].healthCheck();
            if (health.ok) {
                this.current = preferred;
                return this.adapters[preferred];
            }
        }

        // Check all backends by priority
        const sorted = Object.entries(this.backends)
            .filter(([_, b]) => b.enabled)
            .sort((a, b) => a[1].priority - b[1].priority);

        for (const [key, _] of sorted) {
            const adapter = this.adapters[key];
            if (!adapter) continue;

            const health = await adapter.healthCheck();
            this.healthStatus[key] = health;

            if (health.ok) {
                this.current = key;
                return adapter;
            }
        }

        throw new Error('No healthy backend available');
    }

    /**
     * Smart chat - auto-routes to best backend
     */
    async chat(messages, options = {}) {
        const adapter = await this.getAdapter(options.preferredBackend);
        const startTime = Date.now();

        try {
            const response = await adapter.chat(messages, options);
            this.latencyLog[this.current] = Date.now() - startTime;
            return response;
        } catch (error) {
            // Try next backend
            const nextBackend = this.current === 'local' ? 'cloud' : 'local';
            if (this.adapters[nextBackend]) {
                console.log(`[BackendRouter] ${this.current} failed, trying ${nextBackend}...`);
                const fallbackAdapter = await this.getAdapter(nextBackend);
                return fallbackAdapter.chat(messages, options);
            }
            throw error;
        }
    }

    /**
     * Streaming with backend info
     */
    async *streamChat(messages, options = {}) {
        const adapter = await this.getAdapter(options.preferredBackend);

        yield { type: 'meta', backend: this.current, model: adapter.config.model };

        const stream = adapter.streamChat(messages, options);
        for await (const chunk of stream) {
            yield chunk;
        }
    }

    /**
     * Run health check on all backends
     */
    async healthCheckAll() {
        const results = {};
        for (const [key, adapter] of Object.entries(this.adapters)) {
            results[key] = await adapter.healthCheck();
        }
        this.healthStatus = results;
        return results;
    }

    /**
     * Get current status report
     */
    getStatus() {
        return {
            current: this.current,
            backends: Object.keys(this.adapters),
            health: this.healthStatus,
            latency: this.latencyLog
        };
    }
}

export default BackendRouter;

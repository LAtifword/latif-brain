/**
 * LATIF-NI Kimi Integration
 * =========================
 * Main entry point for Kimi open-source components integration.
 * 
 * Provides:
 * - KimiAdapter: OpenAI-compatible backend adapter
 * - BackendRouter: Auto-switch between local/cloud
 * - PluginManager: Kimi-style plugin marketplace
 * - SkillRegistry: Built-in + dynamic skills
 * - ToolCaller: Tool execution pipeline
 * - StreamHandler: Streaming response handler
 * 
 * Usage:
 *   import { createLATIF } from './kimi-integration/index.js';
 *   const latif = await createLATIF();
 *   const response = await latif.chat("Hello!");
 */

import { KimiAdapter } from './kimi-adapter.js';
import { BackendRouter } from './backend-router.js';
import { PluginManager } from './plugin-manager.js';
import { SkillRegistry } from './skill-registry.js';
import { ToolCaller } from './tool-caller.js';
import { StreamHandler } from './stream-handler.js';
import { SYSTEM_PROMPTS, getPrompt } from './configs/system-prompts.js';
import { TOOL_SCHEMAS, getAllTools, getTool } from './configs/tool-schemas.js';
import { INFERENCE_PARAMS, getParams, mergeParams } from './configs/inference-params.js';

/**
 * Main LATIF-NI class with Kimi integration
 */
export class LATIFNI {
    constructor(config = {}) {
        this.config = {
            // Backend
            mode: config.mode || process.env.LATIF_MODE || 'auto', // 'local', 'cloud', 'auto'

            // Local (Ollama)
            localURL: config.localURL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
            localModel: config.localModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b',

            // Cloud (Moonshot)
            cloudURL: config.cloudURL || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
            cloudModel: config.cloudModel || process.env.KIMI_MODEL || 'kimi-k2.6',
            cloudApiKey: config.cloudApiKey || process.env.KIMI_API_KEY || '',

            // Behavior
            defaultSkill: config.defaultSkill || 'default',
            defaultPreset: config.defaultPreset || 'kimiK2',
            pluginsDir: config.pluginsDir || process.env.KIMI_PLUGINS_DIR || './kimi-integration/plugins',

            ...config
        };

        this.router = null;
        this.adapter = null;
        this.skills = null;
        this.plugins = null;
        this.tools = null;
        this.initialized = false;
    }

    /**
     * Initialize all components
     */
    async init() {
        if (this.initialized) return this;

        // 1. Initialize backend router
        this.router = new BackendRouter({
            localURL: this.config.localURL,
            localModel: this.config.localModel,
            cloudURL: this.config.cloudURL,
            cloudModel: this.config.cloudModel,
            cloudApiKey: this.config.cloudApiKey,
            localEnabled: this.config.mode !== 'cloud',
            cloudEnabled: this.config.mode !== 'local' && !!this.config.cloudApiKey
        });

        // 2. Initialize skills
        this.skills = new SkillRegistry({ pluginsDir: this.config.pluginsDir });
        await this.skills.init();

        // 3. Initialize plugin manager
        this.plugins = this.skills.pluginManager;

        // 4. Initialize tool caller
        this.tools = new ToolCaller(this.plugins.getToolMap());

        // 5. Get initial adapter
        this.adapter = await this.router.getAdapter(
            this.config.mode === 'cloud' ? 'cloud' : 'local'
        );

        this.initialized = true;
        console.log('[LATIF-NI] Initialized successfully');
        console.log(`[LATIF-NI] Backend: ${this.router.current}`);
        console.log(`[LATIF-NI] Skills: ${this.skills.list().length}`);
        console.log(`[LATIF-NI] Plugins: ${this.plugins.list().length}`);

        return this;
    }

    /**
     * Simple chat - no tools, no streaming
     */
    async chat(message, options = {}) {
        await this._ensureInit();

        const skill = this.skills.get(options.skill || this.config.defaultSkill);
        const params = mergeParams(options.preset || this.config.defaultPreset, options);

        const messages = [
            { role: 'system', content: skill?.systemPrompt || getPrompt('default') },
            { role: 'user', content: message }
        ];

        const response = await this.router.chat(messages, {
            ...params,
            preferredBackend: options.backend
        });

        return response.choices[0]?.message?.content || '';
    }

    /**
     * Streaming chat
     */
    async *stream(message, options = {}) {
        await this._ensureInit();

        const skill = this.skills.get(options.skill || this.config.defaultSkill);
        const params = mergeParams(options.preset || this.config.defaultPreset, options);

        const messages = [
            { role: 'system', content: skill?.systemPrompt || getPrompt('default') },
            { role: 'user', content: message }
        ];

        yield* this.router.streamChat(messages, {
            ...params,
            preferredBackend: options.backend
        });
    }

    /**
     * Chat with tools (Kimi K2 style)
     */
    async chatWithTools(message, options = {}) {
        await this._ensureInit();

        const skill = this.skills.get(options.skill || this.config.defaultSkill);
        const params = mergeParams(options.preset || this.config.defaultPreset, options);
        const tools = options.tools || this.plugins.getTools();

        if (tools.length === 0) {
            return this.chat(message, options);
        }

        const messages = [
            { role: 'system', content: skill?.systemPrompt || getPrompt('toolUse') },
            { role: 'user', content: message }
        ];

        const result = await this.tools.runLoop(this.adapter, messages, tools, params);
        return result.finalResponse.choices[0]?.message?.content || '';
    }

    /**
     * Execute a specific skill
     */
    async useSkill(skillName, context = {}) {
        await this._ensureInit();
        return this.skills.execute(skillName, context, this.adapter);
    }

    /**
     * Switch backend at runtime
     */
    async switchBackend(target) {
        await this._ensureInit();
        this.adapter = await this.router.getAdapter(target);
        return this.router.getStatus();
    }

    /**
     * Get system status
     */
    async status() {
        await this._ensureInit();
        const health = await this.router.healthCheckAll();
        return {
            initialized: this.initialized,
            backend: this.router.getStatus(),
            health,
            skills: this.skills.list(),
            plugins: this.plugins.list()
        };
    }

    async _ensureInit() {
        if (!this.initialized) {
            await this.init();
        }
    }
}

/**
 * Factory function - quick start
 */
export async function createLATIF(config = {}) {
    const latif = new LATIFNI(config);
    await latif.init();
    return latif;
}

// Re-exports for direct access
export {
    KimiAdapter,
    BackendRouter,
    PluginManager,
    SkillRegistry,
    ToolCaller,
    StreamHandler,
    SYSTEM_PROMPTS,
    getPrompt,
    TOOL_SCHEMAS,
    getAllTools,
    getTool,
    INFERENCE_PARAMS,
    getParams,
    mergeParams
};

export default LATIFNI;

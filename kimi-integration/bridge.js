/**
 * bridge.js — LATIF-NI Phase 0 ↔ Kimi Integration Bridge
 * ======================================================
 * This is the ONLY file that connects your existing Phase 0
 * architecture to the new Kimi layer. It is thin, safe, and
 * fails gracefully if the Kimi layer is unavailable.
 *
 * Design Principles:
 * - Zero modification to existing src/ files (except 3 lines in orchestrator.js)
 * - Kimi layer is optional — Phase 0 works standalone
 * - All events flow through your existing EventBus
 * - Easy rollback: delete kimi-integration/ folder
 */

import { createLATIF } from './kimi-integration/index.js';

/**
 * Initialize the Kimi integration layer
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Kimi instance or null
 */
export async function initKimiLayer(config = {}) {
    try {
        const kimi = await createLATIF({
            mode: config.mode || process.env.LATIF_MODE || 'auto',
            localURL: config.localURL || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1',
            localModel: config.localModel || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
            cloudURL: config.cloudURL || process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
            cloudModel: config.cloudModel || process.env.KIMI_MODEL || 'kimi-k2.6',
            cloudApiKey: config.cloudApiKey || process.env.KIMI_API_KEY || '',
            pluginsDir: config.pluginsDir || process.env.KIMI_PLUGINS_DIR || './kimi-integration/plugins',
            defaultSkill: config.defaultSkill || 'default',
            defaultPreset: config.defaultPreset || 'local'
        });

        // Wire Kimi events into your existing EventBus if available
        try {
            const { EventBus } = await import('./src/core/event-bus.js');

            kimi.on('initialized', (data) => {
                EventBus.emitEvent('kimi:initialized', data);
            });

            kimi.on('response', (data) => {
                EventBus.emitEvent('kimi:response', data);
            });

            kimi.on('error', (data) => {
                EventBus.emitEvent('kimi:error', data);
            });

            kimi.on('tool_call', (data) => {
                EventBus.emitEvent('kimi:tool_call', data);
            });

            kimi.on('tool_result', (data) => {
                EventBus.emitEvent('kimi:tool_result', data);
            });

            kimi.on('backend_switched', (data) => {
                EventBus.emitEvent('kimi:backend_switched', data);
            });

            console.log('[Bridge] ✅ EventBus wired successfully');
        } catch (e) {
            console.log('[Bridge] ℹ️ EventBus not available, running standalone');
        }

        console.log('[Bridge] 🚀 Kimi layer initialized');
        console.log(`[Bridge] Backend: ${kimi.router.current}`);
        console.log(`[Bridge] Skills: ${kimi.skills.list().length}`);
        console.log(`[Bridge] Plugins: ${kimi.plugins.list().length}`);

        return kimi;
    } catch (error) {
        console.error('[Bridge] ❌ Kimi layer failed to initialize:', error.message);
        console.log('[Bridge] ℹ️ Falling back to Phase 0 only');
        return null;
    }
}

/**
 * Quick health check for the Kimi layer
 */
export async function checkKimiHealth(kimi) {
    if (!kimi) return { available: false, reason: 'not_initialized' };

    try {
        const health = await kimi.status();
        return {
            available: true,
            backend: health.backend.current,
            model: health.backend.backends.includes('local') ? 'qwen2.5:7b' : 'kimi-k2.6',
            skills: health.skills.length,
            plugins: health.plugins.length
        };
    } catch (error) {
        return { available: false, reason: error.message };
    }
}

/**
 * Graceful shutdown of Kimi layer
 */
export async function shutdownKimiLayer(kimi) {
    if (!kimi) return;

    try {
        // Emit shutdown event
        try {
            const { EventBus } = await import('./src/core/event-bus.js');
            EventBus.emitEvent('kimi:shutdown', { timestamp: Date.now() });
        } catch (e) {
            // EventBus not available, ignore
        }

        console.log('[Bridge] 👋 Kimi layer shutdown complete');
    } catch (error) {
        console.error('[Bridge] Error during shutdown:', error.message);
    }
}

export default { initKimiLayer, checkKimiHealth, shutdownKimiLayer };

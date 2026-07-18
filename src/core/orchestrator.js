/**
 * orchestrator.js — Phase 0 Orchestrator for LATIF v5
 * Test-compatible interface for agent orchestration
 */

import { EventBus } from './event-bus.js';
import { getLogger } from './logger.js';

const logger = getLogger();

export class Orchestrator {
  constructor(config = {}) {
    this.config = config;
    this.memory = null;
    this.rag = null;
    this.kimi = null;
    this.kimiEnabled = config.kimiEnabled !== false;
    this.initialized = false;
  }

  async init() {
    try {
      // Initialize Phase 0 components (placeholder for now)
      logger.info('[Orchestrator] 🚀 Phase 0 initializing');

      this.initialized = true;
      logger.info('[Orchestrator] ✅ Phase 0 initialized');

      // Optionally initialize Kimi layer
      if (this.kimiEnabled) {
        try {
          const { initKimiLayer } = await import('../../bridge.js');
          this.kimi = await initKimiLayer({
            model: this.config.model || 'qwen2.5:7b',
            mode: process.env.LATIF_MODE || 'auto'
          });

          if (this.kimi) {
            logger.info('[Orchestrator] 🎯 Kimi bridge active');
          }
        } catch (error) {
          logger.info('[Orchestrator] ℹ️ Kimi bridge unavailable, Phase 0 only');
          this.kimi = null;
        }
      }

      return this;
    } catch (error) {
      logger.error('[Orchestrator] Initialization error:', error);
      throw error;
    }
  }

  async process(message, options = {}) {
    if (this.kimi && options.useKimi) {
      return this.kimi.chat(message, options);
    }
    return { text: message, source: 'phase0' };
  }

  async kimiChat(message, options = {}) {
    if (!this.kimi) {
      throw new Error('Kimi layer not available');
    }
    return this.kimi.chat(message, options);
  }

  async getFullStatus() {
    const status = {
      phase0: 'active',
      kimi: null
    };

    if (this.kimi) {
      const { checkKimiHealth } = await import('../../bridge.js');
      status.kimi = await checkKimiHealth(this.kimi);
    }

    return status;
  }

  async shutdown() {
    if (this.kimi) {
      try {
        const { shutdownKimiLayer } = await import('../../bridge.js');
        await shutdownKimiLayer(this.kimi);
      } catch (error) {
        logger.error('[Orchestrator] Shutdown error:', error);
      }
    }
  }
}

export default Orchestrator;

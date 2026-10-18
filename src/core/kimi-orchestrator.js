/**
 * Kimi Integration Bridge for LATIF v5
 * Bridges Kimi capabilities with LATIF's agent framework
 */

import { createLATIF } from '../../kimi-integration/index.js';
import { getLogger } from './logger.js';

const logger = getLogger();

export class KimiOrchestrator {
  constructor(config = {}) {
    this.config = config;
    this.kimi = null;
    this.enabled = config.kimiEnabled !== false;
    this.initialized = false;
  }

  async initialize() {
    if (!this.enabled) {
      logger.info('[KimiOrchestrator] Disabled via config');
      return false;
    }

    try {
      this.kimi = await createLATIF({
        model: this.config.model || 'qwen2.5:7b',
        mode: process.env.LATIF_MODE || 'auto',
        debug: process.env.LATIF_DEBUG === 'true'
      });

      this.initialized = true;
      logger.info('[KimiOrchestrator] ✅ Kimi bridge initialized');
      return true;
    } catch (error) {
      logger.error('[KimiOrchestrator] Failed to initialize Kimi bridge:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Chat via Kimi
   */
  async chat(message, options = {}) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.chat(message, options);
    } catch (error) {
      logger.error('[KimiOrchestrator] Chat error:', error);
      throw error;
    }
  }

  /**
   * Stream via Kimi
   */
  async *stream(message, options = {}) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      yield* this.kimi.stream(message, options);
    } catch (error) {
      logger.error('[KimiOrchestrator] Stream error:', error);
      throw error;
    }
  }

  /**
   * Chat with tools
   */
  async chatWithTools(message, options = {}) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.chatWithTools(message, options);
    } catch (error) {
      logger.error('[KimiOrchestrator] Tool chat error:', error);
      throw error;
    }
  }

  /**
   * Use a skill
   */
  async useSkill(skillName, context = {}) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.useSkill(skillName, context);
    } catch (error) {
      logger.error('[KimiOrchestrator] Skill error:', error);
      throw error;
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args = {}) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.executeTool(toolName, args);
    } catch (error) {
      logger.error('[KimiOrchestrator] Tool execution error:', error);
      throw error;
    }
  }

  /**
   * Load a plugin
   */
  async loadPlugin(pluginPath) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.loadPlugin(pluginPath);
    } catch (error) {
      logger.error('[KimiOrchestrator] Plugin load error:', error);
      throw error;
    }
  }

  /**
   * Switch backend at runtime
   */
  async switchBackend(mode) {
    if (!this.initialized || !this.kimi) {
      throw new Error('Kimi orchestrator not initialized');
    }

    try {
      return await this.kimi.switchBackend(mode);
    } catch (error) {
      logger.error('[KimiOrchestrator] Backend switch error:', error);
      throw error;
    }
  }

  /**
   * Get status
   */
  async getStatus() {
    if (!this.initialized || !this.kimi) {
      return { initialized: false, kimi: null };
    }

    try {
      return await this.kimi.status();
    } catch (error) {
      logger.error('[KimiOrchestrator] Status check error:', error);
      return { initialized: true, kimi: 'error', error: error.message };
    }
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.kimi) {
      try {
        if (typeof this.kimi.shutdown === 'function') {
          await this.kimi.shutdown();
        }
        this.kimi = null;
        this.initialized = false;
        logger.info('[KimiOrchestrator] Shutdown complete');
      } catch (error) {
        logger.error('[KimiOrchestrator] Shutdown error:', error);
      }
    }
  }
}

// Export singleton
export const kimiOrchestrator = new KimiOrchestrator({
  kimiEnabled: process.env.LATIF_KIMI_ENABLED !== 'false'
});

export default KimiOrchestrator;

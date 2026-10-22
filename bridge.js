/**
 * bridge.js — Integration bridge between LATIF v5 and Kimi
 * Provides initKimiLayer and checkKimiHealth for test suite
 */

import { createLATIF } from './kimi-integration/index.js';
import { getLogger } from './src/core/logger.js';

const logger = getLogger();

/**
 * Initialize Kimi layer for standalone or orchestrator use
 */
export async function initKimiLayer(config = {}) {
  try {
    const latif = await createLATIF({
      model: config.model || process.env.KIMI_MODEL || 'qwen2.5:7b',
      mode: config.mode || process.env.LATIF_MODE || 'auto',
      debug: process.env.LATIF_DEBUG === 'true'
    });

    logger.info('[Bridge] ✅ Kimi layer initialized');
    return latif;
  } catch (error) {
    logger.error('[Bridge] Failed to initialize Kimi layer:', error.message || String(error));
    console.error('[Bridge] Full error:', error);
    return null;
  }
}

/**
 * Health check for Kimi instance
 */
export async function checkKimiHealth(kimi) {
  if (!kimi) {
    return { available: false, reason: 'Kimi instance is null' };
  }

  try {
    const status = await kimi.status();
    return {
      available: !!status.backend,
      reason: status.backend || 'No backend available',
      status
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message,
      error
    };
  }
}

/**
 * Shutdown Kimi layer
 */
export async function shutdownKimiLayer(kimi) {
  if (kimi && typeof kimi.shutdown === 'function') {
    try {
      await kimi.shutdown();
      logger.info('[Bridge] Kimi layer shutdown complete');
    } catch (error) {
      logger.error('[Bridge] Kimi shutdown error:', error);
    }
  }
}

export default {
  initKimiLayer,
  checkKimiHealth,
  shutdownKimiLayer
};

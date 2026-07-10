/**
 * LATIF Configuration Manager
 * Environment-based and file-based configuration with validation
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

class ConfigManager {
  constructor() {
    this.config = {};
    this.env = process.env.NODE_ENV || 'development';
    this.initialized = false;
  }

  async initialize(configDir = './config') {
    try {
      // Load default configuration
      this.config = this.getDefaults();

      // Load environment-specific config
      const envConfigPath = path.join(configDir, `${this.env}.json`);
      if (fs.existsSync(envConfigPath)) {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));
        this.config = this.mergeConfig(this.config, envConfig);
        logger.info('Loaded environment configuration', { env: this.env });
      }

      // Load .env variables (override file config)
      this.loadEnvVariables();

      // Validate configuration
      this.validate();

      this.initialized = true;
      logger.info('Configuration initialized', { env: this.env });
    } catch (error) {
      logger.error('Configuration initialization failed', { error: error.message });
      throw error;
    }
  }

  getDefaults() {
    return {
      app: {
        name: 'LATIF',
        version: '5.0.0',
        debug: false,
        port: 3000,
        host: '0.0.0.0'
      },
      database: {
        path: './latif.db',
        maxConnections: 10,
        timeout: 5000,
        enableWAL: true
      },
      logging: {
        level: 'info',
        dir: './logs',
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 10,
        transports: ['console', 'file']
      },
      jobs: {
        concurrency: 4,
        retryAttempts: 3,
        retryDelay: 5000,
        maxTimeout: 300000,
        queues: ['default', 'background', 'priority']
      },
      agents: {
        maxConcurrent: 5,
        defaultTimeout: 300000,
        memoryLimit: 256,
        maxIterations: 10
      },
      api: {
        cors: {
          enabled: true,
          origins: ['http://localhost:3000']
        },
        rateLimit: {
          enabled: true,
          windowMs: 60000,
          max: 100
        },
        auth: {
          enabled: true,
          jwtSecret: 'change-me-in-production'
        }
      },
      features: {
        agentSystem: true,
        workflowEngine: true,
        knowledgeGraph: true,
        visionAI: true,
        voiceInterface: true,
        documentIntelligence: true,
        browserAutomation: true,
        pluginSystem: true
      },
      storage: {
        maxUploadSize: 100 * 1024 * 1024,
        uploadDir: './uploads',
        tempDir: './temp'
      },
      ai: {
        defaultModel: 'ollama',
        embedding: {
          model: 'all-MiniLM-L6-v2',
          dimension: 384
        },
        reranker: {
          enabled: true,
          model: 'cross-encoder/ms-marco-MiniLM-L-12-v2'
        }
      },
      monitoring: {
        enabled: true,
        metricsPort: 9090,
        healthCheckInterval: 30000
      }
    };
  }

  loadEnvVariables() {
    const envMapping = {
      'NODE_ENV': 'env',
      'APP_DEBUG': 'app.debug',
      'APP_PORT': 'app.port',
      'DB_PATH': 'database.path',
      'LOG_LEVEL': 'logging.level',
      'LOG_DIR': 'logging.dir',
      'JWT_SECRET': 'api.auth.jwtSecret',
      'UPLOAD_DIR': 'storage.uploadDir',
      'DEFAULT_MODEL': 'ai.defaultModel',
      'EMBEDDING_MODEL': 'ai.embedding.model',
      'CORS_ORIGINS': 'api.cors.origins'
    };

    for (const [envKey, configPath] of Object.entries(envMapping)) {
      if (process.env[envKey]) {
        this.setNested(configPath, this.parseEnvValue(process.env[envKey]));
      }
    }
  }

  parseEnvValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (!isNaN(value) && value !== '') return Number(value);
    if (value.startsWith('[') || value.startsWith('{')) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  mergeConfig(base, override) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = this.mergeConfig(base[key] || {}, value);
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  setNested(path, value) {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  getNested(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  get(path, defaultValue = undefined) {
    if (!this.initialized) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.getNested(path, defaultValue);
  }

  set(path, value) {
    this.setNested(path, value);
  }

  validate() {
    const errors = [];

    // Validate port
    const port = this.config.app.port;
    if (typeof port !== 'number' || port < 1 || port > 65535) {
      errors.push('app.port must be a number between 1 and 65535');
    }

    // Validate database
    if (!this.config.database.path) {
      errors.push('database.path is required');
    }

    // Validate log level
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLevels.includes(this.config.logging.level)) {
      errors.push(`logging.level must be one of: ${validLevels.join(', ')}`);
    }

    // Validate API settings
    if (this.config.api.auth.enabled && !this.config.api.auth.jwtSecret) {
      logger.warn('API auth enabled but jwtSecret not configured. Using default (insecure).');
    }

    if (errors.length > 0) {
      logger.error('Configuration validation failed', { errors });
      throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
    }
  }

  getAll() {
    if (!this.initialized) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.config };
  }

  async saveToFile(configPath) {
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
      logger.info('Configuration saved to file', { path: configPath });
    } catch (error) {
      logger.error('Failed to save configuration', { error: error.message });
      throw error;
    }
  }

  toString() {
    return JSON.stringify(this.config, null, 2);
  }
}

// Singleton instance
let configManager = null;

export async function initializeConfig(configDir = './config') {
  if (configManager) return configManager;

  configManager = new ConfigManager();
  await configManager.initialize(configDir);

  return configManager;
}

export function getConfig() {
  if (!configManager) {
    throw new Error('Config not initialized. Call initializeConfig() first.');
  }
  return configManager;
}

export { ConfigManager };

export default {
  initializeConfig,
  getConfig,
  ConfigManager
};

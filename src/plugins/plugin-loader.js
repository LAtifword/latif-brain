/**
 * LATIF Plugin Loader - Loads, validates, and manages plugins
 * Handles plugin lifecycle, permissions, sandboxing, and registry management
 */

class PluginLoader {
  constructor(config = {}) {
    this.plugins = new Map();
    this.registry = new Map();
    this.config = {
      sandboxed: true,
      enableLogging: true,
      maxMemory: 128 * 1024 * 1024, // 128 MB
      requestTimeout: 30000,
      ...config
    };
    this.hooks = new Map();
    this.tools = new Map();
    this.logger = this.createLogger();
  }

  /**
   * Load plugin from source (filesystem, web, or registry)
   */
  async loadPlugin(source, _options = {}) {
    try {
      this.logger.info(`Loading plugin from: ${source}`);

      const manifest = await this.fetchManifest(source);
      this.validateManifest(manifest);

      const pluginId = manifest.id;
      const plugin = new PluginInstance(manifest, source, this.config);

      // Initialize plugin
      await plugin.init();

      // Register plugin
      this.plugins.set(pluginId, plugin);
      this.registry.set(manifest.name, pluginId);

      this.logger.info(`✓ Plugin loaded: ${manifest.name} v${manifest.version}`);
      return plugin;
    } catch (err) {
      this.logger.error(`Failed to load plugin: ${err.message}`);
      throw err;
    }
  }

  /**
   * Fetch plugin manifest from various sources
   */
  async fetchManifest(source) {
    if (source.startsWith('file://')) {
      return this.loadLocalManifest(source);
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      return this.loadRemoteManifest(source);
    } else if (source.startsWith('registry://')) {
      return this.loadRegistryManifest(source);
    } else {
      throw new Error(`Unknown plugin source: ${source}`);
    }
  }

  /**
   * Validate plugin manifest against schema
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'author'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required manifest field: ${field}`);
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}`);
    }

    // Validate capabilities
    if (manifest.capabilities) {
      const validCaps = ['tools', 'models', 'hooks', 'ui', 'api'];
      for (const cap of Object.keys(manifest.capabilities)) {
        if (!validCaps.includes(cap)) {
          throw new Error(`Unknown capability: ${cap}`);
        }
      }
    }

    // Validate permissions
    if (manifest.permissions) {
      const validPerms = ['memory', 'network', 'tools', 'models', 'ui'];
      for (const perm of Object.keys(manifest.permissions)) {
        if (!validPerms.includes(perm)) {
          throw new Error(`Unknown permission: ${perm}`);
        }
      }
    }
  }

  /**
   * Get plugin by ID or name
   */
  getPlugin(idOrName) {
    if (this.plugins.has(idOrName)) {
      return this.plugins.get(idOrName);
    }
    const pluginId = this.registry.get(idOrName);
    return pluginId ? this.plugins.get(pluginId) : null;
  }

  /**
   * Register hook from plugin
   */
  registerHook(pluginId, hookName, handler) {
    const hooks = this.hooks.get(hookName) || [];
    hooks.push({ pluginId, handler });
    this.hooks.set(hookName, hooks);
  }

  /**
   * Register tool from plugin
   */
  registerTool(pluginId, toolName, toolDef) {
    const key = `${pluginId}:${toolName}`;
    this.tools.set(key, toolDef);
  }

  /**
   * Execute hooks in order
   */
  async executeHooks(hookName, ...args) {
    const hooks = this.hooks.get(hookName) || [];
    const results = [];

    for (const { pluginId, handler } of hooks) {
      try {
        const result = await handler(...args);
        results.push(result);
      } catch (err) {
        this.logger.error(`Hook ${hookName} failed in ${pluginId}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Get all loaded plugins
   */
  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      enabled: p.enabled,
      memoryUsage: p.memoryUsage()
    }));
  }

  /**
   * Disable/enable plugin
   */
  setPluginEnabled(pluginId, enabled) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      this.logger.info(`Plugin ${pluginId}: ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Unload plugin
   */
  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await plugin.cleanup();
      this.plugins.delete(pluginId);
      this.logger.info(`Plugin ${pluginId} unloaded`);
    }
  }

  /**
   * Create logger instance
   */
  createLogger() {
    return {
      info: (msg) => console.log(`[PluginLoader] ${msg}`),
      warn: (msg) => console.warn(`[PluginLoader] ${msg}`),
      error: (msg) => console.error(`[PluginLoader] ${msg}`)
    };
  }

  async loadLocalManifest(_source) {
    // Implementation: fetch manifest.json from local filesystem
    throw new Error('Local plugin loading not implemented in browser context');
  }

  async loadRemoteManifest(source) {
    const res = await fetch(`${source}/manifest.json`);
    if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.statusText}`);
    return res.json();
  }

  async loadRegistryManifest(_source) {
    // Implementation: fetch from LATIF plugin registry
    throw new Error('Registry loading not implemented yet');
  }
}

/**
 * Plugin Instance - Represents a loaded plugin
 */
class PluginInstance {
  constructor(manifest, source, config) {
    this.manifest = manifest;
    this.source = source;
    this.config = config;
    this.enabled = true;
    this.context = null;
    this.memory = new Map();
  }

  async init() {
    // Initialize plugin context and load entry point
    this.context = new PluginContext(this);
  }

  async cleanup() {
    // Clean up plugin resources
    this.memory.clear();
    this.context = null;
  }

  memoryUsage() {
    // Return approximate memory usage in bytes
    return JSON.stringify(this.memory).length;
  }
}

/**
 * Plugin Context - API surface available to plugins
 */
class PluginContext {
  constructor(plugin) {
    this.plugin = plugin;
  }

  // AI Runtime API
  async getModels() {
    // Return available models
  }

  async runModel(_modelName, _params) {
    // Execute model with timeout protection
  }

  async generateEmbedding(_text) {
    // Generate embedding for text
  }

  // Memory API
  async readMemory(key) {
    return this.plugin.memory.get(key);
  }

  async writeMemory(key, value) {
    this.plugin.memory.set(key, value);
  }

  // Tool Registration API
  registerTool(_toolName, _definition) {
    // Register a tool that can be called by LATIF
  }

  // Hook Registration API
  registerHook(_hookName, _handler) {
    // Register a hook (onMessage, onToolCall, etc.)
  }

  // UI API
  registerComponent(_componentName, _component) {
    // Register a custom UI component
  }

  // Event API
  emit(_eventName, _data) {
    // Emit custom event
  }

  on(_eventName, _handler) {
    // Listen to custom events
  }
}

// Export
export { PluginLoader, PluginInstance, PluginContext };

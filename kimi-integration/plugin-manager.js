import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';

/**
 * PluginManager - Kimi-style plugin marketplace for LATIF-NI
 * Loads plugins from: local directory, GitHub repos, or inline definitions
 */
export class PluginManager {
    constructor(config = {}) {
        this.pluginsDir = config.pluginsDir || process.env.KIMI_PLUGINS_DIR || './kimi-integration/plugins';
        this.plugins = new Map();
        this.hooks = {
            preToolCall: [],
            postToolCall: [],
            preChat: [],
            postChat: [],
            onError: []
        };
    }

    /**
     * Load all plugins from the plugins directory
     */
    async loadAll() {
        try {
            const entries = await readdir(this.pluginsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.loadPlugin(entry.name);
                } else if (extname(entry.name) === '.js') {
                    await this.loadPluginFile(entry.name);
                }
            }

            console.log(`[PluginManager] Loaded ${this.plugins.size} plugins`);
        } catch (error) {
            console.log('[PluginManager] No plugins directory found, starting empty');
        }
    }

    /**
     * Load a single plugin by name
     */
    async loadPlugin(name) {
        const pluginPath = join(this.pluginsDir, name, 'index.js');
        try {
            const module = await import(pathToFileURL(pluginPath).href);
            const plugin = module.default || module;

            if (this._validatePlugin(plugin)) {
                this.plugins.set(plugin.name, plugin);
                this._registerHooks(plugin);
                console.log(`[PluginManager] Loaded plugin: ${plugin.name} v${plugin.version}`);
                return plugin;
            }
        } catch (error) {
            console.error(`[PluginManager] Failed to load plugin "${name}":`, error.message);
        }
    }

    /**
     * Load a plugin from a GitHub URL (Kimi marketplace style)
     */
    async loadFromGitHub(repoUrl, options = {}) {
        // In production, this would clone or fetch raw files
        // For Termux/local use, we support local git clones
        console.log(`[PluginManager] GitHub loading not yet implemented for: ${repoUrl}`);
        console.log(`[PluginManager] Please clone manually to: ${this.pluginsDir}/`);
    }

    /**
     * Register an inline plugin
     */
    register(plugin) {
        if (this._validatePlugin(plugin)) {
            this.plugins.set(plugin.name, plugin);
            this._registerHooks(plugin);
            console.log(`[PluginManager] Registered inline plugin: ${plugin.name}`);
            return true;
        }
        return false;
    }

    /**
     * Get a plugin by name
     */
    get(name) {
        return this.plugins.get(name);
    }

    /**
     * Get all plugins as tools for tool-calling
     */
    getTools() {
        const tools = [];
        for (const plugin of this.plugins.values()) {
            if (plugin.tools) {
                tools.push(...plugin.tools);
            }
        }
        return tools;
    }

    /**
     * Get tool implementation map
     */
    getToolMap() {
        const map = {};
        for (const plugin of this.plugins.values()) {
            if (plugin.handlers) {
                Object.assign(map, plugin.handlers);
            }
        }
        return map;
    }

    /**
     * Execute lifecycle hooks
     */
    async executeHook(hookName, context) {
        const hooks = this.hooks[hookName] || [];
        for (const hook of hooks) {
            try {
                await hook(context);
            } catch (error) {
                console.error(`[PluginManager] Hook error in ${hookName}:`, error.message);
            }
        }
    }

    _validatePlugin(plugin) {
        const required = ['name', 'version', 'description'];
        for (const field of required) {
            if (!plugin[field]) {
                console.error(`[PluginManager] Plugin missing required field: ${field}`);
                return false;
            }
        }
        return true;
    }

    _registerHooks(plugin) {
        if (plugin.hooks) {
            for (const [hookName, handler] of Object.entries(plugin.hooks)) {
                if (this.hooks[hookName]) {
                    this.hooks[hookName].push(handler);
                }
            }
        }
    }

    list() {
        return Array.from(this.plugins.values()).map(p => ({
            name: p.name,
            version: p.version,
            description: p.description,
            author: p.author || 'unknown',
            tools: p.tools?.length || 0
        }));
    }
}

export default PluginManager;

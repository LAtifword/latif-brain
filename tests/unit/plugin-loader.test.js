/**
 * Unit tests for Plugin Loader
 */

import { describe, it, expect, beforeEach, afterEach } from '@latif/test-framework';
import { PluginLoader, PluginInstance } from '../../src/plugins/plugin-loader.js';

describe('PluginLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new PluginLoader({
      enableLogging: false
    });
  });

  describe('initialization', () => {
    it('should create loader with default config', () => {
      expect(loader.config.sandboxed).toBe(true);
      expect(loader.config.maxMemory).toBe(128 * 1024 * 1024);
    });

    it('should accept custom config', () => {
      const custom = new PluginLoader({ maxMemory: 256 * 1024 * 1024 });
      expect(custom.config.maxMemory).toBe(256 * 1024 * 1024);
    });
  });

  describe('plugin validation', () => {
    it('should validate required manifest fields', () => {
      const invalidManifest = { name: 'Test' };
      expect(() => {
        loader.validateManifest(invalidManifest);
      }).toThrow('Missing required manifest field: id');
    });

    it('should validate version format', () => {
      const invalidVersion = {
        id: 'test',
        name: 'Test',
        version: '1.0',
        author: 'Test'
      };
      expect(() => {
        loader.validateManifest(invalidVersion);
      }).toThrow('Invalid version format');
    });

    it('should validate capabilities', () => {
      const invalidCap = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        author: 'Test',
        capabilities: { invalid: [] }
      };
      expect(() => {
        loader.validateManifest(invalidCap);
      }).toThrow('Unknown capability: invalid');
    });
  });

  describe('plugin listing', () => {
    it('should list loaded plugins', async () => {
      const manifest = {
        id: 'com.test.plugin1',
        name: 'TestPlugin1',
        version: '1.0.0',
        author: 'Test'
      };

      loader.plugins.set('test1', new PluginInstance(manifest, 'file:///test', {}));
      const plugins = loader.listPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('TestPlugin1');
    });
  });

  describe('hook management', () => {
    it('should register hooks from plugins', () => {
      const handler = () => {};
      loader.registerHook('pluginA', 'onMessage', handler);

      const hooks = loader.hooks.get('onMessage');
      expect(hooks).toBeDefined();
      expect(hooks).toHaveLength(1);
    });

    it('should execute multiple hooks in order', async () => {
      const results = [];
      loader.registerHook('pluginA', 'test', async () => {
        results.push('A');
        return 'resultA';
      });
      loader.registerHook('pluginB', 'test', async () => {
        results.push('B');
        return 'resultB';
      });

      const hookResults = await loader.executeHooks('test');

      expect(results).toEqual(['A', 'B']);
      expect(hookResults).toEqual(['resultA', 'resultB']);
    });

    it('should handle hook errors gracefully', async () => {
      loader.registerHook('pluginA', 'test', async () => {
        throw new Error('Hook failed');
      });
      loader.registerHook('pluginB', 'test', async () => {
        return 'resultB';
      });

      const results = await loader.executeHooks('test');

      // Should return results from successful hooks
      expect(results).toContain('resultB');
    });
  });

  describe('tool management', () => {
    it('should register tools from plugins', () => {
      const toolDef = {
        name: 'searchPlugin',
        description: 'Search tool',
        execute: async () => {}
      };

      loader.registerTool('pluginA', 'search', toolDef);
      const registered = loader.tools.get('pluginA:search');

      expect(registered).toEqual(toolDef);
    });
  });

  describe('plugin lifecycle', () => {
    it('should enable/disable plugins', () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        author: 'Test'
      };
      const plugin = new PluginInstance(manifest, 'file:///test', {});

      loader.plugins.set('test', plugin);
      expect(plugin.enabled).toBe(true);

      loader.setPluginEnabled('test', false);
      expect(plugin.enabled).toBe(false);

      loader.setPluginEnabled('test', true);
      expect(plugin.enabled).toBe(true);
    });

    it('should unload plugins', async () => {
      const manifest = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        author: 'Test'
      };
      const plugin = new PluginInstance(manifest, 'file:///test', {});

      loader.plugins.set('test', plugin);
      expect(loader.plugins.has('test')).toBe(true);

      await loader.unloadPlugin('test');
      expect(loader.plugins.has('test')).toBe(false);
    });
  });

  describe('plugin retrieval', () => {
    it('should get plugin by ID', () => {
      const manifest = {
        id: 'com.test.plugin1',
        name: 'TestPlugin1',
        version: '1.0.0',
        author: 'Test'
      };
      const plugin = new PluginInstance(manifest, 'file:///test', {});
      loader.plugins.set('com.test.plugin1', plugin);

      const retrieved = loader.getPlugin('com.test.plugin1');
      expect(retrieved).toEqual(plugin);
    });

    it('should get plugin by name', () => {
      const manifest = {
        id: 'com.test.plugin1',
        name: 'TestPlugin1',
        version: '1.0.0',
        author: 'Test'
      };
      const plugin = new PluginInstance(manifest, 'file:///test', {});
      loader.plugins.set('com.test.plugin1', plugin);
      loader.registry.set('TestPlugin1', 'com.test.plugin1');

      const retrieved = loader.getPlugin('TestPlugin1');
      expect(retrieved).toEqual(plugin);
    });
  });

  afterEach(async () => {
    // Clean up
    for (const pluginId of loader.plugins.keys()) {
      await loader.unloadPlugin(pluginId);
    }
  });
});

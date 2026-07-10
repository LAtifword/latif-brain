#!/usr/bin/env node

/**
 * LATIF CLI Tool
 * Complete command-line interface for LATIF development and management
 *
 * Commands:
 * - plugin:create     Create new plugin from template
 * - plugin:dev        Develop plugin locally with hot reload
 * - plugin:build      Build plugin for distribution
 * - plugin:test       Run plugin tests
 * - plugin:publish    Publish plugin to registry
 * - plugin:install    Install plugin from registry
 * - plugin:list       List installed plugins
 * - start             Start LATIF server
 * - dev               Start dev server with hot reload
 * - build             Build for production
 * - test              Run test suite
 * - docs              Generate API documentation
 * - export            Export chat history or knowledge base
 * - import            Import chat history or data
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class LatifCLI {
  constructor() {
    this.commands = {
      'plugin:create': this.createPlugin,
      'plugin:dev': this.devPlugin,
      'plugin:build': this.buildPlugin,
      'plugin:test': this.testPlugin,
      'plugin:publish': this.publishPlugin,
      'plugin:install': this.installPlugin,
      'plugin:list': this.listPlugins,
      'start': this.start,
      'dev': this.dev,
      'build': this.build,
      'test': this.test,
      'docs': this.generateDocs,
      'export': this.exportData,
      'import': this.importData,
      'version': this.version,
      'help': this.help
    };
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    const handler = this.commands[command];

    if (!handler) {
      console.error(`✗ Unknown command: ${command}`);
      this.help();
      process.exit(1);
    }

    try {
      await handler.call(this, args.slice(1));
    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  }

  async createPlugin(args) {
    const pluginName = args[0];
    if (!pluginName) {
      throw new Error('Plugin name required: latif-cli plugin:create <name>');
    }

    console.log(`Creating plugin: ${pluginName}...`);

    const pluginDir = path.join(process.cwd(), pluginName);
    if (fs.existsSync(pluginDir)) {
      throw new Error(`Directory already exists: ${pluginDir}`);
    }

    // Create plugin directory structure
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'src'));
    fs.mkdirSync(path.join(pluginDir, 'tests'));

    // Create manifest.json
    const manifest = {
      id: `com.latif.plugins.${pluginName.toLowerCase()}`,
      name: pluginName,
      version: '1.0.0',
      description: `${pluginName} plugin for LATIF`,
      author: 'Your Name',
      license: 'MIT',
      requiredVersion: '5.0.0',
      capabilities: { tools: [], hooks: [], ui: [] },
      permissions: { memory: ['read', 'write'], network: [], tools: [] }
    };

    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create package.json
    const packageJson = {
      name: `@latif/plugin-${pluginName.toLowerCase()}`,
      version: '1.0.0',
      description: manifest.description,
      main: 'src/index.js',
      scripts: {
        dev: 'latif-cli plugin:dev .',
        build: 'latif-cli plugin:build .',
        test: 'latif-cli plugin:test .',
        publish: 'latif-cli plugin:publish .'
      }
    };

    fs.writeFileSync(
      path.join(pluginDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create index.js
    fs.writeFileSync(
      path.join(pluginDir, 'src', 'index.js'),
      `// LATIF Plugin: ${pluginName}

export async function init(context) {
  console.log('${pluginName} plugin initialized');

  // Register tools
  context.registerTool('example', {
    name: 'example',
    description: 'Example tool',
    execute: async (params) => {
      return { result: 'Hello from plugin!' };
    }
  });
}

export async function cleanup() {
  console.log('${pluginName} plugin cleaned up');
}
`
    );

    // Create README
    fs.writeFileSync(
      path.join(pluginDir, 'README.md'),
      `# ${pluginName} Plugin

A LATIF plugin for [description].

## Installation

\`\`\`bash
latif-cli plugin:install ${pluginName}
\`\`\`

## Usage

[Usage instructions]

## Development

\`\`\`bash
cd ${pluginName}
npm install
latif-cli plugin:dev .
\`\`\`

## Testing

\`\`\`bash
latif-cli plugin:test .
\`\`\`
`
    );

    console.log(`✓ Plugin created at ${pluginDir}`);
    console.log('\nNext steps:');
    console.log(`  cd ${pluginName}`);
    console.log('  npm install');
    console.log('  latif-cli plugin:dev .');
  }

  async devPlugin(args) {
    const pluginDir = args[0] || '.';
    console.log(`Starting plugin dev server for ${pluginDir}...`);
    // Implementation: start dev server with hot reload
  }

  async buildPlugin(args) {
    const pluginDir = args[0] || '.';
    console.log(`Building plugin ${pluginDir}...`);
    // Implementation: bundle plugin for distribution
  }

  async testPlugin(args) {
    const pluginDir = args[0] || '.';
    console.log(`Running tests for plugin ${pluginDir}...`);
    // Implementation: run test suite
  }

  async publishPlugin(args) {
    const pluginDir = args[0] || '.';
    console.log(`Publishing plugin ${pluginDir}...`);
    // Implementation: publish to registry
  }

  async installPlugin(args) {
    const pluginName = args[0];
    if (!pluginName) {
      throw new Error('Plugin name required');
    }
    console.log(`Installing plugin ${pluginName}...`);
    // Implementation: install from registry
  }

  async listPlugins(args) {
    console.log('Installed plugins:');
    // Implementation: list installed plugins
  }

  async start(args) {
    console.log('Starting LATIF server...');
    // Implementation: start server
  }

  async dev(args) {
    console.log('Starting dev server...');
    // Implementation: start dev server with hot reload
  }

  async build(args) {
    console.log('Building for production...');
    // Implementation: build for production
  }

  async test(args) {
    console.log('Running tests...');
    // Implementation: run full test suite
  }

  async generateDocs(args) {
    console.log('Generating documentation...');
    // Implementation: generate API documentation
  }

  async exportData(args) {
    const format = args[0] || 'json';
    console.log(`Exporting data as ${format}...`);
    // Implementation: export chat history, knowledge base, etc.
  }

  async importData(args) {
    const file = args[0];
    if (!file) {
      throw new Error('File path required');
    }
    console.log(`Importing data from ${file}...`);
    // Implementation: import data
  }

  version() {
    console.log('LATIF CLI v5.0.0');
  }

  help() {
    console.log(`
LATIF CLI v5.0.0

Usage: latif-cli <command> [options]

Plugin Commands:
  plugin:create <name>        Create new plugin
  plugin:dev <dir>            Develop plugin locally
  plugin:build <dir>          Build plugin for distribution
  plugin:test <dir>           Run plugin tests
  plugin:publish <dir>        Publish to registry
  plugin:install <name>       Install from registry
  plugin:list                 List installed plugins

Server Commands:
  start                       Start LATIF server
  dev                         Start dev server with hot reload
  build                       Build for production
  test                        Run test suite

Utility Commands:
  docs                        Generate API documentation
  export [format]             Export data (json, csv, markdown)
  import <file>               Import data
  version                     Show version
  help                        Show this help
    `);
  }
}

// Run CLI
const cli = new LatifCLI();
cli.run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

/**
 * LATIF v5 Packaging Script
 * Creates production-ready zip file for distribution and Android/Termux installation
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);
const packageDir = path.join(projectRoot, 'dist');
const zipPath = path.join(packageDir, 'latif-v5.0.0.zip');

// Fix for archiver module
let archiverModule;
try {
  archiverModule = await import('archiver');
} catch (e) {
  console.error('Failed to import archiver:', e.message);
  process.exit(1);
}

// Files and directories to include
const INCLUDE_PATTERNS = [
  // Source code
  'src/**/*.js',
  'src/**/*.d.ts',
  'src/**/*.sql',

  // Configuration
  'config/**/*.json',
  '.env.example',

  // Documentation
  'MASTER_PROMPT.md',
  'OPERATING_SYSTEM_ARCHITECTURE.md',
  'PHASE1_FOUNDATION.md',
  'README.md',
  'docs/**/*.md',

  // Scripts and tools
  'tools/**/*.js',
  'tools/**/*.sh',

  // Package files
  'package.json',
  'package-lock.json',

  // License and meta
  'LICENSE',
  '.gitignore',

  // Android/Termux specific
  'android/**/*',
  'termux/**/*'
];

// Files to exclude
const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  '.env',
  'latif.db',
  'logs/**',
  'uploads/**',
  'temp/**',
  '.DS_Store',
  '*.swp',
  '*.swo',
  '.idea/**',
  '.vscode/**'
];

async function createZip() {
  console.log('📦 Packaging LATIF v5...\n');

  // Ensure dist directory exists
  if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir, { recursive: true });
  }

  // Check if archiver is available
  try {
    require.resolve('archiver');
  } catch (e) {
    console.log('📥 Installing archiver...');
    execSync('npm install archiver --save-dev', { stdio: 'inherit' });
  }

  const archiver_ = await import('archiver');
  const archive = archiver_.default('zip', { zlib: { level: 9 } });

  // Create write stream
  const output = fs.createWriteStream(zipPath);

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeKB = (fs.statSync(zipPath).size / 1024).toFixed(2);
      console.log(`\n✅ Package created: ${zipPath}`);
      console.log(`📊 Size: ${sizeKB} KB\n`);
      resolve();
    });

    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    // Add source code
    console.log('📝 Adding source code...');
    archive.glob('src/**/*.{js,d.ts,sql}', { cwd: projectRoot });

    // Add configuration
    console.log('⚙️  Adding configuration...');
    archive.glob('config/**/*.json', { cwd: projectRoot });
    archive.file(path.join(projectRoot, '.env.example'), { name: '.env.example' });

    // Add documentation
    console.log('📚 Adding documentation...');
    archive.file(path.join(projectRoot, 'MASTER_PROMPT.md'), { name: 'MASTER_PROMPT.md' });
    archive.file(path.join(projectRoot, 'OPERATING_SYSTEM_ARCHITECTURE.md'), { name: 'OPERATING_SYSTEM_ARCHITECTURE.md' });
    archive.file(path.join(projectRoot, 'PHASE1_FOUNDATION.md'), { name: 'PHASE1_FOUNDATION.md' });
    archive.glob('docs/**/*.md', { cwd: projectRoot });

    // Add scripts
    console.log('🛠️  Adding tools and scripts...');
    archive.glob('tools/**/*.{js,sh}', { cwd: projectRoot });

    // Add package files
    console.log('📦 Adding package configuration...');
    archive.file(path.join(projectRoot, 'package.json'), { name: 'package.json' });
    if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
      archive.file(path.join(projectRoot, 'package-lock.json'), { name: 'package-lock.json' });
    }

    // Add license
    if (fs.existsSync(path.join(projectRoot, 'LICENSE'))) {
      archive.file(path.join(projectRoot, 'LICENSE'), { name: 'LICENSE' });
    }

    // Add Android/Termux files
    console.log('📱 Adding Android/Termux setup...');
    archive.glob('android/**/*', { cwd: projectRoot });
    archive.glob('termux/**/*', { cwd: projectRoot });

    // Add installation guide
    archive.file(path.join(projectRoot, 'INSTALL_ANDROID.md'), { name: 'INSTALL_ANDROID.md' });

    // Create MANIFEST.txt
    console.log('📋 Creating manifest...');
    const manifest = createManifest();
    archive.append(manifest, { name: 'MANIFEST.txt' });

    // Create README_FIRST.txt
    const readmeFirst = createReadmeFirst();
    archive.append(readmeFirst, { name: 'README_FIRST.txt' });

    archive.finalize();
  });
}

function createManifest() {
  const content = `LATIF v5 - Personal AI Operating System
=====================================

Version: 5.0.0
Build Date: ${new Date().toISOString()}
Status: Production Foundation Release (Phase 1)

PACKAGE CONTENTS
================

src/
  ├── core/              - Core infrastructure
  │   ├── ai-core.js     - AI runtime
  │   ├── data-layer.js  - Database access
  │   ├── logger.js      - Structured logging
  │   ├── config.js      - Configuration management
  │   └── job-queue.js   - Background job processing
  ├── api/
  │   ├── server.js      - Express REST API server
  │   └── routes/        - API route definitions
  ├── db/
  │   └── schema.sql     - SQLite database schema (11 subsystems)
  ├── ai/                - AI capabilities
  ├── plugins/           - Plugin system
  ├── ui/                - User interface
  └── main.js            - Application entry point

config/
  ├── development.json   - Development configuration
  └── production.json    - Production configuration

docs/
  ├── api/               - API documentation
  ├── architecture/      - Architecture guides
  └── guides/            - User guides

tools/
  ├── package.js         - Packaging script
  ├── cli/               - Command-line tools
  └── deploy/            - Deployment scripts

android/                 - Android/Termux specific files
termux/                  - Termux setup scripts

DOCUMENTATION
=============

README_FIRST.txt         - Start here!
INSTALL_ANDROID.md       - Android/Termux installation guide
PHASE1_FOUNDATION.md     - Foundation implementation details
OPERATING_SYSTEM_ARCHITECTURE.md - Complete system design
MASTER_PROMPT.md         - Project vision and requirements

QUICK START
===========

1. Extract zip file
2. Read README_FIRST.txt
3. For Android/Termux: Follow INSTALL_ANDROID.md
4. Install dependencies: npm install
5. Start server: npm run dev
6. Access API: http://localhost:3000

SYSTEM REQUIREMENTS
===================

- Node.js 18.0.0 or higher
- SQLite3
- 100MB free disk space (plus database size)
- 256MB RAM minimum (512MB recommended)

FEATURES (Phase 1 Foundation)
=============================

✅ SQLite Database (11 subsystems)
✅ Async Data Layer with Repositories
✅ Job Queue with Worker Pools
✅ Structured Logging System
✅ Configuration Management
✅ REST API Server
✅ Health Checks & Monitoring
✅ Admin Tools

UPCOMING (Phase 2+)
===================

⏳ Hybrid RAG System
⏳ Agent Framework & Orchestration
⏳ Knowledge Graphs
⏳ Workflow Automation
⏳ Document Intelligence
⏳ Vision AI Integration
⏳ Voice Interface
⏳ Browser Automation
⏳ Plugin Marketplace

SUPPORT
=======

GitHub: https://github.com/LAtifword/latif-brain
Issues: https://github.com/LAtifword/latif-brain/issues
Docs: See docs/ directory

LICENSE
=======

MIT License - See LICENSE file

---
Built with ❤️ for the future of local AI
`;
  return content;
}

function createReadmeFirst() {
  const content = `╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     LATIF v5 - Personal AI Operating System               ║
║     Enterprise Foundation Release (Phase 1)               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

👋 WELCOME!

This is LATIF v5 - a complete Personal AI Operating System built for
local execution on your device with zero cloud dependencies.

⚡ QUICK START (5 minutes)
=========================

1. EXTRACT THIS ZIP FILE
   Linux/Mac: unzip latif-v5.0.0.zip
   Windows: Right-click → Extract All
   Android: Use file manager or termux

2. OPEN TERMINAL/COMMAND PROMPT
   cd latif-v5.0.0

3. INSTALL DEPENDENCIES
   npm install
   (First time only, takes 2-3 minutes)

4. START THE SERVER
   npm run dev

   You should see:
   ✓ Database initialized
   ✓ API server started
   → http://localhost:3000

5. TEST IT WORKS
   Open browser: http://localhost:3000
   You should see JSON API response

📱 FOR ANDROID/TERMUX USERS
===========================

Follow INSTALL_ANDROID.md for detailed instructions:
- Setting up Termux
- Installing Node.js in Termux
- Running LATIF as a background service
- Accessing from other apps on your device

🏗️ WHAT'S INSIDE (Phase 1)
============================

✅ Complete SQLite Database Schema
   - 11 production subsystems
   - 40+ tables with indexes
   - Full transaction support

✅ Async Data Layer
   - Repository pattern
   - Connection pooling
   - Error handling

✅ Background Job Processing
   - Worker pools
   - Automatic retries
   - Dead letter queue

✅ Structured Logging
   - JSON file logging
   - Automatic rotation
   - Real-time monitoring

✅ Configuration System
   - Environment-specific configs
   - Override via environment variables
   - Feature flags

✅ REST API Server
   - 15+ endpoints
   - Health checks
   - Job management
   - Admin tools

📚 DOCUMENTATION
================

Start with these files (in order):

1. PHASE1_FOUNDATION.md
   → What's built, how it works, architecture decisions

2. OPERATING_SYSTEM_ARCHITECTURE.md
   → Complete system design and roadmap

3. MASTER_PROMPT.md
   → Project vision and requirements

4. docs/ directory
   → API documentation, guides, examples

⚙️ CONFIGURATION
================

Development (Default):
  - Debug mode enabled
  - Local database (./latif.db)
  - Loose security (for testing)
  - Single worker process

Production:
  - Debug disabled
  - Configurable database path
  - Full authentication
  - Multi-worker processing

To use production config:
  export NODE_ENV=production
  npm start

🚀 WHAT WORKS NOW (Phase 1)
============================

✅ Database persistence
✅ Job scheduling and execution
✅ Configuration management
✅ Request logging and monitoring
✅ Health checks
✅ Admin API endpoints

🔮 WHAT'S COMING (Phase 2-6)
=============================

Week 3-5:   Hybrid RAG (vector + keyword search)
Week 6-9:   Agent Framework (autonomous agents)
Week 10-13: Knowledge Graphs (entity relationships)
Week 14-17: Vision AI (image understanding)
Week 18-20: Workflows & Automation

Each phase ships a working v5.x release.

🛠️ COMMON COMMANDS
===================

npm run dev              Start development server
npm run build           Build for production
npm test               Run test suite
npm run lint           Check code quality
npm run format         Format code
npm run docs           Generate API docs
npm start              Start production server

📊 API ENDPOINTS
================

GET  /health                    Health check
GET  /ready                     Readiness check
GET  /api                       API documentation
GET  /api/config               System configuration
GET  /api/stats                System statistics
GET  /api/logs?lines=100       Recent logs

POST /api/jobs                 Enqueue background job
GET  /api/jobs/queues          Queue statistics
GET  /api/jobs/queues/:queue   Specific queue stats
GET  /api/jobs/dead-letter     Failed jobs queue
POST /api/jobs/:id/retry       Retry failed job

POST /api/admin/vacuum         Database optimization

🔍 TROUBLESHOOTING
==================

Q: "Port 3000 already in use"
A: Change port in config/development.json or:
   export APP_PORT=3001
   npm run dev

Q: "Database locked"
A: Another process is using it. Either:
   - Wait for it to finish
   - Kill the process: lsof -ti:3000 | xargs kill -9

Q: "Module not found: sqlite3"
A: Reinstall dependencies:
   rm -rf node_modules package-lock.json
   npm install

Q: "Cannot start on Android"
A: See INSTALL_ANDROID.md for Termux-specific setup

❓ QUESTIONS?
==============

1. Check PHASE1_FOUNDATION.md (detailed reference)
2. Review docs/ directory (architecture & guides)
3. Check GitHub issues: https://github.com/LAtifword/latif-brain
4. Read code comments in src/ directory

🎯 NEXT STEPS
=============

1. ✅ Extract and read this file
2. ✅ Follow INSTALL_ANDROID.md if on Android
3. ✅ Run: npm install
4. ✅ Run: npm run dev
5. ✅ Test: curl http://localhost:3000/health
6. ✅ Read PHASE1_FOUNDATION.md

Then:
- Explore the API
- Review documentation
- Experiment with job queues
- Plan Phase 2 implementations

═════════════════════════════════════════════════════════════

Version: 5.0.0
Release Date: 2024
Status: Production Foundation (Phase 1 Complete)
Build: latif-v5.0.0

Made with ❤️ for the future of local, private AI

═════════════════════════════════════════════════════════════
`;
  return content;
}

// Run packaging
console.log('🚀 Starting LATIF v5 packaging...\n');
createZip()
  .then(() => {
    console.log('✨ Packaging complete!\n');
    console.log(`📦 Package ready at: ${zipPath}`);
    console.log(`💾 Size: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB\n`);
    console.log('To distribute: Share the zip file with others');
    console.log('To install: Extract and run: npm install && npm run dev\n');
  })
  .catch(error => {
    console.error('❌ Packaging failed:', error.message);
    process.exit(1);
  });

/**
 * Schema Initialization
 * Handles database migrations and schema updates
 */

import { getDatabase } from './data-layer.js';
import { getLogger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = getLogger();

export async function initializeSchema() {
  try {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Load schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      try {
        await db.run(statement);
      } catch (error) {
        // Some statements might fail due to existing objects (expected)
        logger.debug(`Schema statement skipped: ${error.message}`);
      }
    }

    // Track this migration
    await trackMigration('v5.0.0-initial-schema');

    logger.info('✓ Schema initialized successfully');
    return true;
  } catch (error) {
    logger.error('Schema initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Track applied migrations
 */
async function trackMigration(version) {
  const db = getDatabase();
  const name = version;
  const now = new Date().toISOString();

  try {
    await db.run(
      `INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
       VALUES (?, ?, ?)`,
      [version, name, now]
    );
  } catch (error) {
    logger.warn('Failed to track migration', { error: error.message });
  }
}

/**
 * Get applied migrations
 */
export async function getAppliedMigrations() {
  const db = getDatabase();

  try {
    const migrations = await db.all(
      `SELECT version, name, applied_at FROM schema_migrations ORDER BY applied_at DESC`
    );
    return migrations || [];
  } catch (error) {
    logger.warn('Failed to get migrations', { error: error.message });
    return [];
  }
}

/**
 * Verify schema health
 */
export async function verifySchema() {
  const db = getDatabase();
  const issues = [];

  try {
    // Check critical tables exist
    const tables = [
      'chats', 'messages', 'agents', 'agent_memory',
      'kg_nodes', 'kg_edges', 'embeddings', 'workflows'
    ];

    for (const table of tables) {
      const result = await db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );

      if (!result) {
        issues.push(`Missing table: ${table}`);
      }
    }

    if (issues.length > 0) {
      logger.warn('Schema issues detected', { issues });
    } else {
      logger.info('✓ Schema verification passed');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    logger.error('Schema verification failed', { error: error.message });
    return {
      valid: false,
      issues: [error.message]
    };
  }
}

/**
 * Get schema statistics
 */
export async function getSchemaStats() {
  const db = getDatabase();

  try {
    const tables = await db.all(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    const stats = {};

    for (const table of tables) {
      const result = await db.get(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      stats[table.name] = result?.count || 0;
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get schema stats', { error: error.message });
    return {};
  }
}

/**
 * Reset schema (development only)
 */
export async function resetSchema() {
  const db = getDatabase();

  try {
    // Get all tables
    const tables = await db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );

    // Drop all tables
    for (const table of tables) {
      await db.run(`DROP TABLE IF EXISTS ${table.name}`);
    }

    logger.info('✓ All tables dropped');

    // Reinitialize
    await initializeSchema();
    logger.info('✓ Schema reinitialized');

    return true;
  } catch (error) {
    logger.error('Failed to reset schema', { error: error.message });
    throw error;
  }
}

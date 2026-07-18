/**
 * LATIF Data Layer
 * Async database access with transactions, connection pooling, and error handling
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger.js';

const logger = getLogger();

class Database {
  constructor(dbPath = './latif.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.isConnected = false;
    this.queryQueue = [];
    this.isProcessingQueue = false;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          logger.error('Database connection failed', { error: err.message });
          reject(err);
          return;
        }

        try {
          this.db.run('PRAGMA journal_mode=WAL');
          this.db.run('PRAGMA foreign_keys=ON');
          this.db.run('PRAGMA synchronous=NORMAL');

          await this.loadSchema();
          this.isConnected = true;
          logger.info('Database initialized', { path: this.dbPath });
          resolve();
        } catch (error) {
          logger.error('Database initialization failed', { error: error.message });
          reject(error);
        }
      });
    });
  }

  async loadSchema() {
    const schemaPath = path.join(path.dirname(import.meta.url.replace('file://', '')), 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          logger.error('Schema load failed', { error: err.message });
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async run(sql, params = []) {
    if (!this.isConnected) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database query failed', {
            sql: sql.substring(0, 100),
            error: err.message
          });
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    if (!this.isConnected) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database query failed', {
            sql: sql.substring(0, 100),
            error: err.message
          });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    if (!this.isConnected) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database query failed', {
            sql: sql.substring(0, 100),
            error: err.message
          });
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      logger.error('Transaction failed', { error: error.message });
      throw error;
    }
  }

  async insert(table, data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    return this.run(sql, values);
  }

  async update(table, id, data) {
    const columns = Object.keys(data).map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${table} SET ${columns} WHERE id = ?`;
    return this.run(sql, values);
  }

  async delete(table, id) {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    return this.run(sql, [id]);
  }

  async findById(table, id) {
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return this.get(sql, [id]);
  }

  async findAll(table, where = null, limit = 100, offset = 0) {
    let sql = `SELECT * FROM ${table}`;
    const params = [];

    if (where) {
      const conditions = Object.keys(where).map(key => `${key} = ?`);
      sql += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(where));
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.all(sql, params);
  }

  async search(table, searchText, columns = []) {
    if (columns.length === 0) return [];

    const conditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
    const params = columns.map(() => `%${searchText}%`);

    const sql = `SELECT * FROM ${table} WHERE ${conditions} LIMIT 100`;
    return this.all(sql, params);
  }

  async close() {
    if (!this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('Database close failed', { error: err.message });
          reject(err);
        } else {
          this.isConnected = false;
          logger.info('Database closed');
          resolve();
        }
      });
    });
  }

  async vacuum() {
    return this.run('VACUUM');
  }

  async getStats() {
    try {
      const dbFile = fs.statSync(this.dbPath);
      const tables = await this.all('SELECT name FROM sqlite_master WHERE type=\'table\'');

      return {
        file_size_bytes: dbFile.size,
        table_count: tables.length,
        file_path: this.dbPath,
        connected: this.isConnected
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message });
      return null;
    }
  }
}

// Repository pattern for cleaner data access

export class AgentRepository {
  constructor(db) {
    this.db = db;
  }

  async create(agent) {
    return this.db.insert('agents', agent);
  }

  async findById(id) {
    return this.db.findById('agents', id);
  }

  async findAll(limit = 50, offset = 0) {
    return this.db.findAll('agents', null, limit, offset);
  }

  async update(id, updates) {
    return this.db.update('agents', id, updates);
  }

  async delete(id) {
    return this.db.delete('agents', id);
  }

  async findByName(name) {
    return this.db.get('SELECT * FROM agents WHERE name = ?', [name]);
  }

  async getStats() {
    return this.db.get(`
      SELECT
        COUNT(*) as total_agents,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_agents
      FROM agents
    `);
  }
}

export class WorkflowRepository {
  constructor(db) {
    this.db = db;
  }

  async create(workflow) {
    return this.db.insert('workflows', workflow);
  }

  async findById(id) {
    return this.db.findById('workflows', id);
  }

  async findAll(limit = 50, offset = 0) {
    return this.db.findAll('workflows', null, limit, offset);
  }

  async update(id, updates) {
    return this.db.update('workflows', id, updates);
  }

  async delete(id) {
    return this.db.delete('workflows', id);
  }

  async getExecutions(workflowId, limit = 50, offset = 0) {
    return this.db.all(
      'SELECT * FROM workflow_executions WHERE workflow_id = ? LIMIT ? OFFSET ?',
      [workflowId, limit, offset]
    );
  }
}

export class JobQueueRepository {
  constructor(db) {
    this.db = db;
  }

  async enqueue(job) {
    return this.db.insert('jobs', job);
  }

  async dequeue(queue, limit = 1) {
    return this.db.all(
      `SELECT * FROM jobs
       WHERE queue = ? AND status = 'pending'
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
      [queue, limit]
    );
  }

  async markProcessing(jobId, _workerId) {
    return this.db.update('jobs', jobId, {
      status: 'processing',
      started_at: new Date().toISOString()
    });
  }

  async markComplete(jobId, result) {
    return this.db.update('jobs', jobId, {
      status: 'completed',
      result: JSON.stringify(result),
      completed_at: new Date().toISOString()
    });
  }

  async markFailed(jobId, error) {
    const job = await this.db.findById('jobs', jobId);
    const attempts = (job?.attempts || 0) + 1;
    const maxAttempts = job?.max_attempts || 3;

    if (attempts >= maxAttempts) {
      return this.db.update('jobs', jobId, {
        status: 'failed',
        error: error.message,
        attempts,
        failed_at: new Date().toISOString()
      });
    } else {
      return this.db.update('jobs', jobId, {
        status: 'pending',
        attempts,
        error: error.message
      });
    }
  }

  async getQueueStats(queue) {
    return this.db.get(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs
      FROM jobs
      WHERE queue = ?
    `, [queue]);
  }
}

export class MemoryRepository {
  constructor(db) {
    this.db = db;
  }

  async save(memory) {
    return this.db.insert('memory_store', memory);
  }

  async findById(id) {
    return this.db.findById('memory_store', id);
  }

  async findByType(type, limit = 50, offset = 0) {
    return this.db.all(
      'SELECT * FROM memory_store WHERE memory_type = ? LIMIT ? OFFSET ?',
      [type, limit, offset]
    );
  }

  async delete(id) {
    return this.db.delete('memory_store', id);
  }

  async vacuum() {
    const expiryDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    return this.db.run(
      'DELETE FROM memory_store WHERE accessed_at < ? AND retention_days > 0',
      [expiryDate]
    );
  }
}

export class KnowledgeGraphRepository {
  constructor(db) {
    this.db = db;
  }

  async createNode(node) {
    return this.db.insert('kg_nodes', node);
  }

  async createEdge(edge) {
    return this.db.insert('kg_edges', edge);
  }

  async findNode(id) {
    return this.db.findById('kg_nodes', id);
  }

  async findEdges(sourceId, targetId = null) {
    if (targetId) {
      return this.db.all(
        'SELECT * FROM kg_edges WHERE source_id = ? AND target_id = ?',
        [sourceId, targetId]
      );
    } else {
      return this.db.all(
        'SELECT * FROM kg_edges WHERE source_id = ?',
        [sourceId]
      );
    }
  }

  async getNodeConnections(nodeId) {
    return this.db.all(
      `SELECT * FROM kg_edges
       WHERE source_id = ? OR target_id = ?
       LIMIT 100`,
      [nodeId, nodeId]
    );
  }

  async deleteNode(id) {
    return this.db.transaction(async (db) => {
      await db.delete('kg_nodes', id);
      await db.run('DELETE FROM kg_edges WHERE source_id = ? OR target_id = ?', [id, id]);
    });
  }
}

// Singleton instance
let dataLayer = null;

export async function initializeDataLayer(dbPath = './latif.db') {
  if (dataLayer) return dataLayer;

  dataLayer = new Database(dbPath);
  await dataLayer.initialize();

  return dataLayer;
}

export function getDatabase() {
  if (!dataLayer) {
    throw new Error('Data layer not initialized. Call initializeDataLayer() first.');
  }
  return dataLayer;
}

export function getRepositories(db = null) {
  const database = db || getDatabase();

  return {
    agents: new AgentRepository(database),
    workflows: new WorkflowRepository(database),
    jobs: new JobQueueRepository(database),
    memory: new MemoryRepository(database),
    knowledge: new KnowledgeGraphRepository(database)
  };
}

export default {
  initializeDataLayer,
  getDatabase,
  getRepositories,
  Database,
  AgentRepository,
  WorkflowRepository,
  JobQueueRepository,
  MemoryRepository,
  KnowledgeGraphRepository
};

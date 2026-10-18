/**
 * Agent Persistence Layer
 * Handles saving and loading agent memory from database
 */

import { v4 as uuid } from 'uuid';
import { getDatabase } from '../../core/data-layer.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

export class AgentPersistence {
  /**
   * Save agent memory to database
   */
  async saveMemory(agentId, sessionId, memoryType, key, value, ttl = null) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const id = uuid.v4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT OR REPLACE INTO agent_memory
         (id, agent_id, session_id, memory_type, key, value, ttl_seconds, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, agentId, sessionId, memoryType, key, JSON.stringify(value), ttl, now, now]
      );

      logger.debug('Agent memory saved', { agentId, sessionId, memoryType, key });
      return id;
    } catch (error) {
      logger.error('Failed to save agent memory', { error: error.message });
      throw error;
    }
  }

  /**
   * Load agent memory from database
   */
  async getMemory(agentId, sessionId, memoryType) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const rows = await db.all(
        `SELECT key, value FROM agent_memory
         WHERE agent_id = ? AND session_id = ? AND memory_type = ?
         ORDER BY updated_at DESC`,
        [agentId, sessionId, memoryType]
      );

      const memory = {};
      for (const row of rows) {
        try {
          memory[row.key] = JSON.parse(row.value);
        } catch (e) {
          memory[row.key] = row.value;
        }
      }

      return memory;
    } catch (error) {
      logger.error('Failed to load agent memory', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete expired memory
   */
  async deleteExpiredMemory() {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const result = await db.run(
        `DELETE FROM agent_memory
         WHERE ttl_seconds IS NOT NULL
         AND datetime(created_at, '+' || ttl_seconds || ' seconds') < datetime('now')`
      );

      logger.info('Expired agent memory cleaned', { deleted: result?.changes || 0 });
      return result?.changes || 0;
    } catch (error) {
      logger.error('Failed to delete expired memory', { error: error.message });
      throw error;
    }
  }

  /**
   * Save agent execution record
   */
  async saveExecution(agentId, sessionId, task, context, status, result = null, error = null, durationMs = 0) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const id = uuid.v4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT INTO agent_executions
         (id, agent_id, session_id, task, context, status, result, error, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, agentId, sessionId, task, JSON.stringify(context), status, JSON.stringify(result), error, durationMs, now]
      );

      logger.debug('Agent execution saved', { agentId, status });
      return id;
    } catch (error) {
      logger.error('Failed to save agent execution', { error: error.message });
      throw error;
    }
  }

  /**
   * Get agent execution history
   */
  async getExecutionHistory(agentId, limit = 50) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const rows = await db.all(
        `SELECT id, task, status, result, error, duration_ms, created_at, completed_at
         FROM agent_executions
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [agentId, limit]
      );

      return rows.map(row => ({
        ...row,
        result: row.result ? JSON.parse(row.result) : null
      }));
    } catch (error) {
      logger.error('Failed to get execution history', { error: error.message });
      throw error;
    }
  }

  /**
   * Register or update agent
   */
  async registerAgent(agentId, name, type, config = {}) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT OR REPLACE INTO agents
         (id, name, type, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [agentId, name, type, JSON.stringify(config), now, now]
      );

      logger.debug('Agent registered', { agentId, name, type });
      return agentId;
    } catch (error) {
      logger.error('Failed to register agent', { error: error.message });
      throw error;
    }
  }

  /**
   * Get agent configuration
   */
  async getAgent(agentId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const agent = await db.get(
        `SELECT id, name, type, config, enabled, created_at, updated_at
         FROM agents WHERE id = ?`,
        [agentId]
      );

      if (agent) {
        agent.config = agent.config ? JSON.parse(agent.config) : {};
      }

      return agent;
    } catch (error) {
      logger.error('Failed to get agent', { error: error.message });
      throw error;
    }
  }

  /**
   * List all agents
   */
  async listAgents() {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const agents = await db.all(
        `SELECT id, name, type, enabled, created_at FROM agents ORDER BY created_at DESC`
      );

      return agents || [];
    } catch (error) {
      logger.error('Failed to list agents', { error: error.message });
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(agentId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const stats = {
        working: 0,
        short_term: 0,
        long_term: 0,
        total: 0
      };

      const result = await db.all(
        `SELECT memory_type, COUNT(*) as count FROM agent_memory
         WHERE agent_id = ? GROUP BY memory_type`,
        [agentId]
      );

      for (const row of result) {
        stats[row.memory_type] = row.count;
        stats.total += row.count;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get memory stats', { error: error.message });
      throw error;
    }
  }
}

export const agentPersistence = new AgentPersistence();
export default AgentPersistence;

/**
 * LATIF Structured Logger
 * JSON-based logging with multiple transports and levels
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

const LOG_LEVEL_PRIORITY = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class Logger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.level = options.level || LOG_LEVELS.INFO;
    this.service = options.service || 'latif';
    this.logDir = options.logDir || './logs';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 10;
    this.transports = options.transports || ['console', 'file'];

    this.initializeLogDirectory();
    this.currentLogFile = null;
    this.logBuffer = [];
    this.bufferSize = 0;
    this.maxBufferSize = options.maxBufferSize || 1024 * 1024; // 1MB
  }

  initializeLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
  }

  formatLog(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      pid: process.pid,
      ...data
    };
  }

  async writeToFile(logEntry) {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${this.service}-${timestamp}.log`);

      if (this.currentLogFile !== logFile) {
        this.currentLogFile = logFile;
        this.checkLogRotation(logFile);
      }

      const line = JSON.stringify(logEntry) + '\n';
      this.logBuffer.push(line);
      this.bufferSize += Buffer.byteLength(line);

      if (this.bufferSize >= this.maxBufferSize) {
        await this.flushBuffer();
      }

      this.emit('log', logEntry);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    try {
      const content = this.logBuffer.join('');
      fs.appendFileSync(this.currentLogFile, content);
      this.logBuffer = [];
      this.bufferSize = 0;
    } catch (error) {
      console.error('Failed to flush log buffer:', error);
    }
  }

  checkLogRotation(logFile) {
    if (!fs.existsSync(logFile)) return;

    const stats = fs.statSync(logFile);
    if (stats.size > this.maxFileSize) {
      const ext = path.extname(logFile);
      const base = logFile.slice(0, -ext.length);
      const newName = `${base}-${Date.now()}${ext}`;
      fs.renameSync(logFile, newName);

      this.cleanupOldLogs();
    }
  }

  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(this.service))
        .sort()
        .reverse();

      while (files.length > this.maxFiles) {
        const oldFile = files.pop();
        fs.unlinkSync(path.join(this.logDir, oldFile));
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  async log(level, message, data = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatLog(level, message, data);

    if (this.transports.includes('console')) {
      this.writeToConsole(logEntry);
    }

    if (this.transports.includes('file')) {
      await this.writeToFile(logEntry);
    }
  }

  writeToConsole(logEntry) {
    const color = this.getColorForLevel(logEntry.level);
    const reset = '\x1b[0m';
    const message = `${color}[${logEntry.level.toUpperCase()}]${reset} ${logEntry.message}`;

    if (logEntry.level === 'error') {
      console.error(message, logEntry);
    } else if (logEntry.level === 'warn') {
      console.warn(message, logEntry);
    } else {
      console.log(message, logEntry);
    }
  }

  getColorForLevel(level) {
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[35m'
    };
    return colors[level] || '';
  }

  error(message, data = {}) {
    return this.log(LOG_LEVELS.ERROR, message, data);
  }

  warn(message, data = {}) {
    return this.log(LOG_LEVELS.WARN, message, data);
  }

  info(message, data = {}) {
    return this.log(LOG_LEVELS.INFO, message, data);
  }

  debug(message, data = {}) {
    return this.log(LOG_LEVELS.DEBUG, message, data);
  }

  async getRecentLogs(lines = 100) {
    try {
      const logFile = path.join(this.logDir, `${this.service}-${new Date().toISOString().split('T')[0]}.log`);

      if (!fs.existsSync(logFile)) return [];

      const content = fs.readFileSync(logFile, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, level: 'unknown' };
          }
        });
    } catch (error) {
      console.error('Failed to read recent logs:', error);
      return [];
    }
  }

  async getLogStats() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(this.service));

      let totalSize = 0;
      let totalLines = 0;

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        const content = fs.readFileSync(filePath, 'utf8');
        totalLines += content.split('\n').length;
      });

      return {
        files: files.length,
        total_size_bytes: totalSize,
        total_lines: totalLines,
        log_dir: this.logDir
      };
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return null;
    }
  }

  async close() {
    await this.flushBuffer();
    this.removeAllListeners();
  }
}

// Singleton instance
let logger = null;

export function initializeLogger(options = {}) {
  if (logger) return logger;

  logger = new Logger({
    level: process.env.LOG_LEVEL || LOG_LEVELS.INFO,
    service: 'latif',
    logDir: process.env.LOG_DIR || './logs',
    ...options
  });

  return logger;
}

export function getLogger() {
  if (!logger) {
    return initializeLogger();
  }
  return logger;
}

export { Logger, LOG_LEVELS };

export const logger = new Proxy(
  {},
  {
    get: (target, prop) => {
      return getLogger()[prop];
    }
  }
);

export default {
  initializeLogger,
  getLogger,
  Logger,
  LOG_LEVELS
};

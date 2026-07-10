/**
 * LATIF v5 - Personal AI Operating System
 * Main entry point for the application
 */

import { initializeAPIServer } from './api/server.js';
import { loggerProxy as logger, initializeLogger } from './core/logger.js';

async function main() {
  try {
    // Initialize logging first
    initializeLogger({
      level: process.env.LOG_LEVEL || 'info'
    });

    logger.info('LATIF v5 starting', {
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid
    });

    // Initialize and start API server
    const apiServer = await initializeAPIServer();
    await apiServer.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await apiServer.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await apiServer.stop();
      process.exit(0);
    });

    // Unhandled error handlers
    process.on('unhandledRejection', (reason, _promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Start the application
main();

export default main;

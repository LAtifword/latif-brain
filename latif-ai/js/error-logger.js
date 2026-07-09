/* ════════════════════════════════════════════════════════════════
   LATIF AI — Error Logging & Reporting
   ════════════════════════════════════════════════════════════════
   Centralized error reporting with console + optional UI feedback.
   Enables debugging while keeping errors discoverable.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class ErrorLogger {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
    this.onError = null; // Optional callback for UI notifications
  }

  /**
   * Log an error to console and history.
   * @param {string} context - Where the error occurred (e.g., "streamResponse", "RAG.search")
   * @param {Error|string} error - The error object or message
   * @param {Object} extra - Optional extra context {url, status, retry, etc}
   * @param {boolean} userFacing - Whether user should see this (default: false)
   */
  error(context, error, extra = {}, userFacing = false) {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const entry = {
      timestamp,
      context,
      message,
      stack,
      extra,
      userFacing,
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Log to console with context
    console.error(`[${context}]`, message, extra);
    if (stack) console.debug(stack);

    // Optionally notify UI
    if (userFacing && this.onError) {
      this.onError(message, context);
    }
  }

  /**
   * Log a warning.
   * @param {string} context
   * @param {string} message
   * @param {Object} extra
   */
  warn(context, message, extra = {}) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, context, message, extra, level: "warn" };
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    console.warn(`[${context}]`, message, extra);
  }

  /**
   * Get error history (useful for debug reports).
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear error history.
   */
  clear() {
    this.history = [];
  }

  /**
   * Export history as JSON for bug reports.
   */
  exportJSON() {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Get summary of recent errors.
   */
  getSummary(limit = 10) {
    return this.history.slice(-limit).map(e => `${e.timestamp} [${e.context}] ${e.message}`).join("\n");
  }
}

const GlobalErrorLogger = new ErrorLogger();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ErrorLogger, GlobalErrorLogger };
}

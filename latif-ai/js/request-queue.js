/* ════════════════════════════════════════════════════════════════
   LATIF AI — Request Queue (Concurrency Control)
   ════════════════════════════════════════════════════════════════
   Manages concurrent message handling with FIFO queue.
   Prevents race conditions from rapid sendMessage() calls.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class RequestQueue {
  constructor(maxConcurrency = 1) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrency = maxConcurrency;
    this.paused = false;
  }

  /**
   * Enqueue a request (async function) and wait for its completion.
   * @param {AsyncFunction} request - Function that returns a Promise
   * @param {Object} context - Optional context for error reporting
   * @returns {Promise} Resolves when request completes
   */
  async enqueue(request, context = {}) {
    return new Promise((resolve, reject) => {
      const task = { request, context, resolve, reject };
      this.queue.push(task);
      this._process();
    });
  }

  async _process() {
    // If paused or already at max concurrency, wait
    if (this.paused || this.running >= this.maxConcurrency) {
      return;
    }

    // Dequeue next task
    const task = this.queue.shift();
    if (!task) return;

    this.running++;
    try {
      const result = await task.request();
      task.resolve(result);
    } catch (err) {
      console.error("[RequestQueue] Task failed:", task.context, err);
      task.reject(err);
    } finally {
      this.running--;
      // Process next queued task
      this._process();
    }
  }

  /**
   * Pause queue processing. Existing tasks complete, new tasks wait.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume queue processing.
   */
  resume() {
    this.paused = false;
    this._process();
  }

  /**
   * Clear all pending tasks in queue (does not abort running tasks).
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }

  /**
   * Get current queue status.
   */
  status() {
    return {
      queued: this.queue.length,
      running: this.running,
      paused: this.paused,
      capacity: this.maxConcurrency,
    };
  }
}

// Global singleton instance for message generation
const GlobalRequestQueue = new RequestQueue(1); // Max 1 concurrent message

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { RequestQueue, GlobalRequestQueue };
}

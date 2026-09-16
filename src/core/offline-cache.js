/**
 * Offline Response Cache Module
 * IndexedDB-backed caching for chat responses with keyword + semantic search
 */

class OfflineCache {
  constructor() {
    this.dbName = 'latif-offline-cache';
    this.storeName = 'chat-responses';
    this.maxEntries = 50;
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('modelName', 'modelName', { unique: false });
        }
      };
    });
  }

  async saveChatResponse(messages, modelName, responseText) {
    if (!this.db) await this.initialize();

    const queryHash = this.hashMessages(messages);
    const queryText = messages.length > 0 ? messages[messages.length - 1].content : '';
    const tags = this.extractTags(responseText);

    const entry = {
      id: queryHash,
      timestamp: Date.now(),
      modelName,
      queryHash,
      queryText,
      responseText,
      messageCount: messages.length,
      tags,
      similarity: 1.0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Add new entry
      store.put(entry);

      transaction.oncomplete = async () => {
        // Prune old entries if needed
        await this.pruneOldEntries();
        resolve(entry);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async searchCache(userQuery, modelName, threshold = 0.6) {
    if (!this.db) await this.initialize();

    const entries = await this.getAllEntries();

    // Calculate relevance scores
    const scored = entries.map((entry) => {
      const keywordScore = this.calculateKeywordSimilarity(userQuery, entry.queryText);
      const tagScore = this.calculateTagSimilarity(userQuery, entry.tags);
      const finalScore = 0.6 * keywordScore + 0.4 * tagScore;

      return {
        ...entry,
        similarity: finalScore
      };
    });

    // Filter by threshold and model, sort by relevance + recency
    return scored
      .filter((e) => e.similarity >= threshold && (!modelName || e.modelName === modelName))
      .sort((a, b) => {
        const scoreDiff = b.similarity - a.similarity;
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff; // Prioritize relevance
        return b.timestamp - a.timestamp; // Then recency
      });
  }

  async getCacheSize() {
    if (!this.db) await this.initialize();

    const entries = await this.getAllEntries();
    const sizeKB = Math.round(
      entries.reduce((sum, e) => sum + (e.responseText.length / 1024), 0)
    );

    return {
      sizeKB,
      entryCount: entries.length,
      maxEntries: this.maxEntries
    };
  }

  async getCacheStats() {
    if (!this.db) await this.initialize();

    const entries = await this.getAllEntries();

    const stats = {
      totalSizeKB: Math.round(
        entries.reduce((sum, e) => sum + (e.responseText.length / 1024), 0)
      ),
      entryCount: entries.length,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
      averageSize: entries.length > 0
        ? Math.round(
            entries.reduce((sum, e) => sum + e.responseText.length, 0) / entries.length
          )
        : 0
    };

    return stats;
  }

  async getRecentEntries(limit = 10) {
    if (!this.db) await this.initialize();

    const entries = await this.getAllEntries();
    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async clearCache() {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
    });
  }

  // Private helper methods

  hashMessages(messages) {
    const text = messages.map(m => m.content).join('|');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  calculateKeywordSimilarity(query, text) {
    if (!query || !text) return 0;

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const textWords = text.toLowerCase().split(/\s+/);

    if (queryWords.length === 0) return 0;

    const matches = queryWords.filter(w => textWords.some(tw => tw.includes(w))).length;
    return Math.min(1, matches / queryWords.length);
  }

  calculateTagSimilarity(query, tags) {
    if (!tags || tags.length === 0) return 0;

    const queryWords = query.toLowerCase().split(/\s+/);
    const matches = queryWords.filter(w => tags.some(t => t.includes(w))).length;

    return matches > 0 ? Math.min(1, matches / Math.max(queryWords.length, tags.length)) : 0;
  }

  extractTags(text) {
    // Extract simple tags: nouns and important words
    const words = text.toLowerCase().split(/[\s,;.!?]+/);
    return words
      .filter(w => w.length > 4)
      .filter(w => !this.isCommonWord(w))
      .slice(0, 10);
  }

  isCommonWord(word) {
    const common = [
      'the', 'this', 'that', 'with', 'from', 'have', 'been', 'more', 'also',
      'which', 'would', 'could', 'should', 'there', 'where', 'when', 'what'
    ];
    return common.includes(word);
  }

  async getAllEntries() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async pruneOldEntries() {
    if (!this.db) return;

    const entries = await this.getAllEntries();
    if (entries.length <= this.maxEntries) return;

    // Sort by timestamp, keep newest
    const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = sorted.slice(this.maxEntries);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      toDelete.forEach(entry => store.delete(entry.id));

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }
}

// Singleton instance
let instance = null;

export async function getOfflineCache() {
  if (!instance) {
    instance = new OfflineCache();
    await instance.initialize();
  }
  return instance;
}

export default OfflineCache;

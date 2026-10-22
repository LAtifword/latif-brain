/* ════════════════════════════════════════════════════════════════
   LATIF AI — OFFLINE CACHE MODULE
   ════════════════════════════════════════════════════════════════
   IndexedDB-backed response caching for offline capability.
   Caches chat responses and enables semantic search via keyword/TF-IDF
   when the Ollama server is unreachable.
   ════════════════════════════════════════════════════════════════ */

class OfflineCache {
  constructor() {
    this.dbName = "latif-offline-cache";
    this.storeName = "responses";
    this.db = null;
    this.maxEntries = 50;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onupgradeneeded = (evt) => {
        const db = evt.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("modelName", "modelName", { unique: false });
        }
      };
    });
  }

  async ensureReady() {
    await this.initPromise;
  }

  hashMessages(messages) {
    const text = JSON.stringify(messages);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  extractTags(text) {
    const nouns = text.match(/\b[A-Za-z]{4,}\b/gi) || [];
    return nouns.slice(0, 5).map(w => w.toLowerCase());
  }

  async saveChatResponse(messages, modelName, response) {
    try {
      await this.ensureReady();
      const lastMsg = messages[messages.length - 1]?.content || "";
      const entry = {
        id: this.hashMessages(messages),
        timestamp: Date.now(),
        modelName,
        queryHash: this.hashMessages(messages),
        queryText: lastMsg.substring(0, 200),
        responseText: response,
        messageCount: messages.length,
        tags: this.extractTags(lastMsg),
      };

      const tx = this.db.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      store.put(entry);

      await this.pruneIfNeeded();
    } catch (err) {
      console.warn("[OfflineCache] Save failed:", err);
    }
  }

  async pruneIfNeeded() {
    try {
      const tx = this.db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      const entries = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (entries.length > this.maxEntries) {
        const sorted = entries.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = sorted.slice(0, entries.length - this.maxEntries);

        const txDel = this.db.transaction([this.storeName], "readwrite");
        const storeDel = txDel.objectStore(this.storeName);
        toDelete.forEach(e => storeDel.delete(e.id));
      }
    } catch (err) {
      console.warn("[OfflineCache] Prune failed:", err);
    }
  }

  calculateSimilarity(query, cached) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const cachedWords = cached.toLowerCase().split(/\s+/);
    const querySet = new Set(queryWords);
    const cachedSet = new Set(cachedWords);

    let overlap = 0;
    for (const word of querySet) {
      if (cachedSet.has(word)) overlap++;
    }

    const union = querySet.size + cachedSet.size - overlap;
    return union > 0 ? overlap / union : 0;
  }

  async searchCache(userQuery, modelName, threshold = 0.4) {
    try {
      await this.ensureReady();

      const tx = this.db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const index = store.index("modelName");
      const req = index.getAll(modelName);

      const entries = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const scored = entries.map((e) => ({
        ...e,
        similarity: this.calculateSimilarity(userQuery, e.queryText),
      }))
        .filter(e => e.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

      return scored.slice(0, 3);
    } catch (err) {
      console.warn("[OfflineCache] Search failed:", err);
      return [];
    }
  }

  async getCacheSize() {
    try {
      await this.ensureReady();
      const tx = this.db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      const entries = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      let totalSize = 0;
      entries.forEach(e => {
        totalSize += JSON.stringify(e).length;
      });

      return {
        sizeKB: Math.round(totalSize / 1024),
        entryCount: entries.length,
      };
    } catch (err) {
      console.warn("[OfflineCache] Size calc failed:", err);
      return { sizeKB: 0, entryCount: 0 };
    }
  }

  async getCacheStats() {
    try {
      await this.ensureReady();
      const tx = this.db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      const entries = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      let totalSize = 0;
      let oldestEntry = null;
      let newestEntry = null;

      entries.forEach(e => {
        totalSize += JSON.stringify(e).length;
        if (!oldestEntry || e.timestamp < oldestEntry) oldestEntry = e.timestamp;
        if (!newestEntry || e.timestamp > newestEntry) newestEntry = e.timestamp;
      });

      return {
        totalSizeKB: Math.round(totalSize / 1024),
        entryCount: entries.length,
        oldestEntry,
        newestEntry,
        averageSize: entries.length > 0 ? Math.round(totalSize / entries.length / 1024) : 0,
      };
    } catch (err) {
      console.warn("[OfflineCache] Stats failed:", err);
      return { totalSizeKB: 0, entryCount: 0, oldestEntry: null, newestEntry: null };
    }
  }

  async getRecentEntries(limit = 10) {
    try {
      await this.ensureReady();
      const tx = this.db.transaction([this.storeName], "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      const entries = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (err) {
      console.warn("[OfflineCache] Get recent failed:", err);
      return [];
    }
  }

  async clearCache() {
    try {
      await this.ensureReady();
      const tx = this.db.transaction([this.storeName], "readwrite");
      const store = tx.objectStore(this.storeName);
      store.clear();

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn("[OfflineCache] Clear failed:", err);
      throw err;
    }
  }
}

const OfflineCacheInstance = new OfflineCache();

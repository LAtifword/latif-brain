/* ════════════════════════════════════════════════════════════════
   LATIF AI — Data Layer (IndexedDB + Async Operations)
   ════════════════════════════════════════════════════════════════
   Replaces localStorage with IndexedDB for scalability.
   Handles chats, messages, memory, embeddings with transactions.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class DataLayer {
  constructor(dbName = "latif-ai-v5", version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.ready = false;
  }

  /**
   * Initialize database and create/upgrade schema.
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);

      req.onerror = () => {
        GlobalErrorLogger.error("DataLayer.init", req.error, { dbName: this.dbName });
        reject(req.error);
      };

      req.onsuccess = () => {
        this.db = req.result;
        this.ready = true;
        resolve();
      };

      req.onupgradeneeded = (e) => {
        this.db = e.target.result;
        this._createSchema(this.db);
      };
    });
  }

  /**
   * Create/upgrade database schema (called once per version).
   * @private
   */
  _createSchema(db) {
    // Chats store: all conversations
    if (!db.objectStoreNames.contains("chats")) {
      const chatStore = db.createObjectStore("chats", { keyPath: "id" });
      chatStore.createIndex("createdAt", "createdAt", { unique: false });
      chatStore.createIndex("pinned", "pinned", { unique: false });
      chatStore.createIndex("updatedAt", "updatedAt", { unique: false });
    }

    // Messages store: all chat messages (linked to chats via chatId)
    if (!db.objectStoreNames.contains("messages")) {
      const msgStore = db.createObjectStore("messages", { keyPath: "id" });
      msgStore.createIndex("chatId", "chatId", { unique: false });
      msgStore.createIndex("role", "role", { unique: false });
      msgStore.createIndex("timestamp", "timestamp", { unique: false });
    }

    // Embeddings store: cached embeddings for RAG
    if (!db.objectStoreNames.contains("embeddings")) {
      const embStore = db.createObjectStore("embeddings", { keyPath: "hash" });
      embStore.createIndex("model", "model", { unique: false });
      embStore.createIndex("timestamp", "timestamp", { unique: false });
    }

    // Memory store: long-term memories/facts
    if (!db.objectStoreNames.contains("memory")) {
      db.createObjectStore("memory", { keyPath: "id", autoIncrement: true });
    }

    // Settings store: app configuration
    if (!db.objectStoreNames.contains("settings")) {
      db.createObjectStore("settings", { keyPath: "key" });
    }

    // Cache store: offline response cache
    if (!db.objectStoreNames.contains("cache")) {
      const cacheStore = db.createObjectStore("cache", { keyPath: "id" });
      cacheStore.createIndex("model", "model", { unique: false });
      cacheStore.createIndex("timestamp", "timestamp", { unique: false });
    }
  }

  /**
   * Save a chat.
   * @param {Object} chat - Chat object with id, title, messages[], etc.
   * @returns {Promise<void>}
   */
  async saveChat(chat) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    chat.updatedAt = Date.now();
    return this._put("chats", chat);
  }

  /**
   * Get a chat by ID.
   * @param {string} chatId
   * @returns {Promise<Object|null>}
   */
  async getChat(chatId) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._get("chats", chatId);
  }

  /**
   * Get all chats.
   * @returns {Promise<Array>}
   */
  async getAllChats() {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._getAll("chats");
  }

  /**
   * Delete a chat and its messages.
   * @param {string} chatId
   * @returns {Promise<void>}
   */
  async deleteChat(chatId) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const tx = this.db.transaction(["chats", "messages"], "readwrite");
    await this._delete("chats", chatId, tx);
    const messages = await this._getAllByIndex("messages", "chatId", chatId, tx);
    for (const msg of messages) {
      await this._delete("messages", msg.id, tx);
    }
    return tx;
  }

  /**
   * Save a message.
   * @param {Object} message - Message with id, chatId, role, content, timestamp
   * @returns {Promise<void>}
   */
  async saveMessage(message) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    message.timestamp = message.timestamp || Date.now();
    return this._put("messages", message);
  }

  /**
   * Get messages for a chat.
   * @param {string} chatId
   * @returns {Promise<Array>}
   */
  async getMessages(chatId) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._getAllByIndex("messages", "chatId", chatId);
  }

  /**
   * Cache an embedding.
   * @param {string} hash - Hash of text that was embedded
   * @param {Array<number>} embedding - Vector
   * @param {string} model - Model used
   * @returns {Promise<void>}
   */
  async cacheEmbedding(hash, embedding, model) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._put("embeddings", {
      hash,
      embedding,
      model,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached embedding.
   * @param {string} hash
   * @returns {Promise<Array|null>}
   */
  async getCachedEmbedding(hash) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const result = await this._get("embeddings", hash);
    return result ? result.embedding : null;
  }

  /**
   * Save memory item.
   * @param {string} text - Memory text
   * @returns {Promise<number>} Memory ID
   */
  async saveMemory(text) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._put("memory", { text, timestamp: Date.now() });
  }

  /**
   * Get all memories.
   * @returns {Promise<Array>}
   */
  async getAllMemories() {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._getAll("memory");
  }

  /**
   * Delete memory by ID.
   * @param {number} id
   * @returns {Promise<void>}
   */
  async deleteMemory(id) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._delete("memory", id);
  }

  /**
   * Save setting.
   * @param {string} key
   * @param {*} value
   * @returns {Promise<void>}
   */
  async saveSetting(key, value) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return this._put("settings", { key, value, timestamp: Date.now() });
  }

  /**
   * Get setting.
   * @param {string} key
   * @returns {Promise<*>}
   */
  async getSetting(key) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const result = await this._get("settings", key);
    return result ? result.value : null;
  }

  /**
   * Get database stats (size, entry counts).
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const stats = {
      chats: (await this._getAll("chats")).length,
      messages: (await this._getAll("messages")).length,
      embeddings: (await this._getAll("embeddings")).length,
      memory: (await this._getAll("memory")).length,
      cache: (await this._getAll("cache")).length,
    };
    return stats;
  }

  /**
   * Export all data as JSON (for backup/migration).
   * @returns {Promise<Object>}
   */
  async exportAll() {
    if (!this.ready) throw new Error("DataLayer not initialized");
    return {
      chats: await this._getAll("chats"),
      messages: await this._getAll("messages"),
      embeddings: await this._getAll("embeddings"),
      memory: await this._getAll("memory"),
      settings: await this._getAll("settings"),
      cache: await this._getAll("cache"),
      exportedAt: Date.now(),
    };
  }

  /**
   * Import data from JSON (for restore/migration).
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async importAll(data) {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const tx = this.db.transaction(
      ["chats", "messages", "embeddings", "memory", "settings", "cache"],
      "readwrite"
    );

    for (const store of ["chats", "messages", "embeddings", "memory", "settings", "cache"]) {
      if (data[store]) {
        for (const item of data[store]) {
          await this._put(store, item, tx);
        }
      }
    }

    return tx;
  }

  /**
   * Clear all data (dangerous!).
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.ready) throw new Error("DataLayer not initialized");
    const tx = this.db.transaction(
      ["chats", "messages", "embeddings", "memory", "settings", "cache"],
      "readwrite"
    );
    for (const store of ["chats", "messages", "embeddings", "memory", "settings", "cache"]) {
      tx.objectStore(store).clear();
    }
    return tx;
  }

  // ─── Private helpers ───

  async _put(storeName, obj, tx) {
    return new Promise((resolve, reject) => {
      const store = (tx || this.db.transaction(storeName, "readwrite")).objectStore(storeName);
      const req = store.put(obj);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async _get(storeName, key, tx) {
    return new Promise((resolve, reject) => {
      const store = (tx || this.db.transaction(storeName)).objectStore(storeName);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async _delete(storeName, key, tx) {
    return new Promise((resolve, reject) => {
      const store = (tx || this.db.transaction(storeName, "readwrite")).objectStore(storeName);
      const req = store.delete(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async _getAll(storeName, tx) {
    return new Promise((resolve, reject) => {
      const store = (tx || this.db.transaction(storeName)).objectStore(storeName);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async _getAllByIndex(storeName, indexName, value, tx) {
    return new Promise((resolve, reject) => {
      const store = (tx || this.db.transaction(storeName)).objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });
  }
}

const GlobalDataLayer = new DataLayer();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DataLayer, GlobalDataLayer };
}

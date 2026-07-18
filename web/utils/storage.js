/**
 * IndexedDB Storage Layer
 * Persistent storage for chats, messages, settings
 */

export class Storage {
  constructor(dbName = 'latif-db', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Chats store
        if (!db.objectStoreNames.contains('chats')) {
          const chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
          chatsStore.createIndex('timestamp', 'timestamp', { unique: false });
          chatsStore.createIndex('title', 'title', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('chatId', 'chatId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
          messagesStore.createIndex('role', 'role', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Agent memory store
        if (!db.objectStoreNames.contains('agentMemory')) {
          const memoryStore = db.createObjectStore('agentMemory', { keyPath: 'id' });
          memoryStore.createIndex('agentId', 'agentId', { unique: false });
          memoryStore.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };
    });
  }

  // Chat operations
  async saveChat(chat) {
    const tx = this.db.transaction(['chats'], 'readwrite');
    const store = tx.objectStore('chats');
    chat.timestamp = chat.timestamp || Date.now();
    return new Promise((resolve, reject) => {
      const request = store.put(chat);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getChat(chatId) {
    const tx = this.db.transaction(['chats'], 'readonly');
    const store = tx.objectStore('chats');
    return new Promise((resolve, reject) => {
      const request = store.get(chatId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllChats() {
    const tx = this.db.transaction(['chats'], 'readonly');
    const store = tx.objectStore('chats');
    const index = store.index('timestamp');
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result.reverse());
      request.onerror = () => reject(request.error);
    });
  }

  async deleteChat(chatId) {
    const tx = this.db.transaction(['chats', 'messages'], 'readwrite');
    const chatsStore = tx.objectStore('chats');
    const messagesStore = tx.objectStore('messages');

    // Delete chat
    chatsStore.delete(chatId);

    // Delete all messages in chat
    const index = messagesStore.index('chatId');
    const range = IDBKeyRange.only(chatId);
    index.openCursor(range).onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Message operations
  async saveMessage(message) {
    const tx = this.db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    message.timestamp = message.timestamp || Date.now();
    return new Promise((resolve, reject) => {
      const request = store.put(message);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(chatId, limit = 50, offset = 0) {
    const tx = this.db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const range = IDBKeyRange.only(chatId);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => {
        const messages = request.result.reverse().slice(offset, offset + limit);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessage(messageId) {
    const tx = this.db.transaction(['messages'], 'readwrite');
    const store = tx.objectStore('messages');
    return new Promise((resolve, reject) => {
      const request = store.delete(messageId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings operations
  async saveSetting(key, value) {
    const tx = this.db.transaction(['settings'], 'readwrite');
    const store = tx.objectStore('settings');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    const tx = this.db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? defaultValue);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSettings() {
    const tx = this.db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(item => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Agent memory operations
  async saveAgentMemory(agentId, sessionId, key, value) {
    const tx = this.db.transaction(['agentMemory'], 'readwrite');
    const store = tx.objectStore('agentMemory');
    const id = `${agentId}:${sessionId}:${key}`;
    return new Promise((resolve, reject) => {
      const request = store.put({ id, agentId, sessionId, key, value, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAgentMemory(agentId, sessionId) {
    const tx = this.db.transaction(['agentMemory'], 'readonly');
    const store = tx.objectStore('agentMemory');
    const index = store.index('agentId');
    const range = IDBKeyRange.only(agentId);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => {
        const memory = {};
        request.result.forEach(item => {
          if (item.sessionId === sessionId) {
            memory[item.key] = item.value;
          }
        });
        resolve(memory);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Search operations
  async searchMessages(chatId, query) {
    const tx = this.db.transaction(['messages'], 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('chatId');
    const range = IDBKeyRange.only(chatId);

    return new Promise((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => {
        const results = request.result.filter(msg =>
          msg.content.toLowerCase().includes(query.toLowerCase())
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const storage = new Storage();

/* ════════════════════════════════════════════════════════════════
   LATIF AI — Search Index (Chat Title Indexing)
   ════════════════════════════════════════════════════════════════
   Maintains an inverted index for fast chat title searches.
   Reduces O(n) full-text scan to O(1) index lookup.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class SearchIndex {
  constructor() {
    this.wordIndex = new Map(); // Map<word, Set<chatId>>
    this.chatTitles = new Map(); // Map<chatId, title> for quick access
  }

  /**
   * Tokenize a string into searchable words (lowercase, split on spaces/punctuation).
   * @param {string} text
   * @returns {string[]}
   */
  tokenize(text) {
    if (!text) return [];
    return text.toLowerCase()
      .split(/[\s\-_./,;:()[\]{}]+/)
      .filter(w => w.length > 0);
  }

  /**
   * Index a single chat by its ID and title.
   * Adds all words from the title to the inverted index.
   * @param {string} chatId
   * @param {string} title
   */
  indexChat(chatId, title) {
    // Remove old index entries for this chat
    this.unindexChat(chatId);

    // Store title for direct lookup
    this.chatTitles.set(chatId, title);

    // Add all words to inverted index
    const words = this.tokenize(title);
    words.forEach(word => {
      if (!this.wordIndex.has(word)) {
        this.wordIndex.set(word, new Set());
      }
      this.wordIndex.get(word).add(chatId);
    });
  }

  /**
   * Remove a chat from the index.
   * @param {string} chatId
   */
  unindexChat(chatId) {
    this.chatTitles.delete(chatId);

    // Remove chat from all word sets
    for (const wordSet of this.wordIndex.values()) {
      wordSet.delete(chatId);
    }
  }

  /**
   * Search for chats by query string.
   * Returns set of chat IDs that match the query (substring match on any word).
   * @param {string} query - Search query
   * @returns {Set<string>} Chat IDs matching the query
   */
  search(query) {
    if (!query || !query.trim()) {
      // Return all indexed chat IDs
      return new Set(this.chatTitles.keys());
    }

    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) {
      return new Set(this.chatTitles.keys());
    }

    // Find chats that match ANY word in the query (OR search)
    // This is more forgiving than AND search for partial titles
    let results = new Set();
    queryWords.forEach(word => {
      // Find words in index that START WITH the query word (prefix match)
      for (const [indexedWord, chatIds] of this.wordIndex) {
        if (indexedWord.startsWith(word)) {
          chatIds.forEach(id => results.add(id));
        }
      }
    });

    return results;
  }

  /**
   * Rebuild the entire index from scratch.
   * Call when loading all chats from localStorage.
   * @param {Object} chatsObject - Object with structure {chatId: {title, ...}}
   */
  rebuildIndex(chatsObject) {
    this.wordIndex.clear();
    this.chatTitles.clear();

    Object.entries(chatsObject).forEach(([chatId, chat]) => {
      if (chat && chat.title) {
        this.indexChat(chatId, chat.title);
      }
    });
  }

  /**
   * Get the number of indexed chats.
   */
  size() {
    return this.chatTitles.size;
  }

  /**
   * Clear the entire index.
   */
  clear() {
    this.wordIndex.clear();
    this.chatTitles.clear();
  }
}

// Global singleton search index for chat titles
const GlobalSearchIndex = new SearchIndex();

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SearchIndex, GlobalSearchIndex };
}

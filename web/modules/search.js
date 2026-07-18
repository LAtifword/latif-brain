/**
 * Search Module
 * Chat and message search functionality
 */

import { storage } from '../utils/storage.js';
import { api } from '../utils/api.js';

export class SearchEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }

  /**
   * Search messages in a chat
   */
  async searchMessages(chatId, query) {
    const cacheKey = `search:${chatId}:${query}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.results;
      }
    }

    try {
      const results = await storage.searchMessages(chatId, query);
      this.cache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Search all chats
   */
  async searchAllChats(query) {
    try {
      const chats = await storage.getAllChats();
      const results = [];

      for (const chat of chats) {
        const messages = await storage.getMessages(chat.id, 1000, 0);
        const matchedMessages = messages.filter(msg =>
          msg.content.toLowerCase().includes(query.toLowerCase())
        );

        if (matchedMessages.length > 0 || chat.title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            chat,
            matchedMessages: matchedMessages.slice(0, 3),
            matchCount: matchedMessages.length
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Global search failed:', error);
      return [];
    }
  }

  /**
   * Advanced search with filters
   */
  async advancedSearch(options = {}) {
    const {
      chatId,
      query = '',
      role = null, // 'user' | 'assistant'
      startDate = null,
      endDate = null,
      limit = 50
    } = options;

    try {
      let results = [];

      if (chatId) {
        results = await storage.searchMessages(chatId, query);
      } else {
        const chats = await storage.getAllChats();
        for (const chat of chats) {
          const messages = await storage.getMessages(chat.id, 1000, 0);
          results = results.concat(messages);
        }
        results = results.filter(msg =>
          msg.content.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Apply filters
      if (role) {
        results = results.filter(msg => msg.role === role);
      }

      if (startDate) {
        results = results.filter(msg => msg.timestamp >= startDate.getTime());
      }

      if (endDate) {
        results = results.filter(msg => msg.timestamp <= endDate.getTime());
      }

      // Sort by relevance and date
      results.sort((a, b) => {
        const aScore = this.calculateRelevance(a.content, query);
        const bScore = this.calculateRelevance(b.content, query);
        if (aScore !== bScore) return bScore - aScore;
        return b.timestamp - a.timestamp;
      });

      return results.slice(0, limit);
    } catch (error) {
      console.error('Advanced search failed:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score for a message
   */
  calculateRelevance(content, query) {
    if (!query) return 0;

    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Exact phrase match
    if (lowerContent.includes(lowerQuery)) {
      score += 10;
    }

    // Word-by-word matches
    const queryWords = lowerQuery.split(/\s+/);
    const contentWords = lowerContent.split(/\s+/);

    for (const qWord of queryWords) {
      const count = contentWords.filter(w => w.includes(qWord)).length;
      score += count;
    }

    // Proximity bonus (words close together)
    const queryIndex = lowerContent.indexOf(lowerQuery);
    if (queryIndex !== -1) {
      score += 5;
    }

    return score;
  }

  /**
   * Generate search suggestions
   */
  async getSuggestions(query, limit = 5) {
    try {
      const results = await this.searchAllChats(query);
      const suggestions = new Set();

      // Extract word suggestions from results
      for (const result of results.slice(0, 10)) {
        const words = result.chat.title.split(/\s+/);
        for (const word of words) {
          if (word.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(word);
          }
        }

        for (const msg of result.matchedMessages) {
          const words = msg.content.split(/\s+/).slice(0, 20);
          for (const word of words) {
            if (word.toLowerCase().includes(query.toLowerCase())) {
              suggestions.add(word.replace(/[.,!?;:]/g, ''));
            }
          }
        }
      }

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Getting suggestions failed:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get search history
   */
  async getSearchHistory() {
    return Array.from(this.cache.keys());
  }
}

export const searchEngine = new SearchEngine();

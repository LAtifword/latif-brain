/* ════════════════════════════════════════════════════════════════
   LATIF AI — Hybrid RAG (BM25 + Vector Search)
   ════════════════════════════════════════════════════════════════
   Combines BM25 keyword search with vector similarity for better
   retrieval quality and ranking.

   LATIF v5.1.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class HybridRAG {
  constructor() {
    // BM25 parameters
    this.k1 = 1.5;      // Term frequency saturation parameter
    this.b = 0.75;      // Length normalization parameter
    this.avgDocLen = 0; // Average document length

    // Inverted index for BM25
    this.invertedIndex = new Map(); // term -> {docId -> freq, idf}
    this.documents = new Map();     // docId -> {content, length}
    this.documentCount = 0;

    // Semantic cache for deduplication
    this.semanticCache = new Map(); // queryHash -> {results, timestamp}
    this.cacheMaxAge = 3600000;     // 1 hour
    this.cacheMaxSize = 100;        // Max 100 cached queries
  }

  /**
   * Tokenize text into words for indexing.
   * @param {string} text
   * @returns {string[]} Tokens (lowercase, no punctuation)
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2); // Ignore 1-2 char words
  }

  /**
   * Index a document for BM25 search.
   * @param {string} docId - Unique document identifier
   * @param {string} content - Document content to index
   */
  indexDocument(docId, content) {
    const tokens = this.tokenize(content);
    const docLength = tokens.length;

    // Store document
    this.documents.set(docId, { content, length: docLength });

    // Update inverted index
    const seenTokens = new Set();
    for (const token of tokens) {
      if (!seenTokens.has(token)) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, { docs: {}, idf: 0 });
        }
        const posting = this.invertedIndex.get(token);
        posting.docs[docId] = (posting.docs[docId] || 0) + 1;
        seenTokens.add(token);
      }
    }

    // Recalculate average document length
    this.documentCount = this.documents.size;
    const totalLen = Array.from(this.documents.values()).reduce((sum, d) => sum + d.length, 0);
    this.avgDocLen = totalLen / this.documentCount || 1;

    // Recalculate IDF values
    this.updateIDF();
  }

  /**
   * Update IDF (Inverse Document Frequency) for all terms.
   * @private
   */
  updateIDF() {
    const N = this.documentCount || 1;
    for (const [term, posting] of this.invertedIndex) {
      const docFreq = Object.keys(posting.docs).length;
      posting.idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
    }
  }

  /**
   * Calculate BM25 score for a query term in a document.
   * @private
   */
  bm25Score(term, docId) {
    const posting = this.invertedIndex.get(term);
    if (!posting) return 0;

    const doc = this.documents.get(docId);
    if (!doc) return 0;

    const freq = posting.docs[docId] || 0;
    const idf = posting.idf || 0;
    const docLen = doc.length;
    const avgLen = this.avgDocLen || 1;

    // BM25 formula
    const numerator = freq * (this.k1 + 1);
    const denominator = freq + this.k1 * (1 - this.b + this.b * (docLen / avgLen));

    return idf * (numerator / denominator);
  }

  /**
   * Search documents using BM25 (keyword matching).
   * @param {string} query - Search query
   * @param {number} topK - Number of top results to return (default 10)
   * @returns {Array} [{docId, score, content}] sorted by relevance
   */
  searchBM25(query, topK = 10) {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return [];

    // Score each document
    const scores = new Map(); // docId -> score
    for (const docId of this.documents.keys()) {
      let score = 0;
      for (const token of tokens) {
        score += this.bm25Score(token, docId);
      }
      if (score > 0) {
        scores.set(docId, score);
      }
    }

    // Sort by score and return top K
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => ({
        docId,
        score,
        content: this.documents.get(docId).content,
      }));
  }

  /**
   * Combine BM25 (keyword) and vector (semantic) search results.
   * @param {string} query - Search query
   * @param {Array} vectorResults - [{docId, score}] from vector search
   * @param {number} topK - Return top K results
   * @param {number} bm25Weight - Weight for BM25 (0-1), vector gets (1-weight)
   * @returns {Array} Hybrid-ranked results [{docId, score, content}]
   */
  hybridSearch(query, vectorResults = [], topK = 10, bm25Weight = 0.4) {
    // Get BM25 results
    const bm25Results = this.searchBM25(query, topK * 2); // Get more to merge

    // Normalize and combine scores
    const combinedScores = new Map();

    // Add BM25 scores
    const bm25MaxScore = Math.max(...bm25Results.map((r) => r.score), 1);
    for (const result of bm25Results) {
      const normalizedScore = result.score / bm25MaxScore;
      const weight = bm25Weight * normalizedScore;
      combinedScores.set(result.docId, (combinedScores.get(result.docId) || 0) + weight);
    }

    // Add vector scores
    const vectorMaxScore = Math.max(...vectorResults.map((r) => r.score), 1);
    const vectorWeight = 1 - bm25Weight;
    for (const result of vectorResults) {
      const normalizedScore = result.score / vectorMaxScore;
      const weight = vectorWeight * normalizedScore;
      combinedScores.set(result.docId, (combinedScores.get(result.docId) || 0) + weight);
    }

    // Sort and return top K
    return Array.from(combinedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => ({
        docId,
        score,
        content: this.documents.get(docId)?.content || "",
      }));
  }

  /**
   * Get cache hash for a query (for semantic deduplication).
   * @private
   */
  getQueryHash(query) {
    // Simple hash: SHA-256 would be better but use simple for now
    return btoa(query.toLowerCase()).substring(0, 16);
  }

  /**
   * Check semantic cache for similar recent queries.
   * @param {string} query - Search query
   * @returns {Array|null} Cached results if found, null otherwise
   */
  getCachedResults(query) {
    const hash = this.getQueryHash(query);
    const cached = this.semanticCache.get(hash);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheMaxAge) {
        return cached.results; // Cache hit
      }
      this.semanticCache.delete(hash); // Expired
    }

    return null;
  }

  /**
   * Cache search results for future queries.
   * @param {string} query - Search query
   * @param {Array} results - Search results to cache
   */
  cacheResults(query, results) {
    // Evict oldest entry if cache is full
    if (this.semanticCache.size >= this.cacheMaxSize) {
      const oldestKey = Array.from(this.semanticCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.semanticCache.delete(oldestKey);
    }

    const hash = this.getQueryHash(query);
    this.semanticCache.set(hash, { results, timestamp: Date.now() });
  }

  /**
   * Clear all indices and cache.
   */
  clear() {
    this.invertedIndex.clear();
    this.documents.clear();
    this.semanticCache.clear();
    this.documentCount = 0;
    this.avgDocLen = 0;
  }

  /**
   * Get statistics about the index.
   * @returns {Object} {documentCount, termCount, avgDocLength, cacheSize}
   */
  getStats() {
    return {
      documentCount: this.documentCount,
      termCount: this.invertedIndex.size,
      avgDocLength: Math.round(this.avgDocLen),
      cacheSize: this.semanticCache.size,
    };
  }
}

const GlobalHybridRAG = new HybridRAG();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { HybridRAG, GlobalHybridRAG };
}

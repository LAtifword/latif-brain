/**
 * Hybrid RAG System - BM25 + Vector Search + Semantic Caching
 * Phase 2 implementation for advanced retrieval quality
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * BM25 Algorithm implementation for keyword search
 */
export class BM25 {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1; // Term frequency saturation
    this.b = b;   // Length normalization
    this.avgDocLen = 0;
    this.docFreq = new Map(); // Document frequency
    this.termFreq = new Map(); // Term frequency per document
  }

  /**
   * Index documents for BM25 scoring
   */
  indexDocuments(documents) {
    const tokenizedDocs = documents.map(doc => this.tokenize(doc));
    this.totalDocs = tokenizedDocs.length;

    let totalLen = 0;

    tokenizedDocs.forEach((tokens, docIdx) => {
      totalLen += tokens.length;
      const termFreqDoc = new Map();

      tokens.forEach(token => {
        termFreqDoc.set(token, (termFreqDoc.get(token) || 0) + 1);

        if (!this.docFreq.has(token)) {
          this.docFreq.set(token, 0);
        }
        this.docFreq.set(token, this.docFreq.get(token) + 1);
      });

      this.termFreq.set(docIdx, termFreqDoc);
    });

    this.avgDocLen = totalLen / this.totalDocs;
    return this;
  }

  /**
   * Tokenize text into terms
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2); // Ignore short terms
  }

  /**
   * Score documents for a query
   */
  score(queryText, docLengths) {
    const queryTokens = this.tokenize(queryText);
    const scores = new Map();

    for (let docIdx = 0; docIdx < this.totalDocs; docIdx++) {
      let score = 0;
      const docTermFreq = this.termFreq.get(docIdx);
      const docLen = docLengths[docIdx] || this.avgDocLen;

      queryTokens.forEach(token => {
        const tf = docTermFreq.get(token) || 0;
        const df = this.docFreq.get(token) || 1;
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

        const normLen = 1 - this.b + this.b * (docLen / this.avgDocLen);
        const bm25Score = idf * ((this.k1 + 1) * tf) / (this.k1 * normLen + tf);

        score += bm25Score;
      });

      scores.set(docIdx, score);
    }

    return scores;
  }
}

/**
 * Hybrid Search combining BM25 + Vector similarity
 */
export class HybridSearch {
  constructor() {
    this.bm25 = new BM25();
    this.cache = new Map();
  }

  /**
   * Hybrid search combining keyword and semantic relevance
   */
  async search(query, documents, embeddings, threshold = 0.5) {
    // Check semantic cache first
    const cacheKey = this.getCacheKey(query);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // BM25 keyword search
    const docLengths = documents.map(d => d.length);
    this.bm25.indexDocuments(documents);
    const bm25Scores = this.bm25.score(query, docLengths);

    // Vector similarity search
    const queryEmbedding = await this.getQueryEmbedding(query);
    const vectorScores = this.computeVectorSimilarity(queryEmbedding, embeddings);

    // Combine scores (60% keyword, 40% semantic)
    const combined = this.combineScores(bm25Scores, vectorScores, 0.6, 0.4);

    // Filter by threshold and sort
    const results = Array.from(combined.entries())
      .filter(([_, score]) => score >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([docIdx, score]) => ({
        docIndex: docIdx,
        document: documents[docIdx],
        score: score.toFixed(4),
        embedding: embeddings[docIdx]
      }));

    // Cache result
    this.cache.set(cacheKey, results);
    return results;
  }

  /**
   * Get or compute query embedding
   */
  async getQueryEmbedding(query) {
    const cacheKey = `emb_${query}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // In production, call embedding API
    const embedding = await this.computeEmbedding(query);
    this.cache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Compute query embedding (placeholder - would call AI service)
   */
  async computeEmbedding(_text) {
    // Simplified: return random embedding (real system would call API)
    return Array(384).fill(0).map(() => Math.random());
  }

  /**
   * Compute cosine similarity between query and document embeddings
   */
  computeVectorSimilarity(queryEmbedding, docEmbeddings) {
    const scores = new Map();

    docEmbeddings.forEach((docEmb, idx) => {
      const similarity = this.cosineSimilarity(queryEmbedding, docEmb);
      scores.set(idx, similarity);
    });

    return scores;
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
  }

  /**
   * Combine BM25 and vector scores
   */
  combineScores(bm25Scores, vectorScores, bm25Weight = 0.6, vectorWeight = 0.4) {
    const combined = new Map();
    const allKeys = new Set([...bm25Scores.keys(), ...vectorScores.keys()]);

    allKeys.forEach(key => {
      const bm25 = (bm25Scores.get(key) || 0) / Math.max(...bm25Scores.values() || [1]);
      const vector = vectorScores.get(key) || 0;
      combined.set(key, bm25 * bm25Weight + vector * vectorWeight);
    });

    return combined;
  }

  /**
   * Generate cache key for semantic caching
   */
  getCacheKey(query) {
    return `query_${Buffer.from(query).toString('base64').substring(0, 32)}`;
  }

  /**
   * Clear old cache entries (LRU eviction)
   */
  pruneCache(maxSize = 1000) {
    if (this.cache.size > maxSize) {
      const entriesToDelete = Math.ceil(this.cache.size * 0.2);
      let deleted = 0;
      for (const key of this.cache.keys()) {
        if (deleted >= entriesToDelete) break;
        this.cache.delete(key);
        deleted++;
      }
      logger.info(`Pruned ${deleted} cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      memorySizeEstimate: this.cache.size * 1024, // Rough estimate
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Semantic Cache for deduplicating similar queries
 */
export class SemanticCache {
  constructor(similarityThreshold = 0.95) {
    this.threshold = similarityThreshold;
    this.entries = [];
  }

  /**
   * Check if query is similar to cached query
   */
  findSimilar(queryEmbedding) {
    for (const entry of this.entries) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= this.threshold) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Cache query and response
   */
  set(query, embedding, response) {
    this.entries.push({
      query,
      embedding,
      response,
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (this.entries.length > 100) {
      this.entries = this.entries.slice(-100);
    }
  }

  /**
   * Cosine similarity helper
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Clear cache
   */
  clear() {
    this.entries = [];
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheEntries: this.entries.length,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp
    };
  }
}

// Export singleton instances
export const hybridSearch = new HybridSearch();
export const semanticCache = new SemanticCache();

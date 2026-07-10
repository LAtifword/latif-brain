/**
 * Cross-Encoder Reranking for RAG
 * Reranks retrieval results using semantic relevance
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Cross-Encoder Reranker - reranks top-K results by relevance
 */
export class CrossEncoderReranker {
  constructor(modelName = 'ms-marco-MiniLM-L-12-v2') {
    this.modelName = modelName;
    this.scoreCache = new Map();
    this.batchSize = 32;
  }

  /**
   * Rerank search results
   */
  async rerank(query, documents, topK = 10) {
    // Score each document
    const scores = await Promise.all(
      documents.map((doc) => this.scoreRelevance(query, doc))
    );

    // Pair scores with documents
    const ranked = documents.map((doc, idx) => ({
      ...doc,
      rerankerScore: scores[idx],
      originalIndex: idx
    }));

    // Sort by score descending
    ranked.sort((a, b) => b.rerankerScore - a.rerankerScore);

    // Return top-K
    return ranked.slice(0, topK);
  }

  /**
   * Score relevance of document to query
   */
  async scoreRelevance(query, document) {
    const cacheKey = `${query}||${document.substring(0, 100)}`;

    if (this.scoreCache.has(cacheKey)) {
      return this.scoreCache.get(cacheKey);
    }

    // Simplified scoring: in production would call actual cross-encoder model
    const score = this.computeRelevanceScore(query, document);
    this.scoreCache.set(cacheKey, score);

    return score;
  }

  /**
   * Compute relevance score (heuristic)
   * In production: would call actual cross-encoder model (MiniLM, etc.)
   */
  computeRelevanceScore(query, document) {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const docTokens = document.toLowerCase().split(/\s+/);

    let matchCount = 0;
    let totalTokens = docTokens.length;

    docTokens.forEach(token => {
      if (queryTokens.has(token)) {
        matchCount++;
      }
    });

    // Position boost: matches at start weighted higher
    const positionBoost = docTokens.slice(0, Math.min(50, totalTokens)).reduce((boost, token, idx) => {
      return queryTokens.has(token) ? boost + (1 - idx / 50) * 0.5 : boost;
    }, 0);

    // Relevance score: 0-1
    const baseScore = matchCount / Math.max(queryTokens.size, 1);
    const finalScore = Math.min(1, (baseScore * 0.6 + positionBoost * 0.4));

    return finalScore;
  }

  /**
   * Batch rerank for efficiency
   */
  async batchRerank(query, documentBatches, topK = 10) {
    const allScored = [];

    for (const batch of documentBatches) {
      const scored = await this.rerank(query, batch, batch.length);
      allScored.push(...scored);
    }

    // Global rerank across batches
    allScored.sort((a, b) => b.rerankerScore - a.rerankerScore);
    return allScored.slice(0, topK);
  }

  /**
   * Get score statistics
   */
  getScoreStats(scores) {
    const sorted = [...scores].sort((a, b) => a - b);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const min = sorted[0];

    return { mean, median, max, min };
  }

  /**
   * Clear score cache
   */
  clearCache() {
    this.scoreCache.clear();
    logger.info('Reranker cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheEntries: this.scoreCache.size,
      estimatedMemory: this.scoreCache.size * 256, // Rough estimate
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced RAG Pipeline combining search and reranking
 */
export class RAGPipeline {
  constructor(search, reranker) {
    this.search = search;
    this.reranker = reranker;
  }

  /**
   * End-to-end RAG: search -> rerank -> return
   */
  async retrieve(query, documents, embeddings, options = {}) {
    const {
      initialK = 50,
      finalK = 10,
      threshold = 0.5
    } = options;

    // Step 1: Initial retrieval (hybrid search)
    const initialResults = await this.search.search(
      query,
      documents,
      embeddings,
      threshold
    );

    // Limit to initialK for efficiency
    const candidateDocs = initialResults.slice(0, initialK).map(r => r.document);

    // Step 2: Rerank top candidates
    if (candidateDocs.length === 0) {
      return [];
    }

    const reranked = await this.reranker.rerank(query, candidateDocs, finalK);

    // Add back metadata
    return reranked.map(doc => ({
      document: doc.document || doc,
      rerankerScore: doc.rerankerScore,
      relevance: (doc.rerankerScore * 100).toFixed(1) + '%',
      metadata: {
        source: doc.source || 'unknown',
        timestamp: new Date().toISOString()
      }
    }));
  }

  /**
   * Citation tracking: which source each result came from
   */
  trackCitations(results, sources) {
    return results.map((result, _idx) => ({
      ...result,
      citations: this.extractCitations(result.document, sources)
    }));
  }

  /**
   * Extract citations from document
   */
  extractCitations(document, sources) {
    const citations = [];
    sources.forEach(source => {
      if (document.toLowerCase().includes(source.toLowerCase())) {
        citations.push(source);
      }
    });
    return citations;
  }

  /**
   * Context compression: extract key facts
   */
  compressContext(documents, maxTokens = 2000) {
    let totalTokens = 0;
    const compressed = [];

    for (const doc of documents) {
      const tokens = doc.split(/\s+/).length;
      if (totalTokens + tokens > maxTokens) {
        break;
      }

      // Extract key sentences (simplified)
      const sentences = doc.split(/[.!?]+/).filter(s => s.trim());
      const keyFacts = sentences
        .filter(s => s.includes('important') || s.includes('key') || s.length > 50)
        .slice(0, 3)
        .join('. ');

      if (keyFacts) {
        compressed.push(keyFacts);
        totalTokens += keyFacts.split(/\s+/).length;
      }
    }

    return compressed.join(' ');
  }

  /**
   * Get RAG statistics
   */
  getStats() {
    return {
      searchStats: this.search?.getCacheStats(),
      rerankerStats: this.reranker?.getCacheStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton reranker
export const crossEncoderReranker = new CrossEncoderReranker();

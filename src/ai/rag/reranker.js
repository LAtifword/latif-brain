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
   * Compute relevance score (enhanced heuristic)
   * In production: would call actual cross-encoder model (MiniLM, etc.)
   */
  computeRelevanceScore(query, document) {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const queryPhrase = query.toLowerCase();
    const docLower = document.toLowerCase();
    const docTokens = document.toLowerCase().split(/\s+/);

    let matchCount = 0;
    let totalTokens = docTokens.length;

    // Exact token matches
    docTokens.forEach(token => {
      if (queryTokens.has(token)) {
        matchCount++;
      }
    });

    // Phrase match bonus (higher weight)
    const phraseMatch = docLower.includes(queryPhrase) ? 1.0 : 0.0;

    // Position boost: matches at start weighted higher
    const positionBoost = docTokens.slice(0, Math.min(50, totalTokens)).reduce((boost, token, idx) => {
      return queryTokens.has(token) ? boost + (1 - idx / 50) * 0.5 : boost;
    }, 0);

    // Sentence proximity: boost if query terms are close together
    const sentences = document.split(/[.!?]+/);
    let proximityScore = 0;
    sentences.forEach(sentence => {
      const sentenceTokens = sentence.toLowerCase().split(/\s+/);
      let sentenceMatches = 0;
      sentenceTokens.forEach(token => {
        if (queryTokens.has(token)) sentenceMatches++;
      });
      // Score: match ratio in this sentence
      if (sentenceMatches > 0) {
        proximityScore += (sentenceMatches / queryTokens.size) / sentences.length;
      }
    });

    // Document length penalty (too short or too long docs less relevant)
    const lengthRatio = Math.min(1, totalTokens / 200);
    const lengthScore = lengthRatio > 0.1 ? 1.0 : lengthRatio;

    // Combine scores with weights
    const baseScore = matchCount / Math.max(queryTokens.size, 1);
    const finalScore = Math.min(
      1,
      baseScore * 0.35 +
        phraseMatch * 0.30 +
        positionBoost * 0.15 +
        proximityScore * 0.15 +
        (lengthScore * 0.05)
    );

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
   * Enhanced citation tracking: which source each result came from
   */
  trackCitations(results, sources = []) {
    return results.map((result, _idx) => {
      const citations = this.extractCitations(result.document || result, sources);

      return {
        ...result,
        citations: citations.map(c => ({
          source: c,
          position: this.findSourcePosition(result.document || result, c),
          confidence: 0.95
        })),
        citationCount: citations.length
      };
    });
  }

  /**
   * Extract citations from document with position tracking
   */
  extractCitations(document, sources = []) {
    const citations = [];
    const docLower = document.toLowerCase();

    sources.forEach(source => {
      if (docLower.includes(source.toLowerCase())) {
        citations.push(source);
      }
    });

    return citations;
  }

  /**
   * Find position of source in document
   */
  findSourcePosition(document, source) {
    const position = document.toLowerCase().indexOf(source.toLowerCase());
    const lineNumber = document.substring(0, position).split('\n').length;
    return { characterOffset: position, lineNumber };
  }

  /**
   * Enhanced context compression: extract and preserve key facts
   */
  compressContext(documents, maxTokens = 2000) {
    let totalTokens = 0;
    const keyFactsMap = new Map();

    for (const doc of documents) {
      const tokens = doc.split(/\s+/).length;
      if (totalTokens + tokens > maxTokens) {
        break;
      }

      // Extract key sentences with scoring
      const sentences = doc.split(/[.!?]+/).filter(s => s.trim());
      const keyFacts = this.extractKeyFacts(sentences);

      // Add top-3 key facts
      keyFacts.slice(0, 3).forEach(fact => {
        const key = fact.text;
        if (!keyFactsMap.has(key)) {
          keyFactsMap.set(key, { text: fact.text, score: fact.score });
          totalTokens += fact.text.split(/\s+/).length;
        }
      });

      if (keyFactsMap.size >= 10) break;
    }

    // Sort by score and return
    const sortedFacts = Array.from(keyFactsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(maxTokens / 50))
      .map(f => f.text);

    return sortedFacts.join(' ');
  }

  /**
   * Extract and score key facts from sentences
   */
  extractKeyFacts(sentences) {
    const facts = [];

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      let score = 0;

      // Length score: prefer medium-length sentences
      const length = trimmed.split(/\s+/).length;
      score += Math.max(0, 1 - Math.abs(length - 15) / 50);

      // Keyword scoring: presence of important words
      const importantKeywords = ['important', 'key', 'must', 'required', 'critical', 'essential', 'note', 'fact'];
      const keywordMatches = importantKeywords.filter(kw => trimmed.toLowerCase().includes(kw)).length;
      score += keywordMatches * 0.2;

      // Begins with uppercase and ends with period
      if (trimmed[0] === trimmed[0].toUpperCase() && trimmed.endsWith('.')) {
        score += 0.3;
      }

      facts.push({ text: trimmed, score });
    });

    return facts.sort((a, b) => b.score - a.score);
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

/* ════════════════════════════════════════════════════════════════
   LATIF AI — Reranker (Result Ranking & Quality Scoring)
   ════════════════════════════════════════════════════════════════
   Reranks retrieved results based on semantic relevance,
   query-document similarity, and metadata signals.
   Lightweight local implementation (no neural models needed).

   LATIF v5.1.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class Reranker {
  constructor() {
    // Weights for different ranking signals
    this.weights = {
      tokenOverlap: 0.3,        // How many query tokens appear in doc
      queryDocLen: 0.2,         // Query length vs doc length ratio
      queryPos: 0.2,            // Position of query terms in doc (earlier = better)
      termProximity: 0.15,      // Distance between query terms
      recency: 0.15,            // Timestamp recency (for chat/message contexts)
    };
  }

  /**
   * Tokenize text for comparison.
   * @private
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Calculate token overlap between query and document.
   * @private
   */
  calculateTokenOverlap(queryTokens, docTokens) {
    if (!queryTokens.length || !docTokens.length) return 0;
    const querySet = new Set(queryTokens);
    const overlap = docTokens.filter((t) => querySet.has(t)).length;
    return overlap / Math.max(queryTokens.length, docTokens.length);
  }

  /**
   * Calculate optimal query-document length ratio.
   * Penalty if doc is too short or too long relative to query.
   * @private
   */
  calculateLengthScore(queryLen, docLen) {
    // Optimal: doc is 5-10x longer than query
    const ratio = docLen / Math.max(queryLen, 1);
    if (ratio < 2) return ratio / 2; // Too short
    if (ratio > 20) return 20 / ratio; // Too long
    return 1.0; // Optimal range
  }

  /**
   * Calculate position score (how early query terms appear in doc).
   * @private
   */
  calculatePositionScore(queryTokens, docText) {
    if (!queryTokens.length) return 0;

    const docLower = docText.toLowerCase();
    let minPos = docText.length;

    for (const token of queryTokens) {
      const pos = docLower.indexOf(token);
      if (pos >= 0 && pos < minPos) {
        minPos = pos;
      }
    }

    // Score: 1.0 if query appears at start, decreasing toward 0
    return Math.max(0, 1 - minPos / docText.length);
  }

  /**
   * Calculate proximity score (how close query terms are to each other).
   * @private
   */
  calculateProximityScore(queryTokens, docText) {
    if (queryTokens.length < 2) return 1.0; // N/A for single-token queries

    const docLower = docText.toLowerCase();
    const positions = [];

    for (const token of queryTokens) {
      let pos = docLower.indexOf(token);
      while (pos >= 0 && positions.length < 10) {
        // Limit to first 10 occurrences
        positions.push(pos);
        pos = docLower.indexOf(token, pos + 1);
      }
    }

    if (positions.length < 2) return 1.0;

    // Calculate average distance between consecutive positions
    positions.sort((a, b) => a - b);
    let totalDist = 0;
    for (let i = 1; i < positions.length; i++) {
      totalDist += positions[i] - positions[i - 1];
    }
    const avgDist = totalDist / (positions.length - 1);

    // Score: 1.0 if very close (< 50 chars apart), decreasing with distance
    return Math.max(0, 1 - avgDist / 200);
  }

  /**
   * Calculate recency score based on timestamp.
   * @private
   */
  calculateRecencyScore(timestamp) {
    if (!timestamp) return 0.5; // Neutral score for missing timestamps
    const now = Date.now();
    const ageMs = now - timestamp;

    // Decay over 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Math.max(0, 1 - ageMs / sevenDaysMs);
  }

  /**
   * Rerank search results based on relevance signals.
   * @param {string} query - Original search query
   * @param {Array} results - [{docId, score, content, timestamp?}] to rerank
   * @param {Object} options - {includeRecency, weights}
   * @returns {Array} Reranked results with updated scores
   */
  rerank(query, results, options = {}) {
    if (!results || results.length === 0) return results;

    const { includeRecency = true, weights = this.weights } = options;

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return results;

    // Calculate scores for each result
    const rerankedResults = results.map((result) => {
      const docTokens = this.tokenize(result.content);

      // Calculate individual signals
      const signals = {
        tokenOverlap: this.calculateTokenOverlap(queryTokens, docTokens),
        queryDocLen: this.calculateLengthScore(queryTokens.length, result.content.length),
        queryPos: this.calculatePositionScore(queryTokens, result.content),
        termProximity: this.calculateProximityScore(queryTokens, result.content),
        recency: includeRecency ? this.calculateRecencyScore(result.timestamp) : 0.5,
      };

      // Calculate weighted combined score
      let finalScore = 0;
      for (const [signal, weight] of Object.entries(weights)) {
        finalScore += (signals[signal] || 0) * weight;
      }

      return {
        ...result,
        rerankerScore: finalScore,
        signals, // Include breakdown for debugging
      };
    });

    // Sort by reranker score
    return rerankedResults.sort((a, b) => b.rerankerScore - a.rerankerScore);
  }

  /**
   * Rerank with diversity penalty (reduce similar results).
   * @param {string} query
   * @param {Array} results
   * @param {number} diversityPenalty - Penalty factor (0-1) for similar results
   * @returns {Array} Reranked with diversity applied
   */
  rerankWithDiversity(query, results, diversityPenalty = 0.7) {
    const reranked = this.rerank(query, results);

    // Apply diversity penalty: reduce score of very similar consecutive results
    const processed = [];
    for (let i = 0; i < reranked.length; i++) {
      let result = reranked[i];

      // Compare with previous results
      for (const prev of processed) {
        // Simple similarity: if docs share >60% of tokens, apply penalty
        const prevTokens = new Set(this.tokenize(prev.content));
        const currTokens = this.tokenize(result.content);
        const sharedTokens = currTokens.filter((t) => prevTokens.has(t)).length;
        const similarity = sharedTokens / Math.max(prevTokens.size, currTokens.length);

        if (similarity > 0.6) {
          result.rerankerScore *= diversityPenalty;
        }
      }

      processed.push(result);
    }

    return processed.sort((a, b) => b.rerankerScore - a.rerankerScore);
  }

  /**
   * Filter results by minimum relevance threshold.
   * @param {Array} results - Reranked results with scores
   * @param {number} threshold - Minimum score (0-1)
   * @returns {Array} Filtered results
   */
  filterByThreshold(results, threshold = 0.3) {
    return results.filter((r) => (r.rerankerScore || r.score || 0) >= threshold);
  }

  /**
   * Format results for display with relevance explanation.
   * @param {Array} results - Reranked results
   * @param {number} topK - Number of top results
   * @returns {Array} Formatted [{content, score, relevance}]
   */
  formatResults(results, topK = 5) {
    return results.slice(0, topK).map((r) => ({
      content: r.content,
      score: r.rerankerScore || r.score || 0,
      relevance: this.getRelevanceLabel(r.rerankerScore || r.score || 0),
      docId: r.docId,
    }));
  }

  /**
   * Get human-readable relevance label.
   * @private
   */
  getRelevanceLabel(score) {
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    if (score >= 0.2) return "Poor";
    return "Very Poor";
  }

  /**
   * Get default weight configuration.
   */
  getWeights() {
    return { ...this.weights };
  }

  /**
   * Set custom weight configuration.
   */
  setWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
    // Normalize weights to sum to 1.0
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const key in this.weights) {
      this.weights[key] /= sum;
    }
  }
}

const GlobalReranker = new Reranker();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Reranker, GlobalReranker };
}

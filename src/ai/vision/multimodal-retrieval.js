/**
 * Multimodal Retrieval - Cross-modal search combining text and images
 * Phase 5: Image-text search, similarity matching, hybrid retrieval
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Multimodal Retrieval Engine
 */
export class MultimodalRetriever {
  constructor(hybridSearch, imageEmbeddingsManager) {
    this.hybridSearch = hybridSearch;
    this.imageEmbeddings = imageEmbeddingsManager;
    this.imageTextIndex = new Map(); // imageId -> [associated texts]
    this.queryCache = new Map();
    this.crossModalThreshold = 0.6;
  }

  /**
   * Index image with associated text
   */
  indexImageWithText(imageId, text, metadata = {}) {
    if (!this.imageTextIndex.has(imageId)) {
      this.imageTextIndex.set(imageId, []);
    }

    this.imageTextIndex.get(imageId).push({
      text: text,
      timestamp: new Date().toISOString(),
      metadata: metadata
    });

    logger.info('Image indexed with text', {
      imageId,
      textLength: text.length
    });
  }

  /**
   * Retrieve images by text query (cross-modal search)
   */
  async retrieveImagesByText(query, topK = 10, threshold = 0.5) {
    // Check query cache
    const cacheKey = `text:${query}:${topK}`;
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    const results = [];

    // Score each image by text relevance
    for (const [imageId, texts] of this.imageTextIndex) {
      let maxRelevance = 0;

      texts.forEach(textEntry => {
        // Text similarity (simple keyword matching)
        const relevance = this.textSimilarity(query, textEntry.text);
        maxRelevance = Math.max(maxRelevance, relevance);
      });

      if (maxRelevance >= threshold) {
        results.push({
          imageId: imageId,
          textRelevance: maxRelevance,
          texts: texts,
          source: 'text-index'
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.textRelevance - a.textRelevance);
    const topResults = results.slice(0, topK);

    this.queryCache.set(cacheKey, topResults);
    return topResults;
  }

  /**
   * Retrieve images by image (find similar images)
   */
  retrieveImagesByImage(queryImageId, topK = 10, threshold = 0.5) {
    const results = this.imageEmbeddings.findSimilarImages(queryImageId, topK, threshold);

    return results.map(result => ({
      imageId: result.imageId,
      imageRelevance: result.similarity,
      metadata: result.metadata,
      source: 'image-similarity'
    }));
  }

  /**
   * Hybrid search - text + image
   */
  async hybridSearchMultimodal(textQuery, topK = 10, imageQueryId = null) {
    const results = {
      textResults: [],
      imageResults: [],
      combined: []
    };

    // Text search
    if (textQuery) {
      results.textResults = await this.retrieveImagesByText(textQuery, topK);
    }

    // Image search
    if (imageQueryId) {
      results.imageResults = this.retrieveImagesByImage(imageQueryId, topK);
    }

    // Combine and deduplicate
    const combined = new Map();

    results.textResults.forEach(result => {
      const existing = combined.get(result.imageId) || {};
      combined.set(result.imageId, {
        imageId: result.imageId,
        textRelevance: result.textRelevance,
        imageRelevance: existing.imageRelevance,
        metadata: result.metadata
      });
    });

    results.imageResults.forEach(result => {
      const existing = combined.get(result.imageId) || {};
      combined.set(result.imageId, {
        imageId: result.imageId,
        textRelevance: existing.textRelevance,
        imageRelevance: result.imageRelevance,
        metadata: result.metadata
      });
    });

    // Calculate combined score
    results.combined = Array.from(combined.values())
      .map(result => ({
        ...result,
        combinedScore: (
          (result.textRelevance || 0) * 0.5 +
          (result.imageRelevance || 0) * 0.5
        )
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);

    return results;
  }

  /**
   * Text similarity (simplified)
   */
  textSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get image context for RAG
   */
  getImageContext(imageId, contextSize = 500) {
    const metadata = this.imageEmbeddings.metadata.get(imageId);
    const texts = this.imageTextIndex.get(imageId) || [];

    // Combine all associated text
    const combinedText = texts
      .map(t => t.text)
      .join(' ')
      .substring(0, contextSize);

    return {
      imageId: imageId,
      metadata: metadata,
      associatedText: combinedText,
      textCount: texts.length,
      tags: metadata?.tags || [],
      objects: metadata?.objects || []
    };
  }

  /**
   * Search documents with image context
   */
  async searchWithImageContext(query, imageIds = []) {
    const contexts = imageIds.map(id => this.getImageContext(id));
    const augmentedQuery = query + ' ' + contexts
      .map(c => c.associatedText)
      .join(' ');

    // Return augmented query for RAG system
    return {
      originalQuery: query,
      augmentedQuery: augmentedQuery,
      imageContexts: contexts,
      totalContextLength: augmentedQuery.length
    };
  }

  /**
   * Get retrieval statistics
   */
  getStats() {
    return {
      indexedImages: this.imageTextIndex.size,
      totalTextEntries: Array.from(this.imageTextIndex.values())
        .reduce((sum, texts) => sum + texts.length, 0),
      queryCacheSize: this.queryCache.size,
      crossModalThreshold: this.crossModalThreshold
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    logger.info('Multimodal query cache cleared');
  }
}

// Export singleton
export const multimodalRetriever = new MultimodalRetriever(null, null); // Injected at runtime

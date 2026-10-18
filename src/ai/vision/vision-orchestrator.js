/**
 * Vision Orchestrator - Unified interface for all vision AI capabilities
 * Phase 5: Coordinates embeddings, multimodal retrieval, and analytics
 */

import { getLogger } from '../../core/logger.js';
import { ImageEmbeddingsManager } from './image-embeddings.js';
import { MultimodalRetriever } from './multimodal-retrieval.js';
import { VisionAnalytics } from './vision-analytics.js';

const logger = getLogger();

/**
 * Vision Orchestrator - Central coordinator for vision AI
 */
export class VisionOrchestrator {
  constructor() {
    this.embeddings = new ImageEmbeddingsManager();
    this.retriever = new MultimodalRetriever(null, this.embeddings);
    this.analytics = new VisionAnalytics();
    this.processingQueue = [];
    this.maxConcurrent = 3;
  }

  /**
   * Process and index an image with embeddings and analysis
   */
  async processImage(imageId, imageData, metadata = {}) {
    try {
      // Generate embedding (mock for now - would call CLIP model in production)
      const embedding = this.generateMockEmbedding(imageData);

      // Store embedding
      this.embeddings.storeEmbedding(imageId, embedding, {
        ...metadata,
        fileName: metadata.fileName || imageId,
        uploadedAt: new Date().toISOString()
      });

      logger.info('Image processed', { imageId, hasEmbedding: !!embedding });
      return { success: true, imageId, embeddingDim: embedding.length };
    } catch (err) {
      logger.error('Image processing failed', { imageId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Index image with associated text
   */
  indexImageWithText(imageId, text, metadata = {}) {
    this.retriever.indexImageWithText(imageId, text, metadata);
    logger.info('Image indexed with text', { imageId, textLength: text.length });
  }

  /**
   * Analyze image with all vision capabilities
   */
  analyzeImage(imageId, tags = [], objects = []) {
    const analysis = {
      imageId: imageId,
      tagAnalysis: this.analytics.analyzeTagPatterns(tags),
      objectAnalysis: this.analytics.analyzeObjects(objects),
      composition: this.analytics.analyzeComposition(objects),
      classification: this.analytics.classifyComposition(objects, tags),
      timestamp: new Date().toISOString()
    };

    // Store analysis
    this.analytics.storeAnalysis(imageId, analysis);
    return analysis;
  }

  /**
   * Search images by text query (cross-modal)
   */
  async searchByText(query, topK = 10) {
    const results = await this.retriever.retrieveImagesByText(query, topK);
    logger.info('Text search completed', { query, resultCount: results.length });
    return results;
  }

  /**
   * Find similar images
   */
  findSimilarImages(imageId, topK = 10) {
    const results = this.embeddings.findSimilarImages(imageId, topK);
    logger.info('Similar images found', { imageId, resultCount: results.length });
    return results;
  }

  /**
   * Hybrid search - text + image
   */
  async hybridSearch(textQuery, topK = 10, imageQueryId = null) {
    const results = await this.retriever.hybridSearchMultimodal(textQuery, topK, imageQueryId);
    logger.info('Hybrid search completed', {
      textResults: results.textResults.length,
      imageResults: results.imageResults.length,
      combined: results.combined.length
    });
    return results;
  }

  /**
   * Get image context for RAG
   */
  getImageContext(imageId, contextSize = 500) {
    return this.retriever.getImageContext(imageId, contextSize);
  }

  /**
   * Search documents with image context augmentation
   */
  async searchWithImageContext(query, imageIds = []) {
    return await this.retriever.searchWithImageContext(query, imageIds);
  }

  /**
   * Cluster images by visual similarity
   */
  clusterImages(threshold = 0.7) {
    const clusters = this.embeddings.clusterImages(threshold);
    logger.info('Image clustering complete', { clusterCount: clusters.length });
    return clusters;
  }

  /**
   * Prune old embeddings (LRU)
   */
  pruneOldEmbeddings(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const removed = this.embeddings.pruneByAge(maxAgeMs);
    this.retriever.clearCache();
    logger.info('Embeddings pruned', { removed });
    return removed;
  }

  /**
   * Get comprehensive vision statistics
   */
  getStats() {
    return {
      embeddings: this.embeddings.getStats(),
      retrieval: this.retriever.getStats(),
      analytics: this.analytics.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export vision data
   */
  export() {
    return {
      embeddings: this.embeddings.export(),
      analyticsSummary: {
        totalAnalyses: this.analytics.analysisHistory.length,
        topTags: this.analytics.getTopTags(10),
        uniqueTags: this.analytics.tagFrequency.size,
        uniqueObjects: this.analytics.objectFrequency.size
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock embedding (for testing - replace with CLIP in production)
   */
  generateMockEmbedding(imageData, dim = 512) {
    // Deterministic pseudo-random based on image data
    const seed = imageData.length || 42;
    const embedding = [];
    for (let i = 0; i < dim; i++) {
      const x = Math.sin(seed + i) * 10000;
      embedding.push(x - Math.floor(x));
    }
    return embedding;
  }

  /**
   * Clear all vision data
   */
  clearAll() {
    this.embeddings = new ImageEmbeddingsManager();
    this.retriever = new MultimodalRetriever(null, this.embeddings);
    this.analytics = new VisionAnalytics();
    logger.info('Vision system cleared');
  }
}

// Export singleton
export const visionOrchestrator = new VisionOrchestrator();

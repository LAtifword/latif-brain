/**
 * Image Embeddings - Generate and manage image embeddings for similarity search
 * Phase 5: CLIP embeddings, similarity search, caching
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Image Embeddings Manager
 */
export class ImageEmbeddingsManager {
  constructor() {
    this.embeddings = new Map(); // imageId -> embedding
    this.metadata = new Map(); // imageId -> metadata
    this.index = []; // Array of [imageId, embedding] for fast search
    this.similarityCache = new Map(); // (id1, id2) -> similarity score
    this.embeddingDim = 512; // CLIP embedding dimension
  }

  /**
   * Store image embedding
   */
  storeEmbedding(imageId, embedding, metadata = {}) {
    if (!embedding || embedding.length === 0) {
      throw new Error('Invalid embedding');
    }

    this.embeddings.set(imageId, embedding);
    this.metadata.set(imageId, {
      ...metadata,
      timestamp: new Date().toISOString(),
      dimension: embedding.length
    });

    // Add to index for search
    this.index.push([imageId, embedding]);

    logger.info('Embedding stored', {
      imageId,
      dimension: embedding.length,
      totalEmbeddings: this.embeddings.size
    });

    return imageId;
  }

  /**
   * Get image embedding
   */
  getEmbedding(imageId) {
    return this.embeddings.get(imageId);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Find similar images
   */
  findSimilarImages(imageId, topK = 10, threshold = 0.5) {
    const embedding = this.embeddings.get(imageId);
    if (!embedding) return [];

    const similarities = [];

    this.embeddings.forEach((otherEmbedding, otherId) => {
      if (otherId === imageId) return; // Skip self

      // Check cache first
      const cacheKey = `${imageId}:${otherId}`;
      let similarity = this.similarityCache.get(cacheKey);

      if (similarity === undefined) {
        similarity = this.cosineSimilarity(embedding, otherEmbedding);
        this.similarityCache.set(cacheKey, similarity);
      }

      if (similarity >= threshold) {
        similarities.push({
          imageId: otherId,
          similarity: similarity,
          metadata: this.metadata.get(otherId)
        });
      }
    });

    // Sort by similarity descending
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Calculate centroid embedding
   */
  calculateCentroid(imageIds) {
    if (!imageIds || imageIds.length === 0) return null;

    const embeddings = imageIds
      .map(id => this.embeddings.get(id))
      .filter(e => e !== undefined);

    if (embeddings.length === 0) return null;

    const centroid = new Array(this.embeddingDim).fill(0);

    embeddings.forEach(embedding => {
      for (let i = 0; i < embedding.length; i++) {
        centroid[i] += embedding[i] / embeddings.length;
      }
    });

    return centroid;
  }

  /**
   * Cluster images by similarity
   */
  clusterImages(threshold = 0.7) {
    const clusters = [];
    const visited = new Set();

    this.embeddings.forEach((embedding, imageId) => {
      if (visited.has(imageId)) return;

      const cluster = [imageId];
      visited.add(imageId);

      // Find similar images for this cluster
      const similar = this.findSimilarImages(imageId, 1000, threshold);
      similar.forEach(({ imageId: similarId }) => {
        if (!visited.has(similarId)) {
          cluster.push(similarId);
          visited.add(similarId);
        }
      });

      if (cluster.length > 0) {
        clusters.push({
          centroid: this.calculateCentroid(cluster),
          members: cluster,
          size: cluster.length
        });
      }
    });

    logger.info('Clustering complete', {
      totalClusters: clusters.length,
      totalImages: this.embeddings.size,
      avgClusterSize: (this.embeddings.size / clusters.length).toFixed(1)
    });

    return clusters;
  }

  /**
   * Get embedding statistics
   */
  getStats() {
    return {
      totalImages: this.embeddings.size,
      embeddingDimension: this.embeddingDim,
      indexSize: this.index.length,
      cacheSize: this.similarityCache.size,
      estimatedMemory: (this.embeddings.size * this.embeddingDim * 4) / (1024 * 1024) // MB
    };
  }

  /**
   * Clear old embeddings (LRU)
   */
  pruneByAge(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let prunedCount = 0;

    this.metadata.forEach((meta, imageId) => {
      const age = now - new Date(meta.timestamp).getTime();
      if (age > maxAgeMs) {
        this.embeddings.delete(imageId);
        this.metadata.delete(imageId);
        prunedCount++;
      }
    });

    // Rebuild index
    this.index = Array.from(this.embeddings.entries());
    this.similarityCache.clear();

    logger.info('Embeddings pruned', { removed: prunedCount });
    return prunedCount;
  }

  /**
   * Export embeddings
   */
  export() {
    return {
      embeddings: Object.fromEntries(this.embeddings),
      metadata: Object.fromEntries(this.metadata),
      stats: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton
export const imageEmbeddingsManager = new ImageEmbeddingsManager();

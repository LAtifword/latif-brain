/**
 * Vision Analytics - Advanced image analysis and interpretation
 * Phase 5: Image classification, pattern detection, visual reasoning
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Vision Analytics Engine
 */
export class VisionAnalytics {
  constructor() {
    this.tagFrequency = new Map();
    this.objectFrequency = new Map();
    this.analysisHistory = [];
    this.patterns = new Map();
    this.confidenceThreshold = 0.5;
  }

  /**
   * Analyze image tags for common patterns
   */
  analyzeTagPatterns(tags) {
    tags.forEach(tag => {
      const count = this.tagFrequency.get(tag.name) || 0;
      this.tagFrequency.set(tag.name, count + tag.confidence);
    });

    return {
      topTags: this.getTopTags(5),
      tagDiversity: this.tagFrequency.size,
      patterns: this.extractTagPatterns(tags)
    };
  }

  /**
   * Analyze detected objects
   */
  analyzeObjects(objects) {
    const analysis = {
      totalObjects: objects.length,
      uniqueObjects: new Set(objects.map(o => o.class)).size,
      objectTypes: {},
      spatialDistribution: this.analyzeSpatialDistribution(objects)
    };

    objects.forEach(obj => {
      const type = obj.class;
      if (!analysis.objectTypes[type]) {
        analysis.objectTypes[type] = [];
      }
      analysis.objectTypes[type].push({
        confidence: obj.confidence,
        boundingBox: obj.bbox
      });

      // Update frequency
      const count = this.objectFrequency.get(type) || 0;
      this.objectFrequency.set(type, count + obj.confidence);
    });

    return analysis;
  }

  /**
   * Analyze spatial distribution of objects
   */
  analyzeSpatialDistribution(objects) {
    if (objects.length === 0) return null;

    // Divide image into 9 regions (3x3 grid)
    const regions = Array(9).fill(0);

    objects.forEach(obj => {
      const bbox = obj.bbox;
      const centerX = (bbox.x1 + bbox.x2) / 2;
      const centerY = (bbox.y1 + bbox.y2) / 2;

      const regionX = Math.floor(centerX / 33.33); // 0-2
      const regionY = Math.floor(centerY / 33.33); // 0-2
      const regionIndex = regionY * 3 + Math.min(regionX, 2);

      regions[regionIndex]++;
    });

    return {
      regions: regions,
      density: regions.filter(r => r > 0).length / 9,
      centeredness: (regions[4] / objects.length).toFixed(2) // Center region (index 4)
    };
  }

  /**
   * Extract patterns from tags
   */
  extractTagPatterns(tags) {
    // Find co-occurring tags
    const tagNames = tags.map(t => t.name);
    for (let i = 0; i < tagNames.length; i++) {
      for (let j = i + 1; j < tagNames.length; j++) {
        const pattern = `${tagNames[i]}-${tagNames[j]}`;
        const count = this.patterns.get(pattern) || 0;
        this.patterns.set(pattern, count + 1);
      }
    }

    // Get top patterns
    const topPatterns = Array.from(this.patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, frequency: count }));

    return topPatterns;
  }

  /**
   * Get top tags
   */
  getTopTags(topK = 10) {
    return Array.from(this.tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([tag, score]) => ({ tag, score: score.toFixed(2) }));
  }

  /**
   * Classify image by composition
   */
  classifyComposition(objects, tags) {
    const classification = {
      complexity: this.analyzeComplexity(objects, tags),
      composition: this.analyzeComposition(objects),
      aesthetics: this.analyzeAesthetics(tags),
      contentType: this.classifyContentType(tags)
    };

    return classification;
  }

  /**
   * Analyze image complexity
   */
  analyzeComplexity(objects, tags) {
    const objectDensity = objects.length / 100; // Rough estimate
    const tagDiversity = tags.length / 10;
    const complexity = Math.min(1, objectDensity * 0.5 + tagDiversity * 0.5);

    return {
      score: complexity.toFixed(2),
      level: complexity < 0.33 ? 'simple' : complexity < 0.66 ? 'moderate' : 'complex'
    };
  }

  /**
   * Analyze composition rules
   */
  analyzeComposition(objects) {
    if (objects.length === 0) {
      return { rule: 'empty' };
    }

    const centerObjects = objects.filter(o => {
      const centerX = (o.bbox.x1 + o.bbox.x2) / 2;
      const centerY = (o.bbox.y1 + o.bbox.y2) / 2;
      return Math.abs(centerX - 50) < 20 && Math.abs(centerY - 50) < 20;
    });

    if (centerObjects.length / objects.length > 0.5) {
      return { rule: 'centered' };
    }

    const leftObjects = objects.filter(o => (o.bbox.x1 + o.bbox.x2) / 2 < 40).length;
    const rightObjects = objects.filter(o => (o.bbox.x1 + o.bbox.x2) / 2 > 60).length;

    if (Math.abs(leftObjects - rightObjects) > objects.length * 0.3) {
      return { rule: 'asymmetrical' };
    }

    return { rule: 'balanced' };
  }

  /**
   * Analyze aesthetic qualities
   */
  analyzeAesthetics(tags) {
    const aestheticTags = ['vibrant', 'colorful', 'bright', 'dark', 'moody', 'vivid', 'muted', 'high-contrast'];
    const aesthetics = {};

    tags.forEach(tag => {
      if (aestheticTags.includes(tag.name.toLowerCase())) {
        aesthetics[tag.name] = tag.confidence;
      }
    });

    return aesthetics;
  }

  /**
   * Classify content type
   */
  classifyContentType(tags) {
    const categories = {
      portrait: ['face', 'person', 'head', 'selfie'],
      landscape: ['nature', 'mountain', 'sky', 'outdoor'],
      stillLife: ['object', 'product', 'food', 'flower'],
      abstract: ['abstract', 'texture', 'pattern'],
      document: ['text', 'document', 'scan', 'screenshot']
    };

    const tagNames = tags.map(t => t.name.toLowerCase());
    const scores = {};

    for (const [category, keywords] of Object.entries(categories)) {
      const matches = keywords.filter(kw => tagNames.some(t => t.includes(kw)));
      scores[category] = matches.length;
    }

    const bestCategory = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      type: bestCategory ? bestCategory[0] : 'unknown',
      confidence: bestCategory ? (bestCategory[1] / categories[bestCategory[0]].length).toFixed(2) : 0
    };
  }

  /**
   * Generate image description
   */
  generateDescription(imageId, tags, objects) {
    const topTags = tags.slice(0, 3).map(t => t.name);
    const topObjects = [...new Set(objects.map(o => o.class))].slice(0, 3);

    let description = 'An image ';

    if (topTags.length > 0) {
      description += `that is ${topTags.join(', ')}`;
    }

    if (topObjects.length > 0) {
      description += ` containing ${topObjects.join(', ')}`;
    }

    description += '.';

    return description;
  }

  /**
   * Store analysis
   */
  storeAnalysis(imageId, analysis) {
    const record = {
      imageId: imageId,
      analysis: analysis,
      timestamp: new Date().toISOString()
    };

    this.analysisHistory.push(record);

    logger.info('Analysis stored', {
      imageId,
      analysisType: Object.keys(analysis).join(', ')
    });

    return record;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalAnalyses: this.analysisHistory.length,
      uniqueTags: this.tagFrequency.size,
      uniqueObjects: this.objectFrequency.size,
      topTags: this.getTopTags(5),
      topObjects: Array.from(this.objectFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([obj, score]) => ({ object: obj, score: score.toFixed(2) }))
    };
  }
}

// Export singleton
export const visionAnalytics = new VisionAnalytics();

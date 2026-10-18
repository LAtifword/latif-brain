/* ════════════════════════════════════════════════════════════════
   LATIF AI — Vision AI (Image Understanding & Analysis)
   ════════════════════════════════════════════════════════════════
   Image processing, classification, OCR, and multimodal RAG.
   Extensible architecture for integrating vision models.

   LATIF v5.4.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class VisionAI {
  constructor() {
    // Image metadata storage
    this.imageMetadata = new Map(); // imageId -> {name, tags, description, ocr, embeddings}

    // Vision model endpoints (configurable)
    this.clipEndpoint = null; // CLIP image classifier
    this.ocrEndpoint = null; // OCR model
    this.detectionEndpoint = null; // Object detection model
  }

  /**
   * Analyze an image file and extract metadata.
   * @param {File} file - Image file
   * @returns {Promise<Object>} {tags, description, ocr, size}
   */
  async analyzeImage(file) {
    try {
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Extract basic metadata
      const metadata = {
        id: imageId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: Date.now(),
        tags: [],
        description: "",
        ocr: "",
        colors: [],
        objects: [],
      };

      // Read image as data URL for processing
      const dataUrl = await this.fileToDataUrl(file);

      // Generate auto-tags from filename
      const filenameTags = this.extractTagsFromFilename(file.name);
      metadata.tags.push(...filenameTags);

      // Extract dominant colors (simplified)
      metadata.colors = await this.extractDominantColors(dataUrl);

      // Try to run OCR if available
      try {
        metadata.ocr = await this.performOCR(dataUrl);
      } catch (err) {
        console.warn("OCR failed:", err.message);
      }

      // Try object detection if available
      try {
        metadata.objects = await this.detectObjects(dataUrl);
        metadata.tags.push(...metadata.objects.map((o) => o.label));
      } catch (err) {
        console.warn("Object detection failed:", err.message);
      }

      // Generate description from content
      metadata.description = await this.generateDescription(metadata);

      // Store metadata
      this.imageMetadata.set(imageId, metadata);

      // Save to IndexedDB if available
      if (typeof GlobalDataLayer !== "undefined") {
        await GlobalDataLayer.saveSetting(`vision_img_${imageId}`, metadata);
      }

      return metadata;
    } catch (err) {
      GlobalErrorLogger.error("VisionAI.analyzeImage", err);
      throw err;
    }
  }

  /**
   * Convert File to data URL.
   * @private
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract tags from image filename.
   * @private
   */
  extractTagsFromFilename(filename) {
    const basename = filename.split(".")[0];
    // Split by common separators: -, _, space
    return basename
      .split(/[-_\s]+/)
      .filter((t) => t.length > 2)
      .map((t) => t.toLowerCase());
  }

  /**
   * Extract dominant colors from image (simplified).
   * @private
   */
  async extractDominantColors(dataUrl, colorCount = 3) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 50;
          canvas.height = 50;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, 50, 50);

          const imageData = ctx.getImageData(0, 0, 50, 50).data;
          const colors = [];

          // Simple color sampling (every Nth pixel)
          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            colors.push(`rgb(${r},${g},${b})`);
          }

          // Get most common colors (simplified: just take first few)
          resolve(colors.slice(0, colorCount));
        };
        img.onerror = () => resolve([]);
        img.src = dataUrl;
      } catch (err) {
        resolve([]); // Return empty if canvas not available
      }
    });
  }

  /**
   * Perform OCR on image (requires OCR model endpoint).
   * @private
   */
  async performOCR(dataUrl) {
    if (!this.ocrEndpoint) {
      return ""; // OCR not configured
    }

    try {
      const response = await fetch(this.ocrEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!response.ok) return "";

      const data = await response.json();
      return data.text || "";
    } catch (err) {
      console.warn("OCR request failed:", err.message);
      return "";
    }
  }

  /**
   * Detect objects in image (requires detection model endpoint).
   * @private
   */
  async detectObjects(dataUrl) {
    if (!this.detectionEndpoint) {
      return []; // Detection not configured
    }

    try {
      const response = await fetch(this.detectionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (
        data.objects?.map((obj) => ({
          label: obj.label || "unknown",
          confidence: obj.confidence || 0.5,
          bbox: obj.bbox,
        })) || []
      );
    } catch (err) {
      console.warn("Object detection request failed:", err.message);
      return [];
    }
  }

  /**
   * Generate description from image metadata.
   * @private
   */
  async generateDescription(metadata) {
    // Build description from available signals
    const parts = [];

    if (metadata.objects.length > 0) {
      const objectLabels = metadata.objects.slice(0, 3).map((o) => o.label);
      parts.push(`Image contains: ${objectLabels.join(", ")}`);
    }

    if (metadata.tags.length > 0) {
      parts.push(`Tags: ${metadata.tags.slice(0, 5).join(", ")}`);
    }

    if (metadata.ocr) {
      parts.push(`Text detected: ${metadata.ocr.substring(0, 100)}...`);
    }

    return parts.join(". ") || "Image uploaded";
  }

  /**
   * Generate embedding for image (requires CLIP or similar).
   * @param {string} imageId - Image ID to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async generateImageEmbedding(imageId) {
    if (!this.clipEndpoint) {
      return null; // CLIP not configured
    }

    try {
      const metadata = this.imageMetadata.get(imageId);
      if (!metadata) return null;

      const response = await fetch(this.clipEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: metadata.dataUrl }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.embedding || null;
    } catch (err) {
      console.warn("Image embedding failed:", err.message);
      return null;
    }
  }

  /**
   * Find similar images based on metadata.
   * @param {string} imageId - Reference image
   * @param {number} topK - Number of similar images to return
   * @returns {Array} Similar images
   */
  findSimilarImages(imageId, topK = 5) {
    const refImage = this.imageMetadata.get(imageId);
    if (!refImage) return [];

    const refTags = new Set(refImage.tags);
    const scores = new Map();

    // Compare with all other images
    for (const [otherId, otherImage] of this.imageMetadata) {
      if (otherId === imageId) continue;

      // Calculate tag overlap
      const otherTags = new Set(otherImage.tags);
      const intersection = Array.from(refTags).filter((t) => otherTags.has(t));
      const union = new Set([...refTags, ...otherTags]);
      const similarity = intersection.length / union.size;

      if (similarity > 0.3) {
        scores.set(otherId, similarity);
      }
    }

    // Return top K by similarity
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => ({
        ...this.imageMetadata.get(id),
        similarity: score,
      }));
  }

  /**
   * Get image metadata.
   */
  getImageMetadata(imageId) {
    return this.imageMetadata.get(imageId);
  }

  /**
   * List all images.
   */
  listImages() {
    return Array.from(this.imageMetadata.values());
  }

  /**
   * Search images by tag.
   */
  searchByTag(tag) {
    const results = [];
    for (const [imageId, metadata] of this.imageMetadata) {
      if (metadata.tags.includes(tag.toLowerCase())) {
        results.push(metadata);
      }
    }
    return results;
  }

  /**
   * Delete image metadata.
   */
  deleteImage(imageId) {
    this.imageMetadata.delete(imageId);
    if (typeof GlobalDataLayer !== "undefined") {
      GlobalDataLayer.saveSetting(`vision_img_${imageId}`, null).catch(() => {});
    }
  }

  /**
   * Get vision AI statistics.
   */
  getStats() {
    return {
      imageCount: this.imageMetadata.size,
      totalTags: new Set(
        Array.from(this.imageMetadata.values()).flatMap((m) => m.tags)
      ).size,
      totalOCRChars: Array.from(this.imageMetadata.values()).reduce(
        (sum, m) => sum + (m.ocr?.length || 0),
        0
      ),
    };
  }

  /**
   * Clear all image data.
   */
  clear() {
    this.imageMetadata.clear();
  }
}

const GlobalVisionAI = new VisionAI();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { VisionAI, GlobalVisionAI };
}

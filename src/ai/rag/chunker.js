/**
 * Document Chunking with Adaptive Sizing
 * Phase 2: Intelligent chunking based on content type and structure
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Adaptive Chunker - creates chunks optimized for RAG
 */
export class AdaptiveChunker {
  constructor() {
    // Chunk sizes by content type (tokens)
    this.chunkSizes = {
      technical: 512,      // Shorter for code/technical docs
      narrative: 768,      // Longer for prose/stories
      reference: 384,      // Shorter for reference materials
      dialogue: 256,       // Shorter for conversations
      default: 512
    };

    this.overlapTokens = 64; // Overlap between chunks for context
  }

  /**
   * Detect content type to determine optimal chunk size
   */
  detectContentType(text) {
    // Count specific patterns
    const codeIndicators = (text.match(/```|function|class|const|import|export/g) || []).length;
    const conversationIndicators = (text.match(/^[>:].+$/gm) || []).length;
    const titleIndicators = (text.match(/^#+\s/gm) || []).length;

    if (codeIndicators > text.length / 500) return 'technical';
    if (conversationIndicators > text.length / 1000) return 'dialogue';
    if (titleIndicators > 5) return 'reference';

    return 'narrative';
  }

  /**
   * Smart chunk - splits by sentences and paragraphs
   */
  chunk(document, contentType = null) {
    if (!contentType) {
      contentType = this.detectContentType(document);
    }

    const targetSize = this.chunkSizes[contentType] || this.chunkSizes.default;
    const chunks = [];
    const sentences = this.splitSentences(document);

    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      // Start new chunk if size exceeded
      if (currentTokens + sentenceTokens > targetSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
          contentType,
          startChar: 0,
          endChar: currentChunk.length
        });

        // Add overlap from end of current chunk to start of next
        const overlapText = currentChunk.split(/\s+/).slice(-Math.ceil(this.overlapTokens / 2)).join(' ');
        currentChunk = overlapText;
        currentTokens = this.estimateTokens(overlapText);
      }

      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        tokens: currentTokens,
        contentType,
        startChar: 0,
        endChar: currentChunk.length
      });
    }

    logger.info('Document chunked', {
      contentType,
      chunkCount: chunks.length,
      avgChunkSize: (chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length).toFixed(0),
      totalTokens: chunks.reduce((sum, c) => sum + c.tokens, 0)
    });

    return chunks;
  }

  /**
   * Split document into sentences
   */
  splitSentences(text) {
    // Split on sentence boundaries but preserve formatting
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/g)
      .filter(s => s.trim().length > 0);
  }

  /**
   * Estimate token count (rough: 1 token per 4 characters)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split by paragraphs for better semantic chunks
   */
  chunkByParagraph(document) {
    const paragraphs = document.split(/\n\n+/).filter(p => p.trim());
    const chunks = [];

    for (const paragraph of paragraphs) {
      const tokens = this.estimateTokens(paragraph);
      chunks.push({
        text: paragraph.trim(),
        tokens,
        isParagraph: true,
        type: this.detectContentType(paragraph)
      });
    }

    return chunks;
  }

  /**
   * Chunk by markdown headers (for structured documents)
   */
  chunkByHeaders(document) {
    const chunks = [];
    const lines = document.split('\n');
    let currentChunk = '';
    let currentHeader = 'default';

    for (const line of lines) {
      const headerMatch = line.match(/^(#+)\s(.+)$/);

      if (headerMatch) {
        // Save previous chunk
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            header: currentHeader,
            level: currentHeader.split('#').length - 1
          });
        }

        currentHeader = line;
        currentChunk = '';
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        header: currentHeader,
        level: currentHeader.split('#').length - 1
      });
    }

    return chunks;
  }

  /**
   * Merge small chunks for efficiency
   */
  mergeSmallChunks(chunks, minTokens = 100) {
    const merged = [];
    let buffer = '';
    let bufferTokens = 0;

    for (const chunk of chunks) {
      const tokens = chunk.tokens || this.estimateTokens(chunk.text);

      if (bufferTokens + tokens < minTokens) {
        // Accumulate small chunks
        buffer += (buffer ? '\n\n' : '') + chunk.text;
        bufferTokens += tokens;
      } else {
        // Flush buffer and add current chunk
        if (buffer) {
          merged.push({
            text: buffer,
            tokens: bufferTokens,
            merged: true
          });
        }

        buffer = chunk.text;
        bufferTokens = tokens;
      }
    }

    // Add remaining buffer
    if (buffer) {
      merged.push({
        text: buffer,
        tokens: bufferTokens,
        merged: true
      });
    }

    logger.info('Chunks merged', {
      originalCount: chunks.length,
      mergedCount: merged.length,
      reduction: ((1 - merged.length / chunks.length) * 100).toFixed(1) + '%'
    });

    return merged;
  }
}

/**
 * Chunk metadata for citation and tracking
 */
export class ChunkMetadata {
  constructor(chunk, source, index) {
    this.chunk = chunk;
    this.source = source;
    this.index = index;
    this.embeddings = null;
    this.citations = [];
    this.createdAt = new Date().toISOString();
  }

  /**
   * Add citation information
   */
  addCitation(reference) {
    this.citations.push({
      reference,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get chunk with metadata
   */
  getWithMetadata() {
    return {
      content: this.chunk.text || this.chunk,
      source: this.source,
      chunkIndex: this.index,
      tokenCount: this.chunk.tokens,
      citations: this.citations,
      createdAt: this.createdAt
    };
  }
}

// Export singleton chunker
export const adaptiveChunker = new AdaptiveChunker();

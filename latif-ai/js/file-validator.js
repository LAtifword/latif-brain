/* ════════════════════════════════════════════════════════════════
   LATIF AI — File Validation & Size Limits
   ════════════════════════════════════════════════════════════════
   Validates files before processing with user-friendly warnings
   about truncation and size limits.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class FileValidator {
  constructor() {
    // Maximum characters to keep from any file
    this.maxChars = 20000;
    // Image size limit (bytes)
    this.maxImageSize = 50 * 1024 * 1024; // 50 MB
    // Audio size limit (bytes)
    this.maxAudioSize = 200 * 1024 * 1024; // 200 MB
    // Text file size limit (bytes)
    this.maxTextFileSize = 10 * 1024 * 1024; // 10 MB (will be truncated to maxChars)
  }

  /**
   * Validate a file before processing.
   * Returns {valid: boolean, warning: string|null, willTruncate: boolean}
   * @param {File} file
   * @returns {Object}
   */
  validateFile(file) {
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    if (file.type.startsWith("image/")) {
      if (file.size > this.maxImageSize) {
        return {
          valid: false,
          warning: `Image too large: ${sizeMB} MB (max ${this.maxImageSize / (1024 * 1024)} MB)`,
          willTruncate: false,
        };
      }
      return { valid: true, warning: null, willTruncate: false };
    }

    if (file.type.startsWith("audio/")) {
      if (file.size > this.maxAudioSize) {
        return {
          valid: false,
          warning: `Audio file too large: ${sizeMB} MB (max ${this.maxAudioSize / (1024 * 1024)} MB)`,
          willTruncate: false,
        };
      }
      return { valid: true, warning: null, willTruncate: false };
    }

    // Text files get truncated to maxChars (they may be > maxTextFileSize)
    // Warn if they're being truncated
    if (file.type.startsWith("text/") || file.name.match(/\.(txt|md|csv|json)$/i)) {
      if (file.size > this.maxTextFileSize) {
        return {
          valid: true,
          warning: `Large text file (${sizeMB} MB) will be truncated to ${this.maxChars} characters for processing.`,
          willTruncate: true,
        };
      }
      // File is small but might still be truncated after reading
      // (reading could add overhead), check after reading instead
      return { valid: true, warning: null, willTruncate: false };
    }

    return { valid: true, warning: null, willTruncate: false };
  }

  /**
   * Check if content will be truncated and return warning if so.
   * @param {string} content
   * @param {string} fileName
   * @returns {string|null} Warning message if truncated, null otherwise
   */
  checkTruncation(content, fileName) {
    if (content.length > this.maxChars) {
      const truncatedKB = (content.length / 1024).toFixed(1);
      const keptKB = (this.maxChars / 1024).toFixed(1);
      return `File truncated: ${truncatedKB} KB → ${keptKB} KB. Only the first ${this.maxChars} characters will be used for context.`;
    }
    return null;
  }

  /**
   * Truncate content to max chars and report if truncated.
   * @param {string} content
   * @param {string} fileName
   * @returns {Object} {content, wasTruncated, warning}
   */
  processContent(content, fileName) {
    const wasTruncated = content.length > this.maxChars;
    const warning = this.checkTruncation(content, fileName);

    return {
      content: content.slice(0, this.maxChars),
      wasTruncated,
      warning,
    };
  }
}

const GlobalFileValidator = new FileValidator();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { FileValidator, GlobalFileValidator };
}

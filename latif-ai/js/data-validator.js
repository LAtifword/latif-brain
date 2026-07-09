/* ════════════════════════════════════════════════════════════════
   LATIF AI — Data Validation Layer
   ════════════════════════════════════════════════════════════════
   Validates data schemas and enforces constraints.
   Prevents invalid data from entering the database.

   LATIF v5.0.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class DataValidator {
  constructor() {
    this.schemas = this._defineSchemas();
  }

  /**
   * Define all data schemas with validation rules.
   * @private
   */
  _defineSchemas() {
    return {
      chat: {
        id: { type: "string", required: true, minLength: 1 },
        title: { type: "string", required: true, minLength: 1, maxLength: 200 },
        messages: { type: "array", required: true, items: { type: "object" } },
        pinned: { type: "boolean", default: false },
        model: { type: "string", default: null },
        rag: { type: "array", default: [] },
        createdAt: { type: "number", required: true },
        updatedAt: { type: "number", default: null },
      },
      message: {
        id: { type: "string", required: true },
        chatId: { type: "string", required: true },
        role: { type: "string", enum: ["user", "assistant", "system"], required: true },
        content: { type: "string", required: true, maxLength: 100000 },
        images: { type: "array", default: [] },
        timestamp: { type: "number", required: true },
        tokenCount: { type: "number", default: 0 },
      },
      embedding: {
        hash: { type: "string", required: true, minLength: 40 },
        embedding: { type: "array", required: true, minLength: 1 },
        model: { type: "string", required: true },
        timestamp: { type: "number", required: true },
      },
      memory: {
        id: { type: "number", autoIncrement: true },
        text: { type: "string", required: true, minLength: 1, maxLength: 1000 },
        timestamp: { type: "number", required: true },
        category: { type: "string", default: "general" },
      },
      setting: {
        key: { type: "string", required: true, pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$" },
        value: { required: true },
        timestamp: { type: "number", required: true },
      },
    };
  }

  /**
   * Validate an object against a schema.
   * @param {Object} obj - Object to validate
   * @param {string} schemaName - Name of schema (chat, message, etc.)
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(obj, schemaName) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
    }

    const errors = [];

    for (const [key, rule] of Object.entries(schema)) {
      const value = obj[key];

      // Check required
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        if (rule.default !== undefined) {
          obj[key] = rule.default;
        }
        continue;
      }

      // Check type
      if (rule.type && typeof value !== rule.type) {
        if (rule.type === "array" && !Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        if (rule.type !== "array" && typeof value !== rule.type) {
          errors.push(`${key} must be ${rule.type}, got ${typeof value}`);
          continue;
        }
      }

      // Check string constraints
      if (rule.type === "string") {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${key} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${key} cannot exceed ${rule.maxLength} characters`);
        }
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`${key} must match pattern ${rule.pattern}`);
        }
      }

      // Check enum
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${key} must be one of: ${rule.enum.join(", ")}`);
      }

      // Check array constraints
      if (rule.type === "array") {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${key} must have at least ${rule.minLength} items`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${key} cannot have more than ${rule.maxLength} items`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validated: errors.length === 0 ? obj : null,
    };
  }

  /**
   * Validate and sanitize a chat object.
   * @param {Object} chat
   * @returns {Object} {valid, errors, sanitized}
   */
  validateChat(chat) {
    const result = this.validate(chat, "chat");
    if (result.valid) {
      // Sanitize title
      result.sanitized.title = this._sanitizeString(result.sanitized.title);
    }
    return result;
  }

  /**
   * Validate and sanitize a message.
   * @param {Object} message
   * @returns {Object} {valid, errors, sanitized}
   */
  validateMessage(message) {
    const result = this.validate(message, "message");
    if (result.valid) {
      // Sanitize content (but preserve markdown)
      result.sanitized.content = this._sanitizeString(result.sanitized.content, true);
    }
    return result;
  }

  /**
   * Sanitize string input (prevent XSS).
   * @param {string} str
   * @param {boolean} preserveMarkdown - Allow markdown syntax
   * @returns {string}
   */
  _sanitizeString(str, preserveMarkdown = false) {
    if (!str) return str;

    // Remove control characters
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // HTML encode dangerous characters (but preserve markdown)
    if (!preserveMarkdown) {
      str = str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    } else {
      // Only encode < and > that aren't part of markdown syntax
      str = str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    return str;
  }

  /**
   * Estimate token count for a string (rough approximation).
   * @param {string} text
   * @returns {number}
   */
  estimateTokens(text) {
    // Rough approximation: ~4 characters per token (typical LLM tokenization)
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if message would exceed context window.
   * @param {number} tokens
   * @param {number} contextSize - Max context size (default 4096)
   * @returns {boolean}
   */
  fitsInContext(tokens, contextSize = 4096) {
    return tokens < contextSize * 0.9; // Leave 10% buffer
  }
}

const GlobalDataValidator = new DataValidator();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DataValidator, GlobalDataValidator };
}

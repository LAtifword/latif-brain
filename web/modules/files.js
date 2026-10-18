/**
 * Files Module
 * File handling and uploads
 */

import { api } from '../utils/api.js';
import { formatFileSize } from '../utils/formatting.js';

export class FileManager {
  constructor() {
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = [
      'text/plain', 'text/markdown', 'text/csv',
      'application/pdf', 'application/json',
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mpeg', 'audio/wav',
      'video/mp4', 'video/webm'
    ];
    this.uploadProgress = new Map();
  }

  validateFile(file) {
    const errors = [];

    if (file.size > this.maxFileSize) {
      errors.push(`File exceeds max size (${formatFileSize(this.maxFileSize)})`);
    }

    if (!this.allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed: ${file.type}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async uploadFile(file, chatId, onProgress) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      // Track upload progress
      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            this.uploadProgress.set(file.name, percent);
            onProgress({ loaded: e.loaded, total: e.total, percent });
          }
        });
      }

      const response = await api.uploadFile(file, { chatId });
      this.uploadProgress.delete(file.name);

      return {
        success: true,
        file: response.file || response
      };
    } catch (error) {
      this.uploadProgress.delete(file.name);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async uploadFiles(files, chatId, onProgress) {
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await this.uploadFile(file, chatId, (progress) => {
        if (onProgress) {
          onProgress({
            fileName: file.name,
            fileIndex: i,
            totalFiles: files.length,
            ...progress
          });
        }
      });

      results.push({
        fileName: file.name,
        ...result
      });
    }

    return results;
  }

  getUploadProgress(fileName) {
    return this.uploadProgress.get(fileName) || 0;
  }

  getFileType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('text') || file.type.includes('markdown')) return 'text';
    return 'document';
  }

  async readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
}

export class FilePreview {
  static renderImage(src) {
    return `<img src="${src}" class="file-preview-image" alt="image" />`;
  }

  static renderVideo(src) {
    return `
      <video class="file-preview-video" controls>
        <source src="${src}" />
        Your browser doesn't support video playback.
      </video>
    `;
  }

  static renderAudio(src) {
    return `
      <audio class="file-preview-audio" controls>
        <source src="${src}" />
        Your browser doesn't support audio playback.
      </audio>
    `;
  }

  static renderText(content) {
    return `<pre class="file-preview-text"><code>${escapeHtml(content)}</code></pre>`;
  }

  static renderPDF(src) {
    return `<embed src="${src}" type="application/pdf" class="file-preview-pdf" />`;
  }

  static async create(file) {
    const fileType = new FileManager().getFileType(file);
    let preview = '';

    switch (fileType) {
      case 'image':
        const imageUrl = await new FileManager().readAsDataURL(file);
        preview = this.renderImage(imageUrl);
        break;
      case 'audio':
        const audioUrl = await new FileManager().readAsDataURL(file);
        preview = this.renderAudio(audioUrl);
        break;
      case 'video':
        const videoUrl = await new FileManager().readAsDataURL(file);
        preview = this.renderVideo(videoUrl);
        break;
      case 'text':
        const textContent = await new FileManager().readAsText(file);
        preview = this.renderText(textContent.substring(0, 500));
        break;
      default:
        preview = `<div class="file-preview-default">${file.name}</div>`;
    }

    return preview;
  }
}

export const fileManager = new FileManager();

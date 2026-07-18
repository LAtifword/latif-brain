/**
 * Chat Area Component
 * Displays messages with markdown rendering
 */

import { renderMarkdown } from '../modules/markdown.js';
import { escapeHtml, truncateText, formatTimestamp } from '../utils/formatting.js';
import { State, onStateChange } from '../utils/state.js';
import { api } from '../utils/api.js';

export class ChatArea {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.chatId = null;
    this.isLoading = false;
  }

  async loadChat(chatId) {
    this.chatId = chatId;
    this.isLoading = true;

    try {
      const response = await api.getMessages(chatId, 0, 50);
      this.messages = response.messages || [];
      this.render();
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Failed to load chat');
    } finally {
      this.isLoading = false;
    }
  }

  addMessage(message) {
    this.messages.push(message);
    this.renderAppend(message);
    this.scrollToBottom();
  }

  render() {
    if (this.messages.length === 0) {
      this.container.innerHTML = '<div class="empty-state">Start a conversation...</div>';
      return;
    }

    const html = this.messages
      .map(msg => this.renderMessage(msg))
      .join('');

    this.container.innerHTML = html;
    this.bindEventListeners();
    this.scrollToBottom();
  }

  renderMessage(msg) {
    const content = msg.role === 'assistant'
      ? renderMarkdown(msg.content)
      : `<div class="user-text">${escapeHtml(msg.content)}</div>`;

    const timestamp = formatTimestamp(msg.timestamp);
    const model = msg.model ? `<span class="model-tag">${escapeHtml(msg.model)}</span>` : '';

    return `
      <div class="message message-${msg.role}" data-message-id="${msg.id}">
        <div class="message-header">
          <span class="role">${msg.role === 'user' ? 'You' : 'Assistant'}</span>
          ${model}
          <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">
          ${content}
        </div>
      </div>
    `;
  }

  renderAppend(msg) {
    const html = this.renderMessage(msg);
    const div = document.createElement('div');
    div.innerHTML = html;
    this.container.appendChild(div.firstElementChild);
    this.bindMessageEventListeners(div.firstElementChild);
  }

  bindEventListeners() {
    this.container.querySelectorAll('.message').forEach(el => {
      this.bindMessageEventListeners(el);
    });
  }

  bindMessageEventListeners(messageEl) {
    const msgId = messageEl.getAttribute('data-message-id');
    if (!msgId) return;

    // Copy message text on double-click
    messageEl.addEventListener('dblclick', () => {
      const content = messageEl.querySelector('.message-content').textContent;
      navigator.clipboard.writeText(content).catch(console.error);
    });
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    this.container.appendChild(errorDiv);
    this.scrollToBottom();
  }

  clear() {
    this.messages = [];
    this.container.innerHTML = '';
  }

  export() {
    return {
      messages: this.messages,
      format: 'markdown'
    };
  }
}

/**
 * Input Bar Component
 * Handles user input and message sending
 */

import { State, updateState } from '../utils/state.js';
import { api } from '../utils/api.js';

export class InputBar {
  constructor(container) {
    this.container = container;
    this.textarea = container.querySelector('textarea');
    this.sendBtn = container.querySelector('.send-btn');
    this.attachBtn = container.querySelector('.attach-btn');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.textarea) {
      this.textarea.addEventListener('input', () => this.autoExpand());
      this.textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.send();
        }
      });
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.send());
    }

    if (this.attachBtn) {
      this.attachBtn.addEventListener('click', () => this.handleAttach());
    }
  }

  async send() {
    const content = this.textarea.value.trim();
    if (!content || State.isGenerating) return;

    const chatId = State.activeChat;
    if (!chatId) {
      this.showError('No active chat');
      return;
    }

    try {
      this.disable();

      // Add user message to UI
      const userMessage = {
        id: `msg_${Date.now()}`,
        chatId: chatId,
        role: 'user',
        content: content,
        timestamp: Date.now()
      };

      this.textarea.value = '';
      this.autoExpand();
      updateState({ isGenerating: true });

      // Dispatch event for ChatArea to add message
      window.dispatchEvent(new CustomEvent('message-added', {
        detail: userMessage
      }));

      // Send to backend
      const response = await api.sendMessage(chatId, content, {
        model: State.model,
        temperature: State.temperature,
        maxTokens: State.maxTokens,
        stream: State.streamResponses
      });

      // Add assistant response
      const assistantMessage = {
        id: `msg_${Date.now()}_response`,
        chatId: chatId,
        role: 'assistant',
        content: response.content || response.message || '',
        model: response.model || State.model,
        timestamp: Date.now(),
        tokens: response.tokens
      };

      window.dispatchEvent(new CustomEvent('message-added', {
        detail: assistantMessage
      }));

    } catch (error) {
      console.error('Send failed:', error);
      this.showError(error.message || 'Failed to send message');
    } finally {
      this.enable();
      updateState({ isGenerating: false });
    }
  }

  async *streamSend() {
    const content = this.textarea.value.trim();
    if (!content || State.isGenerating) return;

    const chatId = State.activeChat;
    if (!chatId) {
      this.showError('No active chat');
      return;
    }

    try {
      this.disable();
      updateState({ isGenerating: true });

      // Add user message
      const userMessage = {
        id: `msg_${Date.now()}`,
        chatId: chatId,
        role: 'user',
        content: content,
        timestamp: Date.now()
      };

      this.textarea.value = '';
      this.autoExpand();

      window.dispatchEvent(new CustomEvent('message-added', {
        detail: userMessage
      }));

      // Stream response
      const assistantMessage = {
        id: `msg_${Date.now()}_response`,
        chatId: chatId,
        role: 'assistant',
        content: '',
        model: State.model,
        timestamp: Date.now()
      };

      window.dispatchEvent(new CustomEvent('message-added', {
        detail: assistantMessage
      }));

      for await (const chunk of api.streamMessage(chatId, content, {
        model: State.model,
        temperature: State.temperature,
        maxTokens: State.maxTokens
      })) {
        assistantMessage.content += chunk.content || '';
        window.dispatchEvent(new CustomEvent('message-updated', {
          detail: assistantMessage
        }));
        yield chunk;
      }

    } catch (error) {
      console.error('Stream failed:', error);
      this.showError(error.message || 'Failed to stream message');
    } finally {
      this.enable();
      updateState({ isGenerating: false });
    }
  }

  autoExpand() {
    if (!this.textarea) return;
    this.textarea.style.height = 'auto';
    const newHeight = Math.min(this.textarea.scrollHeight, 200);
    this.textarea.style.height = newHeight + 'px';
  }

  handleAttach() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => this.processFiles(e.target.files);
    input.click();
  }

  async processFiles(files) {
    for (const file of files) {
      try {
        await api.uploadFile(file, {
          chatId: State.activeChat
        });
      } catch (error) {
        this.showError(`Failed to upload ${file.name}`);
      }
    }
  }

  showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  disable() {
    if (this.textarea) this.textarea.disabled = true;
    if (this.sendBtn) this.sendBtn.disabled = true;
    if (this.attachBtn) this.attachBtn.disabled = true;
  }

  enable() {
    if (this.textarea) this.textarea.disabled = false;
    if (this.sendBtn) this.sendBtn.disabled = false;
    if (this.attachBtn) this.attachBtn.disabled = false;
  }

  focus() {
    if (this.textarea) this.textarea.focus();
  }

  clear() {
    if (this.textarea) this.textarea.value = '';
    this.autoExpand();
  }
}

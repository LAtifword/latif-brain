/**
 * Sidebar Component
 * Chat history and navigation
 */

import { State, updateState } from '../utils/state.js';
import { storage } from '../utils/storage.js';
import { api } from '../utils/api.js';
import { truncateText, formatTimestamp } from '../utils/formatting.js';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.chatsList = container.querySelector('.chats-list');
    this.searchInput = container.querySelector('.search-input');
    this.newChatBtn = container.querySelector('.new-chat-btn');
    this.allChats = [];
    this.filteredChats = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.newChatBtn) {
      this.newChatBtn.addEventListener('click', () => this.createNewChat());
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.filterChats(e.target.value));
    }
  }

  async loadChats() {
    try {
      const response = await api.getChats(50, 0);
      this.allChats = response.chats || [];
      this.filteredChats = [...this.allChats];
      this.render();
    } catch (error) {
      console.error('Failed to load chats:', error);
      this.showError('Failed to load chats');
    }
  }

  render() {
    if (this.filteredChats.length === 0) {
      this.chatsList.innerHTML = '<div class="empty-state">No chats</div>';
      return;
    }

    const html = this.filteredChats
      .map(chat => this.renderChat(chat))
      .join('');

    this.chatsList.innerHTML = html;
    this.bindEventListeners();
  }

  renderChat(chat) {
    const isActive = State.activeChat === chat.id;
    const preview = truncateText(chat.preview || chat.title || 'Untitled', 50);
    const timestamp = formatTimestamp(chat.timestamp);

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
        <div class="chat-content">
          <div class="chat-title">${chat.title || 'Untitled'}</div>
          <div class="chat-preview">${preview}</div>
        </div>
        <div class="chat-meta">
          <span class="timestamp">${timestamp}</span>
          <button class="delete-btn" data-chat-id="${chat.id}" title="Delete chat">✕</button>
        </div>
      </div>
    `;
  }

  bindEventListeners() {
    this.chatsList.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-btn')) {
          const chatId = item.getAttribute('data-chat-id');
          this.selectChat(chatId);
        }
      });
    });

    this.chatsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = btn.getAttribute('data-chat-id');
        this.deleteChat(chatId);
      });
    });
  }

  async selectChat(chatId) {
    updateState({ activeChat: chatId });

    // Highlight active chat
    this.chatsList.querySelectorAll('.chat-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-chat-id') === chatId);
    });

    // Dispatch event for main app to load chat
    window.dispatchEvent(new CustomEvent('chat-selected', {
      detail: { chatId }
    }));
  }

  async createNewChat() {
    try {
      const response = await api.createChat(`Chat ${new Date().toLocaleDateString()}`);
      const newChat = response.chat || response;

      this.allChats.unshift(newChat);
      this.filteredChats = [...this.allChats];
      this.render();
      this.selectChat(newChat.id);
    } catch (error) {
      console.error('Failed to create chat:', error);
      this.showError('Failed to create chat');
    }
  }

  async deleteChat(chatId) {
    if (!confirm('Delete this chat?')) return;

    try {
      await api.deleteChat(chatId);
      this.allChats = this.allChats.filter(c => c.id !== chatId);
      this.filteredChats = this.filteredChats.filter(c => c.id !== chatId);

      if (State.activeChat === chatId) {
        if (this.allChats.length > 0) {
          this.selectChat(this.allChats[0].id);
        } else {
          updateState({ activeChat: null });
        }
      }

      this.render();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      this.showError('Failed to delete chat');
    }
  }

  filterChats(query) {
    if (!query.trim()) {
      this.filteredChats = [...this.allChats];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredChats = this.allChats.filter(chat =>
        (chat.title || '').toLowerCase().includes(lowerQuery) ||
        (chat.preview || '').toLowerCase().includes(lowerQuery)
      );
    }

    this.render();
  }

  addChat(chat) {
    this.allChats.unshift(chat);
    this.filteredChats.unshift(chat);
    this.render();
  }

  updateChat(chatId, updates) {
    const chat = this.allChats.find(c => c.id === chatId);
    if (chat) {
      Object.assign(chat, updates);
      this.render();
    }
  }

  showError(message) {
    console.error(message);
  }

  clear() {
    this.allChats = [];
    this.filteredChats = [];
    this.chatsList.innerHTML = '';
  }
}

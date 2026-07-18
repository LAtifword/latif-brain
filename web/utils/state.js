/**
 * LATIF State Management
 * Centralized application state
 * Dispatch state-change event when state updates
 */

export const State = {
  // Active chat
  activeChat: null,
  messages: [],
  chats: [],
  chatLoading: false,

  // Models
  model: 'qwen2.5:1.5b',
  models: [],
  temperature: 0.7,
  maxTokens: 2048,

  // UI state
  theme: 'dark',
  sidebarOpen: true,
  settingsOpen: false,
  isGenerating: false,
  error: null,
  status: 'idle', // idle | loading | generating | error | offline

  // Connection
  isConnected: false,
  serverUrl: 'http://localhost:3000',

  // Settings
  language: 'en',
  offlineMode: false,
  autoSave: true,
  streamResponses: true,

  // Pagination
  messagesOffset: 0,
  hasMoreMessages: true
};

/**
 * Update state and emit change event
 */
export function updateState(updates) {
  Object.assign(State, updates);
  emitStateChange(updates);
}

/**
 * Listen for state changes
 */
export function onStateChange(callback) {
  window.addEventListener('latif-state-change', (event) => {
    callback(event.detail);
  });
}

/**
 * Emit state change event
 */
function emitStateChange(updates) {
  const event = new CustomEvent('latif-state-change', {
    detail: updates
  });
  window.dispatchEvent(event);
}

/**
 * Reset state to defaults
 */
export function resetState() {
  Object.assign(State, {
    activeChat: null,
    messages: [],
    chats: [],
    chatLoading: false,
    isGenerating: false,
    error: null,
    status: 'idle',
    messagesOffset: 0,
    hasMoreMessages: true
  });
  emitStateChange({ reset: true });
}

/**
 * Load state from localStorage
 */
export function loadState() {
  try {
    const saved = localStorage.getItem('latif_state');
    if (saved) {
      const state = JSON.parse(saved);
      // Only restore UI preferences, not runtime state
      Object.assign(State, {
        theme: state.theme || State.theme,
        model: state.model || State.model,
        temperature: state.temperature || State.temperature,
        language: state.language || State.language,
        offlineMode: state.offlineMode || State.offlineMode,
        sidebarOpen: state.sidebarOpen !== false
      });
    }
  } catch (error) {
    console.warn('Failed to load state:', error);
  }
}

/**
 * Save state to localStorage
 */
export function saveState() {
  try {
    const toSave = {
      theme: State.theme,
      model: State.model,
      temperature: State.temperature,
      language: State.language,
      offlineMode: State.offlineMode,
      sidebarOpen: State.sidebarOpen
    };
    localStorage.setItem('latif_state', JSON.stringify(toSave));
  } catch (error) {
    console.warn('Failed to save state:', error);
  }
}

import { useContext } from 'react';
import { LatifContext } from './context.js';

export function useLatifChat() {
  useContext(LatifContext);
  // Implementation
  return { messages: [], sendMessage: () => {} };
}

export function useLatifModels() {
  useContext(LatifContext);
  // Implementation
  return { models: [], loading: false };
}

export function useLatifAgent() {
  useContext(LatifContext);
  // Implementation
  return { agents: [], running: false };
}

/**
 * event-bus.js — Central event bus for LATIF v5
 * Provides publish-subscribe pattern for inter-component communication
 */

class EventBusImpl {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    const callbacks = this.listeners.get(eventName);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emitEvent(eventName, data) {
    if (!this.listeners.has(eventName)) return;
    const callbacks = this.listeners.get(eventName);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Event handler error for ${eventName}:`, error);
      }
    });
  }

  once(eventName, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(eventName, wrapper);
    };
    this.on(eventName, wrapper);
  }

  clear() {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusImpl();

export default EventBus;

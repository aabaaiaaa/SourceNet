/**
 * Trigger Event Bus - Core event system for story missions and game systems
 *
 * Provides a decoupled pub/sub event system that allows:
 * - Core game to emit events without knowing about story missions
 * - Story missions to subscribe to game events without coupling to core
 * - Game systems (Banking, Reputation) to communicate via events
 *
 * Usage:
 *   triggerEventBus.emit('missionAccepted', { missionId: 'tutorial-1' });
 *   triggerEventBus.on('missionAccepted', (data) => console.log(data));
 */

class TriggerEventBus {
  constructor() {
    this.events = {};
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Event name (e.g., 'missionAccepted')
   * @param {function} callback - Function to call when event fires
   * @returns {function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this.events[eventType]) {
      this.events[eventType] = [];
    }

    this.events[eventType].push(callback);

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventType - Event name
   * @param {function} callback - Callback to remove
   */
  off(eventType, callback) {
    if (!this.events[eventType]) return;

    this.events[eventType] = this.events[eventType].filter(
      (cb) => cb !== callback
    );

    // Clean up empty event arrays
    if (this.events[eventType].length === 0) {
      delete this.events[eventType];
    }
  }

  /**
   * Emit an event
   * @param {string} eventType - Event name
   * @param {object} eventData - Event payload
   */
  emit(eventType, eventData = {}) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
    };

    // Add to history for debugging
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Debug logging for mission events
    if (eventType === 'missionAvailable') {
      console.log(`📡 EVENT BUS: Emitting ${eventType}, listeners count: ${this.events[eventType]?.length || 0}`);
    }

    // Call all subscribed callbacks
    if (this.events[eventType]) {
      this.events[eventType].forEach((callback, index) => {
        try {
          if (eventType === 'missionAvailable') {
            console.log(`📡 EVENT BUS: Calling listener ${index + 1} of ${this.events[eventType].length}`);
          }
          callback(event.data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    } else if (eventType === 'missionAvailable') {
      console.warn(`⚠️ EVENT BUS: No listeners for ${eventType}!`);
    }
  }

  /**
   * Subscribe to event once (auto-unsubscribe after first fire)
   * @param {string} eventType - Event name
   * @param {function} callback - Function to call once
   */
  once(eventType, callback) {
    const onceWrapper = (data) => {
      callback(data);
      this.off(eventType, onceWrapper);
    };

    return this.on(eventType, onceWrapper);
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear() {
    this.events = {};
    this.eventHistory = [];
  }

  /**
   * Get event history (for debugging)
   * @param {number} limit - Max number of events to return
   * @returns {array} Recent events
   */
  getHistory(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get all active subscriptions (for debugging)
   * @returns {object} Event types and subscriber counts
   */
  getSubscriptions() {
    const subscriptions = {};
    Object.keys(this.events).forEach((eventType) => {
      subscriptions[eventType] = this.events[eventType].length;
    });
    return subscriptions;
  }
}

// Singleton instance
const triggerEventBus = new TriggerEventBus();

// Expose for e2e testing
if (typeof window !== 'undefined') {
  window.triggerEventBus = triggerEventBus;
}

export default triggerEventBus;

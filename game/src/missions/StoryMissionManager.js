/**
 * Story Mission Manager - Orchestrates story missions from JSON definitions
 *
 * Responsibilities:
 * - Load mission definitions from JSON files
 * - Subscribe to trigger events
 * - Activate missions when triggers fire
 * - Manage mission state lifecycle
 * - Execute scripted events (sabotage, forced disconnects)
 *
 * Story missions are data-driven (JSON) and separate from core game code.
 */

import triggerEventBus from '../core/triggerEventBus';

class StoryMissionManager {
  constructor() {
    this.missions = new Map(); // missionId -> mission definition
    this.unsubscribers = new Map(); // missionId -> array of unsubscribe functions
  }

  /**
   * Register a story mission from JSON definition
   * @param {object} missionDef - Mission definition object
   */
  registerMission(missionDef) {
    this.missions.set(missionDef.missionId, missionDef);

    // Subscribe to trigger events for this mission
    if (missionDef.triggers && missionDef.triggers.start) {
      this.subscribeMissionTrigger(missionDef);
    }

    // Subscribe to scripted event triggers
    if (missionDef.scriptedEvents) {
      this.subscribeScriptedEventTriggers(missionDef);
    }
  }

  /**
   * Subscribe to mission start trigger
   * @param {object} missionDef - Mission definition
   */
  subscribeMissionTrigger(missionDef) {
    const { type, event, delay } = missionDef.triggers.start;

    if (type === 'timeSinceEvent') {
      const unsubscribe = triggerEventBus.on(event, () => {
        setTimeout(() => {
          this.activateMission(missionDef.missionId);
        }, delay || 0);
      });

      this.addUnsubscriber(missionDef.missionId, unsubscribe);
    }
  }

  /**
   * Subscribe to scripted event triggers
   * @param {object} missionDef - Mission definition
   */
  subscribeScriptedEventTriggers(missionDef) {
    missionDef.scriptedEvents.forEach((scriptedEvent) => {
      const { type, objectiveId, delay } = scriptedEvent.trigger;

      if (type === 'afterObjectiveComplete') {
        const unsubscribe = triggerEventBus.on('objectiveComplete', (data) => {
          if (data.objectiveId === objectiveId && data.missionId === missionDef.missionId) {
            setTimeout(() => {
              this.executeScriptedEvent(missionDef.missionId, scriptedEvent);
            }, delay || 0);
          }
        });

        this.addUnsubscriber(missionDef.missionId, unsubscribe);
      }
    });
  }

  /**
   * Add unsubscribe function for cleanup
   * @param {string} missionId - Mission ID
   * @param {function} unsubscriber - Unsubscribe function
   */
  addUnsubscriber(missionId, unsubscriber) {
    if (!this.unsubscribers.has(missionId)) {
      this.unsubscribers.set(missionId, []);
    }
    this.unsubscribers.get(missionId).push(unsubscriber);
  }

  /**
   * Activate mission (make it available on Mission Board)
   * Called by trigger system
   * @param {string} missionId - Mission to activate
   */
  activateMission(missionId) {
    const mission = this.missions.get(missionId);
    if (!mission) {
      console.error(`Mission not found: ${missionId}`);
      return;
    }

    // Emit event that mission is now available
    triggerEventBus.emit('missionAvailable', {
      missionId: mission.missionId,
      mission,
    });
  }

  /**
   * Execute scripted event (sabotage, forced disconnect, etc.)
   * @param {string} missionId - Mission ID
   * @param {object} scriptedEvent - Scripted event definition
   */
  executeScriptedEvent(missionId, scriptedEvent) {
    // Emit event for scripted event execution
    triggerEventBus.emit('scriptedEventStart', {
      missionId,
      eventId: scriptedEvent.id,
      actions: scriptedEvent.actions,
    });

    // The ScriptedEventExecutor will handle the actual execution
    // This manager just triggers it
  }

  /**
   * Get mission definition
   * @param {string} missionId - Mission ID
   * @returns {object|null} Mission definition
   */
  getMission(missionId) {
    return this.missions.get(missionId) || null;
  }

  /**
   * Unregister mission and clean up subscriptions
   * @param {string} missionId - Mission to unregister
   */
  unregisterMission(missionId) {
    // Unsubscribe from all events
    const unsubscribers = this.unsubscribers.get(missionId) || [];
    unsubscribers.forEach((unsub) => unsub());

    this.missions.delete(missionId);
    this.unsubscribers.delete(missionId);
  }

  /**
   * Clear all missions and subscriptions (for testing)
   */
  clear() {
    // Unsubscribe from all events
    this.unsubscribers.forEach((unsubscribers) => {
      unsubscribers.forEach((unsub) => unsub());
    });

    this.missions.clear();
    this.unsubscribers.clear();
  }

  /**
   * Get all registered missions
   * @returns {array} Array of mission definitions
   */
  getAllMissions() {
    return Array.from(this.missions.values());
  }
}

// Singleton instance
const storyMissionManager = new StoryMissionManager();

export default storyMissionManager;

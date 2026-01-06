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
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../core/gameTimeScheduler';

class StoryMissionManager {
  constructor() {
    this.missions = new Map(); // missionId -> mission definition
    this.unsubscribers = new Map(); // missionId -> array of unsubscribe functions
    this.timeSpeed = 1; // Current time speed multiplier (1x or 10x)
  }

  /**
   * Update the current time speed
   * @param {number} speed - Time speed multiplier (1 or 10)
   */
  setTimeSpeed(speed) {
    this.timeSpeed = speed;
  }

  /**
   * Initialize all missions (call this once on app start)
   * @param {array} missions - Array of mission definitions to register
   */
  initializeAllMissions(missions) {
    // Check if already initialized by checking missions Map
    if (this.missions.size > 0) {
      console.log('⚠️ Missions already initialized, skipping');
      return;
    }

    console.log('✅ Initializing story mission system...');
    missions.forEach((mission) => this.registerMission(mission));
    console.log(`✅ Loaded ${missions.length} missions/events`);
  }

  /**
   * Register a story mission from JSON definition
   * @param {object} missionDef - Mission definition object
   */
  registerMission(missionDef) {
    this.missions.set(missionDef.missionId, missionDef);

    // Handle story events (have events[] array)
    if (missionDef.events && Array.isArray(missionDef.events)) {
      missionDef.events.forEach((event) => {
        if (event.trigger) {
          this.subscribeStoryEventTrigger(missionDef, event);
        }
      });
    }

    // Handle missions (have triggers.start)
    if (missionDef.triggers && missionDef.triggers.start) {
      this.subscribeMissionTrigger(missionDef);
    }

    // Subscribe to scripted event triggers
    if (missionDef.scriptedEvents) {
      this.subscribeScriptedEventTriggers(missionDef);
    }
  }

  /**
   * Subscribe to story event trigger (for events with messages)
   * @param {object} storyEventDef - Story event definition
   * @param {object} event - Individual event within the story event
   */
  subscribeStoryEventTrigger(storyEventDef, event) {
    const { type, event: eventName, delay, condition } = event.trigger;

    if (type === 'timeSinceEvent') {
      console.log(`📡 Subscribing to story event: ${eventName} for ${event.id}`);
      const unsubscribe = triggerEventBus.on(eventName, (data) => {
        console.log(`📥 Story event received: ${eventName}`, data);
        // Check condition if specified
        if (condition) {
          console.log(`🔍 Checking condition:`, condition, 'against data:', data);
          const conditionMet = Object.keys(condition).every(
            (key) => data[key] === condition[key]
          );
          if (!conditionMet) {
            console.log(`❌ Condition not met`);
            return;
          }
          console.log(`✅ Condition met`);
        }

        // Use game-time-aware scheduling
        console.log(`⏰ Scheduling story event ${event.id} with delay=${delay}`);
        scheduleGameTimeCallback(() => {
          console.log(`🚀 Executing story event ${event.id}`);
          // For story events, we need to send the message
          // This would be handled by the game context
          triggerEventBus.emit('storyEventTriggered', {
            storyEventId: storyEventDef.missionId,
            eventId: event.id,
            message: event.message,
          });
        }, delay || 0, this.timeSpeed);
      });

      this.addUnsubscriber(storyEventDef.missionId, unsubscribe);
    }
  }

  /**
   * Subscribe to mission start trigger
   * @param {object} missionDef - Mission definition
   */
  subscribeMissionTrigger(missionDef) {
    const { type, event, delay, condition } = missionDef.triggers.start;

    if (type === 'timeSinceEvent') {
      const unsubscribe = triggerEventBus.on(event, (data) => {
        console.log(`🎯 Mission trigger received for ${missionDef.title}: event=${event}`, data);

        // Check condition if specified (e.g., softwareId === 'mission-board')
        if (condition) {
          const conditionMet = Object.keys(condition).every(
            (key) => data[key] === condition[key]
          );
          if (!conditionMet) {
            console.log(`❌ Condition not met for ${missionDef.title}:`, { expected: condition, actual: data });
            return;
          }
          console.log(`✅ Condition met for ${missionDef.title}`);
        }

        // Use game-time-aware scheduling
        console.log(`⏰ Scheduling mission activation for ${missionDef.title} with delay=${delay}, speed=${this.timeSpeed}`);
        const self = this; // Capture this for callback
        scheduleGameTimeCallback(() => {
          try {
            console.log(`🚀 Executing scheduled activation for ${missionDef.title}`);
            console.log(`   self=${typeof self}, self.activateMission=${typeof self?.activateMission}`);
            self.activateMission(missionDef.missionId);
          } catch (error) {
            console.error(`❌ Error in scheduled activation for ${missionDef.title}:`, error);
          }
        }, delay || 0, this.timeSpeed);
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
            // Use game-time-aware scheduling
            scheduleGameTimeCallback(() => {
              this.executeScriptedEvent(missionDef.missionId, scriptedEvent);
            }, delay || 0, this.timeSpeed);
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
      console.error(`❌ Mission not found: ${missionId}`);
      return;
    }

    console.log(`📋 Activating mission: ${mission.title} (${missionId})`);

    // Emit event that mission is now available
    console.log(`📡 Emitting missionAvailable event for ${mission.title}`);
    triggerEventBus.emit('missionAvailable', {
      missionId: mission.missionId,
      mission,
    });
    console.log(`✅ Event emitted successfully`);
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

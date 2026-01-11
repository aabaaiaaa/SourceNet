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

console.log('🚀 StoryMissionManager.js module loaded!');

import triggerEventBus from '../core/triggerEventBus';
import { scheduleGameTimeCallback, rescheduleAllTimers, clearGameTimeCallback } from '../core/gameTimeScheduler';

class StoryMissionManager {
  constructor() {
    this.missions = new Map(); // missionId -> mission definition
    this.unsubscribers = new Map(); // missionId -> array of unsubscribe functions
    this.timeSpeed = 1; // Current time speed multiplier (1x or 10x)
    this.gameStateGetter = null; // Function to get current game state
    this.firedEvents = new Set(); // Track which events have already fired to prevent duplicates
    this.consequencesSubscribed = false; // Track if we've subscribed to mission consequences
    this.pendingEvents = new Map(); // Track pending scheduled events for save/load persistence
    this.pendingEventCounter = 0; // Counter for generating unique event IDs
  }

  /**
   * Get the list of fired events (for save game)
   * @returns {string[]} Array of fired event dedup keys
   */
  getFiredEvents() {
    return Array.from(this.firedEvents);
  }

  /**
   * Set the fired events (for load game)
   * @param {string[]} events - Array of fired event dedup keys
   */
  setFiredEvents(events) {
    this.firedEvents = new Set(events || []);
    console.log(`🔧 Restored ${this.firedEvents.size} fired events`);
  }

  /**
   * Get pending events for save game
   * Returns serializable array with remaining delays
   * @returns {Array} Array of pending event data
   */
  getPendingEvents() {
    const now = Date.now();
    const events = [];

    this.pendingEvents.forEach((event, id) => {
      // Calculate remaining game time
      const elapsedRealTime = now - event.startTime;
      const elapsedGameTime = elapsedRealTime * event.timeSpeed;
      const remainingGameTime = Math.max(0, event.originalDelayMs - elapsedGameTime);

      events.push({
        id,
        type: event.type,
        payload: event.payload,
        remainingDelayMs: remainingGameTime,
      });
    });

    console.log(`📦 Getting ${events.length} pending events for save`);
    return events;
  }

  /**
   * Set pending events from loaded game state
   * Restores timers with remaining delay + 3s buffer (minimum 1s)
   * @param {Array} events - Array of pending event data from save
   */
  setPendingEvents(events) {
    if (!events || events.length === 0) {
      console.log(`📦 No pending events to restore`);
      return;
    }

    console.log(`📦 Restoring ${events.length} pending events`);

    events.forEach((event) => {
      // Add 3 second buffer, with minimum 1 second delay
      const bufferMs = 3000;
      const delayMs = Math.max(1000, event.remainingDelayMs + bufferMs);

      console.log(`  Restoring ${event.type} event (${event.id}): ${event.remainingDelayMs}ms remaining + ${bufferMs}ms buffer = ${delayMs}ms`);

      // Re-schedule based on event type
      this.restorePendingEvent(event, delayMs);
    });
  }

  /**
   * Restore a single pending event by re-scheduling it
   * @param {Object} event - Event data from save
   * @param {number} delayMs - Delay in game time ms
   */
  restorePendingEvent(event, delayMs) {
    const { type, payload } = event;

    if (type === 'storyEvent') {
      // Story event message
      this.schedulePendingEvent(type, payload, delayMs, () => {
        console.log(`🚀 Restored story event firing: ${payload.eventId}`);
        triggerEventBus.emit('storyEventTriggered', payload);
      });
    } else if (type === 'consequenceMessage') {
      // Mission consequence message
      this.schedulePendingEvent(type, payload, delayMs, () => {
        console.log(`✉️ Restored consequence message firing: ${payload.message?.subject}`);
        triggerEventBus.emit('storyEventTriggered', payload);
      });
    } else if (type === 'missionActivation') {
      // Mission activation
      this.schedulePendingEvent(type, payload, delayMs, () => {
        console.log(`🚀 Restored mission activation: ${payload.missionId}`);
        this.activateMission(payload.missionId);
      });
    } else if (type === 'introMessage') {
      // Mission intro message
      this.schedulePendingEvent(type, payload, delayMs, () => {
        console.log(`📧 Restored intro message: ${payload.missionId}`);
        triggerEventBus.emit('sendMissionIntroMessage', payload);
      });
    } else if (type === 'scriptedEvent') {
      // Scripted event execution
      this.schedulePendingEvent(type, payload, delayMs, () => {
        console.log(`🚀 Restored scripted event: ${payload.eventId}`);
        this.executeScriptedEvent(payload.missionId, payload.scriptedEvent);
      });
    }
  }

  /**
   * Schedule a pending event and track it
   * @param {string} type - Event type
   * @param {Object} payload - Event payload
   * @param {number} delayMs - Delay in game time ms
   * @param {Function} callback - Callback to execute
   * @returns {string} Event ID
   */
  schedulePendingEvent(type, payload, delayMs, callback) {
    const eventId = `${type}-${++this.pendingEventCounter}`;

    const timerId = scheduleGameTimeCallback(() => {
      // Remove from pending events when fired
      this.pendingEvents.delete(eventId);
      callback();
    }, delayMs, this.timeSpeed);

    // Track the pending event
    this.pendingEvents.set(eventId, {
      type,
      payload,
      timerId,
      startTime: Date.now(),
      originalDelayMs: delayMs,
      timeSpeed: this.timeSpeed,
    });

    return eventId;
  }

  /**
   * Clear all pending events (used when sleeping/logging out)
   */
  clearPendingEvents() {
    console.log(`🧹 Clearing ${this.pendingEvents.size} pending story events`);
    this.pendingEvents.forEach((event) => {
      clearGameTimeCallback(event.timerId);
    });
    this.pendingEvents.clear();
  }

  /**
   * Set the game state getter function
   * @param {function} getter - Function that returns current game state
   */
  setGameStateGetter(getter) {
    this.gameStateGetter = getter;
  }

  /**
   * Update the current time speed
   * @param {number} speed - Time speed multiplier (1 or 10)
   */
  setTimeSpeed(speed) {
    console.log(`⏱️ StoryMissionManager.setTimeSpeed: ${this.timeSpeed} → ${speed}`);
    this.timeSpeed = speed;

    // Reschedule all active timers with the new speed
    // This allows delays to speed up/slow down mid-execution
    rescheduleAllTimers(speed);
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

    // Subscribe to mission completion to send consequence messages
    this.subscribeMissionConsequences();
  }

  /**
   * Subscribe to mission completion to send consequence messages
   */
  subscribeMissionConsequences() {
    if (this.consequencesSubscribed) {
      console.log('📡 Already subscribed to mission consequences, skipping');
      return;
    }

    this.consequencesSubscribed = true;
    const instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`📡 Subscribing to mission completion consequences... (instance: ${instanceId})`);
    triggerEventBus.on('missionComplete', (data) => {
      console.log(`📡 [${instanceId}] CALLBACK INVOKED for missionComplete`);
      try {
        const { missionId, status } = data;
        console.log(`📡 [${instanceId}] Mission complete event received: ${missionId}, status=${status}`);
        console.log(`🔍 About to call this.getMission for ${missionId}`);
        const mission = this.getMission(missionId);
        console.log(`🔍 Mission retrieved:`, mission ? 'EXISTS' : 'NULL');

        console.log(`🔍 Mission object:`, mission ? `has ${Object.keys(mission).length} keys` : 'null');
        console.log(`🔍 Mission has consequences?`, mission && mission.consequences ? 'YES' : 'NO');
        console.log(`🔍 Checking condition: mission=${!!mission}, mission.consequences=${!!mission?.consequences}`);

        if (!mission || !mission.consequences) {
          console.log(`⚠️ No consequences found for ${missionId} (mission=${!!mission}, consequences=${!!mission?.consequences})`);
          if (mission) {
            console.log(`   Mission keys:`, Object.keys(mission).join(', '));
          }
          return;
        }

        console.log(`✅ Passed consequences check, getting status-specific consequences`);
        console.log(`🔍 Getting consequences for status: ${status}`);
        const consequences = status === 'failed' ? mission.consequences.failure : mission.consequences.success;
        console.log(`🔍 Consequences object:`, consequences ? `has ${Object.keys(consequences).length} keys` : 'null');

        if (!consequences || !consequences.messages || consequences.messages.length === 0) {
          console.log(`⚠️ No messages in consequences for ${missionId}`);
          if (consequences) {
            console.log(`   Consequences keys:`, Object.keys(consequences).join(', '));
            console.log(`   Messages:`, consequences.messages);
          }
          return;
        }

        console.log(`📨 Sending ${consequences.messages.length} ${status} consequence messages for ${missionId}`);

        // Send each consequence message with its delay
        consequences.messages.forEach((messageConfig, index) => {
          const delay = messageConfig.delay || 0;
          console.log(`   Message ${index + 1}/${consequences.messages.length}: ${messageConfig.subject}, delay=${delay}ms`);

          const payload = {
            storyEventId: missionId,
            eventId: messageConfig.id || `${missionId}-consequence-${index}`,
            message: messageConfig,
          };

          this.schedulePendingEvent('consequenceMessage', payload, delay, () => {
            console.log(`✉️ Actually sending message: ${messageConfig.subject}`);
            triggerEventBus.emit('storyEventTriggered', payload);
          });
        });
      } catch (error) {
        console.error(`❌ Error in subscribeMissionConsequences:`, error);
      }
    });
  }

  /**
   * Register a story mission from JSON definition
   * @param {object} missionDef - Mission definition object
   */
  registerMission(missionDef) {

    // Automatically add final verification objective if mission has objectives
    // This gives time for scripted events to execute and prevents instant completion
    // Always add it (even without scripted events) to maintain consistency and suspense
    if (missionDef.objectives && missionDef.objectives.length > 0) {
      const hasVerificationObjective = missionDef.objectives.some(obj => obj.id === 'obj-verify');

      if (!hasVerificationObjective) {
        // Add verification objective at the end
        missionDef.objectives.push({
          id: 'obj-verify',
          description: 'Verify mission completion',
          type: 'verification',
          autoComplete: false, // Manual completion only
        });
      }
    }

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
    if (missionDef.scriptedEvents && Array.isArray(missionDef.scriptedEvents) && missionDef.scriptedEvents.length > 0) {
      console.log(`✅ Subscribing to scripted events for ${missionDef.missionId}`);
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
          console.log(`   Has gameState?`, condition.gameState ? 'YES' : 'NO');
          console.log(`   Has gameStateGetter?`, this.gameStateGetter ? 'YES' : 'NO');

          // Check game state conditions (prefixed with 'gameState.')
          if (this.gameStateGetter && condition.gameState) {
            const gameState = this.gameStateGetter();
            console.log(`🔍 Checking gameState conditions - keys:`, Object.keys(condition.gameState).join(', '));
            console.log(`   Current gameState has messages?`, gameState && gameState.messages ? gameState.messages.length : 'NO');
            console.log(`   Current gameState has software?`, gameState && gameState.software ? gameState.software.length : 'NO');
            const gameStateConditionMet = Object.keys(condition.gameState).every((key) => {
              if (key === 'softwareInstalled') {
                const installed = gameState.software && gameState.software.includes(condition.gameState[key]);
                console.log(`   software check: ${condition.gameState[key]} installed? ${installed}`);
                return installed;
              }
              if (key === 'messageRead') {
                const message = gameState.messages && gameState.messages.find(m => m.id === condition.gameState[key]);
                const read = message && message.read;
                console.log(`   message check: ${condition.gameState[key]} read? ${read}`, message ? `(found message)` : `(message not found)`);
                return read;
              }
              return gameState[key] === condition.gameState[key];
            });
            if (!gameStateConditionMet) {
              console.log(`❌ Game state condition not met`);
              return;
            }
            console.log(`✅ Game state condition met`);
          }

          // Check event data conditions (non-gameState keys)
          const eventConditions = { ...condition };
          delete eventConditions.gameState;
          if (Object.keys(eventConditions).length > 0) {
            const conditionMet = Object.keys(eventConditions).every(
              (key) => data[key] === eventConditions[key]
            );
            if (!conditionMet) {
              console.log(`❌ Event condition not met`);
              return;
            }
            console.log(`✅ Event condition met`);
          }
        }

        // Use game-time-aware scheduling with persistence tracking
        console.log(`⏰ Scheduling story event ${event.id} with delay=${delay} at timeSpeed=${this.timeSpeed}`);
        const realDelay = (delay || 0) / this.timeSpeed;
        console.log(`   → Real-time delay will be ${realDelay}ms`);

        const payload = {
          storyEventId: storyEventDef.missionId,
          eventId: event.id,
          message: event.message,
        };

        this.schedulePendingEvent('storyEvent', payload, delay || 0, () => {
          console.log(`🚀 Executing story event ${event.id}`);

          // Create a deduplication key based on message subject to prevent duplicate messages
          const dedupKey = event.message?.subject || event.id;
          if (this.firedEvents.has(dedupKey)) {
            console.log(`⚠️ Event ${event.id} already fired (dedupKey: ${dedupKey}), skipping`);
            return;
          }

          // Mark this event as fired
          this.firedEvents.add(dedupKey);

          // For story events, we need to send the message
          // This would be handled by the game context
          triggerEventBus.emit('storyEventTriggered', payload);
        });
      });

      this.addUnsubscriber(storyEventDef.missionId, unsubscribe);
    }
  }

  /**
   * Subscribe to mission start trigger
   * @param {object} missionDef - Mission definition
   */
  subscribeMissionTrigger(missionDef) {
    const { type, event, delay, condition, missionId: triggerMissionId } = missionDef.triggers.start;

    console.log(`📡 Subscribing to mission trigger for ${missionDef.title}: type=${type}, trigger=${triggerMissionId || event}`);

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

        // Use game-time-aware scheduling with persistence tracking
        console.log(`⏰ Scheduling mission activation for ${missionDef.title} with delay=${delay}, speed=${this.timeSpeed}`);
        const self = this; // Capture this for callback

        self.schedulePendingEvent('missionActivation', { missionId: missionDef.missionId }, delay || 0, () => {
          try {
            console.log(`🚀 Executing scheduled activation for ${missionDef.title}`);
            console.log(`   self=${typeof self}, self.activateMission=${typeof self?.activateMission}`);
            self.activateMission(missionDef.missionId);
          } catch (error) {
            console.error(`❌ Error in scheduled activation for ${missionDef.title}:`, error);
          }
        });
      });

      this.addUnsubscriber(missionDef.missionId, unsubscribe);
    } else if (type === 'afterMissionComplete') {
      const unsubscribe = triggerEventBus.on('missionComplete', (data) => {
        console.log(`🎯 missionComplete event received: ${data.missionId}, looking for: ${triggerMissionId}`);

        // Check if this is the mission we're waiting for
        if (data.missionId !== triggerMissionId) {
          return;
        }

        console.log(`✅ Mission ${triggerMissionId} completed, scheduling ${missionDef.title} activation`);

        // Use game-time-aware scheduling with persistence tracking
        const self = this; // Capture this for callback
        self.schedulePendingEvent('missionActivation', { missionId: missionDef.missionId }, delay || 0, () => {
          try {
            console.log(`🚀 Executing scheduled activation for ${missionDef.title} after mission completion`);
            self.activateMission(missionDef.missionId);
          } catch (error) {
            console.error(`❌ Error in scheduled activation for ${missionDef.title}:`, error);
          }
        });
      });

      this.addUnsubscriber(missionDef.missionId, unsubscribe);
    }
  }

  /**
   * Subscribe to scripted event triggers
   * @param {object} missionDef - Mission definition
   */
  subscribeScriptedEventTriggers(missionDef) {
    console.log(`✅ Setting up scripted event triggers for ${missionDef.missionId}`);

    missionDef.scriptedEvents.forEach((scriptedEvent) => {
      const { type, objectiveId, delay } = scriptedEvent.trigger;
      console.log(`✅ Subscribing to trigger: type=${type}, objectiveId=${objectiveId}`);

      if (type === 'afterObjectiveComplete') {
        const unsubscribe = triggerEventBus.on('objectiveComplete', (data) => {
          console.log(`✅ objectiveComplete: obj=${data.objectiveId}, mission=${data.missionId}`);

          if (data.objectiveId === objectiveId && data.missionId === missionDef.missionId) {
            console.log(`✅ Scripted event triggered: ${scriptedEvent.id}`);
            // Use game-time-aware scheduling with persistence tracking
            const payload = { missionId: missionDef.missionId, eventId: scriptedEvent.id, scriptedEvent };
            this.schedulePendingEvent('scriptedEvent', payload, delay || 0, () => {
              this.executeScriptedEvent(missionDef.missionId, scriptedEvent);
            });
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

    // Check if mission has an intro message
    const introMessage = mission.triggers?.start?.introMessage;
    if (introMessage) {
      console.log(`📧 Scheduling intro message for ${mission.title}`);
      const delay = introMessage.delay || 0;

      const payload = { missionId: mission.missionId, introMessage };
      this.schedulePendingEvent('introMessage', payload, delay, () => {
        console.log(`📧 Sending intro message for ${mission.title}`);
        triggerEventBus.emit('sendMissionIntroMessage', payload);
      });
    }

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
    console.log(`🚀 Executing scripted event: ${scriptedEvent.id}`);

    // Get mission definition to access consequences
    const mission = this.getMission(missionId);

    // Enrich actions with mission data (e.g., failure consequences)
    const enrichedActions = scriptedEvent.actions.map(action => {
      if (action.type === 'setMissionStatus' && action.status === 'failed' && mission?.consequences?.failure) {
        return {
          ...action,
          failureConsequences: mission.consequences.failure
        };
      }
      return action;
    });

    // Emit event for scripted event execution
    console.log(`📡 EMITTING scriptedEventStart: eventId=${scriptedEvent.id}, missionId=${missionId}, actions=${enrichedActions.length}`);
    triggerEventBus.emit('scriptedEventStart', {
      missionId,
      eventId: scriptedEvent.id,
      actions: enrichedActions,
    });
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

/**
 * useStoryMissions Hook - Initialize and manage story missions
 *
 * This hook should be called in GameContext to:
 * - Load all mission JSON definitions
 * - Register missions with Story Mission Manager
 * - Subscribe to game events for mission triggers
 *
 * Usage in GameContext:
 *   useStoryMissions(gameState, actions);
 */

import { useEffect, useRef } from 'react';
import storyMissionManager from './StoryMissionManager';
import { storyEvents, allMissions } from './missionData';
import triggerEventBus from '../core/triggerEventBus';
import messageTemplates from './messageTemplates';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../core/gameTimeScheduler';
import { VERIFICATION_DELAY_MS } from '../constants/gameConstants';

// Module-level state that persists across component remounts (including React Strict Mode)
let eventsSubscribed = false;

/**
 * Initialize story missions system
 * @param {object} gameState - Current game state
 * @param {object} actions - Game actions (addMessage, setAvailableMissions, etc.)
 */
export const useStoryMissions = (gameState, actions) => {
  const desktopLoadedEmitted = useRef(false);
  const emittedConnectionsRef = useRef(new Set());
  const emittedMissionRef = useRef(null);
  const completeMissionObjectiveRef = useRef(null);
  const completeMissionRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const gameStateRef = useRef(gameState);
  const verificationTimerRef = useRef(null);
  const verificationScheduledForMissionRef = useRef(null); // Guard against re-scheduling

  // Keep refs updated with latest values
  useEffect(() => {
    gameStateRef.current = gameState;
    completeMissionObjectiveRef.current = actions.completeMissionObjective;
    completeMissionRef.current = actions.completeMission;
  }, [gameState, actions.completeMissionObjective, actions.completeMission]);

  // Initialize missions once on mount
  useEffect(() => {
    // Initialize missions in singleton (guard inside singleton prevents duplicates across HMR)
    storyMissionManager.initializeAllMissions([...storyEvents, ...allMissions]);

    // Set game state getter for condition evaluation (uses ref to always get latest state)
    storyMissionManager.setGameStateGetter(() => gameStateRef.current);

    // Only subscribe once (module-level flag persists across remounts)
    if (eventsSubscribed) {
      console.log('📡 Already subscribed, skipping');
      return; // Don't return cleanup
    }
    eventsSubscribed = true;

    // Subscribe to mission available events (only happens once ever)
    console.log('📡 Subscribing to missionAvailable events...');
    triggerEventBus.on('missionAvailable', (data) => {
      console.log(`📥 Received missionAvailable event:`, data);
      const { mission } = data;

      // Check if this is a one-time mission that has already been completed/failed
      if (mission.oneTime) {
        const currentState = gameStateRef.current;
        const completedMissions = currentState?.completedMissions || [];
        const alreadyCompleted = completedMissions.some(m => m.missionId === mission.missionId);
        if (alreadyCompleted) {
          console.log(`⚠️ One-time mission ${mission.title} already completed/failed, not adding to available list`);
          return;
        }
      }

      // Actions are accessed directly - they should be stable
      if (actions.setAvailableMissions) {
        console.log(`📝 Calling setAvailableMissions for ${mission.title}`);
        actions.setAvailableMissions((prev) => {
          console.log(`📝 Previous missions:`, prev.length);
          // Avoid duplicates
          if (prev.some((m) => m.missionId === mission.missionId)) {
            console.log(`⚠️ Mission ${mission.title} already in available list`);
            return prev;
          }
          console.log(`➕ Adding mission ${mission.title} to available list`);
          return [...prev, mission];
        });
      } else {
        console.error(`❌ setAvailableMissions action not available!`);
      }

      console.log(`📋 Mission available: ${mission.title}`);
    });

    // No cleanup - subscriptions persist for app lifetime
  }, []); // Empty dependency array - only run once on first mount

  // Message handler with current username and managerName
  useEffect(() => {
    // Remove old handler if it exists
    if (messageHandlerRef.current) {
      triggerEventBus.off('storyEventTriggered', messageHandlerRef.current);
    }

    // Create new handler with current username and managerName in closure
    const handler = (data) => {
      const { message, eventId } = data;

      if (message && actions.addMessage) {
        // Resolve template if templateId is specified
        let resolvedMessage = message;
        if (message.templateId && messageTemplates.MESSAGE_TEMPLATES[message.templateId]) {
          const template = messageTemplates.MESSAGE_TEMPLATES[message.templateId];
          // Template provides the canonical message content, message config only provides metadata
          // (id, delay, etc.) - template fields take priority for from, fromId, fromName, subject, body
          resolvedMessage = {
            ...message, // First spread message config (id, delay, etc.)
            from: template.from,
            fromId: template.fromId,
            fromName: template.fromName,
            subject: template.subject,
            body: template.body,
            attachments: template.attachments || message.attachments || [],
          };
        }

        // Helper to replace placeholders using current gameState
        const replacePlaceholders = (text) => {
          if (!text) return text;
          return text
            .replace(/{username}/g, gameState.username || '')
            .replace(/{managerName}/g, gameState.managerName || '');
        };

        // Helper to generate random ID segments
        const generateRandomId = () => {
          return `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        };

        // Create message object with placeholder replacement
        const newMessage = {
          id: eventId.startsWith('msg-') ? eventId : `msg-${eventId}`, // Only add prefix if not already present
          from: replacePlaceholders(resolvedMessage.from),
          fromId: (resolvedMessage.fromId || '').replace(/{random}/g, generateRandomId()),
          fromName: replacePlaceholders(resolvedMessage.fromName || resolvedMessage.from),
          subject: replacePlaceholders(resolvedMessage.subject),
          body: replacePlaceholders(resolvedMessage.body || ''),
          timestamp: null, // Will be set by addMessage
          read: false,
          archived: false,
          attachments: resolvedMessage.attachments || [],
        };

        actions.addMessage(newMessage);
      }
    };

    // Store handler ref and register it
    messageHandlerRef.current = handler;
    triggerEventBus.on('storyEventTriggered', handler);

    // Cleanup on unmount
    return () => {
      if (messageHandlerRef.current) {
        triggerEventBus.off('storyEventTriggered', messageHandlerRef.current);
      }
    };
  }, [gameState.username, gameState.managerName, actions.addMessage]);

  // Emit desktop loaded event (once)
  useEffect(() => {
    if (!gameState.username || desktopLoadedEmitted.current) return;

    if (gameState.gamePhase === 'desktop') {
      triggerEventBus.emit('desktopLoaded', {
        username: gameState.username,
        time: gameState.currentTime,
      });
      desktopLoadedEmitted.current = true;
      console.log('📡 Desktop loaded event emitted');
    }
  }, [gameState.gamePhase, gameState.username, gameState.currentTime]);

  // Emit network connection events (only new connections)
  useEffect(() => {
    if (gameState.activeConnections && gameState.activeConnections.length > 0) {
      gameState.activeConnections.forEach((conn) => {
        const connKey = conn.networkId || conn.networkName;
        if (!emittedConnectionsRef.current.has(connKey)) {
          triggerEventBus.emit('networkConnected', {
            networkId: conn.networkId,
            networkName: conn.networkName,
          });
          emittedConnectionsRef.current.add(connKey);
        }
      });
    }
  }, [gameState.activeConnections]);

  // Emit mission acceptance event (only new missions)
  useEffect(() => {
    if (gameState.activeMission) {
      const missionId = gameState.activeMission.missionId || gameState.activeMission.id;
      if (missionId && missionId !== emittedMissionRef.current) {
        triggerEventBus.emit('missionAccepted', {
          missionId: missionId,
        });
        emittedMissionRef.current = missionId;
      }
    }
  }, [gameState.activeMission]);

  // Update time speed in StoryMissionManager when it changes
  useEffect(() => {
    if (gameState.timeSpeed !== undefined) {
      storyMissionManager.setTimeSpeed(gameState.timeSpeed);
    }
  }, [gameState.timeSpeed]);

  // Auto-complete verification objective with game-time delay:
  // - For missions WITH scripted events: wait for scriptedEventComplete, then schedule verification
  // - For missions WITHOUT scripted events: schedule verification immediately
  useEffect(() => {
    if (!gameState.activeMission || !gameState.activeMission.objectives) {
      // Clear guard if no active mission
      verificationScheduledForMissionRef.current = null;
      return;
    }

    const verificationObj = gameState.activeMission.objectives.find(
      obj => obj.id === 'obj-verify'
    );

    if (!verificationObj || verificationObj.status === 'complete') {
      // Clear guard if verification is already complete
      verificationScheduledForMissionRef.current = null;
      return;
    }

    // Check if all non-verification objectives are complete
    const otherObjectives = gameState.activeMission.objectives.filter(
      obj => obj.id !== 'obj-verify'
    );
    const allOtherComplete = otherObjectives.every(obj => obj.status === 'complete');

    if (!allOtherComplete) {
      return;
    }

    const missionId = gameState.activeMission.missionId;
    const missionDef = gameState.activeMission;

    // Guard: Don't re-schedule if already scheduled for this mission
    if (verificationScheduledForMissionRef.current === missionId && verificationTimerRef.current) {
      console.log('[VERIFY] Already scheduled for', missionId);
      return;
    }

    console.log('[VERIFY] Checking to schedule for', missionId, 'allOtherComplete:', allOtherComplete);

    // Helper function to schedule verification with game-time delay
    const scheduleVerification = () => {
      // Clear any existing timer for a different mission
      if (verificationTimerRef.current && verificationScheduledForMissionRef.current !== missionId) {
        clearGameTimeCallback(verificationTimerRef.current);
        verificationTimerRef.current = null;
      }

      verificationTimerRef.current = scheduleGameTimeCallback(() => {
        console.log('[VERIFY] Timer fired for', missionId);
        if (gameStateRef.current.activeMission?.missionId === missionId) {
          completeMissionObjectiveRef.current?.('obj-verify');
        }
        verificationTimerRef.current = null;
        verificationScheduledForMissionRef.current = null;
      }, VERIFICATION_DELAY_MS, gameState.timeSpeed || 1);

      verificationScheduledForMissionRef.current = missionId;
      console.log('[VERIFY] Scheduled timer for', missionId, 'delay:', VERIFICATION_DELAY_MS, 'speed:', gameState.timeSpeed || 1);
    };

    // Check if this mission has scripted events triggered by objective completion
    let hasScriptedEvents = false;
    if (missionDef.scriptedEvents && missionDef.scriptedEvents.length > 0) {
      hasScriptedEvents = missionDef.scriptedEvents.some(event =>
        event.trigger?.type === 'afterObjectiveComplete'
      );
    }

    // For missions with scripted events, listen for scriptedEventComplete then schedule verification
    if (hasScriptedEvents) {
      const handleScriptedComplete = () => {
        // Check mission wasn't failed by the scripted event
        if (gameStateRef.current.activeMission?.missionId === missionId) {
          scheduleVerification();
        }
      };

      triggerEventBus.on('scriptedEventComplete', handleScriptedComplete);
      // Note: No cleanup that clears the timer - let it run to completion
      return () => {
        triggerEventBus.off('scriptedEventComplete', handleScriptedComplete);
      };
    }

    // For missions WITHOUT scripted events, schedule verification immediately
    console.log('[VERIFY] Calling scheduleVerification for', missionId, 'hasScriptedEvents:', hasScriptedEvents);
    scheduleVerification();

    // Note: No cleanup that clears the timer - guard pattern prevents re-scheduling
  }, [
    gameState.activeMission,
    gameState.activeMission?.objectives?.map(obj => `${obj.id}:${obj.status}`).join(','),
    gameState.timeSpeed
  ]);
};

export default useStoryMissions;

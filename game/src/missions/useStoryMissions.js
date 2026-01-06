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
  const messageHandlerRef = useRef(null);

  // Initialize missions once on mount
  useEffect(() => {
    // Initialize missions in singleton (guard inside singleton prevents duplicates across HMR)
    storyMissionManager.initializeAllMissions([...storyEvents, ...allMissions]);

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
          id: eventId, // Use eventId directly as the message ID for trigger matching
          from: replacePlaceholders(message.from),
          fromId: message.fromId.replace(/{random}/g, generateRandomId()),
          fromName: replacePlaceholders(message.fromName),
          subject: replacePlaceholders(message.subject),
          body: replacePlaceholders(message.body),
          timestamp: null, // Will be set by addMessage
          read: false,
          archived: false,
          attachments: message.attachments || [],
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
};

export default useStoryMissions;

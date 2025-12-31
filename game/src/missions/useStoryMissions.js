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
import { initializeAllMissions } from './missionData';
import triggerEventBus from '../core/triggerEventBus';

/**
 * Initialize story missions system
 * @param {object} gameState - Current game state
 * @param {object} actions - Game actions (addMessage, setAvailableMissions, etc.)
 */
export const useStoryMissions = (gameState, actions) => {
  const initialized = useRef(false);
  const desktopLoadedEmitted = useRef(false);
  const emittedConnectionsRef = useRef(new Set());
  const emittedMissionRef = useRef(null);

  // Initialize missions once on mount
  useEffect(() => {
    if (initialized.current) return;

    // Load all mission definitions
    initializeAllMissions(storyMissionManager);
    initialized.current = true;

    console.log('✅ Story mission system initialized');

    // Subscribe to mission available events
    const unsubscribeMission = triggerEventBus.on('missionAvailable', (data) => {
      const { mission } = data;

      // Add mission to available missions
      if (actions.setAvailableMissions) {
        actions.setAvailableMissions((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.missionId === mission.missionId)) {
            return prev;
          }
          return [...prev, mission];
        });
      }

      console.log(`📋 Mission available: ${mission.title}`);
    });

    // Subscribe to story event triggered (for messages)
    const unsubscribeEvent = triggerEventBus.on('storyEventTriggered', (data) => {
      const { message, eventId } = data;

      if (message && actions.addMessage) {
        // Create message object
        const newMessage = {
          id: `msg-${eventId}-${Date.now()}`,
          from: message.from,
          fromId: message.fromId,
          fromName: message.fromName,
          subject: message.subject,
          body: message.body,
          timestamp: null, // Will be set by addMessage
          read: false,
          archived: false,
          attachments: message.attachments || [],
        };

        actions.addMessage(newMessage);
        console.log(`📧 Story event message: ${message.subject}`);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeMission();
      unsubscribeEvent();
    };
  }, [actions]);

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
};

export default useStoryMissions;

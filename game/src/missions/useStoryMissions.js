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

  // Initialize missions once on mount
  useEffect(() => {
    if (initialized.current) return;

    // Load all mission definitions
    initializeAllMissions(storyMissionManager);
    initialized.current = true;

    console.log('✅ Story mission system initialized');

    // Subscribe to mission available events
    const unsubscribe = triggerEventBus.on('missionAvailable', (data) => {
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

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [actions]);

  // Emit events when game state changes (for mission triggers)
  useEffect(() => {
    if (!gameState.username) return; // Not initialized yet

    // Emit desktop loaded event (triggers Phase 1 welcome messages)
    if (gameState.gamePhase === 'desktop' && !gameState.desktopLoadedEmitted) {
      triggerEventBus.emit('desktopLoaded', {
        username: gameState.username,
        time: gameState.currentTime,
      });
    }
  }, [gameState.gamePhase, gameState.username, gameState.currentTime, gameState.desktopLoadedEmitted]);

  // Emit network connection events
  useEffect(() => {
    if (gameState.activeConnections && gameState.activeConnections.length > 0) {
      gameState.activeConnections.forEach((conn) => {
        triggerEventBus.emit('networkConnected', {
          networkId: conn.networkId,
          networkName: conn.networkName,
        });
      });
    }
  }, [gameState.activeConnections]);

  // Emit mission acceptance event
  useEffect(() => {
    if (gameState.activeMission) {
      triggerEventBus.emit('missionAccepted', {
        missionId: gameState.activeMission.missionId || gameState.activeMission.id,
      });
    }
  }, [gameState.activeMission]);
};

export default useStoryMissions;

/**
 * useObjectiveAutoTracking Hook - Automatically track and complete mission objectives
 *
 * Listens for game events and checks if mission objectives are met.
 * When an objective is complete, it automatically marks it as complete.
 * When all objectives are complete, it triggers mission completion.
 *
 * Features:
 * - Event-driven (only checks when relevant events fire)
 * - Test-friendly (can be disabled via enabled flag)
 * - Re-entrancy protection (prevents cascading updates)
 */

import { useEffect, useRef, useCallback } from 'react';
import triggerEventBus from '../core/triggerEventBus';
import networkRegistry from '../systems/NetworkRegistry';
import { checkMissionObjectives, areAllObjectivesComplete } from './ObjectiveTracker';
import { calculateMissionPayout } from '../systems/MissionSystem';

/**
 * Hook to automatically track and complete mission objectives
 *
 * @param {object} activeMission - Current active mission with objectives
 * @param {object} gameState - Current game state for objective checking
 * @param {number} reputation - Current player reputation tier
 * @param {function} completeMissionObjective - Function to mark objective complete
 * @param {function} completeMission - Function to complete the mission (status, payout, repChange)
 * @param {boolean} enabled - Whether auto-tracking is enabled (default: true)
 */
export const useObjectiveAutoTracking = (
  activeMission,
  gameState,
  reputation,
  completeMissionObjective,
  completeMission,
  enabled = true
) => {
  const processingRef = useRef(false);
  const completedObjectiveIdsRef = useRef(new Set());
  const missionCompletedRef = useRef(null);

  // Track latest values in refs to avoid stale closure issues
  const gameStateRef = useRef(gameState);
  const activeMissionRef = useRef(activeMission);

  // Track latest file operation from event (more reliable than gameState due to React timing)
  const lastFileOperationRef = useRef(null);

  // Track latest scan results from event (more reliable than gameState due to React timing)
  const lastScanResultsRef = useRef(null);

  // Track latest file system connection from event (more reliable than gameState due to React timing)
  const lastFileSystemConnectionRef = useRef(null);

  // Track viewed device logs for investigation objectives (accumulates during mission)
  const viewedDeviceLogsRef = useRef([]);

  // Track Data Recovery Tool connections (accumulates during mission)
  const dataRecoveryToolConnectionsRef = useRef([]);

  // Track Data Recovery Tool scans (accumulates during mission)
  const dataRecoveryScansRef = useRef([]);

  // Track recovery operations (restore/secure-delete) from Data Recovery Tool
  const missionRecoveryOperationsRef = useRef({ restored: new Set(), secureDeleted: new Set() });

  // Keep refs updated with latest values
  useEffect(() => {
    gameStateRef.current = gameState;
    activeMissionRef.current = activeMission;
  }, [gameState, activeMission]);

  // Memoized objective checker - handles multiple objectives completing at once
  const checkAndCompleteObjectives = useCallback(() => {
    // Use refs to always get latest state (avoids stale closure from setTimeout)
    const currentGameState = gameStateRef.current;
    const currentMission = activeMissionRef.current;

    // Use event-sourced lastFileOperation if available (more reliable than React state)
    // Also derive narEntries from networkRegistry (accessible networks)
    const accessibleNetworks = networkRegistry.getSnapshot().networks.filter(n => n.accessible);
    const narEntries = accessibleNetworks.map(n => ({ networkId: n.networkId, authorized: true }));

    // Merge file system connection from event if not already in state
    let effectiveFileManagerConnections = currentGameState.fileManagerConnections || [];
    if (lastFileSystemConnectionRef.current) {
      const alreadyInState = effectiveFileManagerConnections.some(
        conn => conn.fileSystemId === lastFileSystemConnectionRef.current.fileSystemId
      );
      if (!alreadyInState) {
        effectiveFileManagerConnections = [...effectiveFileManagerConnections, lastFileSystemConnectionRef.current];
      }
    }

    const effectiveGameState = {
      ...currentGameState,
      narEntries,
      fileManagerConnections: effectiveFileManagerConnections,
      dataRecoveryToolConnections: dataRecoveryToolConnectionsRef.current,
      dataRecoveryScans: dataRecoveryScansRef.current,
      viewedDeviceLogs: viewedDeviceLogsRef.current,
      missionRecoveryOperations: missionRecoveryOperationsRef.current,
      ...(lastFileOperationRef.current ? { lastFileOperation: lastFileOperationRef.current } : {}),
      ...(lastScanResultsRef.current ? { lastScanResults: lastScanResultsRef.current } : {}),
    };

    if (!enabled || !currentMission || !currentMission.objectives || processingRef.current) {
      return;
    }

    // Don't process if we already completed this mission
    const missionId = currentMission.missionId || currentMission.id;
    if (missionCompletedRef.current === missionId) {
      return;
    }

    processingRef.current = true;

    try {
      // Get ALL completable objectives (array)
      const completableObjectives = checkMissionObjectives(currentMission, effectiveGameState);

      // Track which objectives are being completed this cycle
      const newlyCompletedIds = [];

      // Complete each objective that hasn't been completed yet
      for (const objective of completableObjectives) {
        if (!completedObjectiveIdsRef.current.has(objective.id)) {
          completedObjectiveIdsRef.current.add(objective.id);
          newlyCompletedIds.push(objective.id);

          // Determine if this is a pre-completion (not the first incomplete objective)
          const firstIncomplete = currentMission.objectives.find(obj => obj.status !== 'complete');
          const isPreCompleted = firstIncomplete && firstIncomplete.id !== objective.id;

          console.log(`✅ Objective auto-completed${isPreCompleted ? ' (pre-completed)' : ''}: ${objective.description}`);
          completeMissionObjective(objective.id, isPreCompleted);

          // Emit objectiveComplete event for scripted event triggers
          triggerEventBus.emit('objectiveComplete', {
            objectiveId: objective.id,
            missionId: currentMission.missionId,
            objective: objective
          });
        }
      }

      // Check if all objectives now complete (after this batch)
      if (newlyCompletedIds.length > 0) {
        const updatedObjectives = currentMission.objectives.map((obj) =>
          completedObjectiveIdsRef.current.has(obj.id) ? { ...obj, status: 'complete' } : obj
        );

        if (areAllObjectivesComplete(updatedObjectives)) {
          console.log(`🎉 All objectives complete (including verification) - completing mission`);
          missionCompletedRef.current = missionId;

          // Calculate payout and reputation change
          const basePayout = currentMission.basePayout || 0;
          const payout = calculateMissionPayout(basePayout, reputation);
          const reputationChange = currentMission.consequences?.success?.reputation ?? 1;

          // Small delay to allow state to settle before completing mission
          setTimeout(() => completeMission('success', payout, reputationChange), 100);
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [enabled, reputation, completeMissionObjective, completeMission]);  // Removed activeMission and gameState since we use refs

  // Subscribe to relevant game events
  useEffect(() => {
    if (!enabled) return;

    const eventHandlers = [
      { event: 'networkConnected', handler: () => setTimeout(checkAndCompleteObjectives, 50) },
      {
        event: 'networkScanComplete',
        handler: (data) => {
          // Store the scan results directly from the event (avoids React state timing issues)
          lastScanResultsRef.current = data.results;
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'fileSystemConnected',
        handler: (data) => {
          // Store the connection data directly from the event (avoids React state timing issues)
          lastFileSystemConnectionRef.current = data;
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      { event: 'narEntryAdded', handler: () => setTimeout(checkAndCompleteObjectives, 50) },
      {
        event: 'deviceLogsViewed',
        handler: (data) => {
          // Track viewed device logs for investigation objectives
          // Only add if not already tracked (avoid duplicates)
          const alreadyViewed = viewedDeviceLogsRef.current.some(
            v => v.fileSystemId === data.fileSystemId
          );
          if (!alreadyViewed && data.fileSystemId) {
            viewedDeviceLogsRef.current = [...viewedDeviceLogsRef.current, data];
          }
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'fileOperationComplete',
        handler: (data) => {
          // Store the operation data directly from the event (avoids React state timing issues)
          lastFileOperationRef.current = data;
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'dataRecoveryToolConnected',
        handler: (data) => {
          // Track Data Recovery Tool connections for fileSystemConnection objectives with app='dataRecoveryTool'
          const alreadyConnected = dataRecoveryToolConnectionsRef.current.some(
            c => c.fileSystemId === data.fileSystemId
          );
          if (!alreadyConnected) {
            dataRecoveryToolConnectionsRef.current = [...dataRecoveryToolConnectionsRef.current, data];
          }
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'dataRecoveryScanComplete',
        handler: (data) => {
          // Track Data Recovery Tool scans for dataRecoveryScan objectives
          const alreadyScanned = dataRecoveryScansRef.current.some(
            s => s.fileSystemId === data.fileSystemId
          );
          if (!alreadyScanned) {
            dataRecoveryScansRef.current = [...dataRecoveryScansRef.current, data];
          }
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'fileRecoveryComplete',
        handler: (data) => {
          if (data.fileName) {
            const current = missionRecoveryOperationsRef.current;
            const newRestored = new Set(current.restored);
            newRestored.add(data.fileName);
            missionRecoveryOperationsRef.current = { ...current, restored: newRestored };
          }
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
      {
        event: 'secureDeleteComplete',
        handler: (data) => {
          if (data.fileName) {
            const current = missionRecoveryOperationsRef.current;
            const newSecureDeleted = new Set(current.secureDeleted);
            newSecureDeleted.add(data.fileName);
            missionRecoveryOperationsRef.current = { ...current, secureDeleted: newSecureDeleted };
          }
          setTimeout(checkAndCompleteObjectives, 50);
        }
      },
    ];

    const unsubscribers = eventHandlers.map(({ event, handler }) =>
      triggerEventBus.on(event, handler)
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, checkAndCompleteObjectives]);

  // Reset tracking when mission changes
  useEffect(() => {
    const missionId = activeMission?.missionId || activeMission?.id;
    if (missionId) {
      // Reset refs for new mission
      completedObjectiveIdsRef.current = new Set();
      viewedDeviceLogsRef.current = [];
      dataRecoveryToolConnectionsRef.current = [];
      dataRecoveryScansRef.current = [];
      missionRecoveryOperationsRef.current = { restored: new Set(), secureDeleted: new Set() };
      // Only reset missionCompletedRef if it's a different mission
      if (missionCompletedRef.current !== missionId) {
        missionCompletedRef.current = null;
      }
    }
  }, [activeMission?.missionId, activeMission?.id]);

  // Check objectives when mission is first accepted (catch-up for pre-satisfied objectives)
  useEffect(() => {
    if (!enabled || !activeMission) return;

    // Delay initial check to allow state to settle
    const timeoutId = setTimeout(checkAndCompleteObjectives, 100);
    return () => clearTimeout(timeoutId);
  }, [enabled, activeMission?.missionId, checkAndCompleteObjectives]);

  // Watch for all objectives being complete (handles externally completed objectives like obj-verify)
  useEffect(() => {
    if (!enabled || !activeMission || !activeMission.objectives) return;

    const missionId = activeMission.missionId || activeMission.id;

    // Don't process if we already completed this mission
    if (missionCompletedRef.current === missionId) {
      return;
    }

    // Check if ALL objectives are complete
    if (areAllObjectivesComplete(activeMission.objectives)) {
      console.log(`🎉 All objectives complete (detected by watcher) - completing mission ${missionId}`);
      missionCompletedRef.current = missionId;

      // Calculate payout and reputation change
      const basePayout = activeMission.basePayout || 0;
      const payout = calculateMissionPayout(basePayout, reputation);
      const reputationChange = activeMission.consequences?.success?.reputation ?? 1;

      // Small delay to allow state to settle before completing mission
      setTimeout(() => completeMission('success', payout, reputationChange), 100);
    }
  }, [enabled, activeMission, activeMission?.objectives, reputation, completeMission]);
};

export default useObjectiveAutoTracking;

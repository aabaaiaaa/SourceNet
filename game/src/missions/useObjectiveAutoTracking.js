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
  const lastCompletedRef = useRef(null);
  const missionCompletedRef = useRef(null);

  // Memoized objective checker
  const checkAndCompleteObjective = useCallback(() => {
    if (!enabled || !activeMission || !activeMission.objectives || processingRef.current) {
      return;
    }

    // Don't process if we already completed this mission
    const missionId = activeMission.missionId || activeMission.id;
    if (missionCompletedRef.current === missionId) {
      return;
    }

    processingRef.current = true;

    try {
      const completedObjective = checkMissionObjectives(activeMission, gameState);

      if (completedObjective && completedObjective.id !== lastCompletedRef.current) {
        console.log(`✅ Objective auto-completed: ${completedObjective.description}`);
        lastCompletedRef.current = completedObjective.id;
        completeMissionObjective(completedObjective.id);

        // Check if all objectives now complete
        const updatedObjectives = activeMission.objectives.map((obj) =>
          obj.id === completedObjective.id ? { ...obj, status: 'complete' } : obj
        );

        if (areAllObjectivesComplete(updatedObjectives)) {
          console.log(`🎉 All objectives complete - completing mission`);
          missionCompletedRef.current = missionId;

          // Calculate payout and reputation change
          const basePayout = activeMission.basePayout || 0;
          const payout = calculateMissionPayout(basePayout, reputation);
          const reputationChange = activeMission.consequences?.success?.reputation || 1;

          // Small delay to allow state to settle before completing mission
          setTimeout(() => completeMission('success', payout, reputationChange), 100);
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [activeMission, gameState, reputation, completeMissionObjective, completeMission, enabled]);

  // Subscribe to relevant game events
  useEffect(() => {
    if (!enabled) return;

    const events = [
      'networkConnected',
      'networkScanComplete',
      'fileSystemConnected',
      'fileOperationComplete',
    ];

    const unsubscribers = events.map((eventType) =>
      triggerEventBus.on(eventType, () => {
        // Small delay to ensure state has updated before checking
        setTimeout(checkAndCompleteObjective, 50);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, checkAndCompleteObjective]);

  // Reset tracking when mission changes
  useEffect(() => {
    const missionId = activeMission?.missionId || activeMission?.id;
    if (missionId) {
      // Reset refs for new mission
      lastCompletedRef.current = null;
      // Only reset missionCompletedRef if it's a different mission
      if (missionCompletedRef.current !== missionId) {
        missionCompletedRef.current = null;
      }
    }
  }, [activeMission?.missionId, activeMission?.id]);

  // Check objectives when mission is first accepted (some may already be met)
  useEffect(() => {
    if (!enabled || !activeMission) return;

    // Delay initial check to allow state to settle
    const timeoutId = setTimeout(checkAndCompleteObjective, 100);
    return () => clearTimeout(timeoutId);
  }, [enabled, activeMission?.missionId, checkAndCompleteObjective]);
};

export default useObjectiveAutoTracking;

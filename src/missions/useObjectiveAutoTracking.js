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
  const completedObjectiveIdsRef = useRef(new Set());
  const missionCompletedRef = useRef(null);

  // Memoized objective checker - handles multiple objectives completing at once
  const checkAndCompleteObjectives = useCallback(() => {
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
      // Get ALL completable objectives (array)
      const completableObjectives = checkMissionObjectives(activeMission, gameState);

      // Track which objectives are being completed this cycle
      const newlyCompletedIds = [];

      // Complete each objective that hasn't been completed yet
      for (const objective of completableObjectives) {
        if (!completedObjectiveIdsRef.current.has(objective.id)) {
          completedObjectiveIdsRef.current.add(objective.id);
          newlyCompletedIds.push(objective.id);

          // Determine if this is a pre-completion (not the first incomplete objective)
          const firstIncomplete = activeMission.objectives.find(obj => obj.status !== 'complete');
          const isPreCompleted = firstIncomplete && firstIncomplete.id !== objective.id;

          console.log(`✅ Objective auto-completed${isPreCompleted ? ' (pre-completed)' : ''}: ${objective.description}`);
          completeMissionObjective(objective.id, isPreCompleted);

          // Emit objectiveComplete event for scripted event triggers
          triggerEventBus.emit('objectiveComplete', {
            objectiveId: objective.id,
            missionId: activeMission.missionId,
            objective: objective
          });
        }
      }

      // Check if all objectives now complete (after this batch)
      if (newlyCompletedIds.length > 0) {
        const updatedObjectives = activeMission.objectives.map((obj) =>
          completedObjectiveIdsRef.current.has(obj.id) ? { ...obj, status: 'complete' } : obj
        );

        if (areAllObjectivesComplete(updatedObjectives)) {
          console.log(`🎉 All objectives complete (including verification) - completing mission`);
          missionCompletedRef.current = missionId;

          // Calculate payout and reputation change
          const basePayout = activeMission.basePayout || 0;
          const payout = calculateMissionPayout(basePayout, reputation);
          const reputationChange = activeMission.consequences?.success?.reputation ?? 1;

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
      'narEntryAdded',
    ];

    const unsubscribers = events.map((eventType) =>
      triggerEventBus.on(eventType, () => {
        // Small delay to ensure state has updated before checking
        setTimeout(checkAndCompleteObjectives, 50);
      })
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

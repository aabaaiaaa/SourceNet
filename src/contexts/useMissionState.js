/**
 * useMissionState - Mission state and pure actions.
 *
 * Extracted from GameContext to reduce file size.
 * Manages active/completed/available missions, procedural mission state,
 * mission operation tracking, and the completeMissionObjective action.
 *
 * Cross-domain actions (acceptMission, completeMission, dismissMission)
 * and all mission effects remain in GameContext because they reference
 * banking, messaging, reputation, and network state.
 */

import { useState, useRef, useCallback } from 'react';

export function useMissionState() {
  // Core mission state
  const [activeMission, setActiveMissionRaw] = useState(null);
  const setActiveMission = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === 'function') {
      setActiveMissionRaw((prev) => {
        const newValue = valueOrUpdater(prev);
        return newValue;
      });
    } else {
      setActiveMissionRaw(valueOrUpdater);
    }
  }, []);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [missionCooldowns, setMissionCooldowns] = useState({ easy: null, medium: null, hard: null });

  // Mission operation tracking
  const [missionFileOperations, setMissionFileOperations] = useState({});
  const [missionSubmitting, setMissionSubmitting] = useState(false);
  const [missionDecryptionOperations, setMissionDecryptionOperations] = useState({ decrypted: new Set() });
  const [missionUploadOperations, setMissionUploadOperations] = useState({ uploaded: new Set(), uploadDestinations: new Map() });
  const [missionAvDetections, setMissionAvDetections] = useState(new Set());
  const [missionPasswordCracks, setMissionPasswordCracks] = useState(new Set());

  // Procedural mission system
  const [proceduralMissionsEnabled, setProceduralMissionsEnabled] = useState(false);
  const [missionPool, setMissionPool] = useState([]);
  const [pendingChainMissions, setPendingChainMissions] = useState({});
  const [activeClientIds, setActiveClientIds] = useState([]);
  const [clientStandings, setClientStandings] = useState({});
  const [extensionOffers, setExtensionOffers] = useState({});

  // Refs
  const failedMissionsRef = useRef(new Set());
  const completeMissionRef = useRef(null);

  // --- Pure action ---

  const completeMissionObjective = useCallback((objectiveId, isPreCompleted = false) => {
    // Check for active mission before state update (for logging)
    if (!activeMission) {
      console.log(`⚠️ completeMissionObjective: No active mission to update (objective: ${objectiveId})`);
      return;
    }

    // Log before state update (outside updater)
    console.log(`📋 completeMissionObjective: Updating objective ${objectiveId} for mission ${activeMission.missionId}${isPreCompleted ? ' (pre-completed)' : ''}`);

    // Use functional update to get the latest activeMission state
    // This prevents stale closure issues when multiple updates happen quickly
    setActiveMission((currentMission) => {
      if (!currentMission) {
        return null; // Don't set it back if it was already cleared
      }

      const updatedObjectives = currentMission.objectives.map(obj =>
        obj.id === objectiveId ? { ...obj, status: 'complete', preCompleted: isPreCompleted } : obj
      );

      return {
        ...currentMission,
        objectives: updatedObjectives,
      };
    });
  }, [activeMission, setActiveMission]);

  return {
    // Core state
    activeMission, setActiveMission,
    completedMissions, setCompletedMissions,
    availableMissions, setAvailableMissions,
    missionCooldowns, setMissionCooldowns,
    // Operation tracking
    missionFileOperations, setMissionFileOperations,
    missionSubmitting, setMissionSubmitting,
    missionDecryptionOperations, setMissionDecryptionOperations,
    missionUploadOperations, setMissionUploadOperations,
    missionAvDetections, setMissionAvDetections,
    missionPasswordCracks, setMissionPasswordCracks,
    // Procedural
    proceduralMissionsEnabled, setProceduralMissionsEnabled,
    missionPool, setMissionPool,
    pendingChainMissions, setPendingChainMissions,
    activeClientIds, setActiveClientIds,
    clientStandings, setClientStandings,
    extensionOffers, setExtensionOffers,
    // Refs
    failedMissionsRef,
    completeMissionRef,
    // Actions
    completeMissionObjective,
  };
}

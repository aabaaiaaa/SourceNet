/**
 * Objective Tracker - Monitors game state for objective completion
 *
 * Listens to game events and checks if mission objectives are complete.
 * Emits objectiveComplete events when objectives are met.
 *
 * Supported objective types:
 * - networkConnection: Connected to specific network
 * - networkScan: Scanned network and found target
 * - fileSystemConnection: Connected File Manager to file system
 * - fileOperation: Performed file operation (copy, repair, delete)
 */

import triggerEventBus from '../core/triggerEventBus';

/**
 * Check if network connection objective is complete
 * @param {object} objective - Objective definition
 * @param {array} activeConnections - Currently connected networks
 * @returns {boolean} Objective complete
 */
export const checkNetworkConnectionObjective = (objective, activeConnections) => {
  return activeConnections.some(
    (conn) => conn.networkId === objective.target || conn.networkName === objective.target
  );
};

/**
 * Check if network scan objective is complete
 * @param {object} objective - Objective definition
 * @param {object} scanResults - Network scan results
 * @returns {boolean} Objective complete
 */
export const checkNetworkScanObjective = (objective, scanResults) => {
  if (!scanResults || !scanResults.machines) return false;

  const { expectedResult } = objective;

  // Check if expected machine/hostname found in results
  return scanResults.machines.some(
    (machine) =>
      machine.hostname === expectedResult ||
      machine.ip === expectedResult ||
      machine.id === expectedResult
  );
};

/**
 * Check if file system connection objective is complete
 * @param {object} objective - Objective definition
 * @param {array} fileManagerConnections - Active File Manager connections
 * @returns {boolean} Objective complete
 */
export const checkFileSystemConnectionObjective = (objective, fileManagerConnections) => {
  return fileManagerConnections.some(
    (conn) => conn.ip === objective.target || conn.fileSystemId === objective.target
  );
};

/**
 * Check if NAR entry added objective is complete
 * @param {object} objective - Objective definition
 * @param {array} narEntries - Current NAR entries
 * @returns {boolean} Objective complete
 */
export const checkNarEntryAddedObjective = (objective, narEntries) => {
  if (!narEntries || narEntries.length === 0) return false;

  // Check if the target network has been added to NAR
  return narEntries.some(
    (entry) => entry.networkId === objective.target && entry.authorized !== false
  );
};

/**
 * Check if file operation objective is complete
 * @param {object} objective - Objective definition with targetFiles array
 * @param {object} operationData - File operation completion data (last operation)
 * @param {object} cumulativeOperations - Cumulative file operations {paste: Set(['file1.txt', ...])}
 * @returns {boolean} Objective complete
 */
export const checkFileOperationObjective = (objective, operationData, cumulativeOperations = {}) => {
  const { operation, targetFiles } = objective;

  // Check if operation matches
  if (operationData.operation !== operation) return false;

  if (!targetFiles || targetFiles.length === 0) {
    // No specific files required - just check if operation happened
    return true;
  }

  // Get the Set of completed files for this operation
  const completedFiles = cumulativeOperations[operation] || new Set();

  // Check if all target files have been operated on
  const completedTargetFiles = targetFiles.filter(file => completedFiles.has(file));
  console.log(`🔍 checkFileOperationObjective: ${operation} - ${completedTargetFiles.length}/${targetFiles.length} target files completed`);

  return completedTargetFiles.length >= targetFiles.length;
};

/**
 * Get progress for file operation objective
 * @param {object} objective - Objective definition with targetFiles array
 * @param {object} cumulativeOperations - Cumulative file operations
 * @returns {object|null} Progress info {current, total} or null if no targetFiles
 */
export const getFileOperationProgress = (objective, cumulativeOperations = {}) => {
  const { operation, targetFiles } = objective;

  if (!targetFiles || targetFiles.length === 0) {
    return null;
  }

  const completedFiles = cumulativeOperations[operation] || new Set();
  const completedCount = targetFiles.filter(file => completedFiles.has(file)).length;

  return {
    current: completedCount,
    total: targetFiles.length
  };
};

/**
 * Check if all objectives are complete
 * @param {array} objectives - Mission objectives
 * @returns {boolean} All complete
 */
export const areAllObjectivesComplete = (objectives) => {
  if (!objectives || objectives.length === 0) return false;
  return objectives.every((obj) => obj.status === 'complete');
};

/**
 * Monitor active mission objectives
 * Called on relevant game events to check objective progress
 *
 * @param {object} activeMission - Current active mission
 * @param {object} gameState - Current game state
 * @returns {object|null} Completed objective or null
 */
export const checkMissionObjectives = (activeMission, gameState) => {
  if (!activeMission || !activeMission.objectives) return null;

  // Find first incomplete objective (objectives must complete in order)
  const incompleteObjective = activeMission.objectives.find(
    (obj) => obj.status !== 'complete'
  );

  if (!incompleteObjective) return null; // All complete

  // Check if this objective is now complete based on game state
  let isComplete = false;

  switch (incompleteObjective.type) {
    case 'networkConnection':
      isComplete = checkNetworkConnectionObjective(
        incompleteObjective,
        gameState.activeConnections || []
      );
      break;

    case 'networkScan':
      isComplete = checkNetworkScanObjective(
        incompleteObjective,
        gameState.lastScanResults
      );
      break;

    case 'fileSystemConnection':
      isComplete = checkFileSystemConnectionObjective(
        incompleteObjective,
        gameState.fileManagerConnections || []
      );
      break;

    case 'fileOperation':
      isComplete = checkFileOperationObjective(
        incompleteObjective,
        gameState.lastFileOperation || {},
        gameState.missionFileOperations || {} // Pass cumulative operations
      );
      break;

    case 'narEntryAdded':
      isComplete = checkNarEntryAddedObjective(
        incompleteObjective,
        gameState.narEntries || []
      );
      break;

    case 'verification':
      // Verification objectives never auto-complete - they are completed manually
      // after all scripted events finish or via explicit game logic
      isComplete = false;
      break;

    default:
      console.warn(`Unknown objective type: ${incompleteObjective.type}`);
  }

  if (isComplete) {
    return incompleteObjective;
  }

  return null;
};

/**
 * Initialize objective tracking for a mission
 * Sets up event listeners for objective completion
 *
 * @param {object} mission - Mission object with objectives
 * @param {function} onObjectiveComplete - Callback when objective completes
 * @returns {function} Cleanup function
 */
export const initializeObjectiveTracking = (mission, onObjectiveComplete) => {
  const unsubscribers = [];

  // Subscribe to events that might complete objectives
  const events = [
    'networkConnected',
    'networkDisconnected',
    'networkScanComplete',
    'fileSystemConnected',
    'fileOperationComplete',
  ];

  events.forEach((eventType) => {
    const unsubscribe = triggerEventBus.on(eventType, (data) => {
      // Callback will check objectives and update if needed
      if (onObjectiveComplete) {
        onObjectiveComplete(eventType, data);
      }
    });

    unsubscribers.push(unsubscribe);
  });

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

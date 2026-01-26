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
 * @param {object} objective - Objective definition with targetFiles array and optional destination
 * @param {object} operationData - File operation completion data (last operation)
 * @param {object} cumulativeOperations - Cumulative file operations {paste: Set(['file1.txt', ...]), pasteDestinations: Map([['file1.txt', '192.168.50.20']])}
 * @returns {boolean} Objective complete
 */
export const checkFileOperationObjective = (objective, operationData, cumulativeOperations = {}) => {
  const { operation, targetFiles, destination } = objective;

  if (!targetFiles || targetFiles.length === 0) {
    // No specific files required - just check if operation type matches
    if (operationData.operation !== operation) return false;
    return true;
  }

  // For objectives with targetFiles, we rely on cumulative tracking.
  // Don't require operationData.operation to match - files may be copied individually
  // and subsequent operations (e.g. paste) would cause the check to fail otherwise.

  // For paste operations with a destination requirement, check files were pasted to correct location
  if (destination && operation === 'paste') {
    const pasteDestinations = cumulativeOperations.pasteDestinations || new Map();
    const completedAtDestination = targetFiles.filter(file => pasteDestinations.get(file) === destination);
    console.log(`🔍 checkFileOperationObjective: ${operation} to ${destination} - ${completedAtDestination.length}/${targetFiles.length} target files at correct destination`);

    // Debug: Log what files we're expecting vs what we have when there's a mismatch
    if (completedAtDestination.length < targetFiles.length && pasteDestinations.size > 0) {
      console.log(`  📋 Target files expected:`, targetFiles);
      console.log(`  📋 Files pasted with destinations:`, [...pasteDestinations.entries()]);
      const missing = targetFiles.filter(file => pasteDestinations.get(file) !== destination);
      console.log(`  ❌ Missing/wrong destination files:`, missing);
    }

    return completedAtDestination.length >= targetFiles.length;
  }

  // Get the Set of completed files for this operation
  const completedFiles = cumulativeOperations[operation] || new Set();

  // Check if all target files have been operated on
  const completedTargetFiles = targetFiles.filter(file => completedFiles.has(file));
  console.log(`🔍 checkFileOperationObjective: ${operation} - ${completedTargetFiles.length}/${targetFiles.length} target files completed`);

  // Debug: Log what files we're expecting vs what we have when there's a mismatch
  if (completedTargetFiles.length < targetFiles.length && completedFiles.size > 0) {
    console.log(`  📋 Target files expected:`, targetFiles);
    console.log(`  📋 Completed files in Set:`, [...completedFiles]);
    const missing = targetFiles.filter(file => !completedFiles.has(file));
    console.log(`  ❌ Missing files:`, missing);
  }

  return completedTargetFiles.length >= targetFiles.length;
};

/**
 * Get progress for file operation objective
 * @param {object} objective - Objective definition with targetFiles array and optional destination
 * @param {object} cumulativeOperations - Cumulative file operations
 * @returns {object|null} Progress info {current, total} or null if no targetFiles
 */
export const getFileOperationProgress = (objective, cumulativeOperations = {}) => {
  const { operation, targetFiles, destination } = objective;

  if (!targetFiles || targetFiles.length === 0) {
    return null;
  }

  // For paste operations with destination requirement, only count files at correct location
  if (destination && operation === 'paste') {
    const pasteDestinations = cumulativeOperations.pasteDestinations || new Map();
    const completedCount = targetFiles.filter(file => pasteDestinations.get(file) === destination).length;
    return {
      current: completedCount,
      total: targetFiles.length
    };
  }

  const completedFiles = cumulativeOperations[operation] || new Set();
  const completedCount = targetFiles.filter(file => completedFiles.has(file)).length;

  return {
    current: completedCount,
    total: targetFiles.length
  };
};

/**
 * Get detailed file status for file operation objective
 * Returns which files are completed and which are still pending
 * @param {object} objective - Objective definition with targetFiles array and optional destination
 * @param {object} cumulativeOperations - Cumulative file operations
 * @returns {object|null} Detailed status {targetFiles, completedFiles, pendingFiles, destination} or null if no targetFiles
 */
export const getFileOperationDetails = (objective, cumulativeOperations = {}) => {
  const { operation, targetFiles, destination } = objective;

  if (!targetFiles || targetFiles.length === 0) {
    return null;
  }

  // For paste operations with destination requirement
  if (destination && operation === 'paste') {
    const pasteDestinations = cumulativeOperations.pasteDestinations || new Map();
    const completedFiles = targetFiles.filter(file => pasteDestinations.get(file) === destination);
    const pendingFiles = targetFiles.filter(file => pasteDestinations.get(file) !== destination);

    // Also track files pasted to wrong location
    const wrongLocationFiles = pendingFiles.filter(file => pasteDestinations.has(file));

    return {
      operation,
      targetFiles,
      completedFiles,
      pendingFiles,
      wrongLocationFiles,
      destination,
      totalRequired: targetFiles.length,
      totalCompleted: completedFiles.length
    };
  }

  const completedFilesSet = cumulativeOperations[operation] || new Set();
  const completedFiles = targetFiles.filter(file => completedFilesSet.has(file));
  const pendingFiles = targetFiles.filter(file => !completedFilesSet.has(file));

  return {
    operation,
    targetFiles,
    completedFiles,
    pendingFiles,
    wrongLocationFiles: [],
    destination: null,
    totalRequired: targetFiles.length,
    totalCompleted: completedFiles.length
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
 * Check if a single objective is complete based on game state
 * @param {object} objective - Objective to check
 * @param {object} gameState - Current game state
 * @returns {boolean} Whether objective is complete
 */
const isObjectiveComplete = (objective, gameState) => {
  switch (objective.type) {
    case 'networkConnection':
      return checkNetworkConnectionObjective(
        objective,
        gameState.activeConnections || []
      );

    case 'networkScan':
      return checkNetworkScanObjective(
        objective,
        gameState.lastScanResults
      );

    case 'fileSystemConnection':
      return checkFileSystemConnectionObjective(
        objective,
        gameState.fileManagerConnections || []
      );

    case 'fileOperation':
      return checkFileOperationObjective(
        objective,
        gameState.lastFileOperation || {},
        gameState.missionFileOperations || {}
      );

    case 'narEntryAdded':
      return checkNarEntryAddedObjective(
        objective,
        gameState.narEntries || []
      );

    case 'verification':
      // Verification objectives never auto-complete
      return false;

    default:
      console.warn(`Unknown objective type: ${objective.type}`);
      return false;
  }
};

/**
 * Monitor active mission objectives
 * Called on relevant game events to check objective progress
 * Checks ALL incomplete objectives and returns array of completable ones
 * (supports out-of-order completion)
 *
 * @param {object} activeMission - Current active mission
 * @param {object} gameState - Current game state
 * @returns {array} Array of completed objectives (may be empty)
 */
export const checkMissionObjectives = (activeMission, gameState) => {
  if (!activeMission || !activeMission.objectives) return [];

  const completableObjectives = [];

  // Find all incomplete non-verification objectives
  const incompleteObjectives = activeMission.objectives.filter(
    (obj) => obj.status !== 'complete' && obj.type !== 'verification'
  );

  // Check each incomplete objective
  for (const objective of incompleteObjectives) {
    if (isObjectiveComplete(objective, gameState)) {
      completableObjectives.push(objective);
    }
  }

  return completableObjectives;
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

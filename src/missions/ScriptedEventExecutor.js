/**
 * Scripted Event Executor - Execute story-driven events
 *
 * Handles scripted events like:
 * - Tutorial sabotage (file deletion)
 * - Forced VPN disconnections
 * - Mission status changes
 * - Visual effects during scripted sequences
 *
 * Blocks player control during scripted events.
 */

import triggerEventBus from '../core/triggerEventBus';
import { scheduleGameTimeCallback } from '../core/gameTimeScheduler';

/**
 * Execute file deletion scripted event
 * @param {object} action - Action definition from mission JSON
 * @param {function} onProgress - Progress callback (for UI updates)
 * @param {function} onComplete - Completion callback
 * @param {array} fileNames - Optional array of file names being deleted (for activity log)
 * @param {number} timeSpeed - Current game time speed multiplier
 */
export const executeFileDeleteAction = async (action, onProgress, onComplete, fileNames = [], timeSpeed = 1) => {
  const { files, duration, playerControl } = action;

  // Block player control if specified
  if (playerControl === false) {
    triggerEventBus.emit('playerControlBlocked', { blocked: true });
  }

  // Simulate file deletion with progress
  const fileCount = typeof files === 'number' ? files : 8; // Default 8 files for tutorial

  // Generate default file names if not provided
  const actualFileNames = fileNames.length > 0 ? fileNames :
    Array.from({ length: fileCount }, (_, i) => `file_${i + 1}.dat`);

  const timePerFile = duration / fileCount;

  for (let i = 0; i < fileCount; i++) {
    await new Promise((resolve) => {
      scheduleGameTimeCallback(resolve, timePerFile, timeSpeed);
    });

    // Emit sabotage file operation event for File Manager activity log
    triggerEventBus.emit('sabotageFileOperation', {
      fileName: actualFileNames[i] || `file_${i + 1}.dat`,
      operation: 'delete',
      source: 'UNKNOWN',
    });

    if (onProgress) {
      onProgress({
        filesDeleted: i + 1,
        totalFiles: fileCount,
        progress: ((i + 1) / fileCount) * 100,
      });
    }
  }

  // Re-enable player control
  if (playerControl === false) {
    triggerEventBus.emit('playerControlBlocked', { blocked: false });
  }

  if (onComplete) {
    onComplete();
  }
};

/**
 * Execute forced network disconnection
 * @param {object} action - Action definition
 * @param {function} onComplete - Completion callback
 */
export const executeForceDisconnectAction = (action, onComplete) => {
  const { network, reason, administratorMessage } = action;

  // Emit forcedDisconnection event for dramatic overlay (distinct from normal disconnect)
  triggerEventBus.emit('forcedDisconnection', {
    networkId: network,
    reason: reason || 'Network administrator terminated connection',
    administratorMessage: administratorMessage || null,
  });

  // Also emit the regular disconnect to actually disconnect the VPN
  triggerEventBus.emit('forceNetworkDisconnect', {
    networkId: network,
    reason: reason || 'Network administrator terminated connection',
  });

  if (onComplete) {
    onComplete();
  }
};

/**
 * Execute mission status change
 * @param {object} action - Action definition
 * @param {function} onComplete - Completion callback
 */
export const executeSetMissionStatusAction = (action, onComplete) => {
  const { status, failureReason } = action;

  console.log('🎭 Emitting missionStatusChanged:', { status, failureReason });
  triggerEventBus.emit('missionStatusChanged', {
    status,
    failureReason,
  });
  console.log('✅ missionStatusChanged event emitted');

  if (onComplete) {
    onComplete();
  }
};

/**
 * Execute NAR entry revocation
 * @param {object} action - Action definition
 * @param {function} onComplete - Completion callback
 */
export const executeRevokeNAREntryAction = (action, onComplete) => {
  const { network, reason } = action;

  triggerEventBus.emit('revokeNAREntry', {
    networkId: network,
    reason: reason || 'Access credentials revoked by network administrator',
  });

  if (onComplete) {
    onComplete();
  }
};

/**
 * Execute scripted event sequence
 * @param {object} scriptedEvent - Scripted event from mission definition
 * @param {object} callbacks - Callback functions {onProgress, onComplete, timeSpeed}
 */
export const executeScriptedEvent = async (scriptedEvent, callbacks = {}) => {
  const { actions, id } = scriptedEvent;
  const timeSpeed = callbacks.timeSpeed || 1;

  // Execute file operations first (these block player control)
  for (const action of actions) {
    if (action.type === 'forceFileOperation' && action.operation === 'delete') {
      // Use resolved file names if available, otherwise empty array
      const fileNames = action.resolvedFileNames || [];

      await executeFileDeleteAction(
        action,
        callbacks.onProgress,
        null, // Don't call onComplete yet
        fileNames, // Use resolved file names from action enrichment
        timeSpeed // Pass time speed for game time scheduling
      );
    }
  }

  // Emit scripted event completion AFTER file operations but BEFORE other actions
  // This restores player control before forced disconnect overlay appears
  triggerEventBus.emit('scriptedEventComplete', {
    eventId: id,
  });

  // Execute remaining actions (disconnect, revoke NAR, mission status)
  for (const action of actions) {
    switch (action.type) {
      case 'forceFileOperation':
        // Already handled above
        break;

      case 'forceDisconnect':
        executeForceDisconnectAction(action, null);
        break;

      case 'revokeNAREntry':
        executeRevokeNAREntryAction(action, null);
        break;

      case 'setMissionStatus':
        executeSetMissionStatusAction(action, null);
        break;

      default:
        console.warn(`Unknown scripted action type: ${action.type}`);
    }
  }

  // Call completion callback after all actions
  if (callbacks.onComplete) {
    callbacks.onComplete();
  }
};

/**
 * Check if player control is currently blocked by scripted event
 * Used by UI to disable buttons during scripted sequences
 */
let playerControlBlocked = false;
let playerControlSubscription = null;

/**
 * Initialize player control tracking subscription
 * Called on module load and can be re-called after event bus is cleared (for testing)
 */
export const initializePlayerControlTracking = () => {
  // Unsubscribe existing subscription if any
  if (playerControlSubscription) {
    playerControlSubscription();
  }
  // Reset state
  playerControlBlocked = false;
  // Subscribe to player control events
  playerControlSubscription = triggerEventBus.on('playerControlBlocked', (data) => {
    playerControlBlocked = data.blocked;
  });
};

// Initialize on module load
initializePlayerControlTracking();

export const isPlayerControlBlocked = () => playerControlBlocked;

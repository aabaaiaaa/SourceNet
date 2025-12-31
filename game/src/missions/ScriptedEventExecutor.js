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

/**
 * Execute file deletion scripted event
 * @param {object} action - Action definition from mission JSON
 * @param {function} onProgress - Progress callback (for UI updates)
 * @param {function} onComplete - Completion callback
 */
export const executeFileDeleteAction = async (action, onProgress, onComplete) => {
  const { files, duration, playerControl } = action;

  // Block player control if specified
  if (playerControl === false) {
    triggerEventBus.emit('playerControlBlocked', { blocked: true });
  }

  // Simulate file deletion with progress
  const fileCount = typeof files === 'number' ? files : 8; // Default 8 files for tutorial
  const timePerFile = duration / fileCount;

  for (let i = 0; i < fileCount; i++) {
    await new Promise((resolve) => setTimeout(resolve, timePerFile));

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
  const { network, reason } = action;

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

  triggerEventBus.emit('missionStatusChanged', {
    status,
    failureReason,
  });

  if (onComplete) {
    onComplete();
  }
};

/**
 * Execute scripted event sequence
 * @param {object} scriptedEvent - Scripted event from mission definition
 * @param {object} callbacks - Callback functions {onProgress, onComplete}
 */
export const executeScriptedEvent = async (scriptedEvent, callbacks = {}) => {
  const { actions } = scriptedEvent;

  for (const action of actions) {
    switch (action.type) {
      case 'forceFileOperation':
        if (action.operation === 'delete') {
          await executeFileDeleteAction(
            action,
            callbacks.onProgress,
            null // Don't call onComplete yet
          );
        }
        break;

      case 'forceDisconnect':
        executeForceDisconnectAction(action, null);
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

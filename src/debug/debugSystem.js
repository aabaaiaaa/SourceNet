/**
 * Debug System - Rapid state manipulation for testing
 *
 * Development mode only (removed in production builds)
 *
 * Enables:
 * - Instant state changes (credits, reputation, time, software)
 * - Pre-configured scenarios (9 scenarios from fresh start to high performer)
 * - Testing helpers for Vitest and Playwright
 *
 * Access: Ctrl+Shift+D or ?debug=true
 */

import networkRegistry from '../systems/NetworkRegistry';

/**
 * Check if debug mode is enabled
 * @returns {boolean} Debug mode enabled
 */
export const isDebugMode = () => {
  return (
    import.meta.env.DEV || // Vite development mode
    window.location.search.includes('debug=true') ||
    localStorage.getItem('debug_mode') === 'true'
  );
};

/**
 * Set game state (for testing)
 * @param {object} gameContext - Game context with setters
 * @param {object} state - State to set
 */
export const setGameState = (gameContext, state) => {
  if (!isDebugMode()) {
    console.warn('Debug system only available in development mode');
    return;
  }

  if (state.credits !== undefined) {
    // Update bank account balance
    const newAccounts = [...gameContext.bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance = state.credits;
      gameContext.setBankAccounts(newAccounts);
    }
  }

  if (state.reputation !== undefined) {
    gameContext.setReputation(state.reputation);
  }

  if (state.time !== undefined) {
    gameContext.setCurrentTime(new Date(state.time));
  }

  if (state.software !== undefined) {
    gameContext.setSoftware(state.software);
  }

  if (state.activeMission !== undefined) {
    gameContext.setActiveMission(state.activeMission);
  }

  if (state.completedMissions !== undefined) {
    gameContext.setCompletedMissions(state.completedMissions);
  }

  if (state.narEntries !== undefined) {
    gameContext.setNarEntries(state.narEntries);
  }

  if (state.transactions !== undefined) {
    gameContext.setTransactions(state.transactions);
  }

  if (state.bankruptcyCountdown !== undefined) {
    gameContext.setBankruptcyCountdown(state.bankruptcyCountdown);
  }

  if (state.reputationCountdown !== undefined) {
    gameContext.setReputationCountdown(state.reputationCountdown);
  }

  console.log('✅ Debug: Game state updated', state);
};

/**
 * Skip time forward
 * @param {object} gameContext - Game context
 * @param {number} minutes - Minutes to skip forward
 */
export const skipTime = (gameContext, minutes) => {
  if (!isDebugMode()) return;

  const newTime = new Date(gameContext.currentTime);
  newTime.setMinutes(newTime.getMinutes() + minutes);
  gameContext.setCurrentTime(newTime);

  console.log(`✅ Debug: Skipped ${minutes} minutes forward`);
};

/**
 * Install software instantly (bypass download)
 * @param {object} gameContext - Game context
 * @param {array} softwareIds - Software IDs to install
 */
export const installSoftwareInstantly = (gameContext, softwareIds) => {
  if (!isDebugMode()) return;

  const currentSoftware = gameContext.software || [];
  const newSoftware = [...new Set([...currentSoftware, ...softwareIds])];
  gameContext.setSoftware(newSoftware);

  console.log('✅ Debug: Software installed', softwareIds);
};

/**
 * Add network to NAR instantly
 * @param {object} gameContext - Game context
 * @param {string} networkId - Network ID
 * @param {string} networkName - Network name
 */
export const addNetworkToNAR = (gameContext, networkId, networkName) => {
  if (!isDebugMode()) return;

  // Register the network in NetworkRegistry
  networkRegistry.registerNetwork({
    networkId,
    networkName,
    address: '10.0.0.0/8',
    bandwidth: 100,
  });

  // Grant access to the network
  networkRegistry.grantNetworkAccess(networkId, []);

  console.log('✅ Debug: Network added to NAR', networkId);
};

/**
 * Connect to network instantly
 * @param {object} gameContext - Game context
 * @param {string} networkId - Network ID
 * @param {string} networkName - Network name
 */
export const connectToNetwork = (gameContext, networkId, networkName) => {
  if (!isDebugMode()) return;

  const connection = {
    networkId,
    networkName,
    address: '10.0.0.0/8',
    connectedAt: new Date().toISOString(),
  };

  gameContext.setActiveConnections([...gameContext.activeConnections, connection]);

  console.log('✅ Debug: Connected to network', networkId);
};

// Export for global access in browser console (dev mode only)
if (isDebugMode()) {
  window.debugSystem = {
    setGameState,
    skipTime,
    installSoftwareInstantly,
    addNetworkToNAR,
    connectToNetwork,
  };
}

/**
 * Network Bandwidth System - Bandwidth sharing across operations
 *
 * Handles:
 * - Network connection bandwidth limits
 * - Bandwidth sharing across multiple operations
 * - Download speed calculations
 * - File transfer speed calculations
 */

/**
 * Get network connection bandwidth limit
 * @param {string} networkId - Network ID
 * @returns {number} Bandwidth limit in Mbps
 */
export const getNetworkBandwidth = (networkId) => {
  // Most networks have 50 Mbps typical limit
  // Could be enhanced with network-specific limits
  return 50; // Mbps
};

/**
 * Get player's network adapter speed
 * @param {object} hardware - Player's hardware
 * @returns {number} Network adapter speed in Mbps
 */
export const getAdapterSpeed = (hardware) => {
  if (hardware && hardware.networkAdapter) {
    return hardware.networkAdapter.speed || 250;
  }
  return 250; // Default starting adapter
};

/**
 * Calculate available bandwidth for operation
 * @param {number} adapterSpeed - Player's adapter speed (Mbps)
 * @param {number} connectionLimit - Network connection limit (Mbps)
 * @param {number} activeOperations - Number of concurrent operations
 * @returns {number} Available bandwidth in Mbps
 */
export const calculateAvailableBandwidth = (adapterSpeed, connectionLimit, activeOperations) => {
  // Effective bandwidth is minimum of adapter speed and connection limit
  const effectiveBandwidth = Math.min(adapterSpeed, connectionLimit);

  // Share equally across all active operations
  if (activeOperations <= 0) return effectiveBandwidth;

  return effectiveBandwidth / activeOperations;
};

/**
 * Calculate transfer speed
 * @param {number} availableBandwidth - Available bandwidth in Mbps
 * @returns {number} Transfer speed in MB/s
 */
export const calculateTransferSpeed = (availableBandwidth) => {
  // Convert Mbps to MB/s: Mbps / 8
  return availableBandwidth / 8;
};

/**
 * Calculate operation time
 * @param {number} sizeInMB - Data size in MB
 * @param {number} transferSpeed - Transfer speed in MB/s
 * @returns {number} Time in seconds
 */
export const calculateOperationTime = (sizeInMB, transferSpeed) => {
  if (transferSpeed <= 0) return Infinity;
  return Math.ceil(sizeInMB / transferSpeed);
};

/**
 * Get active bandwidth operations
 * @param {array} downloadQueue - Active downloads
 * @param {number} fileCopyCount - Number of file copies in progress
 * @returns {number} Total active operations
 */
export const getActiveOperations = (downloadQueue, fileCopyCount = 0) => {
  const downloads = downloadQueue.filter((item) => item.status === 'downloading').length;
  return downloads + fileCopyCount;
};

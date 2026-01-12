/**
 * Software Storage System - Track SSD space usage
 *
 * All software consumes SSD space.
 * Starting: 90 GB SSD
 * OSNet OS: ~12 GB base
 * Each app: varies by size
 */

/**
 * Software sizes in GB
 */
export const SOFTWARE_SIZES = {
  osnet: 12.0,
  portal: 0.5,
  mail: 0.3,
  banking: 0.2,
  'mission-board': 0.2,
  'vpn-client': 0.5,
  'network-scanner': 0.3,
  'network-address-register': 0.15,
  'file-manager': 0.4,
};

/**
 * Calculate total storage used
 * @param {array} installedSoftware - Array of installed software IDs
 * @returns {number} Total GB used
 */
export const calculateStorageUsed = (installedSoftware) => {
  return installedSoftware.reduce((total, softwareId) => {
    const size = SOFTWARE_SIZES[softwareId] || 0.1; // Default 0.1 GB for unknown
    return total + size;
  }, 0);
};

/**
 * Calculate free storage
 * @param {number} totalCapacity - Total SSD capacity in GB
 * @param {number} used - Used storage in GB
 * @returns {number} Free storage in GB
 */
export const calculateStorageFree = (totalCapacity, used) => {
  return Math.max(0, totalCapacity - used);
};

/**
 * Check if software can be installed
 * @param {number} freespace - Free storage in GB
 * @param {number} requiredSpace - Required space for software in GB
 * @returns {boolean} Can install
 */
export const canInstallSoftware = (freeSpace, requiredSpace) => {
  return freeSpace >= requiredSpace;
};

/**
 * Format storage for display
 * @param {number} used - Used GB
 * @param {number} total - Total GB
 * @returns {string} Formatted string "X GB used / Y GB free"
 */
export const formatStorage = (used, total) => {
  const free = calculateStorageFree(total, used);
  return `${used.toFixed(1)} GB used / ${free.toFixed(1)} GB free`;
};

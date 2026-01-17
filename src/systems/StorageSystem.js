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
 * Calculate total storage used by software
 * @param {array} installedSoftware - Array of installed software IDs
 * @returns {number} Total GB used by apps
 */
export const calculateStorageUsed = (installedSoftware) => {
  return installedSoftware.reduce((total, softwareId) => {
    const size = SOFTWARE_SIZES[softwareId] || 0.1; // Default 0.1 GB for unknown
    return total + size;
  }, 0);
};

/**
 * Calculate total storage used by local files
 * @param {array} localFiles - Array of file objects with size property (e.g., "2.5 MB")
 * @returns {number} Total GB used by files
 */
export const calculateLocalFilesSize = (localFiles) => {
  if (!localFiles || localFiles.length === 0) return 0;

  return localFiles.reduce((total, file) => {
    if (!file.size) return total;
    const match = file.size.match(/([0-9.]+)\s*(KB|MB|GB)/i);
    if (!match) return total;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    let sizeInGB = 0;
    if (unit === 'KB') sizeInGB = value / (1024 * 1024);
    else if (unit === 'MB') sizeInGB = value / 1024;
    else if (unit === 'GB') sizeInGB = value;

    return total + sizeInGB;
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
 * Format storage for display with apps/files breakdown
 * @param {number} appsUsed - GB used by apps
 * @param {number} filesUsed - GB used by local files
 * @param {number} total - Total GB
 * @returns {string} Formatted string "Apps: X GB | Files: Y GB | Z GB free"
 */
export const formatStorage = (appsUsed, filesUsed, total) => {
  // Support legacy 2-arg call: formatStorage(used, total)
  // When called with 2 args, 'total' is undefined
  if (total === undefined) {
    const used = appsUsed;
    const totalCapacity = filesUsed;
    const free = calculateStorageFree(totalCapacity, used);
    return `${used.toFixed(1)} GB used / ${free.toFixed(1)} GB free`;
  }

  const totalUsed = appsUsed + filesUsed;
  const free = calculateStorageFree(total, totalUsed);

  if (filesUsed > 0) {
    return `Apps: ${appsUsed.toFixed(1)} GB | Files: ${filesUsed.toFixed(1)} GB | ${free.toFixed(1)} GB free`;
  }
  return `Apps: ${appsUsed.toFixed(1)} GB | ${free.toFixed(1)} GB free`;
};

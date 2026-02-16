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
  const totalUsed = appsUsed + filesUsed;
  const free = calculateStorageFree(total, totalUsed);

  if (filesUsed > 0) {
    return `Apps: ${appsUsed.toFixed(1)} GB | Files: ${filesUsed.toFixed(1)} GB | ${free.toFixed(1)} GB free`;
  }
  return `Apps: ${appsUsed.toFixed(1)} GB | ${free.toFixed(1)} GB free`;
};

/**
 * Parse a capacity string to GB (e.g., "90GB" -> 90, "1TB" -> 1024)
 */
const parseCapacityToGB = (capacityStr) => {
  if (!capacityStr) return 0;
  const match = capacityStr.match(/([0-9.]+)\s*(GB|TB)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return value * 1024;
  return value;
};

/**
 * Calculate total storage capacity from hardware storage array
 * @param {object} hardware - Hardware configuration with storage array
 * @returns {number} Total capacity in GB
 */
export const getTotalStorageCapacityGB = (hardware) => {
  if (!hardware?.storage || !Array.isArray(hardware.storage)) return 0;
  return hardware.storage.reduce((sum, drive) => sum + parseCapacityToGB(drive.capacity), 0);
};

/**
 * Trim files to fit within a new capacity limit.
 * Removes files from the end of the array until used space fits.
 * @param {array} localSSDFiles - Current files on local SSD
 * @param {array} software - Installed software IDs
 * @param {number} newCapacityGB - New total capacity in GB
 * @returns {{ trimmedFiles: array, removedFiles: array }}
 */
export const trimFilesToFitCapacity = (localSSDFiles, software, newCapacityGB) => {
  const appsUsed = calculateStorageUsed(software);
  const filesUsed = calculateLocalFilesSize(localSSDFiles);
  const totalUsed = appsUsed + filesUsed;

  if (totalUsed <= newCapacityGB) {
    return { trimmedFiles: [...localSSDFiles], removedFiles: [] };
  }

  // Need to remove files to fit - remove from end of array
  const trimmedFiles = [...localSSDFiles];
  const removedFiles = [];
  let currentUsed = totalUsed;

  while (currentUsed > newCapacityGB && trimmedFiles.length > 0) {
    const removed = trimmedFiles.pop();
    removedFiles.push(removed);
    currentUsed = appsUsed + calculateLocalFilesSize(trimmedFiles);
  }

  return { trimmedFiles, removedFiles };
};

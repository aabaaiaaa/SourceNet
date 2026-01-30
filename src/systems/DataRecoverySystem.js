/**
 * Data Recovery System
 *
 * Handles calculations for file scanning and recovery operations.
 * Used by DataRecoveryTool component.
 */

/**
 * Parse file size string to MB
 * @param {string} sizeStr - File size string (e.g., "2.5 KB", "150 MB", "1.5 GB")
 * @returns {number} Size in megabytes
 */
export const parseFileSizeToMB = (sizeStr) => {
  const match = sizeStr.match(/([0-9.]+)\s*(KB|MB|GB)/i);
  if (!match) return 1; // Default to 1MB if can't parse

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (unit === 'KB') return value / 1024;
  if (unit === 'MB') return value;
  if (unit === 'GB') return value * 1024;
  return value;
};

/**
 * Calculate scan duration based on total file system size
 * Larger file systems take longer to scan.
 *
 * @param {Array} files - Array of file objects with size property
 * @returns {number} Scan duration in milliseconds
 */
export const calculateScanDuration = (files) => {
  const totalSizeGB = files.reduce((sum, f) => sum + parseFileSizeToMB(f.size) / 1024, 0);
  // 3 seconds per GB, minimum 3 seconds
  return Math.max(3000, totalSizeGB * 3000);
};

/**
 * Determine which deleted files should be discovered at a given scan progress
 * Files are discovered progressively based on their position in the array.
 * Earlier files in the array are discovered sooner.
 *
 * @param {Array} deletedFiles - Array of deleted file objects
 * @param {number} progressPercent - Current scan progress (0-100)
 * @returns {Set} Set of file names that have been discovered
 */
export const getDiscoveredDeletedFiles = (deletedFiles, progressPercent) => {
  const discovered = new Set();

  if (deletedFiles.length === 0) return discovered;

  deletedFiles.forEach((file, index) => {
    // Discovery threshold is based on position: first file at ~0%, last at 100%
    // Using (index + 1) so first file is discovered at (1/n)*100%
    const discoveryThreshold = ((index + 1) / deletedFiles.length) * 100;
    if (progressPercent >= discoveryThreshold) {
      discovered.add(file.name);
    }
  });

  return discovered;
};

/**
 * Calculate operation duration for restore/secure-delete
 *
 * @param {Object} file - File object with size property
 * @param {string} operation - 'restore' or 'secure-delete'
 * @param {number} bandwidthMbps - Network bandwidth in Mbps
 * @returns {number} Duration in milliseconds
 */
export const calculateOperationDuration = (file, operation, bandwidthMbps) => {
  const sizeInMB = parseFileSizeToMB(file.size);
  const bandwidthMBps = bandwidthMbps / 8;

  if (operation === 'restore') {
    // Restore: 1.5x multiplier, minimum 2 seconds
    return Math.max(2000, (sizeInMB / bandwidthMBps) * 1000 * 1.5);
  } else if (operation === 'secure-delete') {
    // Secure delete: 5x multiplier (slow, thorough), minimum 5 seconds
    return Math.max(5000, (sizeInMB / bandwidthMBps) * 1000 * 5);
  }
  return 2000;
};

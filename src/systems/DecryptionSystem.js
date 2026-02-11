/**
 * Decryption System
 *
 * Handles calculations for file decryption operations.
 * Used by DecryptionTool component.
 */

import { parseFileSizeToMB } from './DataRecoverySystem';

/**
 * Available decryption algorithms
 * Base algorithms are included with the tool; upgrade algorithms require purchasable packs.
 */
export const DECRYPTION_ALGORITHMS = {
  'aes-128': { name: 'AES-128', base: true },
  'aes-256': { name: 'AES-256', base: true },
  'rsa-2048': { name: 'RSA-2048', base: false },
  'blowfish': { name: 'Blowfish', base: false },
  'serpent': { name: 'Serpent', base: false },
  'twofish': { name: 'Twofish', base: false },
};

/**
 * Parse CPU specs string to extract GHz and core count
 * @param {string} specsStr - CPU specs string (e.g., "2GHz, 2 cores")
 * @returns {{ ghz: number, cores: number }}
 */
export const parseCpuSpecs = (specsStr) => {
  if (!specsStr) return { ghz: 1, cores: 1 };

  const ghzMatch = specsStr.match(/([0-9.]+)\s*GHz/i);
  const coreMatch = specsStr.match(/([0-9]+)\s*core/i);

  return {
    ghz: ghzMatch ? parseFloat(ghzMatch[1]) : 1,
    cores: coreMatch ? parseInt(coreMatch[1], 10) : 1,
  };
};

/**
 * Calculate download duration for transferring a file from remote FS to local SSD
 * @param {number} fileSizeInMB - File size in megabytes
 * @param {number} networkBandwidthMbps - Network bandwidth in Mbps
 * @returns {number} Duration in milliseconds (minimum 3000ms)
 */
export const calculateDownloadDuration = (fileSizeInMB, networkBandwidthMbps) => {
  const bandwidthMBps = networkBandwidthMbps / 8;
  return Math.max(3000, (fileSizeInMB / bandwidthMBps) * 1000);
};

/**
 * Calculate decryption duration based on file size and CPU specs
 * cpuDecryptionRate = ghz * cores * 2 MB/s
 * @param {number} fileSizeInMB - File size in megabytes
 * @param {string} cpuSpecStr - CPU specs string (e.g., "2GHz, 2 cores")
 * @returns {number} Duration in milliseconds (minimum 5000ms)
 */
export const calculateDecryptionDuration = (fileSizeInMB, cpuSpecStr) => {
  const { ghz, cores } = parseCpuSpecs(cpuSpecStr);
  const cpuDecryptionRate = ghz * cores * 2; // MB/s
  return Math.max(5000, (fileSizeInMB / cpuDecryptionRate) * 1000);
};

/**
 * Calculate upload duration for transferring a decrypted file back to remote FS
 * @param {number} fileSizeInMB - File size in megabytes
 * @param {number} networkBandwidthMbps - Network bandwidth in Mbps
 * @returns {number} Duration in milliseconds (minimum 3000ms)
 */
export const calculateUploadDuration = (fileSizeInMB, networkBandwidthMbps) => {
  const bandwidthMBps = networkBandwidthMbps / 8;
  return Math.max(3000, (fileSizeInMB / bandwidthMBps) * 1000);
};

/**
 * Generate grid data for the binary decryption visualization
 * Cells fill left-to-right, top-to-bottom proportional to progress.
 * Filled cells show deterministic green values; pending cells show random red values.
 *
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} progressPercent - Decryption progress 0-100
 * @returns {Array<Array<{value: string, filled: boolean}>>} 2D array of cell objects
 */
export const generateGridData = (rows, cols, progressPercent) => {
  const totalCells = rows * cols;
  const filledCount = Math.floor((progressPercent / 100) * totalCells);

  const grid = [];
  let cellIndex = 0;

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      if (cellIndex < filledCount) {
        // Deterministic pseudo-random based on position for consistent rendering
        // Uses bit mixing to avoid repeating patterns within rows
        const hash = ((cellIndex * 31 + r * 17 + c * 53) ^ (r * 7 + c * 13)) % 10;
        row.push({
          value: hash < 5 ? '0' : '1',
          filled: true,
        });
      } else {
        // Random value that changes each call (for animation)
        row.push({
          value: Math.random() < 0.5 ? '0' : '1',
          filled: false,
        });
      }
      cellIndex++;
    }
    grid.push(row);
  }

  return grid;
};

/**
 * Check if the player has the required algorithm to decrypt a file
 * @param {string} fileAlgorithm - The encryption algorithm used on the file
 * @param {string[]} playerAlgorithms - Array of algorithm IDs the player has
 * @returns {boolean} Whether the player can decrypt this file
 */
export const hasRequiredAlgorithm = (fileAlgorithm, playerAlgorithms) => {
  if (!fileAlgorithm || !playerAlgorithms) return false;
  return playerAlgorithms.includes(fileAlgorithm);
};

/**
 * Get the display name for an algorithm
 * @param {string} algorithmId - Algorithm ID
 * @returns {string} Display name or the ID if not found
 */
export const getAlgorithmName = (algorithmId) => {
  return DECRYPTION_ALGORITHMS[algorithmId]?.name || algorithmId;
};

/**
 * Check if a file is encrypted (has .enc extension or encrypted property)
 * @param {object} file - File object
 * @returns {boolean}
 */
export const isEncryptedFile = (file) => {
  if (file.encrypted) return true;
  if (file.name && file.name.endsWith('.enc')) return true;
  return false;
};

/**
 * Get the decrypted file name (strips .enc extension)
 * @param {string} fileName - Encrypted file name
 * @returns {string} Decrypted file name
 */
export const getDecryptedFileName = (fileName) => {
  if (fileName.endsWith('.enc')) {
    return fileName.slice(0, -4);
  }
  return fileName;
};

/**
 * Calculate download duration from file size string
 * Convenience wrapper that parses size string first
 * @param {string} fileSizeStr - File size string (e.g., "450 MB")
 * @param {number} networkBandwidthMbps - Network bandwidth in Mbps
 * @returns {number} Duration in milliseconds
 */
export const calculateDownloadDurationFromString = (fileSizeStr, networkBandwidthMbps) => {
  const sizeInMB = parseFileSizeToMB(fileSizeStr);
  return calculateDownloadDuration(sizeInMB, networkBandwidthMbps);
};

/**
 * Calculate decryption duration from file size string
 * Convenience wrapper that parses size string first
 * @param {string} fileSizeStr - File size string (e.g., "450 MB")
 * @param {string} cpuSpecStr - CPU specs string
 * @returns {number} Duration in milliseconds
 */
export const calculateDecryptionDurationFromString = (fileSizeStr, cpuSpecStr) => {
  const sizeInMB = parseFileSizeToMB(fileSizeStr);
  return calculateDecryptionDuration(sizeInMB, cpuSpecStr);
};

/**
 * Calculate upload duration from file size string
 * Convenience wrapper that parses size string first
 * @param {string} fileSizeStr - File size string (e.g., "450 MB")
 * @param {number} networkBandwidthMbps - Network bandwidth in Mbps
 * @returns {number} Duration in milliseconds
 */
export const calculateUploadDurationFromString = (fileSizeStr, networkBandwidthMbps) => {
  const sizeInMB = parseFileSizeToMB(fileSizeStr);
  return calculateUploadDuration(sizeInMB, networkBandwidthMbps);
};

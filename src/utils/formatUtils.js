/**
 * Shared formatting utilities for consistent display across components
 */

/**
 * Format time remaining for display (compact format)
 * @param {number} seconds - Time remaining in seconds
 * @returns {string} Formatted time string (e.g., "1m 24s" or "45s")
 */
export const formatTimeRemaining = (seconds) => {
    if (seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
};

/**
 * Format transfer speed for display
 * @param {number} speedMBps - Speed in MB/s
 * @returns {string} Formatted speed string (e.g., "3.2 MB/s")
 */
export const formatTransferSpeed = (speedMBps) => {
    if (!speedMBps || !isFinite(speedMBps) || speedMBps <= 0) return '';
    return `${speedMBps.toFixed(1)} MB/s`;
};

/**
 * Format bytes/MB for display
 * @param {number} sizeInMB - Size in megabytes
 * @returns {string} Formatted size string (e.g., "150 MB" or "1.5 GB")
 */
export const formatSize = (sizeInMB) => {
    if (sizeInMB >= 1000) {
        return `${(sizeInMB / 1000).toFixed(1)} GB`;
    }
    return `${sizeInMB} MB`;
};

/**
 * Installation System - Download and install software
 *
 * Handles:
 * - Download queue management
 * - Download progress (based on network speed)
 * - Bandwidth sharing across downloads
 * - Installation completion
 */

/**
 * Create download queue item
 * @param {string} softwareId - Software ID
 * @param {string} softwareName - Software name
 * @param {number} sizeInMB - Download size in megabytes
 * @returns {object} Queue item
 */
export const createQueueItem = (softwareId, softwareName, sizeInMB) => {
  return {
    id: `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    softwareId,
    softwareName,
    sizeInMB,
    progress: 0, // 0-100
    status: 'downloading', // 'downloading', 'installing', 'complete'
    startTime: Date.now(),
  };
};

/**
 * Calculate download progress
 * @param {number} elapsedMs - Time elapsed in milliseconds
 * @param {number} sizeInMB - File size in MB
 * @param {number} speedMbps - Network speed in Mbps
 * @param {number} bandwidthShare - Bandwidth share (0.5 = 50%, 1.0 = 100%)
 * @returns {number} Progress percentage (0-100)
 */
export const calculateDownloadProgress = (elapsedMs, sizeInMB, speedMbps, bandwidthShare = 1.0) => {
  // Convert Mbps to MB/s: Mbps / 8
  const speedMBps = (speedMbps / 8) * bandwidthShare;

  // Calculate how many MB downloaded in elapsed time
  const elapsedSeconds = elapsedMs / 1000;
  const downloadedMB = speedMBps * elapsedSeconds;

  // Calculate progress percentage
  const progress = (downloadedMB / sizeInMB) * 100;

  return Math.min(100, Math.max(0, progress));
};

/**
 * Calculate bandwidth share for each download
 * @param {number} activeDownloads - Number of concurrent downloads
 * @returns {number} Bandwidth share per download (0-1)
 */
export const calculateBandwidthShare = (activeDownloads) => {
  if (activeDownloads <= 0) return 1.0;
  return 1.0 / activeDownloads;
};

/**
 * Estimate download time
 * @param {number} sizeInMB - File size in MB
 * @param {number} speedMbps - Network speed in Mbps
 * @param {number} bandwidthShare - Bandwidth share
 * @returns {number} Estimated time in seconds
 */
export const estimateDownloadTime = (sizeInMB, speedMbps, bandwidthShare = 1.0) => {
  const speedMBps = (speedMbps / 8) * bandwidthShare;
  return Math.ceil(sizeInMB / speedMBps);
};

/**
 * Check if download is complete
 * @param {number} progress - Progress percentage
 * @returns {boolean} Download complete
 */
export const isDownloadComplete = (progress) => {
  return progress >= 100;
};

/**
 * Update queue item progress
 * @param {object} item - Queue item
 * @param {number} progress - New progress (0-100)
 * @returns {object} Updated item
 */
export const updateQueueItemProgress = (item, progress) => {
  if (isDownloadComplete(progress) && item.status === 'downloading') {
    return {
      ...item,
      progress: 100,
      status: 'complete',
    };
  }

  return {
    ...item,
    progress: Math.min(100, progress),
  };
};

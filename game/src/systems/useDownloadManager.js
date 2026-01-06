/**
 * useDownloadManager Hook - Manages download queue with real progress
 *
 * Updates download progress based on:
 * - File size
 * - Available network bandwidth
 * - Number of concurrent downloads (bandwidth sharing)
 *
 * Handles download lifecycle:
 * 1. downloading (0-100% progress)
 * 2. installing (brief installation phase)
 * 3. complete (ready to use)
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  calculateDownloadProgress,
  calculateBandwidthShare,
} from './InstallationSystem';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateAvailableBandwidth,
} from './NetworkBandwidthSystem';
import triggerEventBus from '../core/triggerEventBus';

// Progress update interval in ms
const PROGRESS_UPDATE_INTERVAL = 100;

// Installation duration after download completes (ms)
const INSTALLATION_DURATION = 1000;

// Time to keep completed item in queue before removing (ms)
const COMPLETED_DISPLAY_DURATION = 2000;

/**
 * Hook to manage download queue with progress based on game time
 *
 * @param {array} downloadQueue - Current download queue
 * @param {function} setDownloadQueue - State setter for download queue
 * @param {object} hardware - Player's hardware (for network adapter speed)
 * @param {function} onDownloadComplete - Callback when download completes (receives softwareId)
 * @param {Date} currentTime - Current game time
 * @param {boolean} enabled - Whether download management is enabled (default: true)
 */
export const useDownloadManager = (
  downloadQueue,
  setDownloadQueue,
  hardware,
  onDownloadComplete,
  currentTime,
  enabled = true
) => {
  const intervalRef = useRef(null);
  const completedItemsRef = useRef(new Set());

  // Update progress for all active downloads
  const updateDownloadProgress = useCallback(() => {
    if (!enabled || !downloadQueue || downloadQueue.length === 0 || !currentTime) {
      return;
    }

    const now = currentTime.getTime();
    const activeDownloads = downloadQueue.filter(
      (item) => item.status === 'downloading'
    );

    if (activeDownloads.length === 0) {
      return;
    }

    // Calculate bandwidth share
    const bandwidthShare = calculateBandwidthShare(activeDownloads.length);

    // Get effective network speed (minimum of adapter and connection)
    const adapterSpeed = getAdapterSpeed(hardware);
    const connectionSpeed = getNetworkBandwidth();
    const effectiveSpeed = calculateAvailableBandwidth(
      adapterSpeed,
      connectionSpeed,
      1 // Base operations (bandwidth share handles multiple downloads)
    );

    setDownloadQueue((prevQueue) =>
      prevQueue.map((item) => {
        // Skip non-downloading items
        if (item.status !== 'downloading') {
          return item;
        }

        // Calculate elapsed time using game time
        const elapsedMs = now - item.startTime;

        // Calculate new progress
        const newProgress = calculateDownloadProgress(
          elapsedMs,
          item.sizeInMB,
          effectiveSpeed,
          bandwidthShare
        );

        // Check if download is complete
        if (newProgress >= 100) {
          console.log(`✅ [DOWNLOAD] Download complete for ${item.softwareName}, transitioning to installing`);
          // Transition to installing
          return {
            ...item,
            progress: 100,
            status: 'installing',
            installStartTime: now,
          };
        }

        return {
          ...item,
          progress: newProgress,
        };
      })
    );
  }, [enabled, downloadQueue, hardware, setDownloadQueue]);
  // NOTE: currentTime intentionally NOT in dependencies to prevent interval from restarting
  // on every time change. We access it fresh each time the function runs.

  // Handle installation completion
  const handleInstallations = useCallback(() => {
    if (!enabled || !downloadQueue || downloadQueue.length === 0 || !currentTime) {
      return;
    }

    const now = currentTime.getTime();
    const installingItems = downloadQueue.filter(
      (item) => item.status === 'installing'
    );

    installingItems.forEach((item) => {
      const installElapsed = now - (item.installStartTime || now);

      if (installElapsed >= INSTALLATION_DURATION) {
        console.log(`🔧 [DOWNLOAD] Installation complete for ${item.softwareName}`);
        // Mark as complete
        setDownloadQueue((prevQueue) =>
          prevQueue.map((qItem) =>
            qItem.id === item.id
              ? { ...qItem, status: 'complete', completedTime: now }
              : qItem
          )
        );

        // Track completed items to avoid duplicate callbacks
        if (!completedItemsRef.current.has(item.id)) {
          completedItemsRef.current.add(item.id);

          // Emit software installed event
          triggerEventBus.emit('softwareInstalled', {
            softwareId: item.softwareId,
            softwareName: item.softwareName,
          });

          // Call completion callback
          if (onDownloadComplete) {
            onDownloadComplete(item.softwareId, item.softwareName);
          }
        }
      }
    });
  }, [enabled, downloadQueue, setDownloadQueue, onDownloadComplete]);
  // NOTE: currentTime intentionally NOT in dependencies

  // Remove completed items after display duration
  const cleanupCompletedItems = useCallback(() => {
    if (!enabled || !downloadQueue || downloadQueue.length === 0 || !currentTime) {
      return;
    }

    const now = currentTime.getTime();

    setDownloadQueue((prevQueue) =>
      prevQueue.filter((item) => {
        if (item.status === 'complete' && item.completedTime) {
          const displayElapsed = now - item.completedTime;
          if (displayElapsed >= COMPLETED_DISPLAY_DURATION) {
            // Clean up tracking
            completedItemsRef.current.delete(item.id);
            return false; // Remove from queue
          }
        }
        return true; // Keep in queue
      })
    );
  }, [enabled, downloadQueue, setDownloadQueue]);
  // NOTE: currentTime intentionally NOT in dependencies

  // Store latest versions of functions in refs to avoid stale closures
  const updateDownloadProgressRef = useRef();
  const handleInstallationsRef = useRef();
  const cleanupCompletedItemsRef = useRef();

  // Update refs whenever functions change
  useEffect(() => {
    updateDownloadProgressRef.current = updateDownloadProgress;
    handleInstallationsRef.current = handleInstallations;
    cleanupCompletedItemsRef.current = cleanupCompletedItems;
  }, [updateDownloadProgress, handleInstallations, cleanupCompletedItems]);

  // Main update loop using requestAnimationFrame instead of setInterval
  // This ensures updates happen every frame and sync properly with game time
  // We use refs to access the latest function versions without adding them to dependencies
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let animationFrameId;
    const animate = () => {
      // Use refs to always call the latest versions of functions
      updateDownloadProgressRef.current?.();
      handleInstallationsRef.current?.();
      cleanupCompletedItemsRef.current?.();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [enabled]);

  // Reset completed tracking when queue is cleared
  useEffect(() => {
    if (!downloadQueue || downloadQueue.length === 0) {
      completedItemsRef.current.clear();
    }
  }, [downloadQueue]);
};

/**
 * Create a download queue item with proper structure
 *
 * @param {string} softwareId - Software ID
 * @param {string} softwareName - Software display name
 * @param {number} sizeInMB - Download size in megabytes
 * @param {Date} currentTime - Current game time to use as start time
 * @returns {object} Download queue item
 */
export const createDownloadItem = (softwareId, softwareName, sizeInMB, currentTime) => {
  const timestamp = currentTime ? currentTime.getTime() : Date.now();
  return {
    id: `download-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    softwareId,
    softwareName,
    sizeInMB: sizeInMB || 50, // Default 50MB if not specified
    progress: 0,
    status: 'downloading',
    startTime: timestamp,
  };
};

export default useDownloadManager;

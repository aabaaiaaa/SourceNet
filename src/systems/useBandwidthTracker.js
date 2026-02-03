/**
 * useBandwidthTracker Hook - Central bandwidth operations management
 *
 * Tracks all bandwidth-using operations across the game:
 * - Software downloads
 * - File operations (copy, repair)
 * - Network scans
 *
 * Provides:
 * - Current bandwidth usage percentage
 * - Available bandwidth for new operations
 * - Operation registration/completion
 */

import { useState, useCallback, useMemo } from 'react';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateTransferSpeed,
  calculateOperationTime,
} from './NetworkBandwidthSystem';

/**
 * Operation types that use bandwidth
 */
export const BANDWIDTH_OPERATION_TYPES = {
  DOWNLOAD: 'download',
  FILE_COPY: 'file_copy',
  FILE_REPAIR: 'file_repair',
  NETWORK_SCAN: 'network_scan',
};

/**
 * Default data sizes for operations (in MB)
 */
export const OPERATION_SIZES = {
  [BANDWIDTH_OPERATION_TYPES.FILE_COPY]: 2, // 2 MB per file copy
  [BANDWIDTH_OPERATION_TYPES.FILE_REPAIR]: 1, // 1 MB per file repair
  [BANDWIDTH_OPERATION_TYPES.NETWORK_SCAN]: 5, // Default fallback, actual size calculated from device count
};

/**
 * Create a bandwidth operation object
 */
export const createBandwidthOperation = (type, id, sizeInMB, metadata = {}) => {
  return {
    id: id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    sizeInMB,
    progress: 0,
    startTime: Date.now(),
    status: 'active', // 'active', 'complete'
    metadata,
  };
};

/**
 * Hook to track bandwidth operations
 *
 * @param {object} hardware - Player's hardware for adapter speed
 * @param {Array} activeConnections - Active network connections
 * @returns {object} Bandwidth tracking state and functions
 */
export const useBandwidthTracker = (hardware, activeConnections = []) => {
  const [operations, setOperations] = useState([]);

  // Get network speeds
  const adapterSpeed = getAdapterSpeed(hardware);
  const connectionSpeed = getNetworkBandwidth(activeConnections);
  const maxBandwidth = Math.min(adapterSpeed, connectionSpeed);

  // Calculate active operations count
  const activeOperations = useMemo(() => {
    return operations.filter((op) => op.status === 'active');
  }, [operations]);

  // Calculate bandwidth per operation
  const bandwidthPerOperation = useMemo(() => {
    if (activeOperations.length === 0) return maxBandwidth;
    return maxBandwidth / activeOperations.length;
  }, [activeOperations.length, maxBandwidth]);

  // Calculate current bandwidth usage percentage
  const bandwidthUsagePercent = useMemo(() => {
    if (activeOperations.length === 0) return 0;
    // Each active operation uses its share of bandwidth
    return Math.min(100, (activeOperations.length / 4) * 100); // Cap at 4 operations = 100%
  }, [activeOperations.length]);

  // Calculate transfer speed in MB/s
  const currentTransferSpeed = useMemo(() => {
    return calculateTransferSpeed(bandwidthPerOperation);
  }, [bandwidthPerOperation]);

  // Register a new bandwidth operation
  const registerOperation = useCallback((type, sizeInMB, metadata = {}) => {
    const operation = createBandwidthOperation(type, null, sizeInMB, metadata);

    setOperations((prev) => [...prev, operation]);

    // Calculate estimated time based on current bandwidth share
    const newOperationCount = activeOperations.length + 1;
    const newBandwidthShare = maxBandwidth / newOperationCount;
    const transferSpeed = calculateTransferSpeed(newBandwidthShare);
    const estimatedTime = calculateOperationTime(sizeInMB, transferSpeed);

    return {
      operationId: operation.id,
      estimatedTimeMs: estimatedTime * 1000,
      bandwidthShare: newBandwidthShare,
      transferSpeedMBps: transferSpeed,
    };
  }, [activeOperations.length, maxBandwidth]);

  // Complete an operation
  const completeOperation = useCallback((operationId) => {
    setOperations((prev) =>
      prev.map((op) =>
        op.id === operationId
          ? { ...op, status: 'complete', progress: 100 }
          : op
      )
    );

    // Clean up completed operations after a short delay
    setTimeout(() => {
      setOperations((prev) => prev.filter((op) => op.id !== operationId));
    }, 500);
  }, []);

  // Update operation progress
  const updateOperationProgress = useCallback((operationId, progress) => {
    setOperations((prev) =>
      prev.map((op) =>
        op.id === operationId ? { ...op, progress } : op
      )
    );
  }, []);

  // Cancel an operation
  const cancelOperation = useCallback((operationId) => {
    setOperations((prev) => prev.filter((op) => op.id !== operationId));
  }, []);

  // Get estimated time for a new operation (without registering)
  const getEstimatedTime = useCallback((sizeInMB) => {
    const newOperationCount = activeOperations.length + 1;
    const newBandwidthShare = maxBandwidth / newOperationCount;
    const transferSpeed = calculateTransferSpeed(newBandwidthShare);
    return calculateOperationTime(sizeInMB, transferSpeed) * 1000; // Return in ms
  }, [activeOperations.length, maxBandwidth]);

  return {
    // State
    operations,
    activeOperations,
    activeOperationCount: activeOperations.length,

    // Bandwidth info
    maxBandwidth,
    bandwidthPerOperation,
    bandwidthUsagePercent,
    currentTransferSpeed,

    // Actions
    registerOperation,
    completeOperation,
    updateOperationProgress,
    cancelOperation,
    getEstimatedTime,
  };
};

export default useBandwidthTracker;

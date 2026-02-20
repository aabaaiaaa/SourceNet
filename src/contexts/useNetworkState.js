/**
 * useNetworkState - Network state and pure actions.
 *
 * Extracted from GameContext to reduce file size.
 * Manages connections, discovered devices, file clipboard, local SSD,
 * bandwidth operations, relay/trace state, and file system operations.
 *
 * Cross-domain effects (mission tracking, VPN initiation) remain
 * in GameContext because they reference other domain state.
 */

import { useState, useCallback } from 'react';
import networkRegistry from '../systems/NetworkRegistry';

export function useNetworkState() {
  // Core network state
  const [activeConnections, setActiveConnections] = useState([]);
  const [lastScanResults, setLastScanResults] = useState(null);
  const [discoveredDevices, setDiscoveredDevices] = useState({});
  const [fileManagerConnections, setFileManagerConnections] = useState([]);
  const [lastFileOperation, setLastFileOperation] = useState(null);

  // File clipboard (shared across FileManager instances, cleared on disconnect)
  const [fileClipboard, setFileClipboard] = useState({ files: [], sourceFileSystemId: '', sourceNetworkId: '' });

  // Local SSD files (files stored on the player's terminal)
  const [localSSDFiles, setLocalSSDFiles] = useState([]);

  // Known malicious files detected by antivirus
  const [knownMaliciousFiles, setKnownMaliciousFiles] = useState([]);

  // Bandwidth operations (non-download operations that use bandwidth)
  const [bandwidthOperations, setBandwidthOperations] = useState([]);

  // Relay & trace system
  const [relayNodes, setRelayNodes] = useState([]);
  const [activeRelayChain, setActiveRelayChain] = useState([]);
  const [traceState, setTraceState] = useState(null);
  const [rebuildCount, setRebuildCount] = useState(0);

  // --- Pure actions ---

  const clearFileClipboard = useCallback(() => {
    setFileClipboard({ files: [], sourceFileSystemId: '', sourceNetworkId: '' });
  }, []);

  const updateFileSystemFiles = useCallback((networkId, fileSystemId, updatedFiles) => {
    console.log(`📁 updateFileSystemFiles called: networkId=${networkId}, fsId=${fileSystemId}, fileCount=${updatedFiles?.length}`);
    const prevFs = networkRegistry.getFileSystem(fileSystemId);
    const prevFileCount = prevFs?.files?.length;
    const success = networkRegistry.updateFiles(fileSystemId, updatedFiles);
    if (success) {
      console.log(`📁 Updated fs ${fileSystemId} files from ${prevFileCount} to ${updatedFiles?.length}`);
    } else {
      console.warn(`📁 Failed to update fs ${fileSystemId} - not found in registry`);
    }
  }, []);

  const addFilesToFileSystem = useCallback((networkId, fileSystemId, newFiles) => {
    console.log(`📁 addFilesToFileSystem called: networkId=${networkId}, fsId=${fileSystemId}, newFileCount=${newFiles?.length}`);
    const success = networkRegistry.addFilesToFileSystem(fileSystemId, newFiles);
    if (success) {
      console.log(`📁 Added ${newFiles?.length} files to fs ${fileSystemId}`);
    } else {
      console.warn(`📁 Failed to add files to fs ${fileSystemId} - not found in registry`);
    }
    return success;
  }, []);

  const addDiscoveredDevices = useCallback((networkId, ips) => {
    setDiscoveredDevices((prev) => {
      const existingIps = prev[networkId] || new Set();
      const updatedIps = new Set([...existingIps, ...ips]);
      return { ...prev, [networkId]: updatedIps };
    });
  }, []);

  const addFileToLocalSSD = useCallback((file) => {
    setLocalSSDFiles((prev) => [...prev, file]);
  }, []);

  const removeFileFromLocalSSD = useCallback((fileName) => {
    setLocalSSDFiles((prev) => prev.filter(f => f.name !== fileName));
  }, []);

  const replaceFileOnLocalSSD = useCallback((oldName, newFile) => {
    setLocalSSDFiles((prev) => prev.map(f => f.name === oldName ? newFile : f));
  }, []);

  const addKnownMaliciousFile = useCallback((fileName, sourceFileSystemId) => {
    setKnownMaliciousFiles((prev) => {
      const exists = prev.some(
        (f) => f.fileName === fileName && f.sourceFileSystemId === sourceFileSystemId
      );
      if (exists) return prev;
      return [...prev, { fileName, sourceFileSystemId }];
    });
  }, []);

  const completeBandwidthOperation = useCallback((operationId) => {
    setBandwidthOperations((prev) => prev.filter((op) => op.id !== operationId));
  }, []);

  const updateBandwidthOperationProgress = useCallback((operationId, progress) => {
    setBandwidthOperations((prev) =>
      prev.map((op) => op.id === operationId ? { ...op, progress } : op)
    );
  }, []);

  return {
    // State + setters
    activeConnections, setActiveConnections,
    lastScanResults, setLastScanResults,
    discoveredDevices, setDiscoveredDevices,
    fileManagerConnections, setFileManagerConnections,
    lastFileOperation, setLastFileOperation,
    fileClipboard, setFileClipboard,
    localSSDFiles, setLocalSSDFiles,
    knownMaliciousFiles, setKnownMaliciousFiles,
    bandwidthOperations, setBandwidthOperations,
    relayNodes, setRelayNodes,
    activeRelayChain, setActiveRelayChain,
    traceState, setTraceState,
    rebuildCount, setRebuildCount,
    // Actions
    clearFileClipboard,
    updateFileSystemFiles,
    addFilesToFileSystem,
    addDiscoveredDevices,
    addFileToLocalSSD,
    removeFileFromLocalSSD,
    replaceFileOnLocalSSD,
    addKnownMaliciousFile,
    completeBandwidthOperation,
    updateBandwidthOperationProgress,
  };
}

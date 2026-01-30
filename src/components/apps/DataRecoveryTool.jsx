import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import {
  calculateScanDuration,
  getDiscoveredDeletedFiles,
  calculateOperationDuration,
} from '../../systems/DataRecoverySystem';
import './DataRecoveryTool.css';

const DataRecoveryTool = () => {
  const { activeConnections, currentTime, discoveredDevices } = useGame();

  // State
  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [currentNetworkId, setCurrentNetworkId] = useState('');
  const [allFiles, setAllFiles] = useState([]); // All files including deleted
  const [scannedDeletedFiles, setScannedDeletedFiles] = useState(new Set()); // Deleted files discovered by scan
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set()); // Selected file names
  const [operatingFiles, setOperatingFiles] = useState(new Set()); // File names being operated on
  const [operationProgress, setOperationProgress] = useState({}); // Progress per file name
  const [operationTypes, setOperationTypes] = useState({}); // Operation type per file name
  const [disconnectionMessage, setDisconnectionMessage] = useState(null);

  // Refs
  const scanAnimationRef = useRef(null);
  const scanStartTimeRef = useRef(null);
  const scanDurationRef = useRef(0);
  const activeOperationsRef = useRef(new Map()); // Map of fileName -> operation data

  // Get network bandwidth from NetworkRegistry
  const getNetworkBandwidth = useCallback((networkId) => {
    const network = networkRegistry.getNetwork(networkId);
    return network?.bandwidth || 50;
  }, []);

  // Build list of available file systems from connected networks
  const availableFileSystems = useMemo(() => {
    const fileSystems = [];

    if (!activeConnections) return fileSystems;

    activeConnections.forEach((connection) => {
      const network = networkRegistry.getNetwork(connection.networkId);
      const discoveredData = discoveredDevices?.[connection.networkId];
      const discovered = discoveredData instanceof Set ? discoveredData : new Set(discoveredData || []);

      if (network && network.accessible) {
        const accessibleDevices = networkRegistry.getAccessibleDevices(connection.networkId);

        accessibleDevices.forEach((device) => {
          if (discovered.has(device.ip) && device.fileSystemId) {
            const fs = networkRegistry.getFileSystem(device.fileSystemId);
            if (fs) {
              fileSystems.push({
                id: fs.id,
                ip: device.ip,
                name: device.hostname,
                label: `${device.ip} - ${device.hostname}`,
                files: fs.files || [],
                networkId: connection.networkId,
              });
            }
          }
        });
      }
    });

    return fileSystems;
  }, [activeConnections, discoveredDevices]);

  // Handle network disconnection
  useEffect(() => {
    const handleDisconnect = ({ networkId, networkName }) => {
      if (currentNetworkId === networkId) {
        // Cancel any ongoing scan
        if (scanAnimationRef.current) {
          cancelAnimationFrame(scanAnimationRef.current);
          scanAnimationRef.current = null;
        }

        // Cancel any ongoing operations
        activeOperationsRef.current.clear();

        // Clear state
        setSelectedFileSystem('');
        setCurrentNetworkId('');
        setAllFiles([]);
        setScannedDeletedFiles(new Set());
        setScanProgress(0);
        setScanning(false);
        setSelectedFiles(new Set());
        setOperatingFiles(new Set());
        setOperationProgress({});
        setOperationTypes({});
        setDisconnectionMessage(`Disconnected from ${networkName}`);
      }
    };

    triggerEventBus.on('networkDisconnected', handleDisconnect);
    return () => triggerEventBus.off('networkDisconnected', handleDisconnect);
  }, [currentNetworkId]);

  // Auto-clear disconnection message
  useEffect(() => {
    if (disconnectionMessage) {
      const timer = setTimeout(() => setDisconnectionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [disconnectionMessage]);

  // Subscribe to fileSystemChanged events
  useEffect(() => {
    const handleFileSystemChanged = ({ fileSystemId, files }) => {
      if (selectedFileSystem === fileSystemId) {
        setAllFiles(files.map(f => ({ ...f })));
      }
    };

    triggerEventBus.on('fileSystemChanged', handleFileSystemChanged);
    return () => triggerEventBus.off('fileSystemChanged', handleFileSystemChanged);
  }, [selectedFileSystem]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
    };
  }, []);

  // Handle file system selection
  const handleFileSystemSelect = (fileSystemId) => {
    if (!fileSystemId) return;

    const fileSystem = availableFileSystems.find((fs) => fs.id === fileSystemId);
    if (!fileSystem) return;

    // Load all files from the file system (including deleted)
    setAllFiles(fileSystem.files.map(f => ({ ...f })));
    setSelectedFileSystem(fileSystemId);
    setCurrentNetworkId(fileSystem.networkId);

    // Clear previous state
    setScannedDeletedFiles(new Set());
    setScanProgress(0);
    setScanning(false);
    setSelectedFiles(new Set());
    setOperatingFiles(new Set());
    setOperationProgress({});
    setOperationTypes({});

    // Cancel any ongoing scan
    if (scanAnimationRef.current) {
      cancelAnimationFrame(scanAnimationRef.current);
      scanAnimationRef.current = null;
    }

    // Cancel any ongoing operations
    activeOperationsRef.current.clear();
  };

  // Start scan for deleted files
  const handleScan = () => {
    if (!selectedFileSystem || scanning || !currentTime) return;

    // Calculate scan duration based on total file system size (uses DataRecoverySystem)
    const scanDuration = calculateScanDuration(allFiles);

    scanStartTimeRef.current = currentTime.getTime();
    scanDurationRef.current = scanDuration;
    setScanning(true);
    setScanProgress(0);
    setScannedDeletedFiles(new Set());

    // Get deleted files to progressively discover
    const deletedFiles = allFiles.filter(f => f.status === 'deleted');

    const animate = () => {
      const now = currentTime.getTime();
      const elapsedGameMs = now - scanStartTimeRef.current;
      const progress = Math.min(100, (elapsedGameMs / scanDurationRef.current) * 100);
      setScanProgress(progress);

      // Progressively discover deleted files based on scan progress (uses DataRecoverySystem)
      const discoveredSoFar = getDiscoveredDeletedFiles(deletedFiles, progress);
      setScannedDeletedFiles(discoveredSoFar);

      if (progress >= 100) {
        setScanning(false);
        scanAnimationRef.current = null;
      } else {
        scanAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    scanAnimationRef.current = requestAnimationFrame(animate);
  };

  // Handle file selection
  const handleFileSelect = (fileName) => {
    if (operatingFiles.has(fileName)) return;

    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  // Calculate operation duration (wrapper that gets bandwidth from current network)
  const getOperationDuration = (file, operation) => {
    const bandwidth = getNetworkBandwidth(currentNetworkId);
    return calculateOperationDuration(file, operation, bandwidth);
  };

  // Animation loop for operations
  useEffect(() => {
    if (activeOperationsRef.current.size === 0 || !currentTime) return;

    const animate = () => {
      const now = currentTime.getTime();
      const updates = {};
      const completedOps = [];

      activeOperationsRef.current.forEach((opData, fileName) => {
        const elapsedGameMs = now - opData.startTime;
        const progress = Math.min(100, (elapsedGameMs / opData.duration) * 100);
        updates[fileName] = progress;

        if (progress >= 100) {
          completedOps.push({ fileName, operation: opData.operation });
        }
      });

      setOperationProgress(prev => ({ ...prev, ...updates }));

      // Handle completed operations
      completedOps.forEach(({ fileName, operation }) => {
        activeOperationsRef.current.delete(fileName);

        if (operation === 'restore') {
          networkRegistry.restoreFiles(selectedFileSystem, [fileName]);
          // Remove from scanned deleted files
          setScannedDeletedFiles(prev => {
            const next = new Set(prev);
            next.delete(fileName);
            return next;
          });
        } else if (operation === 'secure-delete') {
          networkRegistry.secureDeleteFiles(selectedFileSystem, [fileName]);
          // Remove from scanned deleted files if it was there
          setScannedDeletedFiles(prev => {
            const next = new Set(prev);
            next.delete(fileName);
            return next;
          });
        }

        // Clean up state
        setOperatingFiles(prev => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });

        setOperationProgress(prev => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });

        setOperationTypes(prev => {
          const next = { ...prev };
          delete next[fileName];
          return next;
        });

        setSelectedFiles(prev => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });
      });

      if (activeOperationsRef.current.size > 0) {
        requestAnimationFrame(animate);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [operatingFiles.size, currentTime, selectedFileSystem]);

  // Handle restore operation
  const handleRestore = () => {
    if (!currentTime || selectedFiles.size === 0) return;

    const filesToRestore = allFiles.filter(
      f => selectedFiles.has(f.name) && f.status === 'deleted' && scannedDeletedFiles.has(f.name)
    );

    if (filesToRestore.length === 0) return;

    filesToRestore.forEach(file => {
      const duration = getOperationDuration(file, 'restore');

      activeOperationsRef.current.set(file.name, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'restore',
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, file.name]));
      setOperationProgress(prev => ({ ...prev, [file.name]: 0 }));
      setOperationTypes(prev => ({ ...prev, [file.name]: 'restore' }));
    });
  };

  // Handle secure delete operation
  const handleSecureDelete = () => {
    if (!currentTime || selectedFiles.size === 0) return;

    // Can secure delete normal files or discovered deleted files
    const filesToDelete = allFiles.filter(f => {
      if (!selectedFiles.has(f.name)) return false;
      if (f.status === 'deleted') {
        return scannedDeletedFiles.has(f.name);
      }
      return !f.status || f.status === 'normal';
    });

    if (filesToDelete.length === 0) return;

    filesToDelete.forEach(file => {
      const duration = getOperationDuration(file, 'secure-delete');

      activeOperationsRef.current.set(file.name, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'secure-delete',
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, file.name]));
      setOperationProgress(prev => ({ ...prev, [file.name]: 0 }));
      setOperationTypes(prev => ({ ...prev, [file.name]: 'secure-delete' }));
    });
  };

  // Get visible files (normal files + discovered deleted files)
  const visibleFiles = useMemo(() => {
    return allFiles.filter(f => {
      if (!f.status || f.status === 'normal') return true;
      if (f.status === 'deleted') return scannedDeletedFiles.has(f.name);
      return false;
    });
  }, [allFiles, scannedDeletedFiles]);

  // Count stats
  const normalCount = visibleFiles.filter(f => !f.status || f.status === 'normal').length;
  const deletedCount = visibleFiles.filter(f => f.status === 'deleted').length;
  const totalDeletedOnDisk = allFiles.filter(f => f.status === 'deleted').length;

  // Selected file stats
  const selectedNormalFiles = visibleFiles.filter(
    f => selectedFiles.has(f.name) && (!f.status || f.status === 'normal')
  );
  const selectedDeletedFiles = visibleFiles.filter(
    f => selectedFiles.has(f.name) && f.status === 'deleted'
  );

  const hasOperations = operatingFiles.size > 0;
  const hasConnectedNetworks = activeConnections && activeConnections.length > 0;

  return (
    <div className="data-recovery-tool">
      <div className="data-recovery-header">
        <h2>Data Recovery Tool</h2>
        <p className="data-recovery-subtitle">File System Recovery & Secure Deletion</p>
      </div>

      {disconnectionMessage && (
        <div className="data-recovery-disconnection-message">
          {disconnectionMessage}
        </div>
      )}

      {!hasConnectedNetworks ? (
        <div className="data-recovery-no-networks">
          No networks connected. Use the VPN Client to connect to a network first.
        </div>
      ) : availableFileSystems.length === 0 ? (
        <div className="data-recovery-no-networks">
          No devices found. Use the Network Scanner to discover devices first.
        </div>
      ) : (
        <>
          <div className="data-recovery-controls">
            <label>
              File System:
              <select
                value={selectedFileSystem}
                onChange={(e) => {
                  setSelectedFileSystem(e.target.value);
                  if (e.target.value) handleFileSystemSelect(e.target.value);
                }}
                disabled={scanning || hasOperations}
              >
                <option value="">Select file system</option>
                {availableFileSystems.map((fs) => (
                  <option key={fs.id} value={fs.id}>
                    {fs.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedFileSystem && (
            <>
              <div className="scan-section">
                <button
                  className="data-recovery-btn"
                  onClick={handleScan}
                  disabled={!selectedFileSystem || scanning || hasOperations}
                >
                  {scanning ? 'Scanning...' : 'Scan for Deleted Files'}
                </button>

                {scanning && (
                  <div className="scan-progress-container">
                    <div className="scan-progress-bar">
                      <div
                        className="scan-progress-fill"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <span className="scan-progress-text">
                      Scanning... {Math.floor(scanProgress)}% ({scannedDeletedFiles.size} deleted files found)
                    </span>
                  </div>
                )}
              </div>

              {scanProgress >= 100 && totalDeletedOnDisk > 0 && deletedCount === 0 && (
                <div className="scan-required-message">
                  Scan complete. No deleted files found on this file system.
                </div>
              )}

              {scanProgress > 0 && scanProgress < 100 && !scanning && (
                <div className="scan-required-message">
                  Scan interrupted. Click "Scan for Deleted Files" to rescan.
                </div>
              )}

              <div className="data-recovery-toolbar">
                <button
                  className="restore"
                  onClick={handleRestore}
                  disabled={hasOperations || selectedDeletedFiles.length === 0}
                >
                  Restore ({selectedDeletedFiles.length})
                </button>
                <button
                  className="secure-delete"
                  onClick={handleSecureDelete}
                  disabled={hasOperations || (selectedNormalFiles.length === 0 && selectedDeletedFiles.length === 0)}
                >
                  Secure Delete ({selectedNormalFiles.length + selectedDeletedFiles.length})
                </button>
              </div>

              {visibleFiles.length > 0 && (
                <div className="file-count-summary">
                  <span className="normal-count">{normalCount} normal</span>
                  <span className="deleted-count">{deletedCount} deleted (found by scan)</span>
                </div>
              )}

              <div className="data-recovery-file-list">
                {visibleFiles.length === 0 ? (
                  <div className="data-recovery-empty">
                    {scanProgress === 0
                      ? 'Click "Scan for Deleted Files" to search for recoverable files.'
                      : 'No files found on this file system.'}
                  </div>
                ) : (
                  visibleFiles.map((file) => {
                    const isDeleted = file.status === 'deleted';
                    const isSelected = selectedFiles.has(file.name);
                    const isOperating = operatingFiles.has(file.name);
                    const progress = operationProgress[file.name] || 0;
                    const operation = operationTypes[file.name];

                    return (
                      <div
                        key={file.name}
                        className={`data-recovery-file-item ${isDeleted ? 'deleted' : ''} ${isSelected ? 'selected' : ''} ${isOperating ? 'operating' : ''}`}
                        onClick={() => !isOperating && handleFileSelect(file.name)}
                        style={{ cursor: isOperating ? 'default' : 'pointer' }}
                      >
                        <span className="status-icon">
                          {isDeleted ? '🗑️' : '📄'}
                        </span>
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{file.size}</span>
                        <span className={`file-status ${isDeleted ? 'deleted' : 'normal'}`}>
                          {isDeleted ? 'DELETED' : 'NORMAL'}
                        </span>

                        {isOperating && (
                          <div className="file-operation-progress">
                            <div className="file-operation-bar">
                              <div
                                className={`file-operation-fill ${operation}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="file-operation-text">
                              {operation === 'restore' ? 'Restoring' : 'Secure Deleting'}... {Math.floor(progress)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DataRecoveryTool;

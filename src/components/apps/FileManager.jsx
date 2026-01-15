import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import './FileManager.css';

const FileManager = () => {
  const game = useGame();
  const { currentTime } = game;
  const setFileManagerConnections = game.setFileManagerConnections || (() => { });
  const setLastFileOperation = game.setLastFileOperation || (() => { });
  const registerBandwidthOperation = game.registerBandwidthOperation || (() => ({ operationId: null, estimatedTimeMs: 2000 }));
  const completeBandwidthOperation = game.completeBandwidthOperation || (() => { });
  const narEntries = game.narEntries || [];
  const activeConnections = game.activeConnections || [];
  const discoveredDevices = game.discoveredDevices || {};
  const fileClipboard = game.fileClipboard || { files: [], sourceFileSystemId: '', sourceNetworkId: '' };
  const setFileClipboard = game.setFileClipboard || (() => { });
  const updateFileSystemFiles = game.updateFileSystemFiles || (() => { });

  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [currentNetworkId, setCurrentNetworkId] = useState('');
  const [files, setFiles] = useState([]);
  const [operatingFiles, setOperatingFiles] = useState(new Set()); // Files currently being operated on
  const [fileProgress, setFileProgress] = useState({}); // Progress for each file operation
  const [fileOperations, setFileOperations] = useState({}); // Track operation type per file
  const [activityLog, setActivityLog] = useState([]); // Ephemeral activity log (clears on unmount)
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const animationFrameRef = useRef(null);
  const activeOperationsRef = useRef(new Map()); // Map of fileIndex -> {startTime, duration, operation, operationId}
  const logEndRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const logIdCounterRef = useRef(0);

  // Keep currentTimeRef up to date
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Add entry to activity log
  const addLogEntry = useCallback((entry) => {
    logIdCounterRef.current += 1;
    const logEntry = {
      id: `${Date.now()}-${logIdCounterRef.current}`,
      timestamp: currentTimeRef.current ? new Date(currentTimeRef.current).toLocaleTimeString() : new Date().toLocaleTimeString(),
      ...entry,
    };
    setActivityLog(prev => [...prev, logEntry]);
  }, []);

  // Refs to track current values for use in event handlers
  const availableFileSystemsRef = useRef([]);
  const selectedFileSystemRef = useRef('');
  const currentNetworkIdRef = useRef('');

  // Subscribe to sabotage file operations from scripted events
  useEffect(() => {
    const handleSabotageOperation = (data) => {
      // Find target file system if specified, otherwise use current
      const fileSystems = availableFileSystemsRef.current;
      const targetFs = data.fileSystemId
        ? fileSystems.find(fs => fs.id === data.fileSystemId)
        : fileSystems.find(fs => fs.id === selectedFileSystemRef.current);
      addLogEntry({
        fileName: data.fileName,
        operation: data.operation,
        source: data.source || 'UNKNOWN',
        isSabotage: true,
        location: targetFs ? `${targetFs.ip} (${targetFs.name})` : (data.fileSystemId || 'UNKNOWN'),
      });
    };

    triggerEventBus.on('sabotageFileOperation', handleSabotageOperation);

    return () => {
      triggerEventBus.off('sabotageFileOperation', handleSabotageOperation);
    };
  }, [addLogEntry]);

  // Auto-scroll log to bottom when new entries added
  useEffect(() => {
    if (logEndRef.current && !isLogCollapsed && logEndRef.current.scrollIntoView) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLog, isLogCollapsed]);

  // Animation loop for file operation progress using game time
  useEffect(() => {
    if (activeOperationsRef.current.size === 0 || !currentTime) return;

    const animate = () => {
      const now = currentTime.getTime();
      const updates = {};
      const completedOps = [];

      activeOperationsRef.current.forEach((opData, fileIndex) => {
        const elapsedGameMs = now - opData.startTime;
        const progress = Math.min(100, (elapsedGameMs / opData.duration) * 100);
        updates[fileIndex] = progress;

        if (progress >= 100) {
          completedOps.push({ fileIndex, operation: opData.operation, operationId: opData.operationId, fileName: opData.fileName });
        }
      });

      setFileProgress(prev => ({ ...prev, ...updates }));

      // Handle completed operations - sort deletes by index descending to avoid index shifting issues
      const sortedCompletedOps = completedOps.sort((a, b) => {
        if (a.operation === 'delete' && b.operation === 'delete') {
          return b.fileIndex - a.fileIndex; // Delete from highest index first
        }
        return 0;
      });

      // Handle completed operations
      sortedCompletedOps.forEach(({ fileIndex, operation, operationId, fileName }) => {
        console.log(`✅ Operation complete: ${operation} on ${fileName} (index ${fileIndex})`);
        activeOperationsRef.current.delete(fileIndex);

        if (operationId) {
          completeBandwidthOperation(operationId);
        }

        // Update file state based on operation
        setFiles(prevFiles => {
          const newFiles = [...prevFiles];
          if (operation === 'repair') {
            newFiles[fileIndex] = { ...newFiles[fileIndex], corrupted: false, selected: false };
          } else if (operation === 'delete') {
            newFiles.splice(fileIndex, 1);
          } else if (operation === 'copy') {
            newFiles[fileIndex] = { ...newFiles[fileIndex], selected: false };
          } else if (operation === 'paste') {
            // File already added to array when operation started
            newFiles[fileIndex] = { ...newFiles[fileIndex], selected: false };
          }

          // Schedule persistence outside of setState to avoid "Cannot update a component while rendering" error
          if (operation !== 'copy') {
            const networkId = currentNetworkIdRef.current;
            const fsId = selectedFileSystemRef.current;
            if (networkId && fsId) {
              // Strip selection state before persisting
              const filesToPersist = newFiles.map(({ selected: _selected, ...rest }) => rest);
              // Use setTimeout to defer the context update until after this render cycle
              setTimeout(() => {
                console.log(`📁 Persisting ${operation} to narEntries: networkId=${networkId}, fsId=${fsId}, files=${filesToPersist.length}`);
                updateFileSystemFiles(networkId, fsId, filesToPersist);
              }, 0);
            }
          }

          return newFiles;
        });

        setOperatingFiles(prev => {
          const next = new Set(prev);
          next.delete(fileIndex);
          return next;
        });

        setFileProgress(prev => {
          const next = { ...prev };
          delete next[fileIndex];
          return next;
        });

        setFileOperations(prev => {
          const next = { ...prev };
          delete next[fileIndex];
          return next;
        });

        // Log completed operation (after all state updates)
        // Find the file system for location info (use refs since this runs in useEffect)
        const currentFs = availableFileSystemsRef.current.find(fs => fs.id === selectedFileSystemRef.current);
        addLogEntry({
          fileName: fileName,
          operation: operation.replace('-cross', ''),
          source: 'USER',
          isSabotage: false,
          location: currentFs ? `${currentFs.ip} (${currentFs.name})` : selectedFileSystemRef.current,
        });
      });

      // Emit events for completed operations
      if (completedOps.length > 0 && activeOperationsRef.current.size === 0) {
        // All operations complete
        const operation = completedOps[0].operation;
        const fileNames = completedOps.map(op => op.fileName);
        const eventData = {
          operation,
          filesAffected: completedOps.length,
          fileNames,
          fileSystem: selectedFileSystem,
        };
        setLastFileOperation(eventData);
        triggerEventBus.emit('fileOperationComplete', eventData);
      }

      if (activeOperationsRef.current.size > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [operatingFiles.size, currentTime, selectedFileSystem, completeBandwidthOperation, setLastFileOperation, addLogEntry]);

  // Parse file size string to MB (e.g., "2.5 KB" -> 0.0025, "150 MB" -> 150)
  const parseFileSizeToMB = (sizeStr) => {
    const match = sizeStr.match(/([0-9.]+)\s*(KB|MB|GB)/i);
    if (!match) return 1; // Default to 1MB if can't parse

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (unit === 'KB') return value / 1024;
    if (unit === 'MB') return value;
    if (unit === 'GB') return value * 1024;
    return value;
  };

  // Calculate operation duration based on file size and network bandwidth
  const calculateOperationDuration = (file, operation, bandwidth) => {
    const sizeInMB = parseFileSizeToMB(file.size);
    // Base: 1MB takes 1 second at 50 Mbps bandwidth
    // Adjust for actual bandwidth and operation type
    // Multipliers set higher for gameplay feel - operations should be visible
    const multipliers = { repair: 2, delete: 0.5, copy: 0.3, paste: 1.5 };
    const multiplier = multipliers[operation] || 1;

    // bandwidth in Mbps, convert to MB/s: bandwidth / 8
    const transferSpeedMBps = bandwidth / 8;
    // Time = size / speed, then apply multiplier
    const baseTimeSeconds = sizeInMB / transferSpeedMBps;
    // Minimum 2 seconds (2000ms) so progress bar is always visible
    return Math.max(2000, baseTimeSeconds * 1000 * multiplier);
  };

  // Get network bandwidth from NAR entry
  const getNetworkBandwidth = (networkId) => {
    const narEntry = narEntries.find(e => e.networkId === networkId);
    return narEntry?.bandwidth || 50; // Default 50 Mbps
  };

  // Get available file systems from connected networks
  const availableFileSystems = [];
  activeConnections.forEach((connection) => {
    const narEntry = narEntries.find((entry) => entry.networkId === connection.networkId);
    const discovered = discoveredDevices[connection.networkId] || new Set();

    if (narEntry && narEntry.fileSystems) {
      narEntry.fileSystems.forEach((fs) => {
        // Only include filesystems whose IP has been discovered via Network Scanner
        if (discovered.has(fs.ip)) {
          availableFileSystems.push({
            id: fs.id,
            ip: fs.ip,
            name: fs.name,
            label: `${fs.ip} - ${fs.name}`,
            files: fs.files || [],
            networkId: narEntry.networkId,
          });
        }
      });
    }
  });

  // Check if selected file system is still available (handles network disconnect)
  useEffect(() => {
    if (selectedFileSystem && availableFileSystems.length > 0) {
      const isStillAvailable = availableFileSystems.some(fs => fs.id === selectedFileSystem);
      if (!isStillAvailable) {
        // Selected file system no longer available - clear selection
        setSelectedFileSystem('');
        setFiles([]);
        setCurrentNetworkId(null);
        console.log(`📁 File system ${selectedFileSystem} no longer available - clearing`);
      }
    } else if (selectedFileSystem && availableFileSystems.length === 0) {
      // No networks connected - clear everything
      setSelectedFileSystem('');
      setFiles([]);
      setCurrentNetworkId(null);
    }
  }, [availableFileSystems, selectedFileSystem]);

  // Keep refs updated for use in event handlers (must be in useEffect, not during render)
  useEffect(() => {
    availableFileSystemsRef.current = availableFileSystems;
    selectedFileSystemRef.current = selectedFileSystem;
    currentNetworkIdRef.current = currentNetworkId;
  }, [availableFileSystems, selectedFileSystem, currentNetworkId]);

  const handleConnect = (fileSystemId = selectedFileSystem) => {
    if (!fileSystemId) return;

    // Find the selected file system
    const fileSystem = availableFileSystems.find((fs) => fs.id === fileSystemId);
    if (!fileSystem) return;

    // Load files from the file system with selection state
    setFiles(fileSystem.files.map(f => ({ ...f, selected: false })));
    setCurrentNetworkId(fileSystem.networkId);

    // Clear any ongoing operations
    activeOperationsRef.current.clear();
    setOperatingFiles(new Set());
    setFileProgress({});
    setFileOperations({});

    // Track file system connection for objective tracking
    const connection = {
      fileSystemId: fileSystemId,
      ip: fileSystem.ip,
      path: '/',
    };

    setFileManagerConnections((prev) => [...prev, connection]);

    // Emit connection event
    triggerEventBus.emit('fileSystemConnected', connection);

    console.log(`📁 Connected to file system: ${fileSystem.label}`);
  };

  const handleFileSelect = (index) => {
    if (operatingFiles.has(index)) return; // Can't select files being operated on

    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      newFiles[index] = { ...newFiles[index], selected: !newFiles[index].selected };
      return newFiles;
    });
  };

  const handleCopy = () => {
    if (!currentTime) return;

    const selectedIndices = [];
    files.forEach((file, index) => {
      if (file.selected && !operatingFiles.has(index)) {
        selectedIndices.push(index);
      }
    });

    if (selectedIndices.length === 0) return;

    const bandwidth = getNetworkBandwidth(currentNetworkId);

    // Start copy operation for each selected file (very fast)
    selectedIndices.forEach(index => {
      const file = files[index];
      const duration = calculateOperationDuration(file, 'copy', bandwidth);
      const sizeInMB = parseFileSizeToMB(file.size);

      // Register bandwidth operation
      const { operationId } = registerBandwidthOperation(
        'file_copy',
        sizeInMB * 0.05, // Minimal bandwidth for copying reference
        { fileSystem: selectedFileSystem, fileName: file.name }
      );

      activeOperationsRef.current.set(index, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'copy',
        operationId,
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, index]));
      setFileProgress(prev => ({ ...prev, [index]: 0 }));
      setFileOperations(prev => ({ ...prev, [index]: 'copy' }));
    });

    // Set clipboard after operations start
    const selectedFiles = selectedIndices.map(i => ({ ...files[i], selected: false }));
    setFileClipboard({
      files: selectedFiles,
      sourceFileSystemId: selectedFileSystem,
      sourceNetworkId: currentNetworkId,
    });

    console.log(`📋 ${selectedFiles.length} file(s) copied to clipboard`);
  };

  const handlePaste = () => {
    if (!currentTime || !fileClipboard.files || fileClipboard.files.length === 0) return;

    const sourceBandwidth = getNetworkBandwidth(fileClipboard.sourceNetworkId);
    const destBandwidth = getNetworkBandwidth(currentNetworkId);
    const effectiveBandwidth = Math.min(sourceBandwidth, destBandwidth);

    // Check for filename conflicts
    const existingNames = new Set(files.map(f => f.name));
    const filesToPaste = fileClipboard.files.filter(file => {
      if (existingNames.has(file.name)) {
        console.warn(`⚠️ Skipped duplicate file: ${file.name}`);
        return false;
      }
      return true;
    });

    if (filesToPaste.length === 0) {
      console.log('⚠️ No files to paste (all duplicates)');
      return;
    }

    // Add files to the array immediately (they'll show progress)
    const startIndex = files.length;
    const newFiles = filesToPaste.map(f => ({ ...f, selected: false }));
    setFiles(prev => [...prev, ...newFiles]);

    const isCrossNetwork = fileClipboard.sourceNetworkId !== currentNetworkId;

    // Start paste operation for each file
    newFiles.forEach((file, relativeIndex) => {
      const absoluteIndex = startIndex + relativeIndex;
      const duration = calculateOperationDuration(file, 'paste', effectiveBandwidth);
      const sizeInMB = parseFileSizeToMB(file.size);

      // Register bandwidth operation
      const { operationId } = registerBandwidthOperation(
        'file_paste',
        sizeInMB,
        {
          fileSystem: selectedFileSystem,
          fileName: file.name,
          crossNetwork: isCrossNetwork,
          sourceNetwork: fileClipboard.sourceNetworkId,
        }
      );

      activeOperationsRef.current.set(absoluteIndex, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'paste',
        operationId,
        crossNetwork: isCrossNetwork,
        sourceNetworkId: fileClipboard.sourceNetworkId,
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, absoluteIndex]));
      setFileProgress(prev => ({ ...prev, [absoluteIndex]: 0 }));
      setFileOperations(prev => ({ ...prev, [absoluteIndex]: isCrossNetwork ? 'paste-cross' : 'paste' }));
    });

    // Clear clipboard after paste (one-time use for game purposes)
    setFileClipboard({ files: [], sourceFileSystemId: '', sourceNetworkId: '' });

    console.log(`📥 Pasting ${filesToPaste.length} file(s)${isCrossNetwork ? ' from ' + fileClipboard.sourceNetworkId : ''}`);
  };

  const handleDelete = () => {
    if (!currentTime) return;

    const selectedIndices = [];
    files.forEach((file, index) => {
      if (file.selected && !operatingFiles.has(index)) {
        selectedIndices.push(index);
      }
    });

    if (selectedIndices.length === 0) return;

    const bandwidth = getNetworkBandwidth(currentNetworkId);

    // Start delete operation for each selected file
    selectedIndices.forEach(index => {
      const file = files[index];
      const duration = calculateOperationDuration(file, 'delete', bandwidth);
      const sizeInMB = parseFileSizeToMB(file.size);

      // Register bandwidth operation
      const { operationId } = registerBandwidthOperation(
        'file_delete',
        sizeInMB * 0.1,
        { fileSystem: selectedFileSystem, fileName: file.name }
      );

      activeOperationsRef.current.set(index, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'delete',
        operationId,
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, index]));
      setFileProgress(prev => ({ ...prev, [index]: 0 }));
      setFileOperations(prev => ({ ...prev, [index]: 'delete' }));
    });
  };

  const handleRepair = () => {
    if (!currentTime) return;

    const selectedCorruptedIndices = [];
    files.forEach((file, index) => {
      if (file.selected && file.corrupted && !operatingFiles.has(index)) {
        selectedCorruptedIndices.push(index);
      }
    });

    if (selectedCorruptedIndices.length === 0) return;

    const bandwidth = getNetworkBandwidth(currentNetworkId);

    // Start repair operation for each selected corrupted file
    selectedCorruptedIndices.forEach(index => {
      const file = files[index];
      const duration = calculateOperationDuration(file, 'repair', bandwidth);
      const sizeInMB = parseFileSizeToMB(file.size);

      // Register bandwidth operation
      const { operationId } = registerBandwidthOperation(
        'file_repair',
        sizeInMB,
        { fileSystem: selectedFileSystem, fileName: file.name }
      );

      activeOperationsRef.current.set(index, {
        startTime: currentTime.getTime(),
        duration,
        operation: 'repair',
        operationId,
        fileName: file.name,
      });

      setOperatingFiles(prev => new Set([...prev, index]));
      setFileProgress(prev => ({ ...prev, [index]: 0 }));
      setFileOperations(prev => ({ ...prev, [index]: 'repair' }));
    });
  };

  // Check if connected to any network
  const isConnected = activeConnections.length > 0;
  const hasOperations = operatingFiles.size > 0;
  const selectedFiles = files.filter(f => f.selected);
  const selectedCorruptedCount = files.filter(f => f.selected && f.corrupted).length;

  // Get clipboard source network name for display
  const clipboardSourceNetwork = fileClipboard.sourceNetworkId
    ? narEntries.find(e => e.networkId === fileClipboard.sourceNetworkId)?.networkName || fileClipboard.sourceNetworkId
    : '';

  // Calculate total clipboard size
  const totalClipboardSize = fileClipboard.files.reduce((total, file) => {
    return total + parseFileSizeToMB(file.size);
  }, 0);

  return (
    <div className="file-manager">
      <div className="fm-header">
        <h2>File Manager</h2>
        <p className="fm-subtitle">Remote File System Access</p>
      </div>

      {!isConnected ? (
        <div className="empty-state">
          <p>Not connected to any networks.</p>
          <p>Use VPN Client to connect to a network first.</p>
        </div>
      ) : (
        <>
          <div className="fm-controls">
            <select
              value={selectedFileSystem}
              onChange={(e) => {
                setSelectedFileSystem(e.target.value);
                if (e.target.value) handleConnect(e.target.value);
              }}
            >
              <option value="">
                {availableFileSystems.length === 0 && activeConnections.length > 0
                  ? "Scan network to discover devices"
                  : "Select File System"}
              </option>
              {availableFileSystems.map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.label}
                </option>
              ))}
            </select>
          </div>

          {fileClipboard.files.length > 0 && (
            <div className="clipboard-panel">
              <div className="clipboard-header">
                <strong>📋 Clipboard</strong> ({fileClipboard.files.length} files, {totalClipboardSize.toFixed(2)} MB)
                <br />
                <span className="clipboard-source">Source: {clipboardSourceNetwork}</span>
              </div>
              <div className="clipboard-files">
                {fileClipboard.files.map((file, idx) => (
                  <div key={idx} className="clipboard-file-item">
                    {file.name} <span className="clipboard-file-size">({file.size})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFileSystem && (
            <>
              <div className="fm-toolbar">
                <button
                  onClick={handleCopy}
                  disabled={hasOperations || selectedFiles.length === 0}
                >
                  Copy ({selectedFiles.length})
                </button>
                <button
                  onClick={handlePaste}
                  disabled={hasOperations || fileClipboard.files.length === 0}
                >
                  Paste ({fileClipboard.files.length})
                </button>
                <button
                  onClick={handleDelete}
                  disabled={hasOperations || selectedFiles.length === 0}
                >
                  Delete ({selectedFiles.length})
                </button>
                <button
                  onClick={handleRepair}
                  disabled={hasOperations || selectedCorruptedCount === 0}
                >
                  Repair ({selectedCorruptedCount})
                </button>
              </div>

              <div className="file-list">
                {files.map((file, idx) => {
                  const isOperating = operatingFiles.has(idx);
                  const progress = fileProgress[idx] || 0;
                  const operation = fileOperations[idx];
                  const isCrossNetworkPaste = operation === 'paste-cross';

                  return (
                    <div
                      key={idx}
                      className={`file-item ${file.corrupted ? 'file-corrupted' : ''
                        } ${file.selected ? 'file-selected' : ''
                        } ${isOperating ? 'file-operating' : ''
                        }`}
                      onClick={() => !isOperating && handleFileSelect(idx)}
                      style={{ cursor: isOperating ? 'default' : 'pointer' }}
                    >
                      {file.corrupted && <span className="corruption-icon">⚠</span>}
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{file.size}</span>

                      {isOperating && (
                        <div className="file-progress">
                          <div className="file-progress-bar">
                            <div
                              className={`file-progress-fill ${isCrossNetworkPaste ? 'cross-network' : ''}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="file-progress-text">
                            {operation?.replace('-cross', '')} {Math.floor(progress)}%
                            {isCrossNetworkPaste && ` from ${clipboardSourceNetwork}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Activity Log Panel */}
      <div className={`activity-log-panel ${isLogCollapsed ? 'collapsed' : ''}`}>
        <div className="activity-log-header" onClick={() => setIsLogCollapsed(!isLogCollapsed)}>
          <span className="activity-log-title">
            📋 Activity Log ({activityLog.length})
          </span>
          <span className="activity-log-toggle">{isLogCollapsed ? '▲' : '▼'}</span>
        </div>
        {!isLogCollapsed && (
          <div className="activity-log-content">
            {activityLog.length === 0 ? (
              <div className="activity-log-empty">No activity yet</div>
            ) : (
              activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`activity-log-entry ${entry.isSabotage ? 'sabotage-entry' : ''}`}
                >
                  <span className="log-timestamp">{entry.timestamp}</span>
                  <span className="log-operation">{entry.operation.toUpperCase()}</span>
                  <span className="log-filename">{entry.fileName}</span>
                  <span className="log-location">@ {entry.location}</span>
                  <span className={`log-source ${entry.isSabotage ? 'source-unknown' : ''}`}>
                    {entry.isSabotage ? '⚠️ ' : ''}{entry.source}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManager;

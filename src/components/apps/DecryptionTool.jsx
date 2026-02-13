import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import {
  DECRYPTION_ALGORITHMS,
  calculateDownloadDurationFromString,
  calculateDecryptionDurationFromString,
  calculateUploadDurationFromString,
  generateGridData,
  hasRequiredAlgorithm,
  getAlgorithmName,
  isEncryptedFile,
  getDecryptedFile,
} from '../../systems/DecryptionSystem';
import { parseFileSizeToMB } from '../../systems/DataRecoverySystem';
import './DecryptionTool.css';

const GRID_ROWS = 15;
const GRID_COLS = 36;

const DecryptionTool = () => {
  const {
    activeConnections,
    currentTime,
    discoveredDevices,
    hardware,
    decryptionAlgorithms,
    localSSDFiles,
    addFileToLocalSSD,
    removeFileFromLocalSSD,
    replaceFileOnLocalSSD,
    registerBandwidthOperation,
    completeBandwidthOperation,
  } = useGame();

  // State
  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [currentNetworkId, setCurrentNetworkId] = useState('');
  const [allFiles, setAllFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null); // file name
  const [phase, setPhase] = useState('idle'); // idle, downloading, decrypting, complete, uploading
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [decryptionProgress, setDecryptionProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [disconnectionMessage, setDisconnectionMessage] = useState(null);
  const [algorithmWarning, setAlgorithmWarning] = useState(null);

  // Matrix animation tick
  const [matrixTick, setMatrixTick] = useState(0);

  // Track which files have been locally decrypted (mapped by original encrypted name)
  const [localDecryptedFiles, setLocalDecryptedFiles] = useState(new Map()); // encName -> decryptedName

  // Track which files have been uploaded back
  const [uploadedFiles, setUploadedFiles] = useState(new Set());

  // Refs
  const animationRef = useRef(null);
  const operationStartTimeRef = useRef(null);
  const operationDurationRef = useRef(0);
  const currentTimeRef = useRef(currentTime);
  const activeBandwidthOpRef = useRef(null);

  // Keep currentTimeRef up to date
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Get network bandwidth
  const getNetworkBandwidth = useCallback((networkId) => {
    const network = networkRegistry.getNetwork(networkId);
    return network?.bandwidth || 50;
  }, []);

  // CPU specs string
  const cpuSpecs = hardware?.cpu?.specs || '1GHz, 1 core';

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
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        if (activeBandwidthOpRef.current && completeBandwidthOperation) {
          completeBandwidthOperation(activeBandwidthOpRef.current);
          activeBandwidthOpRef.current = null;
        }
        setSelectedFileSystem('');
        setCurrentNetworkId('');
        setAllFiles([]);
        setSelectedFile(null);
        setPhase('idle');
        setDownloadProgress(0);
        setDecryptionProgress(0);
        setUploadProgress(0);
        setLocalDecryptedFiles(new Map());
        setUploadedFiles(new Set());
        setAlgorithmWarning(null);
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

  // Matrix animation tick - randomizes pending cells every 200ms
  useEffect(() => {
    if (!selectedFileSystem) return;
    const interval = setInterval(() => setMatrixTick(t => t + 1), 200);
    return () => clearInterval(interval);
  }, [selectedFileSystem]);

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (activeBandwidthOpRef.current && completeBandwidthOperation) {
        completeBandwidthOperation(activeBandwidthOpRef.current);
        activeBandwidthOpRef.current = null;
      }
    };
  }, [completeBandwidthOperation]);

  // Handle file system selection
  const handleFileSystemSelect = (fileSystemId) => {
    if (!fileSystemId) return;
    const fileSystem = availableFileSystems.find((fs) => fs.id === fileSystemId);
    if (!fileSystem) return;

    // Read files directly from registry to get the latest data
    // (the availableFileSystems memo may be stale if files were added externally)
    const registryFs = networkRegistry.getFileSystem(fileSystemId);
    const files = registryFs?.files || fileSystem.files;
    setAllFiles(files.map(f => ({ ...f })));
    setSelectedFileSystem(fileSystemId);
    setCurrentNetworkId(fileSystem.networkId);
    setSelectedFile(null);
    setPhase('idle');
    setDownloadProgress(0);
    setDecryptionProgress(0);
    setUploadProgress(0);
    setAlgorithmWarning(null);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    triggerEventBus.emit('decryptionToolConnected', {
      fileSystemId,
      ip: fileSystem.ip,
      networkId: fileSystem.networkId,
    });
  };

  // Get encrypted files from the connected file system
  const encryptedFiles = useMemo(() => {
    return allFiles.filter(f => isEncryptedFile(f));
  }, [allFiles]);

  // Get the selected file object
  const selectedFileObj = useMemo(() => {
    if (!selectedFile) return null;
    return allFiles.find(f => f.name === selectedFile) || null;
  }, [selectedFile, allFiles]);

  // Determine the display phase for a file
  const getFilePhase = useCallback((file) => {
    if (uploadedFiles.has(file.name)) return 'uploaded';
    const decryptedName = localDecryptedFiles.get(file.name);
    if (decryptedName) {
      // Check if currently uploading this decrypted file
      if (phase === 'uploading' && selectedFile === file.name) return 'uploading';
      return 'decrypted';
    }
    // Check if file is on local SSD (downloaded)
    const onLocal = localSSDFiles.some(f => f.name === file.name);
    if (onLocal) {
      if (phase === 'decrypting' && selectedFile === file.name) return 'decrypting';
      return 'local';
    }
    if (phase === 'downloading' && selectedFile === file.name) return 'downloading';
    return 'remote';
  }, [localSSDFiles, localDecryptedFiles, uploadedFiles, phase, selectedFile]);

  // Run animation loop for progress
  const runProgressAnimation = useCallback((duration, setProgress, onComplete) => {
    if (!currentTime) return;

    operationStartTimeRef.current = currentTime.getTime();
    operationDurationRef.current = duration;

    const animate = () => {
      const now = currentTimeRef.current.getTime();
      const elapsed = now - operationStartTimeRef.current;
      const progress = Math.min(100, (elapsed / operationDurationRef.current) * 100);
      setProgress(progress);

      if (progress >= 100) {
        animationRef.current = null;
        onComplete();
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [currentTime]);

  // Handle Download: remote FS -> local SSD
  const handleDownload = () => {
    if (!selectedFileObj || !currentTime || phase !== 'idle') return;

    // Check algorithm before downloading
    if (selectedFileObj.algorithm && !hasRequiredAlgorithm(selectedFileObj.algorithm, decryptionAlgorithms)) {
      setAlgorithmWarning(`Cannot decrypt: requires ${getAlgorithmName(selectedFileObj.algorithm)} algorithm pack.`);
      return;
    }
    setAlgorithmWarning(null);

    const bandwidth = getNetworkBandwidth(currentNetworkId);
    const duration = calculateDownloadDurationFromString(selectedFileObj.size, bandwidth);
    const sizeInMB = parseFileSizeToMB(selectedFileObj.size);

    // Register bandwidth operation
    let opId = null;
    if (registerBandwidthOperation) {
      const result = registerBandwidthOperation('download', sizeInMB, { fileName: selectedFileObj.name });
      opId = result.operationId;
      activeBandwidthOpRef.current = opId;
    }

    setPhase('downloading');
    setDownloadProgress(0);

    runProgressAnimation(duration, setDownloadProgress, () => {
      // Complete bandwidth operation
      if (opId && completeBandwidthOperation) {
        completeBandwidthOperation(opId);
        activeBandwidthOpRef.current = null;
      }
      // Add encrypted file to local SSD
      addFileToLocalSSD({ ...selectedFileObj });
      setPhase('idle');
    });
  };

  // Handle Decrypt: transform .enc file on local SSD
  const handleDecrypt = () => {
    if (!selectedFileObj || !currentTime || phase !== 'idle') return;

    // Must be on local SSD
    const onLocal = localSSDFiles.some(f => f.name === selectedFileObj.name);
    if (!onLocal) return;

    // Check algorithm
    if (selectedFileObj.algorithm && !hasRequiredAlgorithm(selectedFileObj.algorithm, decryptionAlgorithms)) {
      setAlgorithmWarning(`Cannot decrypt: requires ${getAlgorithmName(selectedFileObj.algorithm)} algorithm pack.`);
      return;
    }
    setAlgorithmWarning(null);

    const duration = calculateDecryptionDurationFromString(selectedFileObj.size, cpuSpecs);

    setPhase('decrypting');
    setDecryptionProgress(0);

    runProgressAnimation(duration, setDecryptionProgress, () => {
      // Use getDecryptedFile for multi-layer support
      const result = getDecryptedFile(selectedFileObj);
      const isFullyDecrypted = !result.encrypted;

      // Replace file on local SSD with result
      const updatedFile = {
        ...result,
        decrypted: isFullyDecrypted ? true : undefined,
      };
      replaceFileOnLocalSSD(selectedFileObj.name, updatedFile);

      if (isFullyDecrypted) {
        // Fully decrypted - track for upload
        setLocalDecryptedFiles(prev => {
          const next = new Map(prev);
          next.set(selectedFileObj.name, result.name);
          return next;
        });

        // Emit event for objective tracking
        triggerEventBus.emit('fileDecryptionComplete', {
          fileName: selectedFileObj.name,
          decryptedFileName: result.name,
          fileSystemId: selectedFileSystem,
        });
      } else {
        // Multi-layer: still encrypted with next algorithm
        // Update allFiles so the UI shows the new algorithm requirement
        setAllFiles(prev => prev.map(f =>
          f.name === selectedFileObj.name ? updatedFile : f
        ));
      }

      setPhase('idle');
    });
  };

  // Handle Upload: local decrypted file -> remote FS
  const handleUpload = () => {
    if (!selectedFileObj || !currentTime || phase !== 'idle') return;

    const decryptedName = localDecryptedFiles.get(selectedFileObj.name);
    if (!decryptedName) return;

    const bandwidth = getNetworkBandwidth(currentNetworkId);
    // Use original file size for upload duration
    const duration = calculateUploadDurationFromString(selectedFileObj.size, bandwidth);
    const sizeInMB = parseFileSizeToMB(selectedFileObj.size);

    // Register bandwidth operation
    let opId = null;
    if (registerBandwidthOperation) {
      const result = registerBandwidthOperation('upload', sizeInMB, { fileName: selectedFileObj.name });
      opId = result.operationId;
      activeBandwidthOpRef.current = opId;
    }

    setPhase('uploading');
    setUploadProgress(0);

    // Get the IP address for the current file system
    const fsInfo = availableFileSystems.find(fs => fs.id === selectedFileSystem);
    const destinationIp = fsInfo?.ip || '';

    runProgressAnimation(duration, setUploadProgress, () => {
      // Complete bandwidth operation
      if (opId && completeBandwidthOperation) {
        completeBandwidthOperation(opId);
        activeBandwidthOpRef.current = null;
      }
      // Add decrypted file to remote FS
      const decryptedFile = localSSDFiles.find(f => f.name === decryptedName);
      if (decryptedFile) {
        networkRegistry.addFilesToFileSystem(selectedFileSystem, [{ ...decryptedFile }]);
      }

      // Remove encrypted file from local SSD (cleanup)
      removeFileFromLocalSSD(decryptedName);

      // Track upload
      setUploadedFiles(prev => {
        const next = new Set(prev);
        next.add(selectedFileObj.name);
        return next;
      });

      // Emit event for objective tracking
      triggerEventBus.emit('fileUploadComplete', {
        fileName: decryptedName,
        sourceFileName: selectedFileObj.name,
        destinationIp,
        fileSystemId: selectedFileSystem,
      });

      setPhase('idle');
    });
  };

  // Select a file
  const handleFileSelect = (fileName) => {
    if (phase !== 'idle') return;
    setSelectedFile(fileName === selectedFile ? null : fileName);
    setAlgorithmWarning(null);
  };

  // Grid data for the decryption visualization
  const gridData = useMemo(() => {
    // matrixTick triggers re-generation to randomize pending cells
    void matrixTick;
    return generateGridData(GRID_ROWS, GRID_COLS, phase === 'decrypting' ? decryptionProgress : 0);
  }, [decryptionProgress, phase, matrixTick]);

  // Determine which action buttons are available
  const selectedPhase = selectedFileObj ? getFilePhase(selectedFileObj) : null;
  const canDownload = selectedPhase === 'remote' && phase === 'idle';
  const canDecrypt = selectedPhase === 'local' && phase === 'idle';
  const canUpload = selectedPhase === 'decrypted' && phase === 'idle';

  // Current operation progress for the selected file
  const currentProgress = phase === 'downloading' ? downloadProgress
    : phase === 'decrypting' ? decryptionProgress
    : phase === 'uploading' ? uploadProgress : 0;

  const hasConnectedNetworks = activeConnections && activeConnections.length > 0;

  return (
    <div className="decryption-tool">
      <div className="decryption-header">
        <h2>Decryption Tool</h2>
        <p className="decryption-subtitle">File Decryption & Upload</p>
        <div className="decryption-algorithms-bar">
          <span className="algorithms-label">Algorithms:</span>
          {decryptionAlgorithms.map(algId => (
            <span key={algId} className="algorithm-tag">
              {DECRYPTION_ALGORITHMS[algId]?.name || algId}
            </span>
          ))}
        </div>
      </div>

      {disconnectionMessage && (
        <div className="decryption-disconnection-message">
          {disconnectionMessage}
        </div>
      )}

      {!hasConnectedNetworks ? (
        <div className="decryption-no-networks">
          No networks connected. Use the VPN Client to connect to a network first.
        </div>
      ) : availableFileSystems.length === 0 ? (
        <div className="decryption-no-networks">
          No devices found. Use the Network Scanner to discover devices first.
        </div>
      ) : (
        <>
          <div className="decryption-controls">
            <label>
              File System:
              <select
                value={selectedFileSystem}
                onChange={(e) => {
                  setSelectedFileSystem(e.target.value);
                  if (e.target.value) handleFileSystemSelect(e.target.value);
                }}
                disabled={phase !== 'idle'}
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
              {encryptedFiles.length === 0 ? (
                <div className="decryption-no-encrypted">
                  No encrypted files found on this file system.
                </div>
              ) : (
                <div className="decryption-main">
                  <div className="decryption-file-panel">
                    <div className="decryption-file-list">
                      {encryptedFiles.map((file) => {
                        const filePhase = getFilePhase(file);
                        const isSelected = selectedFile === file.name;
                        const isActive = phase !== 'idle' && selectedFile === file.name;

                        return (
                          <div
                            key={file.name}
                            className={`decryption-file-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleFileSelect(file.name)}
                            style={{ cursor: phase !== 'idle' ? 'default' : 'pointer' }}
                          >
                            <span className="file-icon">🔒</span>
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{file.size}</span>
                            {file.algorithm && (
                              <span className="file-algorithm">{getAlgorithmName(file.algorithm)}</span>
                            )}
                            <span className={`file-phase ${filePhase}`}>
                              {filePhase.toUpperCase()}
                            </span>

                            {isActive && (
                              <div className="decryption-file-progress">
                                <div className="decryption-progress-bar">
                                  <div
                                    className={`decryption-progress-fill ${phase}`}
                                    style={{ width: `${currentProgress}%` }}
                                  />
                                </div>
                                <span className="decryption-progress-text">
                                  {phase === 'downloading' ? 'Downloading' : phase === 'decrypting' ? 'Decrypting' : 'Uploading'}... {Math.floor(currentProgress)}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="decryption-grid-panel">
                    <div className="decryption-grid-label">Decryption Matrix</div>
                    <div className="decryption-grid">
                      {gridData.map((row, rowIdx) =>
                        row.map((cell, colIdx) => (
                          <div
                            key={`${rowIdx}-${colIdx}`}
                            className={`decryption-grid-cell ${cell.filled ? 'filled' : 'pending'}`}
                          >
                            {cell.value}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {algorithmWarning && (
                <div className="algorithm-warning">
                  {algorithmWarning}
                </div>
              )}

              <div className="decryption-actions">
                <button
                  className="download-btn"
                  onClick={handleDownload}
                  disabled={!canDownload}
                >
                  Download
                </button>
                <button
                  className="decrypt-btn"
                  onClick={handleDecrypt}
                  disabled={!canDecrypt}
                >
                  Decrypt
                </button>
                <button
                  className="upload-btn"
                  onClick={handleUpload}
                  disabled={!canUpload}
                >
                  Upload
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DecryptionTool;

import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/useGame';
import networkRegistry from '../../systems/NetworkRegistry';
import './DataRecoveryTool.css';

// Secure delete takes 5x longer than normal operations
const SECURE_DELETE_MULTIPLIER = 5;

/**
 * DataRecoveryTool - Recover deleted files and perform secure deletion
 * 
 * This tool allows players to:
 * 1. View recently deleted files on a device (within recovery window)
 * 2. Recover deleted files back to their original location
 * 3. Perform secure deletion (5x longer) that prevents recovery
 */
const DataRecoveryTool = () => {
    const game = useGame();
    const {
        currentTime,
        lastScanResults,
        discoveredDevices,
        hardware,
        registerBandwidthOperation,
        completeBandwidthOperation,
    } = game;

    const [selectedDevice, setSelectedDevice] = useState('');
    const [deletedFiles, setDeletedFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [operation, setOperation] = useState(null); // { type: 'recover'|'secure-delete', progress: 0-100 }
    const [operationStatus, setOperationStatus] = useState('');
    const operationIdRef = useRef(null);

    // Clean up bandwidth operations on unmount
    useEffect(() => {
        return () => {
            if (operationIdRef.current) {
                completeBandwidthOperation?.(operationIdRef.current);
            }
        };
    }, [completeBandwidthOperation]);

    // Get all discovered devices
    const getDiscoveredDevices = () => {
        const devices = [];
        const seen = new Set();

        if (lastScanResults?.machines) {
            lastScanResults.machines.forEach(machine => {
                if (!seen.has(machine.ip)) {
                    seen.add(machine.ip);
                    devices.push({
                        ip: machine.ip,
                        hostname: machine.name || machine.hostname,
                        networkId: lastScanResults.network,
                    });
                }
            });
        }

        if (discoveredDevices) {
            Object.values(discoveredDevices).flat().forEach(device => {
                if (!seen.has(device.ip)) {
                    seen.add(device.ip);
                    devices.push({
                        ip: device.ip,
                        hostname: device.hostname || device.name,
                        networkId: device.networkId,
                    });
                }
            });
        }

        return devices;
    };

    const availableDevices = getDiscoveredDevices();

    // Load deleted files for selected device
    useEffect(() => {
        if (!selectedDevice) {
            setDeletedFiles([]);
            return;
        }

        const device = networkRegistry.getDevice(selectedDevice);
        if (device && device.fileSystemId) {
            const fileSystem = networkRegistry.getFileSystem(device.fileSystemId);
            if (fileSystem) {
                // Get files marked as deleted but still recoverable
                const recoverableFiles = (fileSystem.files || []).filter(f =>
                    f.deleted && !f.secureDeleted && f.deletedAt
                );
                setDeletedFiles(recoverableFiles);
            }
        } else {
            setDeletedFiles([]);
        }
    }, [selectedDevice, currentTime]);

    // Toggle file selection
    const toggleFileSelection = (fileName) => {
        const newSelection = new Set(selectedFiles);
        if (newSelection.has(fileName)) {
            newSelection.delete(fileName);
        } else {
            newSelection.add(fileName);
        }
        setSelectedFiles(newSelection);
    };

    // Select/deselect all files
    const toggleSelectAll = () => {
        if (selectedFiles.size === deletedFiles.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(deletedFiles.map(f => f.name)));
        }
    };

    // Calculate operation time based on file sizes
    const calculateOperationTime = (files, isSecure = false) => {
        const totalSizeBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 1024), 0);
        const sizeMB = totalSizeBytes / (1024 * 1024);
        const networkSpeed = hardware?.network?.speed || 500;
        const baseTimeMs = (sizeMB / (networkSpeed / 8)) * 1000; // Time based on bandwidth
        return isSecure ? baseTimeMs * SECURE_DELETE_MULTIPLIER : baseTimeMs;
    };

    // Recover selected files
    const handleRecover = () => {
        if (selectedFiles.size === 0) return;

        const filesToRecover = deletedFiles.filter(f => selectedFiles.has(f.name));
        const durationMs = calculateOperationTime(filesToRecover, false);

        // Register bandwidth operation
        if (registerBandwidthOperation) {
            const result = registerBandwidthOperation(durationMs, 'recovery');
            operationIdRef.current = result.operationId;
        }

        setOperation({ type: 'recover', progress: 0, startTime: Date.now(), duration: durationMs });
        setOperationStatus(`Recovering ${filesToRecover.length} file(s)...`);
    };

    // Secure delete selected files (from deleted list - permanent removal)
    const handleSecureDelete = () => {
        if (selectedFiles.size === 0) return;

        const filesToDelete = deletedFiles.filter(f => selectedFiles.has(f.name));
        const durationMs = calculateOperationTime(filesToDelete, true);

        // Register bandwidth operation
        if (registerBandwidthOperation) {
            const result = registerBandwidthOperation(durationMs, 'secure-delete');
            operationIdRef.current = result.operationId;
        }

        setOperation({ type: 'secure-delete', progress: 0, startTime: Date.now(), duration: durationMs });
        setOperationStatus(`Secure deleting ${filesToDelete.length} file(s)... (This takes 5x longer)`);
    };

    // Update operation progress
    useEffect(() => {
        if (!operation) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - operation.startTime;
            const progress = Math.min(100, (elapsed / operation.duration) * 100);

            setOperation(prev => ({ ...prev, progress }));

            if (progress >= 100) {
                clearInterval(interval);

                // Complete the operation
                if (operationIdRef.current) {
                    completeBandwidthOperation?.(operationIdRef.current);
                    operationIdRef.current = null;
                }

                const device = networkRegistry.getDevice(selectedDevice);
                if (device && device.fileSystemId) {
                    const fileSystem = networkRegistry.getFileSystem(device.fileSystemId);
                    if (fileSystem) {
                        if (operation.type === 'recover') {
                            // Mark files as not deleted
                            fileSystem.files = fileSystem.files.map(f =>
                                selectedFiles.has(f.name) ? { ...f, deleted: false, deletedAt: null } : f
                            );
                            setOperationStatus(`✅ Recovered ${selectedFiles.size} file(s)`);

                            // Log the recovery
                            selectedFiles.forEach(fileName => {
                                networkRegistry.addDeviceLog(selectedDevice, {
                                    type: 'file',
                                    action: 'recover',
                                    fileName,
                                    timestamp: currentTime?.toISOString(),
                                });
                            });
                        } else if (operation.type === 'secure-delete') {
                            // Mark files as securely deleted (unrecoverable)
                            fileSystem.files = fileSystem.files.map(f =>
                                selectedFiles.has(f.name) ? { ...f, secureDeleted: true } : f
                            );
                            setOperationStatus(`✅ Securely deleted ${selectedFiles.size} file(s)`);

                            // Log the secure deletion
                            selectedFiles.forEach(fileName => {
                                networkRegistry.addDeviceLog(selectedDevice, {
                                    type: 'file',
                                    action: 'secure-delete',
                                    fileName,
                                    timestamp: currentTime?.toISOString(),
                                });
                            });
                        }
                    }
                }

                setSelectedFiles(new Set());
                setOperation(null);

                // Refresh deleted files list
                setTimeout(() => {
                    const updatedDevice = networkRegistry.getDevice(selectedDevice);
                    if (updatedDevice && updatedDevice.fileSystemId) {
                        const updatedFs = networkRegistry.getFileSystem(updatedDevice.fileSystemId);
                        if (updatedFs) {
                            const recoverableFiles = (updatedFs.files || []).filter(f =>
                                f.deleted && !f.secureDeleted && f.deletedAt
                            );
                            setDeletedFiles(recoverableFiles);
                        }
                    }
                }, 100);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [operation, selectedDevice, selectedFiles, completeBandwidthOperation, currentTime]);

    // Format file size
    const formatSize = (bytes) => {
        if (!bytes) return 'Unknown';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format time since deletion
    const formatTimeSinceDelete = (deletedAt) => {
        if (!deletedAt || !currentTime) return 'Unknown';
        const deleted = new Date(deletedAt);
        const diffMs = currentTime.getTime() - deleted.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    };

    return (
        <div className="data-recovery-tool">
            <div className="recovery-header">
                <h2>🔧 Data Recovery Tool</h2>
                <p className="recovery-subtitle">Recover deleted files or perform secure deletion</p>
            </div>

            <div className="recovery-controls">
                <div className="device-selector">
                    <label>Device:</label>
                    <select
                        value={selectedDevice}
                        onChange={(e) => {
                            setSelectedDevice(e.target.value);
                            setSelectedFiles(new Set());
                        }}
                        disabled={!!operation}
                    >
                        <option value="">-- Select a device --</option>
                        {availableDevices.map(device => (
                            <option key={device.ip} value={device.ip}>
                                {device.hostname} ({device.ip})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="recovery-content">
                {!selectedDevice ? (
                    <div className="recovery-empty">
                        <p>Select a device to view recoverable deleted files.</p>
                        <p className="hint">Tip: Files that were regularly deleted can be recovered. Securely deleted files cannot.</p>
                    </div>
                ) : deletedFiles.length === 0 ? (
                    <div className="recovery-empty">
                        <p>No recoverable deleted files found on this device.</p>
                        <p className="hint">Files appear here when deleted normally. Use secure delete to permanently remove files.</p>
                    </div>
                ) : (
                    <>
                        <div className="file-list-header">
                            <label className="select-all">
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.size === deletedFiles.length}
                                    onChange={toggleSelectAll}
                                    disabled={!!operation}
                                />
                                Select All
                            </label>
                            <span>{deletedFiles.length} recoverable file(s)</span>
                        </div>
                        <div className="file-list">
                            {deletedFiles.map(file => (
                                <div
                                    key={file.name}
                                    className={`file-item ${selectedFiles.has(file.name) ? 'selected' : ''}`}
                                    onClick={() => !operation && toggleFileSelection(file.name)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFiles.has(file.name)}
                                        onChange={() => toggleFileSelection(file.name)}
                                        disabled={!!operation}
                                    />
                                    <span className="file-icon">📄</span>
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatSize(file.sizeBytes)}</span>
                                    <span className="file-deleted-at">{formatTimeSinceDelete(file.deletedAt)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {operation && (
                <div className="operation-progress">
                    <div className="progress-label">{operationStatus}</div>
                    <div className="progress-bar-outer">
                        <div
                            className={`progress-bar-inner ${operation.type}`}
                            style={{ width: `${operation.progress}%` }}
                        />
                    </div>
                    <div className="progress-percent">{Math.round(operation.progress)}%</div>
                </div>
            )}

            <div className="recovery-actions">
                <button
                    className="recover-btn"
                    onClick={handleRecover}
                    disabled={selectedFiles.size === 0 || !!operation}
                >
                    ↩️ Recover Selected ({selectedFiles.size})
                </button>
                <button
                    className="secure-delete-btn"
                    onClick={handleSecureDelete}
                    disabled={selectedFiles.size === 0 || !!operation}
                    title="Secure delete takes 5x longer but prevents recovery"
                >
                    🗑️ Secure Delete ({selectedFiles.size})
                </button>
            </div>

            {operationStatus && !operation && (
                <div className="operation-status">
                    {operationStatus}
                </div>
            )}
        </div>
    );
};

export default DataRecoveryTool;

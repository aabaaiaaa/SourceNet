import { useState, useRef, useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
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

  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [files, setFiles] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const [repairStartTime, setRepairStartTime] = useState(null);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const animationFrameRef = useRef(null);
  const repairOperationIdRef = useRef(null);

  // Animation loop for repair progress using game time
  useEffect(() => {
    if (!repairing || !repairStartTime || !currentTime) return;

    const animate = () => {
      // Calculate elapsed GAME time (respects game speed)
      const elapsedGameMs = currentTime.getTime() - repairStartTime;
      const newProgress = Math.min(100, (elapsedGameMs / estimatedDuration) * 100);
      setRepairProgress(newProgress);

      if (newProgress >= 100) {
        // Repair complete
        completeBandwidthOperation(repairOperationIdRef.current);

        // Update files to mark as repaired
        setFiles(files.map(f => ({ ...f, corrupted: false })));

        // Track file operation for objective tracking
        const operation = {
          operation: 'repair',
          filesAffected: files.filter(f => f.corrupted).length,
          fileSystem: selectedFileSystem,
        };

        setLastFileOperation(operation);

        // Emit file operation complete event
        triggerEventBus.emit('fileOperationComplete', operation);

        setRepairing(false);
        setRepairProgress(0);
        setRepairStartTime(null);
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [repairing, repairStartTime, currentTime, estimatedDuration, files, selectedFileSystem, completeBandwidthOperation, setLastFileOperation]);

  // Get available file systems from connected networks
  const availableFileSystems = [];
  activeConnections.forEach((connection) => {
    const narEntry = narEntries.find((entry) => entry.networkId === connection.networkId);
    if (narEntry && narEntry.fileSystems) {
      narEntry.fileSystems.forEach((fs) => {
        availableFileSystems.push({
          id: fs.id,
          ip: fs.ip,
          name: fs.name,
          label: `${fs.ip} - ${fs.name}`,
          files: fs.files || [],
          networkId: narEntry.networkId,
        });
      });
    }
  });

  const handleConnect = (fileSystemId = selectedFileSystem) => {
    if (!fileSystemId) return;

    // Find the selected file system
    const fileSystem = availableFileSystems.find((fs) => fs.id === fileSystemId);
    if (!fileSystem) return;

    // Load files from the file system
    setFiles(fileSystem.files.map(f => ({ ...f })));

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

  const handleCopy = () => {
    const selected = files.filter((f) => f.selected);
    if (selected.length > 0) {
      setClipboard(selected);
      alert(`${selected.length} file(s) copied to clipboard`);
    }
  };

  const handleRepair = () => {
    const corrupted = files.filter((f) => f.corrupted);
    if (corrupted.length === 0 || repairing || !currentTime) return;

    // Register bandwidth operation (1 MB per file to repair)
    const sizeInMB = corrupted.length * 1;
    const { operationId, estimatedTimeMs } = registerBandwidthOperation(
      'file_repair',
      sizeInMB,
      { fileSystem: selectedFileSystem, fileCount: corrupted.length }
    );

    repairOperationIdRef.current = operationId;
    setEstimatedDuration(estimatedTimeMs);
    setRepairStartTime(currentTime.getTime());
    setRepairing(true);
    setRepairProgress(0);
  };

  // Check if connected to any network
  const isConnected = activeConnections.length > 0;

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
              <option value="">Select File System</option>
              {availableFileSystems.map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.label}
                </option>
              ))}
            </select>
          </div>

          {selectedFileSystem && (
            <>
              <div className="fm-toolbar">
                <button onClick={handleCopy} disabled={repairing}>Copy</button>
                <button disabled={!clipboard || repairing}>Paste</button>
                <button disabled={repairing}>Delete</button>
                <button
                  onClick={handleRepair}
                  disabled={repairing || !files.some(f => f.corrupted)}
                  className={repairing ? 'repairing' : ''}
                >
                  {repairing ? `Repairing... ${Math.floor(repairProgress)}%` : 'Repair'}
                </button>
              </div>
              {repairing && (
                <div className="repair-progress">
                  <div className="repair-progress-bar">
                    <div
                      className="repair-progress-fill"
                      style={{ width: `${repairProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="file-list">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className={`file-item ${file.corrupted ? 'file-corrupted' : ''}`}
                  >
                    {file.corrupted && <span className="corruption-icon">⚠</span>}
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FileManager;

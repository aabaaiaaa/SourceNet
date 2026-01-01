import { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import triggerEventBus from '../../core/triggerEventBus';
import './FileManager.css';

const FileManager = () => {
  const game = useGame();
  const setFileManagerConnections = game.setFileManagerConnections || (() => {});
  const setLastFileOperation = game.setLastFileOperation || (() => {});
  const registerBandwidthOperation = game.registerBandwidthOperation || (() => ({ operationId: null, estimatedTimeMs: 2000 }));
  const completeBandwidthOperation = game.completeBandwidthOperation || (() => {});
  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [files, setFiles] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const [repairProgress, setRepairProgress] = useState(0);
  const repairIntervalRef = useRef(null);

  // Mock file systems (real implementation would come from scan results)
  const availableFileSystems = [
    { id: 'fs-001', label: '192.168.50.10 - fileserver-01' },
    { id: 'fs-002', label: '192.168.50.20 - backup-server' },
  ];

  const handleConnect = () => {
    if (!selectedFileSystem) return;

    // Mock files (real implementation would fetch from game state)
    const mockFiles = [
      { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: true },
      { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: false },
      { name: 'log_2024_03.txt', size: '2.8 KB', corrupted: true },
      { name: 'log_2024_04.txt', size: '3.0 KB', corrupted: true },
      { name: 'log_2024_05.txt', size: '2.7 KB', corrupted: true },
      { name: 'log_2024_06.txt', size: '2.9 KB', corrupted: true },
      { name: 'log_2024_07.txt', size: '3.2 KB', corrupted: true },
      { name: 'log_2024_08.txt', size: '2.6 KB', corrupted: true },
    ];

    setFiles(mockFiles);

    // Track file system connection for objective tracking
    const connection = {
      fileSystemId: selectedFileSystem,
      ip: selectedFileSystem.includes('192.168.50.10') ? '192.168.50.10' : '192.168.50.20',
      path: '/',
    };

    setFileManagerConnections((prev) => [...prev, connection]);

    // Emit connection event
    triggerEventBus.emit('fileSystemConnected', connection);

    console.log(`📁 Connected to file system: ${selectedFileSystem}`);
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
    if (corrupted.length === 0 || repairing) return;

    // Register bandwidth operation (1 MB per file to repair)
    const sizeInMB = corrupted.length * 1;
    const { operationId, estimatedTimeMs } = registerBandwidthOperation(
      'file_repair',
      sizeInMB,
      { fileSystem: selectedFileSystem, fileCount: corrupted.length }
    );

    setRepairing(true);
    setRepairProgress(0);

    // Update progress based on estimated time
    const updateInterval = 100; // Update every 100ms
    const progressIncrement = (100 / estimatedTimeMs) * updateInterval;
    let currentProgress = 0;

    repairIntervalRef.current = setInterval(() => {
      currentProgress += progressIncrement;
      setRepairProgress(Math.min(100, currentProgress));

      if (currentProgress >= 100) {
        clearInterval(repairIntervalRef.current);
        repairIntervalRef.current = null;

        // Complete the bandwidth operation
        completeBandwidthOperation(operationId);

        // Update files to mark as repaired
        setFiles(files.map(f => ({ ...f, corrupted: false })));

        // Track file operation for objective tracking
        const operation = {
          operation: 'repair',
          filesAffected: corrupted.length,
          fileSystem: selectedFileSystem,
        };

        setLastFileOperation(operation);

        // Emit file operation complete event
        triggerEventBus.emit('fileOperationComplete', operation);

        setRepairing(false);
        setRepairProgress(0);
        console.log(`🔧 Repaired ${corrupted.length} files`);
      }
    }, updateInterval);
  };

  // Check if connected to any network (game already declared at top)
  const isConnected = (game.activeConnections || []).length > 0;

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
                if (e.target.value) handleConnect();
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

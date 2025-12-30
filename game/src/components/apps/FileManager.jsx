import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import triggerEventBus from '../../core/triggerEventBus';
import './FileManager.css';

const FileManager = () => {
  const game = useGame();
  const setFileManagerConnections = game.setFileManagerConnections || (() => {});
  const setLastFileOperation = game.setLastFileOperation || (() => {});
  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [files, setFiles] = useState([]);
  const [clipboard, setClipboard] = useState(null);

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
    if (corrupted.length > 0) {
      // Simulate repair
      setTimeout(() => {
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

        console.log(`🔧 Repaired ${corrupted.length} files`);
        alert(`✅ Repaired ${corrupted.length} corrupted file(s)`);
      }, 2000); // 2 second repair time
    }
  };

  return (
    <div className="file-manager">
      <div className="fm-header">
        <h2>File Manager</h2>
        <p className="fm-subtitle">Remote File System Access</p>
      </div>

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
            <button onClick={handleCopy}>Copy</button>
            <button disabled={!clipboard}>Paste</button>
            <button>Delete</button>
            <button onClick={handleRepair}>Repair</button>
          </div>

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
    </div>
  );
};

export default FileManager;

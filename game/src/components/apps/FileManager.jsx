import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import './FileManager.css';

const FileManager = () => {
  const [selectedFileSystem, setSelectedFileSystem] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
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
    setFiles([
      { name: 'log_2024_01.txt', size: '2.5 KB', corrupted: true },
      { name: 'log_2024_02.txt', size: '3.1 KB', corrupted: false },
      { name: 'log_2024_03.txt', size: '2.8 KB', corrupted: true },
    ]);
  };

  const handleCopy = () => {
    const selected = files.filter((f) => f.selected);
    if (selected.length > 0) {
      setClipboard(selected);
      alert(`${selected.length} file(s) copied to clipboard`);
    }
  };

  const handleRepair = () => {
    const corrupted = files.filter((f) => f.corrupted && f.selected);
    if (corrupted.length > 0) {
      alert(`Repairing ${corrupted.length} corrupted file(s)...`);
      // Real implementation would show progress and update file status
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

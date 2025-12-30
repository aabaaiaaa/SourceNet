import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import triggerEventBus from '../../core/triggerEventBus';
import './NetworkScanner.css';

const NetworkScanner = () => {
  const game = useGame();
  const activeConnections = game.activeConnections || [];
  const setLastScanResults = game.setLastScanResults || (() => {});
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [scanType, setScanType] = useState('deep'); // 'quick' or 'deep'
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);

  const handleScan = () => {
    if (!selectedNetwork) return;

    setScanning(true);
    const scanDuration = scanType === 'quick' ? 5000 : 15000;

    setTimeout(() => {
      // Mock scan results (real implementation would come from mission data)
      const results = {
        network: selectedNetwork,
        machines: [
          { ip: '192.168.50.10', hostname: 'fileserver-01', id: 'fileserver-01', fileSystems: ['/logs/'] },
          { ip: '192.168.50.20', hostname: 'backup-server', id: 'backup-server', fileSystems: ['/backups/'] },
        ],
      };

      setScanResults(results);
      setLastScanResults(results); // Update global state for objective tracking

      // Emit scan complete event
      triggerEventBus.emit('networkScanComplete', {
        network: selectedNetwork,
        results: results,
      });

      setScanning(false);
      console.log(`🔍 Scan complete: Found ${results.machines.length} machines`);
    }, scanDuration);
  };

  return (
    <div className="network-scanner">
      <div className="scanner-header">
        <h2>Network Scanner</h2>
        <p className="scanner-subtitle">Discover machines and file systems</p>
      </div>

      <div className="scan-controls">
        <label>
          Network:
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            disabled={scanning}
          >
            <option value="">Select connected network</option>
            {activeConnections && activeConnections.map((conn) => (
              <option key={conn.networkId} value={conn.networkId}>
                {conn.networkName || conn.networkId}
              </option>
            ))}
          </select>
        </label>

        <label>
          Scan Type:
          <select
            value={scanType}
            onChange={(e) => setScanType(e.target.value)}
            disabled={scanning}
          >
            <option value="quick">Quick Scan (5s - machines only)</option>
            <option value="deep">Deep Scan (15s - machines + file systems)</option>
          </select>
        </label>

        <button
          className="scan-btn"
          onClick={handleScan}
          disabled={!selectedNetwork || scanning}
        >
          {scanning ? 'Scanning...' : 'Start Scan'}
        </button>
      </div>

      {scanResults && (
        <div className="scan-results">
          <h3>Scan Results</h3>
          {scanResults.machines.map((machine) => (
            <div key={machine.ip} className="machine-item">
              <div className="machine-ip">{machine.ip}</div>
              <div className="machine-hostname">{machine.hostname}</div>
              {machine.fileSystems && (
                <div className="machine-filesystems">
                  File Systems: {machine.fileSystems.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NetworkScanner;

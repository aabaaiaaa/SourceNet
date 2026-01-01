import { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import triggerEventBus from '../../core/triggerEventBus';
import './NetworkScanner.css';

// Data sizes for scan types (in MB)
const SCAN_SIZES = {
  quick: 5,  // 5 MB for quick scan
  deep: 15,  // 15 MB for deep scan
};

const NetworkScanner = () => {
  const game = useGame();
  const activeConnections = game.activeConnections || [];
  const setLastScanResults = game.setLastScanResults || (() => {});
  const registerBandwidthOperation = game.registerBandwidthOperation || (() => ({ operationId: null, estimatedTimeMs: 5000 }));
  const completeBandwidthOperation = game.completeBandwidthOperation || (() => {});
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [scanType, setScanType] = useState('deep'); // 'quick' or 'deep'
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const scanIntervalRef = useRef(null);

  const handleScan = () => {
    if (!selectedNetwork || scanning) return;

    // Register bandwidth operation based on scan type
    const sizeInMB = SCAN_SIZES[scanType];
    const { operationId, estimatedTimeMs } = registerBandwidthOperation(
      'network_scan',
      sizeInMB,
      { network: selectedNetwork, scanType }
    );

    setScanning(true);
    setScanProgress(0);

    // Update progress based on estimated time
    const updateInterval = 100; // Update every 100ms
    const progressIncrement = (100 / estimatedTimeMs) * updateInterval;
    let currentProgress = 0;

    scanIntervalRef.current = setInterval(() => {
      currentProgress += progressIncrement;
      setScanProgress(Math.min(100, currentProgress));

      if (currentProgress >= 100) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;

        // Complete the bandwidth operation
        completeBandwidthOperation(operationId);

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
        setScanProgress(0);
        console.log(`🔍 Scan complete: Found ${results.machines.length} machines`);
      }
    }, updateInterval);
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
          className={`scan-btn ${scanning ? 'scanning' : ''}`}
          onClick={handleScan}
          disabled={!selectedNetwork || scanning}
        >
          {scanning ? `Scanning... ${Math.floor(scanProgress)}%` : 'Start Scan'}
        </button>
      </div>

      {scanning && (
        <div className="scan-progress">
          <div className="scan-progress-bar">
            <div
              className="scan-progress-fill"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

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

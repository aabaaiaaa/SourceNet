import { useState, useRef, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import { generateDevicesForNetwork } from '../../systems/NetworkDeviceGenerator';
import './NetworkScanner.css';

// Data sizes for scan types (in MB)
const SCAN_SIZES = {
  quick: 5,  // 5 MB for quick scan
  deep: 15,  // 15 MB for deep scan
};

const NetworkScanner = () => {
  const game = useGame();
  const { currentTime } = game;
  const activeConnections = game.activeConnections || [];
  const narEntries = game.narEntries || [];
  const setLastScanResults = game.setLastScanResults || (() => { });
  const registerBandwidthOperation = game.registerBandwidthOperation || (() => ({ operationId: null, estimatedTimeMs: 5000 }));
  const completeBandwidthOperation = game.completeBandwidthOperation || (() => { });
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [scanType, setScanType] = useState('deep'); // 'quick' or 'deep'
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const [scanStartTime, setScanStartTime] = useState(null);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const operationIdRef = useRef(null);

  // Update scan progress based on game time (respects game speed)
  useEffect(() => {
    if (!scanning || !scanStartTime || !currentTime) return;

    // Calculate elapsed GAME time (respects game speed)
    const elapsedGameMs = currentTime.getTime() - scanStartTime;
    const newProgress = Math.min(100, (elapsedGameMs / estimatedDuration) * 100);
    setScanProgress(newProgress);

    if (newProgress >= 100) {
      // Scan complete
      completeBandwidthOperation(operationIdRef.current);

      // Find the NAR entry for this network
      const narEntry = narEntries.find(entry => entry.networkId === selectedNetwork);

      // Generate devices using the device generator
      const machines = generateDevicesForNetwork(narEntry, scanType);

      const results = {
        network: selectedNetwork,
        machines,
      };

      setScanResults(results);
      setLastScanResults(results);

      // Emit scan complete event
      triggerEventBus.emit('networkScanComplete', {
        network: selectedNetwork,
        results: results,
      });

      setScanning(false);
      setScanProgress(0);
      setScanStartTime(null);
      console.log(`🔍 Scan complete: Found ${results.machines.length} machines`);
    }
  }, [scanning, scanStartTime, currentTime, estimatedDuration, selectedNetwork, scanType, narEntries, completeBandwidthOperation, setLastScanResults]);

  const handleScan = () => {
    if (!selectedNetwork || scanning || !currentTime) return;

    // Register bandwidth operation based on scan type
    const sizeInMB = SCAN_SIZES[scanType];
    const { operationId, estimatedTimeMs } = registerBandwidthOperation(
      'network_scan',
      sizeInMB,
      { network: selectedNetwork, scanType }
    );

    operationIdRef.current = operationId;
    setEstimatedDuration(estimatedTimeMs);
    setScanStartTime(currentTime.getTime());
    setScanning(true);
    setScanProgress(0);
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

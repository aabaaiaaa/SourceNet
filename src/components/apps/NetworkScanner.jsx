import { useState, useRef, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import { generateDevicesForNetwork, calculateDeviceCount } from '../../systems/NetworkDeviceGenerator';
import './NetworkScanner.css';

// Scan data size formula: BASE + (deviceCount * PER_DEVICE)
const BASE_SCAN_SIZE_MB = 10;  // Network overhead
const PER_DEVICE_SIZE_MB = 5;  // Per device data

const NetworkScanner = () => {
  const game = useGame();
  const { currentTime } = game;
  const activeConnections = game.activeConnections || [];
  const setLastScanResults = game.setLastScanResults || (() => { });
  const addDiscoveredDevices = game.addDiscoveredDevices || (() => { });
  const registerBandwidthOperation = game.registerBandwidthOperation || (() => ({ operationId: null, estimatedTimeMs: 5000 }));
  const completeBandwidthOperation = game.completeBandwidthOperation || (() => { });
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const [scanStartTime, setScanStartTime] = useState(null);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [disconnectionMessage, setDisconnectionMessage] = useState(null);
  const operationIdRef = useRef(null);

  // Clean up any pending bandwidth operations on unmount
  useEffect(() => {
    return () => {
      if (operationIdRef.current) {
        completeBandwidthOperation(operationIdRef.current);
      }
    };
  }, [completeBandwidthOperation]);

  // Check if selected network is still connected
  const isNetworkConnected = selectedNetwork && activeConnections.some(
    conn => conn.networkId === selectedNetwork
  );

  // Clear disconnection message when reconnecting to any network
  useEffect(() => {
    if (activeConnections.length > 0 && disconnectionMessage) {
      setDisconnectionMessage(null);
    }
  }, [activeConnections.length, disconnectionMessage]);

  // Clear selection and stop scan if network gets disconnected
  useEffect(() => {
    if (selectedNetwork && !isNetworkConnected) {
      // Network was disconnected
      if (scanning) {
        // Cancel ongoing scan
        if (operationIdRef.current) {
          completeBandwidthOperation(operationIdRef.current);
        }
        setScanning(false);
        setScanProgress(0);
        setScanStartTime(null);
        setDisconnectionMessage('Scan cancelled - disconnected from network');
      } else {
        setDisconnectionMessage('Disconnected from network');
      }
      setSelectedNetwork('');
      setScanResults(null);

      // Clear message after 3 seconds
      const timer = setTimeout(() => setDisconnectionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedNetwork, isNetworkConnected, scanning, completeBandwidthOperation]);

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

      // Get the network from NetworkRegistry
      const network = networkRegistry.getNetwork(selectedNetwork);

      // Generate devices using the device generator
      const machines = generateDevicesForNetwork(network);

      const results = {
        network: selectedNetwork,
        machines,
      };

      setScanResults(results);
      setLastScanResults(results);

      // Add discovered IPs to persistent discovered devices
      const discoveredIps = machines.map(m => m.ip);
      addDiscoveredDevices(selectedNetwork, discoveredIps);

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
  }, [scanning, scanStartTime, currentTime, estimatedDuration, selectedNetwork, completeBandwidthOperation, setLastScanResults, addDiscoveredDevices]);

  const handleScan = () => {
    if (!selectedNetwork || scanning || !currentTime) return;

    // Calculate scan size based on device count
    const deviceCount = calculateDeviceCount(selectedNetwork);
    const sizeInMB = BASE_SCAN_SIZE_MB + (deviceCount * PER_DEVICE_SIZE_MB);

    const { operationId, estimatedTimeMs } = registerBandwidthOperation(
      'network_scan',
      sizeInMB,
      { network: selectedNetwork }
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

      {disconnectionMessage && (
        <div className="scanner-disconnection-message">
          ⚠️ {disconnectionMessage}
        </div>
      )}

      <div className="scan-controls">
        <label>
          Network:
          <select
            value={selectedNetwork}
            onChange={(e) => {
              setSelectedNetwork(e.target.value);
              setDisconnectionMessage(null);
              setScanResults(null);
            }}
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

        {activeConnections.length === 0 && (
          <div className="scanner-no-networks">
            No networks connected. Use the VPN Client to connect to a network first.
          </div>
        )}

        {isNetworkConnected && (
          <button
            className={`scan-btn ${scanning ? 'scanning' : ''}`}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? `Scanning... ${Math.floor(scanProgress)}%` : 'Start Scan'}
          </button>
        )}
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

      {isNetworkConnected && scanResults && (
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

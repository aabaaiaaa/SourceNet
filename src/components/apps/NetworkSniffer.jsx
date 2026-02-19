import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../contexts/useGame';
import { CPU_CRACK_MULTIPLIERS } from '../../constants/gameConstants';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../../core/gameTimeScheduler';
import { getAdapterSpeed } from '../../systems/NetworkBandwidthSystem';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import './NetworkSniffer.css';

// Protocols for fake packet generation
const PROTOCOLS = ['TCP', 'HTTP', 'HTTPS', 'SSH', 'FTP', 'DNS', 'SFTP', 'TLS'];
const PACKET_TYPES = [
  '[SYN] Seq=0 Win=64240',
  '[SYN, ACK] Seq=0 Ack=1',
  '[ACK] Seq=1 Ack=1',
  '[PSH, ACK] Len=512',
  '[FIN, ACK] Seq=1024',
  'Encrypted packet (len=256)',
  'Encrypted packet (len=1024)',
  'TLS Client Hello',
  'TLS Server Hello',
  'POST /api/auth',
  'GET /api/status',
  'KEY_EXCHANGE init',
  'CREDENTIAL_CHECK resp=OK',
  'SESSION_TOKEN refresh',
];

// Special packet types that indicate hash fragment capture
const HASH_FRAGMENT_PACKETS = [
  '** HASH FRAGMENT CAPTURED ** (credential data detected)',
  '** AUTH TOKEN FRAGMENT ** (partial credential reconstructed)',
  '** KEY MATERIAL DETECTED ** (encryption key fragment)',
  '** CREDENTIAL HASH CAPTURED ** (authentication data)',
];

// Base required fragments (before hardware modifiers)
const BASE_REQUIRED_FRAGMENTS = 20;

// Auto-reset delay after success (ms)
const SUCCESS_DISPLAY_MS = 2000;

const NetworkSniffer = () => {
  const {
    activeConnections,
    hardware,
    timeSpeed,
    isPaused,
  } = useGame();

  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [mode, setMode] = useState('credentials'); // 'credentials' | 'investigate'
  const [monitoring, setMonitoring] = useState(false);
  const [packets, setPackets] = useState([]);
  const [reconstructionProgress, setReconstructionProgress] = useState(0);
  const [reconstructionComplete, setReconstructionComplete] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState(null); // null | 'success'
  const [statusMessage, setStatusMessage] = useState('');
  const [hashFragmentsCaptured, setHashFragmentsCaptured] = useState(0);

  const packetTimerRef = useRef(null);
  const packetLogRef = useRef(null);
  const fragmentsRef = useRef(0);
  const successResetTimerRef = useRef(null);

  // Get CPU multiplier for analysis speed
  const cpuMultiplier = CPU_CRACK_MULTIPLIERS[hardware?.cpu?.id] || 1;

  // Get network adapter speed
  const adapterSpeed = getAdapterSpeed(hardware);

  // Calculate required fragments based on hardware
  const requiredFragments = (() => {
    const network = selectedNetwork ? networkRegistry.getNetwork(selectedNetwork) : null;
    const networkBandwidth = network?.bandwidth || 50;
    const effectiveBandwidth = Math.min(networkBandwidth, adapterSpeed);
    const bandwidthFactor = effectiveBandwidth / 250;
    const cpuFactor = Math.sqrt(cpuMultiplier);
    const adjusted = Math.round(BASE_REQUIRED_FRAGMENTS / (bandwidthFactor * cpuFactor));
    return Math.max(8, Math.min(adjusted, 30));
  })();

  // Get devices that require credential extraction for the selected network
  const getCredentialDevices = useCallback((networkId) => {
    if (!networkId) return [];
    const devices = networkRegistry.getNetworkDevices(networkId);
    return devices.filter(d => d.requiresCredentials && !d.accessible);
  }, []);

  // Check if there are credential-protected devices on selected network
  const hasCredentialDevices = selectedNetwork ? getCredentialDevices(selectedNetwork).length > 0 : false;

  // Generate a fake network packet line
  const generatePacket = useCallback((networkId) => {
    const network = networkRegistry.getNetwork(networkId);
    const devices = networkRegistry.getNetworkDevices(networkId);
    const address = network?.address || '10.0.0.0/24';
    const baseIp = address.split('/')[0].split('.').slice(0, 3).join('.');

    // Use device IPs or generate random ones
    const ips = devices.length > 0
      ? devices.map(d => d.ip)
      : [1, 5, 10, 15, 20, 25].map(n => `${baseIp}.${n}`);

    const srcIdx = Math.floor(Math.random() * ips.length);
    let dstIdx = Math.floor(Math.random() * ips.length);
    if (dstIdx === srcIdx) dstIdx = (dstIdx + 1) % ips.length;

    const srcIp = ips[srcIdx];
    const dstIp = ips[dstIdx];
    const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];

    // Fragment chance increases with progress
    const currentProgress = fragmentsRef.current / requiredFragments;
    const fragmentChance = 0.05 + currentProgress * 0.15;
    const isFragment = Math.random() < fragmentChance;

    const info = isFragment
      ? HASH_FRAGMENT_PACKETS[Math.floor(Math.random() * HASH_FRAGMENT_PACKETS.length)]
      : PACKET_TYPES[Math.floor(Math.random() * PACKET_TYPES.length)];

    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    return {
      id: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      src: srcIp,
      dst: dstIp,
      protocol,
      info,
      isFragment,
    };
  }, [requiredFragments]);

  // Schedule next packet using game time
  const scheduleNextPacket = useCallback((networkId) => {
    const packetInterval = 200; // ms in game time between packets
    packetTimerRef.current = scheduleGameTimeCallback(() => {
      const newPacket = generatePacket(networkId);

      if (newPacket.isFragment && fragmentsRef.current < requiredFragments) {
        fragmentsRef.current += 1;
        const newFragments = fragmentsRef.current;
        setHashFragmentsCaptured(newFragments);

        // Update progress based on fragments
        const pct = Math.min(100, (newFragments / requiredFragments) * 100);
        setReconstructionProgress(pct);

        // Check completion
        if (newFragments >= requiredFragments) {
          setReconstructionComplete(true);
          setStatusMessage('Hash reconstruction complete. Ready to extract credentials.');
          // Don't schedule more packets after completion
          setPackets(prev => [...prev, newPacket].slice(-50));
          return;
        }
      }

      setPackets(prev => [...prev, newPacket].slice(-50));

      // Schedule next packet
      scheduleNextPacket(networkId);
    }, packetInterval, timeSpeed);
  }, [generatePacket, requiredFragments, timeSpeed]);

  // Start monitoring traffic
  const startMonitoring = useCallback(() => {
    if (!selectedNetwork || monitoring) return;

    setMonitoring(true);
    setReconstructionProgress(0);
    setReconstructionComplete(false);
    setResult(null);
    setPackets([]);
    setHashFragmentsCaptured(0);
    fragmentsRef.current = 0;
    setStatusMessage('Capturing network traffic...');

    // Start game-time packet generation
    scheduleNextPacket(selectedNetwork);
  }, [selectedNetwork, monitoring, scheduleNextPacket]);

  // Pause/resume packet generation when game is paused
  useEffect(() => {
    if (!monitoring || reconstructionComplete) return;
    if (isPaused && packetTimerRef.current) {
      clearGameTimeCallback(packetTimerRef.current);
      packetTimerRef.current = null;
    } else if (!isPaused && !packetTimerRef.current && !reconstructionComplete) {
      scheduleNextPacket(selectedNetwork);
    }
  }, [isPaused, monitoring, selectedNetwork, scheduleNextPacket, reconstructionComplete]);

  // Extract credentials - grants device access
  const extractCredentials = useCallback(() => {
    if (!reconstructionComplete || extracting) return;
    setExtracting(true);
    setStatusMessage('Extracting credentials and granting device access...');

    // Get credential-protected device IPs
    const devices = getCredentialDevices(selectedNetwork);
    const deviceIps = devices.map(d => d.ip);

    // Grant access to credential-protected devices via NetworkRegistry
    networkRegistry.grantNetworkAccess(selectedNetwork, deviceIps);

    // Emit event for objective tracking
    triggerEventBus.emit('credentialsExtracted', {
      networkId: selectedNetwork,
      deviceIps,
    });

    // Also emit narEntryAdded for any other systems that might listen
    const network = networkRegistry.getNetwork(selectedNetwork);
    triggerEventBus.emit('narEntryAdded', {
      networkId: selectedNetwork,
      networkName: network?.networkName || selectedNetwork,
    });

    setExtracting(false);
    setResult('success');
    setStatusMessage(`Credentials extracted. ${deviceIps.length} device(s) now accessible.`);

    // Stop packet generation
    if (packetTimerRef.current) {
      clearGameTimeCallback(packetTimerRef.current);
      packetTimerRef.current = null;
    }

    console.log(`NetworkSniffer: Extracted credentials for ${selectedNetwork}, granted access to ${deviceIps.length} devices`);

    // Auto-reset after success display (F2: no "Monitor Another Network" button)
    successResetTimerRef.current = setTimeout(() => {
      setMonitoring(false);
      setReconstructionProgress(0);
      setReconstructionComplete(false);
      setPackets([]);
      setHashFragmentsCaptured(0);
      fragmentsRef.current = 0;
      setResult(null);
      setStatusMessage('');
    }, SUCCESS_DISPLAY_MS);
  }, [reconstructionComplete, extracting, selectedNetwork, getCredentialDevices]);

  // Cancel monitoring
  const cancelMonitoring = useCallback(() => {
    if (packetTimerRef.current) {
      clearGameTimeCallback(packetTimerRef.current);
      packetTimerRef.current = null;
    }
    setMonitoring(false);
    setReconstructionProgress(0);
    setReconstructionComplete(false);
    setPackets([]);
    setHashFragmentsCaptured(0);
    fragmentsRef.current = 0;
    setStatusMessage('Monitoring cancelled.');
  }, []);

  // Auto-scroll packet log
  useEffect(() => {
    if (packetLogRef.current) {
      packetLogRef.current.scrollTop = packetLogRef.current.scrollHeight;
    }
  }, [packets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (packetTimerRef.current) clearGameTimeCallback(packetTimerRef.current);
      if (successResetTimerRef.current) clearTimeout(successResetTimerRef.current);
    };
  }, []);

  // Build network options from active connections
  const networkOptions = (activeConnections || []).map(conn => ({
    id: conn.networkId,
    name: conn.networkName || conn.networkId,
  }));

  const hasNetworks = networkOptions.length > 0;
  const selectedConn = activeConnections?.find(c => c.networkId === selectedNetwork);
  const selectedNetworkData = selectedNetwork ? networkRegistry.getNetwork(selectedNetwork) : null;

  return (
    <div className="network-sniffer">
      <div className="ns-header">
        <h2>Network Sniffer</h2>
        <p className="ns-subtitle">Monitor network traffic and extract credentials</p>
      </div>

      {/* Network Selection */}
      <div className="ns-section">
        <h3>Target Network</h3>
        {hasNetworks ? (
          <select
            className="ns-dropdown"
            value={selectedNetwork}
            onChange={(e) => {
              if (!monitoring) {
                setSelectedNetwork(e.target.value);
                setResult(null);
                setStatusMessage('');
              }
            }}
            disabled={monitoring}
          >
            <option value="">Select a network...</option>
            {networkOptions.map(net => (
              <option key={net.id} value={net.id}>{net.name}</option>
            ))}
          </select>
        ) : (
          <div className="ns-empty">No networks connected. Use VPN Client to connect first.</div>
        )}
      </div>

      {/* Mode Selection */}
      {selectedNetwork && selectedConn && (
        <div className="ns-section">
          <h3>Mode</h3>
          <div className="ns-modes">
            <button
              className={`ns-mode-btn ${mode === 'credentials' ? 'active' : ''}`}
              onClick={() => !monitoring && setMode('credentials')}
              disabled={monitoring}
            >
              Extract Credentials
            </button>
            <button
              className={`ns-mode-btn ${mode === 'investigate' ? 'active' : ''}`}
              onClick={() => !monitoring && setMode('investigate')}
              disabled={monitoring}
            >
              Investigate Traffic
            </button>
          </div>
        </div>
      )}

      {/* Credential Extraction Mode */}
      {selectedNetwork && selectedConn && mode === 'credentials' && (
        <>
          {/* Traffic Monitor / Progress */}
          {(monitoring || result) && (
            <div className="ns-section ns-monitor-section">
              <h3>Traffic Monitor</h3>

              {/* Packet Log */}
              <div className="ns-packet-log" ref={packetLogRef}>
                {packets.map(pkt => (
                  <div key={pkt.id} className={`ns-packet ${pkt.isFragment ? 'fragment' : ''}`}>
                    <span className="ns-pkt-time">{pkt.timestamp}</span>
                    <span className="ns-pkt-src">{pkt.src}</span>
                    <span className="ns-pkt-arrow">&rarr;</span>
                    <span className="ns-pkt-dst">{pkt.dst}</span>
                    <span className="ns-pkt-proto">{pkt.protocol}</span>
                    <span className="ns-pkt-info">{pkt.info}</span>
                  </div>
                ))}
                {packets.length === 0 && monitoring && (
                  <div className="ns-packet-placeholder">Waiting for packets...</div>
                )}
              </div>

              {/* Hash Reconstruction */}
              <div className="ns-reconstruction">
                <div className="ns-recon-header">
                  <span>Hash Reconstruction</span>
                  <span className="ns-recon-fragments">{hashFragmentsCaptured}/{requiredFragments} fragments</span>
                </div>
                <div className="ns-progress-bar">
                  <div
                    className={`ns-progress-fill ${result === 'success' ? 'success' : reconstructionComplete ? 'ready' : ''}`}
                    style={{ width: `${reconstructionProgress}%` }}
                  />
                </div>
                <div className="ns-progress-text">{Math.floor(reconstructionProgress)}%</div>
              </div>

              {/* Status */}
              <div className={`ns-status ${result === 'success' ? 'success' : ''}`}>
                {statusMessage}
              </div>

              {/* Hardware Info */}
              <div className="ns-hardware-info">
                <span>Network: {selectedNetworkData?.bandwidth || '?'} Mbps</span>
                <span>Adapter: {adapterSpeed} Mbps</span>
                <span>CPU: {hardware?.cpu?.name || 'Unknown'} ({cpuMultiplier}x)</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="ns-actions">
            {!monitoring && !result && hasCredentialDevices && (
              <button className="ns-start-btn" onClick={startMonitoring}>
                Start Monitoring
              </button>
            )}
            {!monitoring && !result && !hasCredentialDevices && (
              <div className="ns-empty">No credential-protected devices found on this network.</div>
            )}
            {monitoring && !reconstructionComplete && (
              <button className="ns-cancel-btn" onClick={cancelMonitoring}>
                Cancel
              </button>
            )}
            {reconstructionComplete && !result && (
              <button className="ns-extract-btn" onClick={extractCredentials}>
                Extract Credentials
              </button>
            )}
          </div>
        </>
      )}

      {/* Investigation Mode */}
      {selectedNetwork && selectedConn && mode === 'investigate' && (
        <>
          <div className="ns-section">
            <h3>Traffic Analysis</h3>
            {monitoring ? (
              <>
                {/* Packet Log (same as credential mode) */}
                <div className="ns-packet-log" ref={packetLogRef}>
                  {packets.map(pkt => (
                    <div key={pkt.id} className={`ns-packet ${pkt.isFragment ? 'fragment' : ''}`}>
                      <span className="ns-pkt-time">{pkt.timestamp}</span>
                      <span className="ns-pkt-src">{pkt.src}</span>
                      <span className="ns-pkt-arrow">&rarr;</span>
                      <span className="ns-pkt-dst">{pkt.dst}</span>
                      <span className="ns-pkt-proto">{pkt.protocol}</span>
                      <span className="ns-pkt-info">{pkt.info}</span>
                    </div>
                  ))}
                </div>

                {/* Analysis Summary */}
                <div className="ns-analysis-summary">
                  <div className="ns-analysis-stat">
                    <span className="ns-stat-label">Packets Captured:</span>
                    <span className="ns-stat-value">{packets.length}</span>
                  </div>
                  <div className="ns-analysis-stat">
                    <span className="ns-stat-label">Unique Sources:</span>
                    <span className="ns-stat-value">{new Set(packets.map(p => p.src)).size}</span>
                  </div>
                  <div className="ns-analysis-stat">
                    <span className="ns-stat-label">Anomalies Detected:</span>
                    <span className="ns-stat-value">{packets.filter(p => p.isFragment).length}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="ns-empty">Start monitoring to capture and analyse traffic patterns.</div>
            )}
          </div>

          <div className="ns-actions">
            {!monitoring ? (
              <button className="ns-start-btn" onClick={() => {
                setMonitoring(true);
                setPackets([]);
                // Use game-time packet generation for investigate mode too
                const scheduleInvestigatePacket = () => {
                  packetTimerRef.current = scheduleGameTimeCallback(() => {
                    const newPacket = generatePacket(selectedNetwork);
                    setPackets(prev => [...prev, newPacket].slice(-50));
                    scheduleInvestigatePacket();
                  }, 200, timeSpeed);
                };
                scheduleInvestigatePacket();
              }}>
                Start Monitoring
              </button>
            ) : (
              <button className="ns-cancel-btn" onClick={() => {
                if (packetTimerRef.current) {
                  clearGameTimeCallback(packetTimerRef.current);
                  packetTimerRef.current = null;
                }
                setMonitoring(false);
              }}>
                Stop Monitoring
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NetworkSniffer;

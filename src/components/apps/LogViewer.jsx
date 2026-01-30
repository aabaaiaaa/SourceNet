import { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../../core/gameTimeScheduler';
import './LogViewer.css';

const LOG_FETCH_DELAY_MS = 3000; // 3 seconds in game time

const LogViewer = () => {
  const { activeConnections, timeSpeed } = useGame();

  // Tab state
  const [activeTab, setActiveTab] = useState('network'); // 'network' | 'device'

  // Network logs state
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [networkLogs, setNetworkLogs] = useState(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const networkLoadingTimerRef = useRef(null);

  // Device logs state
  const [selectedDevice, setSelectedDevice] = useState(null); // { ip, hostname, networkId, networkName }
  const [deviceLogs, setDeviceLogs] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const deviceLoadingTimerRef = useRef(null);

  // Shared state
  const [disconnectionMessage, setDisconnectionMessage] = useState(null);

  // Build list of all devices from all connected networks
  const allDevices = useMemo(() => {
    if (!activeConnections || activeConnections.length === 0) return [];

    return activeConnections.flatMap(conn => {
      const devices = networkRegistry.getNetworkDevices(conn.networkId);
      return devices.map(device => ({
        ip: device.ip,
        hostname: device.hostname,
        networkId: conn.networkId,
        networkName: conn.networkName,
        displayLabel: `${device.hostname} (${conn.networkName})`,
      }));
    });
  }, [activeConnections]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (networkLoadingTimerRef.current) {
        clearGameTimeCallback(networkLoadingTimerRef.current);
      }
      if (deviceLoadingTimerRef.current) {
        clearGameTimeCallback(deviceLoadingTimerRef.current);
      }
    };
  }, []);

  // Handle network disconnection
  useEffect(() => {
    const handleDisconnect = ({ networkId, networkName }) => {
      // Clear network tab selection if this network was selected
      if (selectedNetworkId === networkId) {
        if (networkLoadingTimerRef.current) {
          clearGameTimeCallback(networkLoadingTimerRef.current);
          networkLoadingTimerRef.current = null;
        }
        setSelectedNetworkId('');
        setNetworkLogs(null);
        setNetworkLoading(false);
        setDisconnectionMessage(`Disconnected from ${networkName}`);
      }

      // Clear device tab selection if device was on this network
      if (selectedDevice?.networkId === networkId) {
        if (deviceLoadingTimerRef.current) {
          clearGameTimeCallback(deviceLoadingTimerRef.current);
          deviceLoadingTimerRef.current = null;
        }
        setSelectedDevice(null);
        setDeviceLogs(null);
        setDeviceLoading(false);
        setDisconnectionMessage(`Disconnected from ${networkName}`);
      }
    };

    triggerEventBus.on('networkDisconnected', handleDisconnect);
    return () => triggerEventBus.off('networkDisconnected', handleDisconnect);
  }, [selectedNetworkId, selectedDevice]);

  // Auto-clear disconnection message after 3 seconds
  useEffect(() => {
    if (disconnectionMessage) {
      const timer = setTimeout(() => setDisconnectionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [disconnectionMessage]);

  // Fetch network logs
  const handleFetchNetworkLogs = () => {
    if (!selectedNetworkId || networkLoading) return;

    setNetworkLoading(true);
    setNetworkLogs(null);

    networkLoadingTimerRef.current = scheduleGameTimeCallback(() => {
      const logs = networkRegistry.getNetworkLogs(selectedNetworkId);
      setNetworkLogs(logs);
      setNetworkLoading(false);
      networkLoadingTimerRef.current = null;
    }, LOG_FETCH_DELAY_MS, timeSpeed);
  };

  // Fetch device logs
  const handleFetchDeviceLogs = () => {
    if (!selectedDevice || deviceLoading) return;

    setDeviceLoading(true);
    setDeviceLogs(null);

    deviceLoadingTimerRef.current = scheduleGameTimeCallback(() => {
      const logs = networkRegistry.getDeviceLogs(selectedDevice.ip);
      setDeviceLogs(logs);
      setDeviceLoading(false);
      deviceLoadingTimerRef.current = null;
    }, LOG_FETCH_DELAY_MS, timeSpeed);
  };

  // Handle device dropdown selection
  const handleDeviceSelect = (e) => {
    const ip = e.target.value;
    if (!ip) {
      setSelectedDevice(null);
      setDeviceLogs(null);
      return;
    }
    const device = allDevices.find(d => d.ip === ip);
    setSelectedDevice(device || null);
    setDeviceLogs(null);
  };

  // Format log timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasConnectedNetworks = activeConnections && activeConnections.length > 0;

  return (
    <div className="log-viewer">
      <div className="log-viewer-header">
        <h2>Log Viewer</h2>
        <p className="log-viewer-subtitle">View network and device activity logs</p>
      </div>

      {disconnectionMessage && (
        <div className="log-viewer-disconnection-message">
          {disconnectionMessage}
        </div>
      )}

      <div className="log-viewer-tabs">
        <button
          className={`log-viewer-tab ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          Network Logs
        </button>
        <button
          className={`log-viewer-tab ${activeTab === 'device' ? 'active' : ''}`}
          onClick={() => setActiveTab('device')}
        >
          Device Logs
        </button>
      </div>

      {/* Network Logs Tab */}
      {activeTab === 'network' && (
        <div className="log-viewer-tab-content">
          {!hasConnectedNetworks ? (
            <div className="log-viewer-no-networks">
              No networks connected. Use the VPN Client to connect to a network first.
            </div>
          ) : (
            <>
              <div className="log-controls">
                <label>
                  Network:
                  <select
                    value={selectedNetworkId}
                    onChange={(e) => {
                      setSelectedNetworkId(e.target.value);
                      setNetworkLogs(null);
                      setDisconnectionMessage(null);
                    }}
                    disabled={networkLoading}
                  >
                    <option value="">Select network</option>
                    {activeConnections.map((conn) => (
                      <option key={conn.networkId} value={conn.networkId}>
                        {conn.networkName || conn.networkId}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="log-viewer-btn"
                  onClick={handleFetchNetworkLogs}
                  disabled={!selectedNetworkId || networkLoading}
                >
                  {networkLoading ? 'Fetching...' : 'View Logs'}
                </button>
              </div>

              {networkLoading && (
                <div className="log-viewer-loading">
                  Fetching network logs...
                </div>
              )}

              {networkLogs !== null && !networkLoading && (
                <div className="log-display">
                  {networkLogs.length === 0 ? (
                    <div className="log-empty">No logs found for this network.</div>
                  ) : (
                    networkLogs.map((log) => (
                      <div key={log.id} className="log-entry">
                        <span className="log-timestamp">[{formatTimestamp(log.timestamp)}]</span>
                        {log.user && <span className="log-user">{log.user}</span>}
                        <span className="log-action">{log.action?.toUpperCase()}</span>
                        {log.note && <span className="log-note">- {log.note}</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Device Logs Tab */}
      {activeTab === 'device' && (
        <div className="log-viewer-tab-content">
          {!hasConnectedNetworks ? (
            <div className="log-viewer-no-networks">
              No networks connected. Use the VPN Client to connect to a network first.
            </div>
          ) : allDevices.length === 0 ? (
            <div className="log-viewer-no-networks">
              No devices found. Use the Network Scanner to discover devices first.
            </div>
          ) : (
            <>
              <div className="log-controls">
                <label>
                  Device:
                  <select
                    value={selectedDevice?.ip || ''}
                    onChange={handleDeviceSelect}
                    disabled={deviceLoading}
                  >
                    <option value="">Select device</option>
                    {allDevices.map((device) => (
                      <option key={device.ip} value={device.ip}>
                        {device.displayLabel}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="log-viewer-btn"
                  onClick={handleFetchDeviceLogs}
                  disabled={!selectedDevice || deviceLoading}
                >
                  {deviceLoading ? 'Fetching...' : 'View Logs'}
                </button>
              </div>

              {deviceLoading && (
                <div className="log-viewer-loading">
                  Fetching device logs...
                </div>
              )}

              {deviceLogs !== null && !deviceLoading && (
                <div className="log-display">
                  {deviceLogs.length === 0 ? (
                    <div className="log-empty">No logs found for this device.</div>
                  ) : (
                    deviceLogs.map((log) => (
                      <div key={log.id} className="log-entry">
                        <span className="log-timestamp">[{formatTimestamp(log.timestamp)}]</span>
                        {log.user && <span className="log-user">{log.user}</span>}
                        <span className="log-action">{log.action?.toUpperCase()}</span>
                        {log.fileName && (
                          <span className="log-file">
                            - {log.fileName}
                            {log.sizeBytes && ` (${formatSize(log.sizeBytes)})`}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LogViewer;

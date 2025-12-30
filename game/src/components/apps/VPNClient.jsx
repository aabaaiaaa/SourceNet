import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import triggerEventBus from '../../core/triggerEventBus';
import './VPNClient.css';

const VPNClient = () => {
  const { narEntries, activeConnections, setActiveConnections } = useGame();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Get available networks from NAR (non-expired only)
  const availableNetworks = (narEntries || []).filter((entry) => entry.status !== 'expired');

  const handleConnect = () => {
    if (!selectedNetwork) return;

    const networkEntry = narEntries.find((e) => e.networkId === selectedNetwork);
    if (!networkEntry) return;

    // Simulate connection delay
    setConnecting(true);
    setTimeout(() => {
      const newConnection = {
        networkId: networkEntry.networkId,
        networkName: networkEntry.networkName,
        address: networkEntry.address,
        connectedAt: new Date().toISOString(),
      };

      setActiveConnections([...activeConnections, newConnection]);

      // Emit network connected event
      triggerEventBus.emit('networkConnected', {
        networkId: newConnection.networkId,
        networkName: newConnection.networkName,
      });

      setConnecting(false);
      setSelectedNetwork('');
      console.log(`🔒 Connected to: ${newConnection.networkName}`);
    }, 3000); // 3 second connection time
  };

  const handleDisconnect = (networkId) => {
    setActiveConnections(activeConnections.filter((conn) => conn.networkId !== networkId));
  };

  return (
    <div className="vpn-client">
      <div className="vpn-header">
        <h2>SourceNet VPN Client</h2>
        <p className="vpn-subtitle">Secure Network Access</p>
      </div>

      {/* Connected Networks List */}
      <div className="connected-networks-section">
        <h3>Connected Networks</h3>
        {activeConnections && activeConnections.length > 0 ? (
          <div className="connected-list">
            {activeConnections.map((conn) => (
              <div key={conn.networkId} className="connected-item">
                <div className="connection-info">
                  <div className="connection-status">
                    <span className="status-indicator">●</span> Connected
                  </div>
                  <div className="connection-name">{conn.networkName || conn.networkId}</div>
                  <div className="connection-address">{conn.address}</div>
                </div>
                <button
                  className="disconnect-btn"
                  onClick={() => handleDisconnect(conn.networkId)}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No active connections</div>
        )}
      </div>

      {/* New Connection Section */}
      <div className="new-connection-section">
        <h3>New Connection</h3>

        {availableNetworks.length > 0 ? (
          <>
            <select
              className="network-dropdown"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              disabled={connecting}
            >
              <option value="">Select Network</option>
              {availableNetworks.map((entry) => (
                <option key={entry.id} value={entry.networkId}>
                  {entry.networkName || entry.networkId}
                </option>
              ))}
            </select>

            <button
              className="connect-btn"
              onClick={handleConnect}
              disabled={!selectedNetwork || connecting}
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>

            {connecting && (
              <div className="connecting-status">
                Establishing secure connection...
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            No network credentials available. Accept a mission to receive network access.
          </div>
        )}
      </div>

      {/* Connection Log */}
      <div className="connection-log-section">
        <h3>Connection Log</h3>
        <div className="connection-log">
          {activeConnections && activeConnections.length > 0 ? (
            activeConnections.map((conn) => (
              <div key={conn.networkId} className="log-entry">
                Connected to {conn.networkName || conn.networkId} at{' '}
                {new Date(conn.connectedAt).toLocaleTimeString()}
              </div>
            ))
          ) : (
            <div className="log-empty">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VPNClient;

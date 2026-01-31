import { useState, useEffect, useRef } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import './VPNClient.css';

const VPNClient = () => {
  const { activeConnections, setActiveConnections, currentTime, pendingVpnConnection, clearPendingVpnConnection, username } = useGame();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [knownNetworks, setKnownNetworks] = useState([]);
  const animationFrameRef = useRef(null);

  // Subscribe to network access changes to refresh known networks list
  useEffect(() => {
    const refreshNetworks = () => {
      setKnownNetworks(networkRegistry.getKnownNetworks());
    };

    // Initial load
    refreshNetworks();

    // Listen for access changes and registry reloads
    triggerEventBus.on('networkAccessGranted', refreshNetworks);
    triggerEventBus.on('networkAccessRevoked', ({ networkId, reason }) => {
      // Refresh known networks
      refreshNetworks();

      // If we are connected to the revoked network, disconnect and log
      setActiveConnections((prev) => {
        const removed = prev.filter(conn => conn.networkId === networkId);
        const remaining = prev.filter(conn => conn.networkId !== networkId);

        if (removed.length > 0) {
          removed.forEach((conn) => {
            try {
              networkRegistry.addNetworkLog(conn.networkId, {
                type: 'remote',
                action: 'disconnect',
                user: username,
                note: `Disconnected (access revoked)${reason ? `: ${reason}` : ''}`,
                timestamp: new Date().toISOString(),
              });
            } catch (e) {
              console.warn('VPNClient: failed to write network log on revoke', e);
            }
          });
        }

        return remaining;
      });
    });
    triggerEventBus.on('networkRegistryLoaded', refreshNetworks);

    return () => {
      triggerEventBus.off('networkAccessGranted', refreshNetworks);
      triggerEventBus.off('networkAccessRevoked', refreshNetworks);
      triggerEventBus.off('networkRegistryLoaded', refreshNetworks);
    };
  }, []);

  // Auto-connect when initiated from NAR
  useEffect(() => {
    if (pendingVpnConnection && !connecting) {
      const network = networkRegistry.getNetwork(pendingVpnConnection);
      if (network && network.accessible) {
        // Check if already connected
        const alreadyConnected = (activeConnections || []).some(
          conn => conn.networkId === pendingVpnConnection
        );
        if (!alreadyConnected && currentTime) {
          setSelectedNetwork(pendingVpnConnection);
          // Start connection
          setPendingConnection({
            networkId: network.networkId,
            networkName: network.networkName,
            address: network.address,
          });
          setConnectionStartTime(currentTime.getTime());
          setConnecting(true);
        }
      }
      clearPendingVpnConnection();
    }
  }, [pendingVpnConnection, activeConnections, connecting, currentTime, clearPendingVpnConnection]);

  // Monitor game time for connection completion
  useEffect(() => {
    if (!connecting || !connectionStartTime || !currentTime || !pendingConnection) return;

    const animate = () => {
      // Calculate elapsed GAME time (respects game speed)
      const elapsedGameMs = currentTime.getTime() - connectionStartTime;
      const connectionDuration = 3000; // 3 seconds in game time

      if (elapsedGameMs >= connectionDuration) {
        // Connection complete
        const newConnection = {
          networkId: pendingConnection.networkId,
          networkName: pendingConnection.networkName,
          address: pendingConnection.address,
          connectedAt: currentTime.toISOString(),
        };

        setActiveConnections((prev) => {
          // Prevent duplicate connections (race condition guard)
          const alreadyExists = (prev || []).some(conn => conn.networkId === newConnection.networkId);
          if (alreadyExists) {
            console.warn(`VPNClient: Already connected to ${newConnection.networkId}, skipping duplicate`);
            return prev;
          }

          const updated = [...(prev || []), newConnection];

          // Log network-level connection
          try {
            networkRegistry.addNetworkLog(newConnection.networkId, {
              type: 'remote',
              action: 'connect',
              user: username,
              note: `Connected via VPN`,
              timestamp: currentTime.toISOString(),
            });
          } catch (e) {
            console.warn('VPNClient: failed to write network connect log', e);
          }

          return updated;
        });

        // Emit network connected event
        triggerEventBus.emit('networkConnected', {
          networkId: newConnection.networkId,
          networkName: newConnection.networkName,
        });

        setConnecting(false);
        setSelectedNetwork('');
        setConnectionStartTime(null);
        setPendingConnection(null);
        console.log(`🔒 Connected to: ${newConnection.networkName}`);
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [connecting, connectionStartTime, currentTime, pendingConnection, activeConnections, setActiveConnections]);

  // Get available networks (accessible and not already connected)
  const connectedNetworkIds = new Set((activeConnections || []).map(conn => conn.networkId));
  const availableNetworks = knownNetworks.filter((network) =>
    network.accessible && !connectedNetworkIds.has(network.networkId)
  );

  const handleConnect = () => {
    if (!selectedNetwork || !currentTime) return;

    const network = networkRegistry.getNetwork(selectedNetwork);
    if (!network) return;

    // Check if network is accessible
    if (!network.accessible) {
      console.warn(`Cannot connect to ${network.networkId}: Access revoked`);
      return;
    }

    // Start connection using game time
    setPendingConnection({
      networkId: network.networkId,
      networkName: network.networkName,
      address: network.address,
    });
    setConnectionStartTime(currentTime.getTime());
    setConnecting(true);
  };

  const handleDisconnect = (networkId) => {
    setActiveConnections((prev) => {
      const remaining = (prev || []).filter((conn) => conn.networkId !== networkId);

      // Write network-level disconnect log
      try {
        networkRegistry.addNetworkLog(networkId, {
          type: 'remote',
          action: 'disconnect',
          user: username,
          note: 'Player disconnected via VPN',
          timestamp: currentTime ? currentTime.toISOString() : new Date().toISOString(),
        });
      } catch (e) {
        console.warn('VPNClient: failed to write network disconnect log', e);
      }

      return remaining;
    });
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

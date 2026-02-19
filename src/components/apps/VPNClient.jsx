import { useState, useEffect, useRef, useMemo } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import { calculateChainCost, calculateChainBandwidth, calculateETT, formatETT, applySuspicion } from '../../systems/RelaySystem';
import './VPNClient.css';

const VPNClient = () => {
  const {
    activeConnections, setActiveConnections, currentTime, pendingVpnConnection,
    clearPendingVpnConnection, username, software,
    relayNodes, setRelayNodes, setActiveRelayChain,
    purchasedServices, updateBankBalance, setTransactions, bankAccounts,
  } = useGame();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionStartTime, setConnectionStartTime] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [knownNetworks, setKnownNetworks] = useState([]);
  const [relayPanelExpanded, setRelayPanelExpanded] = useState(false);
  const [selectedRelayIds, setSelectedRelayIds] = useState([]);
  const animationFrameRef = useRef(null);

  const hasRelayUpgrade = software.includes('vpn-relay-upgrade');
  const hasRelayService = purchasedServices.includes('relay-service-standard');
  const showRelayPanel = hasRelayUpgrade;

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
        const relayChain = showRelayPanel ? selectedRelayIds : [];
        const newConnection = {
          networkId: pendingConnection.networkId,
          networkName: pendingConnection.networkName,
          address: pendingConnection.address,
          connectedAt: currentTime.toISOString(),
          relayChain,
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
            const relayNote = relayChain.length > 0
              ? `Connected via VPN (${relayChain.length} relay nodes)`
              : 'Connected via VPN';
            networkRegistry.addNetworkLog(newConnection.networkId, {
              type: 'remote',
              action: 'connect',
              user: username,
              note: relayNote,
              timestamp: currentTime.toISOString(),
            });
          } catch (e) {
            console.warn('VPNClient: failed to write network connect log', e);
          }

          return updated;
        });

        // Apply suspicion to relay nodes and deduct relay costs
        if (relayChain.length > 0) {
          const updatedNodes = applySuspicion(relayChain, relayNodes);
          setRelayNodes(updatedNodes);
          setActiveRelayChain(relayChain);

          // Deduct relay costs
          const cost = calculateChainCost(relayChain, relayNodes);
          if (cost > 0 && bankAccounts?.[0]?.id) {
            updateBankBalance(bankAccounts[0].id, -cost, 'relay-usage');
            setTransactions(prev => [...prev, {
              id: `txn-relay-${Date.now()}`,
              date: currentTime.toISOString(),
              type: 'expense',
              amount: -cost,
              description: `Relay chain usage (${relayChain.length} nodes)`,
              balanceAfter: bankAccounts[0].balance - cost,
            }]);
          }
        }

        // Emit network connected event
        triggerEventBus.emit('networkConnected', {
          networkId: newConnection.networkId,
          networkName: newConnection.networkName,
          relayChain,
        });

        setConnecting(false);
        setSelectedNetwork('');
        setConnectionStartTime(null);
        setPendingConnection(null);
        console.log(`🔒 Connected to: ${newConnection.networkName}${relayChain.length > 0 ? ` via ${relayChain.length} relays` : ''}`);
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

  // Relay chain stats
  const chainStats = useMemo(() => {
    if (!showRelayPanel || selectedRelayIds.length === 0) return null;
    return {
      cost: calculateChainCost(selectedRelayIds, relayNodes),
      bandwidth: calculateChainBandwidth(selectedRelayIds, relayNodes),
      ett: calculateETT(selectedRelayIds, relayNodes),
    };
  }, [showRelayPanel, selectedRelayIds, relayNodes]);

  const availableRelayNodes = useMemo(() => {
    return (relayNodes || []).filter(n => !n.burned);
  }, [relayNodes]);

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

    // Clear active relay chain if this was the relayed connection
    setActiveRelayChain([]);
  };

  const toggleRelayNode = (nodeId) => {
    setSelectedRelayIds(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  };

  const moveRelayNode = (nodeId, direction) => {
    setSelectedRelayIds(prev => {
      const index = prev.indexOf(nodeId);
      if (index === -1) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
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
                    {conn.relayChain?.length > 0 && (
                      <span className="relay-badge"> ({conn.relayChain.length} relays)</span>
                    )}
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
                <option key={entry.networkId} value={entry.networkId}>
                  {entry.networkName || entry.networkId}
                </option>
              ))}
            </select>

            {/* Relay Panel */}
            {showRelayPanel && (
              <div className="relay-panel">
                <div
                  className="relay-panel-header"
                  onClick={() => setRelayPanelExpanded(!relayPanelExpanded)}
                >
                  <span className="relay-panel-chevron">{relayPanelExpanded ? '\u25BC' : '\u25B6'}</span>
                  <span className="relay-panel-title">Relay Routing</span>
                  {selectedRelayIds.length > 0 && (
                    <span className="relay-panel-summary">
                      {selectedRelayIds.length} node{selectedRelayIds.length !== 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>

                {relayPanelExpanded && (
                  <div className="relay-panel-content">
                    {!hasRelayService ? (
                      <div className="relay-placeholder">
                        Purchase Standard Relay Service from Portal to access relay nodes
                      </div>
                    ) : (
                    <>
                    {/* Available relay nodes */}
                    <div className="relay-nodes-section">
                      <div className="relay-nodes-label">Available Nodes ({availableRelayNodes.length})</div>
                      <div className="relay-nodes-list">
                        {availableRelayNodes.length === 0 ? (
                          <div className="relay-empty">No relay nodes available. Purchase from Portal Services tab.</div>
                        ) : (
                          availableRelayNodes.map((node) => {
                            const isSelected = selectedRelayIds.includes(node.id);
                            const suspicionPct = Math.floor((node.suspicion / 100) * 100);

                            return (
                              <div
                                key={node.id}
                                className={`relay-node ${isSelected ? 'selected' : ''}`}
                                onClick={() => !connecting && toggleRelayNode(node.id)}
                              >
                                <div className="relay-node-info">
                                  <div className="relay-node-name">{node.name}</div>
                                  <div className="relay-node-stats">
                                    <span>{node.bandwidth} Mbps</span>
                                    <span>${node.costPerUse}</span>
                                    <span className={suspicionPct > 60 ? 'relay-suspicion-high' : ''}>
                                      Susp: {suspicionPct}%
                                    </span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="relay-node-order">
                                    <span className="relay-order-number">#{selectedRelayIds.indexOf(node.id) + 1}</span>
                                    <button className="relay-move-btn" onClick={(e) => { e.stopPropagation(); moveRelayNode(node.id, -1); }} disabled={selectedRelayIds.indexOf(node.id) === 0}>&#9650;</button>
                                    <button className="relay-move-btn" onClick={(e) => { e.stopPropagation(); moveRelayNode(node.id, 1); }} disabled={selectedRelayIds.indexOf(node.id) === selectedRelayIds.length - 1}>&#9660;</button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Chain stats */}
                    {chainStats && (
                      <div className="relay-chain-stats">
                        <div className="relay-stat">
                          <span className="relay-stat-label">Route Cost:</span>
                          <span className="relay-stat-value">${chainStats.cost}</span>
                        </div>
                        <div className="relay-stat">
                          <span className="relay-stat-label">Max Bandwidth:</span>
                          <span className="relay-stat-value">{chainStats.bandwidth} Mbps</span>
                        </div>
                        <div className="relay-stat">
                          <span className="relay-stat-label">Est. Time-to-Traced:</span>
                          <span className="relay-stat-value relay-ett">{formatETT(chainStats.ett)}</span>
                        </div>
                      </div>
                    )}

                    {selectedRelayIds.length > 0 && (
                      <button
                        className="relay-clear-btn"
                        onClick={() => setSelectedRelayIds([])}
                      >
                        Clear Route
                      </button>
                    )}
                    </>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              className="connect-btn"
              onClick={handleConnect}
              disabled={!selectedNetwork || connecting}
            >
              {connecting ? 'Connecting...' : showRelayPanel && selectedRelayIds.length > 0 ? `Connect via ${selectedRelayIds.length} Relays` : 'Connect'}
            </button>

            {connecting && (
              <div className="connecting-status">
                {selectedRelayIds.length > 0
                  ? `Establishing relay chain (${selectedRelayIds.length} hops)...`
                  : 'Establishing secure connection...'}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            No network credentials available. Accept a mission to receive network access.
          </div>
        )}
      </div>

      {/* Burned Relay Nodes */}
      {showRelayPanel && relayNodes.some(n => n.burned) && (
        <div className="relay-burned-section">
          <h3>Burned Relay Nodes</h3>
          <div className="relay-burned-list">
            {relayNodes.filter(n => n.burned).map(node => (
              <div key={node.id} className="relay-burned-item">
                <span className="relay-burned-name">{node.name}</span>
                <span className="relay-burned-badge">BURNED</span>
              </div>
            ))}
          </div>
          <div className="relay-burned-hint">Purchase replacements from Portal &gt; Services</div>
        </div>
      )}

      {/* Connection Log */}
      <div className="connection-log-section">
        <h3>Connection Log</h3>
        <div className="connection-log">
          {activeConnections && activeConnections.length > 0 ? (
            activeConnections.map((conn) => (
              <div key={conn.networkId} className="log-entry">
                Connected to {conn.networkName || conn.networkId} at{' '}
                {new Date(conn.connectedAt).toLocaleTimeString()}
                {conn.relayChain?.length > 0 && ` (${conn.relayChain.length} relays)`}
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

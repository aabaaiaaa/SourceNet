import { useState, useEffect } from 'react';
import { useGame } from '../../contexts/useGame';
import networkRegistry from '../../systems/NetworkRegistry';
import triggerEventBus from '../../core/triggerEventBus';
import './NetworkAddressRegister.css';

const NetworkAddressRegister = () => {
  const { activeConnections, setActiveConnections, initiateVpnConnection } = useGame();
  const [activeTab, setActiveTab] = useState('active');
  const [knownNetworks, setKnownNetworks] = useState([]);

  // Subscribe to network access changes to refresh networks list
  useEffect(() => {
    const refreshNetworks = () => {
      setKnownNetworks(networkRegistry.getKnownNetworks());
    };

    // Initial load
    refreshNetworks();

    // Listen for access changes and registry reloads
    triggerEventBus.on('networkAccessGranted', refreshNetworks);
    triggerEventBus.on('networkAccessRevoked', refreshNetworks);
    triggerEventBus.on('networkRegistryLoaded', refreshNetworks);

    return () => {
      triggerEventBus.off('networkAccessGranted', refreshNetworks);
      triggerEventBus.off('networkAccessRevoked', refreshNetworks);
      triggerEventBus.off('networkRegistryLoaded', refreshNetworks);
    };
  }, []);

  // Check if a network is currently connected
  const isConnected = (networkId) => {
    return (activeConnections || []).some(conn => conn.networkId === networkId);
  };

  // Disconnect from a network
  const handleDisconnect = (networkId) => {
    setActiveConnections((activeConnections || []).filter(conn => conn.networkId !== networkId));
  };

  // Filter networks by accessibility status
  const activeNetworks = knownNetworks.filter(network => network.accessible);
  const revokedNetworks = knownNetworks.filter(network => !network.accessible && network.revokedReason);
  const hasRevokedNetworks = revokedNetworks.length > 0;

  const displayedNetworks = activeTab === 'active' ? activeNetworks : revokedNetworks;

  return (
    <div className="network-address-register">
      <div className="nar-header">
        <h2>Network Address Register</h2>
        <p className="nar-subtitle">Network Credentials Management</p>
      </div>

      {/* Tabs - only show if there are revoked networks */}
      {hasRevokedNetworks && (
        <div className="nar-tabs">
          <button
            className={`nar-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({activeNetworks.length})
          </button>
          <button
            className={`nar-tab ${activeTab === 'revoked' ? 'active' : ''}`}
            onClick={() => setActiveTab('revoked')}
          >
            Revoked ({revokedNetworks.length})
          </button>
        </div>
      )}

      <div className="nar-list">
        {displayedNetworks.length > 0 ? (
          displayedNetworks.map((network) => (
            <div
              key={network.networkId}
              className={`nar-entry ${!network.accessible && network.revokedReason ? 'nar-revoked' : ''}`}
            >
              <div className="nar-entry-header">
                <div className="nar-name">{network.networkName || network.networkId}</div>
                {!network.accessible && network.revokedReason && (
                  <span className="nar-revoked-badge">Access Revoked</span>
                )}
              </div>
              <div className="nar-address">{network.address}</div>
              {!network.accessible && network.revokedReason && (
                <div className="nar-revoked-reason">{network.revokedReason}</div>
              )}
              <div className={`nar-status status-${!network.accessible && network.revokedReason ? 'revoked' : 'active'}`}>
                Status: {!network.accessible && network.revokedReason ? 'Revoked' : 'Active'}
              </div>
              {network.accessible && (
                <div className="nar-connection-actions">
                  {isConnected(network.networkId) ? (
                    <div className="nar-connection-status">
                      <span className="nar-connected-badge">✓ Connected</span>
                      <button
                        className="nar-disconnect-btn"
                        onClick={() => handleDisconnect(network.networkId)}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className="nar-connect-btn"
                      onClick={() => initiateVpnConnection(network.networkId)}
                    >
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            {activeTab === 'active'
              ? 'No network credentials registered. Accept missions to receive network access.'
              : 'No revoked credentials.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkAddressRegister;

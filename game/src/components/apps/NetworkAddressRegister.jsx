import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import './NetworkAddressRegister.css';

const NetworkAddressRegister = () => {
  const { narEntries } = useGame();
  const [activeTab, setActiveTab] = useState('active');

  // Filter entries by authorization status
  const activeEntries = (narEntries || []).filter(entry => entry.authorized !== false);
  const revokedEntries = (narEntries || []).filter(entry => entry.authorized === false);
  const hasRevokedEntries = revokedEntries.length > 0;

  const displayedEntries = activeTab === 'active' ? activeEntries : revokedEntries;

  return (
    <div className="network-address-register">
      <div className="nar-header">
        <h2>Network Address Register</h2>
        <p className="nar-subtitle">Network Credentials Management</p>
      </div>

      {/* Tabs - only show if there are revoked entries */}
      {hasRevokedEntries && (
        <div className="nar-tabs">
          <button
            className={`nar-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({activeEntries.length})
          </button>
          <button
            className={`nar-tab ${activeTab === 'revoked' ? 'active' : ''}`}
            onClick={() => setActiveTab('revoked')}
          >
            Revoked ({revokedEntries.length})
          </button>
        </div>
      )}

      <div className="nar-list">
        {displayedEntries.length > 0 ? (
          displayedEntries.map((entry) => (
            <div
              key={entry.id}
              className={`nar-entry ${entry.status === 'expired' ? 'nar-expired' : ''} ${entry.authorized === false ? 'nar-revoked' : ''}`}
            >
              <div className="nar-entry-header">
                <div className="nar-name">{entry.networkName || entry.networkId}</div>
                {entry.authorized === false && (
                  <span className="nar-revoked-badge">Access Revoked</span>
                )}
              </div>
              <div className="nar-address">{entry.address}</div>
              {entry.authorized === false && entry.revokedReason && (
                <div className="nar-revoked-reason">{entry.revokedReason}</div>
              )}
              <div className={`nar-status status-${entry.authorized === false ? 'revoked' : (entry.status || 'active')}`}>
                Status: {entry.authorized === false ? 'Revoked' : (entry.status || 'Active')}
              </div>
              {entry.authorized !== false && entry.status !== 'expired' && (
                <button className="nar-connect-btn" onClick={() => alert('Quick connect pending')}>
                  Connect
                </button>
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

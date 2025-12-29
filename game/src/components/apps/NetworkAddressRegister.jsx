import { useGame } from '../../contexts/GameContext';
import './NetworkAddressRegister.css';

const NetworkAddressRegister = () => {
  const { narEntries } = useGame();

  return (
    <div className="network-address-register">
      <div className="nar-header">
        <h2>Network Address Register</h2>
        <p className="nar-subtitle">Network Credentials Management</p>
      </div>

      <div className="nar-list">
        {narEntries && narEntries.length > 0 ? (
          narEntries.map((entry) => (
            <div
              key={entry.id}
              className={`nar-entry ${entry.status === 'expired' ? 'nar-expired' : ''}`}
            >
              <div className="nar-name">{entry.networkName || entry.networkId}</div>
              <div className="nar-address">{entry.address}</div>
              <div className={`nar-status status-${entry.status}`}>
                Status: {entry.status || 'Active'}
              </div>
              {entry.status !== 'expired' && (
                <button className="nar-connect-btn" onClick={() => alert('Quick connect pending')}>
                  Connect
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            No network credentials registered. Accept missions to receive network access.
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkAddressRegister;

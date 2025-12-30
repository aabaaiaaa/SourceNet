import { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatDateTime, getAllSaves } from '../../utils/helpers';
import { getReputationTier } from '../../systems/ReputationSystem';
import './TopBar.css';

const TopBar = () => {
  const {
    currentTime,
    timeSpeed,
    toggleTimeSpeed,
    isPaused,
    setIsPaused,
    messages,
    bankAccounts,
    openWindow,
    saveGame,
    loadGame,
    setGamePhase,
    getTotalCredits,
    rebootSystem,
    // Extended state
    reputation,
    activeConnections,
    activeMission,
    bankruptcyCountdown,
    reputationCountdown,
  } = useGame();

  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showMailPreview, setShowMailPreview] = useState(false);
  const [showBankPreview, setShowBankPreview] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [showReputationPreview, setShowReputationPreview] = useState(false);
  const [showNetworkPreview, setShowNetworkPreview] = useState(false);
  const [showMissionPreview, setShowMissionPreview] = useState(false);

  // Timeout refs for delayed menu closing
  const powerMenuTimeout = useRef(null);
  const appLauncherTimeout = useRef(null);

  const unreadMessages = messages.filter((m) => !m.read);
  const totalCredits = getTotalCredits();

  const apps = [
    { id: 'mail', name: 'SNet Mail' },
    { id: 'banking', name: 'SNet Banking App' },
    { id: 'portal', name: 'OSNet Portal' },
    { id: 'missionBoard', name: 'SourceNet Mission Board' },
    { id: 'vpnClient', name: 'SourceNet VPN Client' },
    { id: 'networkScanner', name: 'Network Scanner' },
    { id: 'networkAddressRegister', name: 'Network Address Register' },
    { id: 'fileManager', name: 'File Manager' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = () => {
    const saveName = prompt('Enter save name (or leave blank for auto-name):');
    saveGame(saveName || null);
    alert('Game saved!');
    setShowPowerMenu(false);
  };

  const handleLoad = () => {
    setShowPowerMenu(false);
    setShowLoadMenu(true);
  };

  const handleLoadSave = (username) => {
    const success = loadGame(username);
    if (success) {
      setShowLoadMenu(false);
    } else {
      alert('Failed to load save!');
    }
  };

  const handleReboot = () => {
    if (confirm('Reboot the system? This will close all opened apps.')) {
      rebootSystem();
    }
    setShowPowerMenu(false);
  };

  const handleSleep = () => {
    // Auto-save before sleeping (uses in-game time as default name, like manual save)
    saveGame(null);

    // Go to sleep animation
    setGamePhase('sleeping');
    setShowPowerMenu(false);
  };

  return (
    <div className="topbar">
      {/* Bankruptcy Warning Banner (flashing) */}
      {bankruptcyCountdown && bankruptcyCountdown.remaining <= 300 && (
        <div className="bankruptcy-warning-banner">
          ⚠️ BANKRUPTCY WARNING: {Math.floor(bankruptcyCountdown.remaining / 60)}:{String(bankruptcyCountdown.remaining % 60).padStart(2, '0')} remaining ⚠️
        </div>
      )}

      {/* Reputation Warning Banner */}
      {reputationCountdown && (
        <div className="reputation-warning-banner">
          ⚠️ TERMINATION WARNING: {Math.floor(reputationCountdown.remaining / 60)}:{String(reputationCountdown.remaining % 60).padStart(2, '0')} remaining ⚠️
        </div>
      )}

      {/* Left: Power Button */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => {
            if (powerMenuTimeout.current) {
              clearTimeout(powerMenuTimeout.current);
            }
            setShowPowerMenu(true);
          }}
          onMouseLeave={() => {
            powerMenuTimeout.current = setTimeout(() => {
              setShowPowerMenu(false);
            }, 100);
          }}
        >
          <button className="topbar-button">⏻</button>
          {showPowerMenu && (
            <div
              className="dropdown-menu power-menu"
              onMouseEnter={() => {
                if (powerMenuTimeout.current) {
                  clearTimeout(powerMenuTimeout.current);
                }
              }}
              onMouseLeave={() => {
                powerMenuTimeout.current = setTimeout(() => {
                  setShowPowerMenu(false);
                }, 100);
              }}
            >
              {!isPaused ? (
                <button onClick={() => setIsPaused(true)}>Pause</button>
              ) : (
                <button onClick={() => setIsPaused(false)}>Resume</button>
              )}
              <button onClick={handleSave}>Save</button>
              <button onClick={handleLoad}>Load</button>
              <button onClick={handleReboot}>Reboot</button>
              <button onClick={handleSleep}>Sleep</button>
            </div>
          )}
        </div>
      </div>

      {/* Left-Center: Date/Time */}
      <div className="topbar-section">
        <span className="topbar-time">{formatDateTime(currentTime)}</span>
        <button className="topbar-button time-speed" onClick={toggleTimeSpeed}>
          {timeSpeed}x
        </button>
      </div>

      {/* Center-Right: Notifications */}
      <div className="topbar-section">
        <div
          className="topbar-notification"
          onMouseEnter={() => setShowMailPreview(true)}
          onMouseLeave={() => setShowMailPreview(false)}
          onClick={() => {
            openWindow('mail');
            setShowMailPreview(false);
          }}
        >
          <span className="notification-icon">
            ✉ {unreadMessages.length > 0 && <span className="badge">{unreadMessages.length}</span>}
          </span>
          {showMailPreview && unreadMessages.length > 0 && (
            <div className="notification-preview">
              <div className="preview-header">Unread Messages:</div>
              {unreadMessages.slice(0, 3).map((msg) => (
                <div key={msg.id} className="preview-item">
                  <strong>{msg.from}</strong>: {msg.subject}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="topbar-notification"
          onMouseEnter={() => setShowBankPreview(true)}
          onMouseLeave={() => setShowBankPreview(false)}
          onClick={() => {
            openWindow('banking');
            setShowBankPreview(false);
          }}
        >
          <span className="notification-icon">💳</span>
          {showBankPreview && (
            <div className="notification-preview">
              <div className="preview-header">Bank Accounts:</div>
              {bankAccounts.map((acc) => (
                <div key={acc.id} className="preview-item">
                  {acc.bankName}: {acc.balance} credits
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="topbar-credits"
          onClick={() => openWindow('banking')}
          title="Click to open Banking App"
        >
          {totalCredits} credits
        </div>

        {/* Reputation Indicator */}
        <div
          className="topbar-reputation"
          onMouseEnter={() => setShowReputationPreview(true)}
          onMouseLeave={() => setShowReputationPreview(false)}
          title="Your SourceNet Reputation"
        >
          <span
            className="reputation-badge"
            style={{ backgroundColor: getReputationTier(reputation).color }}
          >
            {reputation}
          </span>
          {showReputationPreview && (
            <div className="notification-preview">
              <div className="preview-header">Reputation:</div>
              <div className="preview-item">
                <strong>{getReputationTier(reputation).name}</strong> (Tier {reputation})
              </div>
              <div className="preview-item-small">
                {getReputationTier(reputation).description}
              </div>
              <div className="preview-item-small">
                Payout Multiplier: {getReputationTier(reputation).payoutMultiplier}x
              </div>
            </div>
          )}
        </div>

        {/* Network Connection Indicator */}
        {activeConnections && activeConnections.length > 0 && (
          <div
            className="topbar-network"
            onMouseEnter={() => setShowNetworkPreview(true)}
            onMouseLeave={() => setShowNetworkPreview(false)}
            title="Active Network Connections"
          >
            <span className="network-icon" style={{ color: '#32CD32' }}>📶</span>
            <span className="network-badge">{activeConnections.length}</span>
            {showNetworkPreview && (
              <div className="notification-preview">
                <div className="preview-header">Connected Networks:</div>
                {activeConnections.map((conn, idx) => (
                  <div key={idx} className="preview-item">
                    {conn.networkName || conn.networkId}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Mission Indicator */}
        {activeMission && (
          <div
            className="topbar-mission"
            onMouseEnter={() => setShowMissionPreview(true)}
            onMouseLeave={() => setShowMissionPreview(false)}
            onClick={() => openWindow('missionBoard')}
            title="Click to open Mission Board"
          >
            <span className="mission-icon">📋</span>
            <span className="mission-badge">
              {activeMission.objectives?.filter(o => o.status !== 'complete').length || 0}
            </span>
            {showMissionPreview && (
              <div className="notification-preview">
                <div className="preview-header">{activeMission.title}</div>
                {activeMission.objectives?.map((obj) => (
                  <div
                    key={obj.id}
                    className="preview-item-small"
                    style={{
                      textDecoration: obj.status === 'complete' ? 'line-through' : 'none',
                      color: obj.status === 'complete' ? '#32CD32' : '#222',
                    }}
                  >
                    {obj.status === 'complete' ? '☑' : '☐'} {obj.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: App Launcher */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => {
            if (appLauncherTimeout.current) {
              clearTimeout(appLauncherTimeout.current);
            }
            setShowAppLauncher(true);
          }}
          onMouseLeave={() => {
            appLauncherTimeout.current = setTimeout(() => {
              setShowAppLauncher(false);
            }, 100);
          }}
        >
          <button className="topbar-button">☰</button>
          {showAppLauncher && (
            <div
              className="dropdown-menu app-launcher-menu"
              onMouseEnter={() => {
                if (appLauncherTimeout.current) {
                  clearTimeout(appLauncherTimeout.current);
                }
              }}
              onMouseLeave={() => {
                appLauncherTimeout.current = setTimeout(() => {
                  setShowAppLauncher(false);
                }, 100);
              }}
            >
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    openWindow(app.id);
                    setShowAppLauncher(false);
                  }}
                >
                  {app.name}
                </button>
              ))}
              <div className="app-launcher-storage">
                {/* Mock storage for now - real implementation would calculate from installed software */}
                14.5 GB used / 90 GB free
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Load Game Modal */}
      {showLoadMenu && (
        <div className="modal-overlay" onClick={() => setShowLoadMenu(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Load Game</h3>
            <div className="load-saves-list">
              {Object.keys(getAllSaves()).length === 0 ? (
                <p>No saved games found.</p>
              ) : (
                Object.keys(getAllSaves()).map((username) => (
                  <button
                    key={username}
                    className="load-save-btn"
                    onClick={() => handleLoadSave(username)}
                  >
                    {username}
                  </button>
                ))
              )}
            </div>
            <button
              className="modal-close-btn"
              onClick={() => setShowLoadMenu(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;

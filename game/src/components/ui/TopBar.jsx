import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { formatDateTime, getAllSaves } from '../../utils/helpers';
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
  } = useGame();

  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [showMailPreview, setShowMailPreview] = useState(false);
  const [showBankPreview, setShowBankPreview] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  const unreadMessages = messages.filter((m) => !m.read);
  const totalCredits = getTotalCredits();

  const apps = [
    { id: 'mail', name: 'SNet Mail' },
    { id: 'banking', name: 'SNet Banking App' },
    { id: 'portal', name: 'OSNet Portal' },
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
    if (confirm('Reboot the system? Unsaved progress will be lost.')) {
      setGamePhase('boot');
    }
    setShowPowerMenu(false);
  };

  const handleSleep = () => {
    if (confirm('Exit the game? Make sure to save first!')) {
      alert('Thanks for playing SourceNet!');
      // In a real game, this would close the window or return to main menu
    }
    setShowPowerMenu(false);
  };

  return (
    <div className="topbar">
      {/* Left: Power Button */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => setShowPowerMenu(true)}
          onMouseLeave={() => setShowPowerMenu(false)}
        >
          <button className="topbar-button">⏻</button>
          {showPowerMenu && (
            <div className="dropdown-menu power-menu">
              <button onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
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
      </div>

      {/* Right: App Launcher */}
      <div className="topbar-section">
        <div
          className="topbar-button-wrapper"
          onMouseEnter={() => setShowAppLauncher(true)}
          onMouseLeave={() => setShowAppLauncher(false)}
        >
          <button className="topbar-button">☰</button>
          {showAppLauncher && (
            <div className="dropdown-menu app-launcher-menu">
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

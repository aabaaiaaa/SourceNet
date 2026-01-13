import { useState } from 'react';
import { useGame } from '../contexts/useGame';
import { getAllSavesFlat, deleteSave } from '../utils/helpers';
import './GameLoginScreen.css';

const GameLoginScreen = () => {
  const { loadGame, resetGame } = useGame();
  const allSavesFlat = getAllSavesFlat();
  const [expandedUser, setExpandedUser] = useState(null);

  // Group saves by username and get latest for each user
  const userGroups = {};
  allSavesFlat.forEach((save) => {
    if (!userGroups[save.username]) {
      userGroups[save.username] = [];
    }
    userGroups[save.username].push(save);
  });
  const usernames = Object.keys(userGroups);

  const handleLoadLatest = (username) => {
    console.log('Loading latest save for:', username);
    const success = loadGame(username);
    console.log('Load result:', success);
    if (!success) {
      alert('Failed to load save!');
    } else {
      console.log('Load successful, game phase should be desktop');
    }
  };

  const handleLoadSpecific = (username, saveIndex) => {
    console.log('Loading specific save for:', username, 'index:', saveIndex);
    const success = loadGame(username, saveIndex);
    if (!success) {
      alert('Failed to load save!');
    }
  };

  const handleDeleteSave = (username, saveIndex = null) => {
    const msg = saveIndex !== null
      ? `Delete this save for ${username}?`
      : `Delete ALL saves for ${username}?`;
    if (confirm(msg)) {
      deleteSave(username, saveIndex);
      window.location.reload();
    }
  };

  const handleNewGame = () => {
    resetGame();
  };

  const toggleExpanded = (username) => {
    setExpandedUser(expandedUser === username ? null : username);
  };

  const formatSaveDate = (savedAt) => {
    if (!savedAt) return 'Unknown';
    const date = new Date(savedAt);
    return date.toLocaleString();
  };

  return (
    <div className="game-login-screen">
      <div className="login-container">
        <h1 className="login-title">SOURCENET</h1>
        <p className="login-subtitle">Select a saved game or start a new one</p>

        <div className="saves-list">
          {usernames.length === 0 ? (
            <p className="no-saves-message">No saved games found. Start a new game below.</p>
          ) : (
            usernames.map((username) => {
              const saves = userGroups[username];
              const latestSave = saves[0];
              const hasMultipleSaves = saves.length > 1;
              const isExpanded = expandedUser === username;

              return (
                <div key={username} className="save-user-group">
                  <div className="save-item save-item-main">
                    <div className="save-info">
                      <div className="save-username">{username}</div>
                      <div className="save-details">
                        <span className="save-name">{latestSave.saveName}</span>
                        <span className="save-date">Saved: {formatSaveDate(latestSave.savedAt)}</span>
                      </div>
                    </div>
                    <div className="save-actions">
                      <button
                        className="save-load-btn"
                        onClick={() => handleLoadLatest(username)}
                      >
                        Load Latest
                      </button>
                      {hasMultipleSaves && (
                        <button
                          className="save-expand-btn"
                          onClick={() => toggleExpanded(username)}
                        >
                          {isExpanded ? '▲' : '▼'} ({saves.length})
                        </button>
                      )}
                      <button
                        className="save-delete-btn"
                        onClick={() => handleDeleteSave(username)}
                        title="Delete all saves for this user"
                      >
                        Delete All
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="save-list-expanded">
                      {saves.map((save, index) => (
                        <div key={index} className="save-item save-item-sub">
                          <div className="save-info">
                            <span className="save-name">{save.saveName}</span>
                            <span className="save-date">{formatSaveDate(save.savedAt)}</span>
                          </div>
                          <div className="save-actions">
                            <button
                              className="save-load-btn save-load-btn-small"
                              onClick={() => handleLoadSpecific(username, index)}
                            >
                              Load
                            </button>
                            <button
                              className="save-delete-btn save-delete-btn-small"
                              onClick={() => handleDeleteSave(username, index)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button className="new-game-btn" onClick={handleNewGame}>
          + New Game
        </button>
      </div>
    </div>
  );
};

export default GameLoginScreen;

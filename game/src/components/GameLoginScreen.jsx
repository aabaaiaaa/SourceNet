import { useGame } from '../contexts/GameContext';
import { getAllSaves, deleteSave } from '../utils/helpers';
import './GameLoginScreen.css';

const GameLoginScreen = () => {
  const { loadGame, setGamePhase } = useGame();
  const saves = getAllSaves();
  const usernames = Object.keys(saves);

  const handleLoadSave = (username) => {
    const success = loadGame(username);
    if (!success) {
      alert('Failed to load save!');
    }
  };

  const handleDeleteSave = (username) => {
    if (confirm(`Delete save for ${username}?`)) {
      deleteSave(username);
      // Reload the screen
      window.location.reload();
    }
  };

  const handleNewGame = () => {
    setGamePhase('boot');
  };

  return (
    <div className="game-login-screen">
      <div className="login-container">
        <h1 className="login-title">SOURCENET</h1>
        <p className="login-subtitle">Select a saved game or start a new one</p>

        <div className="saves-list">
          {usernames.map((username) => (
            <div key={username} className="save-item">
              <div className="save-username">{username}</div>
              <div className="save-actions">
                <button
                  className="save-load-btn"
                  onClick={() => handleLoadSave(username)}
                >
                  Load
                </button>
                <button
                  className="save-delete-btn"
                  onClick={() => handleDeleteSave(username)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="new-game-btn" onClick={handleNewGame}>
          + New Game
        </button>
      </div>
    </div>
  );
};

export default GameLoginScreen;

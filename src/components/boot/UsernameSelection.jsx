import { useState } from 'react';
import { useGame } from '../../contexts/useGame';
import './UsernameSelection.css';

const UsernameSelection = () => {
  const { initializePlayer, generateUsername } = useGame();
  const [username, setUsername] = useState(generateUsername());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim().length > 0 && username.length <= 15) {
      initializePlayer(username.trim());
    }
  };

  return (
    <div className="username-selection">
      <div className="username-container">
        <h1>Welcome to OSNet</h1>
        <p>Please select your username:</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={15}
            className="username-input"
            autoFocus
          />
          <div className="username-hint">Maximum 15 characters</div>
          <button type="submit" className="username-submit">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameSelection;

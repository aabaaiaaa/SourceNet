import './GameOverOverlay.css';

const GameOverOverlay = ({ type, onLoadSave, onNewGame }) => {
  // type: 'bankruptcy' or 'termination'

  const getMessage = () => {
    if (type === 'bankruptcy') {
      return {
        title: 'BANKRUPTCY',
        message:
          'SourceNet has been notified of your bankruptcy. The bank has worked with SourceNet to seize your assets by order of financial authorities. You are no longer able to work as a SourceNet agent.',
      };
    } else if (type === 'termination') {
      return {
        title: 'CONTRACT TERMINATED',
        message:
          'SourceNet has terminated your contract due to poor performance. You are no longer able to work as an agent.',
      };
    }
    return { title: 'GAME OVER', message: 'Your session has ended.' };
  };

  const { title, message } = getMessage();

  return (
    <div className="game-over-overlay">
      <div className="game-over-modal">
        <div className="game-over-header">
          <h1>{title}</h1>
        </div>

        <div className="game-over-content">
          <p>{message}</p>
        </div>

        <div className="game-over-actions">
          <button className="game-over-btn primary-btn" onClick={onLoadSave}>
            Load Previous Save
          </button>
          <button className="game-over-btn secondary-btn" onClick={onNewGame}>
            Return to Main Menu
          </button>
        </div>

        <div className="game-over-footer">
          <p className="game-over-note">
            Save files from this session are marked as {type === 'bankruptcy' ? 'BANKRUPT' : 'TERMINATED'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GameOverOverlay;

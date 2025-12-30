import { useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import PauseOverlay from './PauseOverlay';
import GameOverOverlay from './GameOverOverlay';
import './Desktop.css';

const Desktop = () => {
  const { windows, isPaused, setIsPaused, gamePhase, setGamePhase, loadGame } = useGame();

  // Handle ESC key to resume from pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPaused) {
        setIsPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, setIsPaused]);

  return (
    <div className="desktop">
      <TopBar />

      <div className="desktop-content">
        {/* OSNet logo watermark will be in CSS background */}
        {windows
          .filter((w) => !w.minimized)
          .map((window) => (
            <Window key={window.appId} window={window} />
          ))}
      </div>

      <MinimizedWindowBar />

      {isPaused && <PauseOverlay />}

      {gamePhase === 'gameOver-bankruptcy' && (
        <GameOverOverlay
          type="bankruptcy"
          onLoadSave={() => {
            // Show load menu
            setGamePhase('login');
          }}
          onNewGame={() => {
            setGamePhase('login');
          }}
        />
      )}

      {gamePhase === 'gameOver-termination' && (
        <GameOverOverlay
          type="termination"
          onLoadSave={() => {
            setGamePhase('login');
          }}
          onNewGame={() => {
            setGamePhase('login');
          }}
        />
      )}
    </div>
  );
};

export default Desktop;

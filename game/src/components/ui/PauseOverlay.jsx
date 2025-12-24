import { useGame } from '../../contexts/GameContext';
import './PauseOverlay.css';

const PauseOverlay = () => {
  const { setIsPaused } = useGame();

  const handleResume = () => {
    setIsPaused(false);
  };

  return (
    <div className="pause-overlay" onClick={handleResume}>
      <div className="pause-content">
        <div className="pause-watermark">PAUSED</div>
        <div className="pause-instruction">
          Click anywhere or press ESC to resume
        </div>
      </div>
    </div>
  );
};

export default PauseOverlay;

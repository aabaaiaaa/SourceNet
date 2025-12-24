import { useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './Rebooting.css';

const Rebooting = () => {
  const { setGamePhase } = useGame();

  useEffect(() => {
    // Show "Rebooting..." for 2 seconds
    const timer = setTimeout(() => {
      // Fade to black for 1 second, then start boot
      setGamePhase('boot');
    }, 2000);

    return () => clearTimeout(timer);
  }, [setGamePhase]);

  return (
    <div className="rebooting-screen">
      <div className="rebooting-message">
        <div className="rebooting-text">Rebooting</div>
        <div className="rebooting-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </div>
      </div>
    </div>
  );
};

export default Rebooting;

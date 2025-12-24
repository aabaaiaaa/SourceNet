import { useEffect } from 'react';
import { useGame } from '../../contexts/GameContext';
import './SleepAnimation.css';

const SleepAnimation = () => {
  const { setGamePhase } = useGame();

  useEffect(() => {
    // Show "Sleeping..." for 2 seconds then go to login
    const timer = setTimeout(() => {
      setGamePhase('login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [setGamePhase]);

  return (
    <div className="sleep-screen">
      <div className="sleep-message">
        <div className="sleep-icon">💤</div>
        <div className="sleep-text">Sleeping...</div>
      </div>
    </div>
  );
};

export default SleepAnimation;

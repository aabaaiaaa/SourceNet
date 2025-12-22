import { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { hasSaves } from '../utils/helpers';
import GameLoginScreen from './GameLoginScreen';
import BootSequence from './boot/BootSequence';
import UsernameSelection from './boot/UsernameSelection';
import Desktop from './ui/Desktop';

const GameRoot = () => {
  const { gamePhase, setGamePhase } = useGame();

  useEffect(() => {
    // On initial mount, check if we have any saves
    if (gamePhase === 'boot') {
      const savesExist = hasSaves();
      if (savesExist) {
        setGamePhase('login');
      }
      // If no saves, stay in 'boot' phase
    }
  }, []);

  // Render appropriate component based on game phase
  switch (gamePhase) {
    case 'login':
      return <GameLoginScreen />;
    case 'boot':
      return <BootSequence />;
    case 'username':
      return <UsernameSelection />;
    case 'desktop':
      return <Desktop />;
    default:
      return <div>Loading...</div>;
  }
};

export default GameRoot;

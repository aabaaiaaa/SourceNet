import { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { hasSaves } from '../utils/helpers';
import GameLoginScreen from './GameLoginScreen';
import BootSequence from './boot/BootSequence';
import UsernameSelection from './boot/UsernameSelection';
import Rebooting from './boot/Rebooting';
import SleepAnimation from './boot/SleepAnimation';
import Desktop from './ui/Desktop';

const GameRoot = () => {
  const { gamePhase, setGamePhase } = useGame();

  useEffect(() => {
    // Only check for saves on initial mount (gamePhase starts as 'boot')
    // Don't re-check if user explicitly chose "New Game"
    const savesExist = hasSaves();
    if (savesExist && gamePhase === 'boot') {
      setGamePhase('login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = only run on mount

  // Render appropriate component based on game phase
  switch (gamePhase) {
    case 'login':
      return <GameLoginScreen />;
    case 'rebooting':
      return <Rebooting />;
    case 'sleeping':
      return <SleepAnimation />;
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

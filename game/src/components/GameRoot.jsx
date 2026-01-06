import { useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { hasSaves } from '../utils/helpers';
import GameLoginScreen from './GameLoginScreen';
import BootSequence from './boot/BootSequence';
import UsernameSelection from './boot/UsernameSelection';
import Rebooting from './boot/Rebooting';
import SleepAnimation from './boot/SleepAnimation';
import Desktop from './ui/Desktop';
import GameOverOverlay from './ui/GameOverOverlay';

const GameRoot = () => {
  const gameContext = useGame();
  const { gamePhase, setGamePhase } = gameContext;

  // Expose game context globally for e2e testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.gameContext = gameContext;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.gameContext;
      }
    };
  }, [gameContext]);

  useEffect(() => {
    // Check for skipBoot parameter (for E2E tests)
    const urlParams = new URLSearchParams(window.location.search);
    const skipBoot = urlParams.get('skipBoot') === 'true';

    if (skipBoot && gamePhase === 'boot') {
      // If saves exist, go to login to pick save
      // If no saves, go to username
      const savesExist = hasSaves();
      if (savesExist) {
        setGamePhase('login');
      } else {
        setGamePhase('username');
      }
      return;
    }

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
    case 'gameOver-bankruptcy':
      return (
        <GameOverOverlay
          type="bankruptcy"
          onLoadSave={() => {
            setGamePhase('login');
          }}
          onNewGame={() => {
            setGamePhase('login');
          }}
        />
      );
    case 'gameOver-termination':
      return (
        <GameOverOverlay
          type="termination"
          onLoadSave={() => {
            setGamePhase('login');
          }}
          onNewGame={() => {
            setGamePhase('login');
          }}
        />
      );
    default:
      return <div>Loading...</div>;
  }
};

export default GameRoot;

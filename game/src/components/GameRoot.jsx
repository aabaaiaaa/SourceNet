import { useEffect, useRef } from 'react';
import { useGame } from '../contexts/useGame';
import { hasSaves } from '../utils/helpers';
import { getScenarioFixture } from '../debug/fixtures';
import { TIME_SPEEDS } from '../constants/gameConstants';
import storyMissionManager from '../missions/StoryMissionManager';
import GameLoginScreen from './GameLoginScreen';
import BootSequence from './boot/BootSequence';
import UsernameSelection from './boot/UsernameSelection';
import Rebooting from './boot/Rebooting';
import SleepAnimation from './boot/SleepAnimation';
import Desktop from './ui/Desktop';
import GameOverOverlay from './ui/GameOverOverlay';

/**
 * Apply a scenario fixture to the game state
 * @param {object} fixture - The save game state to apply
 * @param {object} gameContext - Game context with setters
 * @returns {boolean} Whether the scenario was applied successfully
 */
const applyScenarioFixture = (fixture, gameContext) => {
  if (!fixture || !gameContext) {
    console.error('❌ Invalid fixture or game context');
    return false;
  }

  try {
    // Apply all state from fixture (same pattern as loadGame)
    gameContext.setUsername(fixture.username);
    gameContext.setPlayerMailId(fixture.playerMailId);
    gameContext.setCurrentTime(new Date(fixture.currentTime));
    gameContext.setHardware(fixture.hardware);
    gameContext.setSoftware(fixture.software);
    gameContext.setBankAccounts(fixture.bankAccounts);
    gameContext.setMessages(fixture.messages);
    gameContext.setManagerName(fixture.managerName);

    // Extended state (with defaults for older save formats)
    gameContext.setReputation(fixture.reputation ?? 9);
    gameContext.setReputationCountdown(fixture.reputationCountdown ?? null);
    gameContext.setActiveMission(fixture.activeMission ?? null);
    gameContext.setCompletedMissions(fixture.completedMissions ?? []);
    gameContext.setAvailableMissions(fixture.availableMissions ?? []);
    gameContext.setMissionCooldowns(fixture.missionCooldowns ?? { easy: null, medium: null, hard: null });
    gameContext.setNarEntries(fixture.narEntries ?? []);
    gameContext.setActiveConnections(fixture.activeConnections ?? []);
    gameContext.setLastScanResults(fixture.lastScanResults ?? null);
    gameContext.setFileManagerConnections(fixture.fileManagerConnections ?? []);
    gameContext.setLastFileOperation(fixture.lastFileOperation ?? null);
    gameContext.setDownloadQueue(fixture.downloadQueue ?? []);
    gameContext.setTransactions(fixture.transactions ?? []);
    gameContext.setLicensedSoftware(fixture.licensedSoftware ?? []);
    gameContext.setBankruptcyCountdown(fixture.bankruptcyCountdown ?? null);
    gameContext.setLastInterestTime(fixture.lastInterestTime ?? null);

    // Restore story progression (prevents duplicate messages)
    storyMissionManager.setFiredEvents(fixture.processedEvents ?? []);

    // Windows are not restored for scenarios - start fresh
    gameContext.setWindows([]);

    // Reset time speed to normal
    gameContext.setTimeSpeed(TIME_SPEEDS.NORMAL);

    return true;
  } catch (error) {
    console.error('❌ Failed to apply scenario fixture:', error);
    return false;
  }
};

const GameRoot = () => {
  const gameContext = useGame();
  const { gamePhase, setGamePhase } = gameContext;
  const scenarioAppliedRef = useRef(false);

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
    // Check for scenario parameter (for E2E tests and debug)
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioName = urlParams.get('scenario');

    if (scenarioName && !scenarioAppliedRef.current && gamePhase === 'boot') {
      const fixture = getScenarioFixture(scenarioName);

      if (fixture) {
        const success = applyScenarioFixture(fixture, gameContext);
        if (success) {
          scenarioAppliedRef.current = true;
          console.log(`✅ Scenario '${scenarioName}' loaded successfully`);
          setGamePhase('desktop'); // Go straight to desktop
          return;
        } else {
          console.error(`❌ Failed to load scenario '${scenarioName}'`);
        }
      } else {
        console.error(`❌ Scenario '${scenarioName}' not found`);
      }
    }

    // Check for skipBoot parameter (for E2E tests)
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

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
import SleepOverlay from './ui/SleepOverlay';
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
    const convertedDiscoveredDevices = fixture.discoveredDevices
      ? Object.fromEntries(
        Object.entries(fixture.discoveredDevices).map(([networkId, ips]) => [
          networkId,
          new Set(ips)
        ])
      )
      : {};
    gameContext.setDiscoveredDevices(convertedDiscoveredDevices);
    gameContext.setFileManagerConnections(fixture.fileManagerConnections ?? []);
    gameContext.setLastFileOperation(fixture.lastFileOperation ?? null);
    gameContext.setDownloadQueue(fixture.downloadQueue ?? []);
    gameContext.setTransactions(fixture.transactions ?? []);
    gameContext.setLicensedSoftware(fixture.licensedSoftware ?? []);
    gameContext.setBankruptcyCountdown(fixture.bankruptcyCountdown ?? null);
    gameContext.setLastInterestTime(fixture.lastInterestTime ?? null);

    // Restore story progression (prevents duplicate messages)
    storyMissionManager.setFiredEvents(fixture.processedEvents ?? []);

    // Restore pending story events (timers in progress)
    storyMissionManager.setPendingEvents(fixture.pendingStoryEvents ?? []);

    // Restore banking message tracking
    gameContext.setBankingMessagesSent(fixture.bankingMessagesSent ?? {
      firstOverdraft: false,
      approachingBankruptcy: false,
      bankruptcyCountdownStart: false,
      bankruptcyCancelled: false,
    });

    // Restore HR message tracking
    gameContext.setReputationMessagesSent(fixture.reputationMessagesSent ?? {
      performancePlanWarning: false,
      finalTerminationWarning: false,
      performanceImproved: false,
    });

    // Restore procedural mission system
    gameContext.setProceduralMissionsEnabled(fixture.proceduralMissionsEnabled ?? false);
    gameContext.setMissionPool(fixture.missionPool ?? []);
    gameContext.setPendingChainMissions(fixture.pendingChainMissions ?? {});
    gameContext.setActiveClientIds(fixture.activeClientIds ?? []);
    gameContext.setClientStandings(fixture.clientStandings ?? {});
    gameContext.setExtensionOffers(fixture.extensionOffers ?? {});

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

  // Use sessionStorage to persist across component remounts (React Strict Mode)
  // Namespace with scenario name to avoid cross-test contamination
  const getScenarioApplied = (scenarioName) => {
    if (typeof window !== 'undefined' && scenarioName) {
      return sessionStorage.getItem(`scenarioApplied_${scenarioName}`) === 'true';
    }
    return false;
  };

  const setScenarioApplied = (scenarioName, value) => {
    if (typeof window !== 'undefined' && scenarioName) {
      sessionStorage.setItem(`scenarioApplied_${scenarioName}`, value.toString());
    }
  };

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
    // Check for scenario parameter (for E2E tests and debug) - highest priority
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioName = urlParams.get('scenario');

    // Early return if scenario already applied
    if (scenarioName && getScenarioApplied(scenarioName)) {
      // Scenario already loaded, skip reloading
      return;
    } else if (scenarioName && !getScenarioApplied(scenarioName)) {
      const fixture = getScenarioFixture(scenarioName);

      if (fixture) {
        const success = applyScenarioFixture(fixture, gameContext);
        if (success) {
          setScenarioApplied(scenarioName, true);
          setGamePhase('desktop'); // Skip boot and go straight to desktop
          console.log(`✅ Scenario '${scenarioName}' loaded successfully`);
          return;
        } else {
          console.error(`❌ Failed to load scenario '${scenarioName}'`);
        }
      } else {
        console.error(`❌ Scenario '${scenarioName}' not found`);
      }
      // If scenario failed to load, fall through to normal boot logic
    }

    // Only process boot-related logic when in boot phase
    if (gamePhase !== 'boot') {
      return;
    }

    // Check for skipBoot parameter (for E2E tests)
    const skipBoot = urlParams.get('skipBoot') === 'true';

    if (skipBoot) {
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
    if (savesExist) {
      setGamePhase('login');
    }

  }, [gamePhase]); // Only run when gamePhase changes

  // Render appropriate component based on game phase
  switch (gamePhase) {
    case 'login':
      return <GameLoginScreen />;
    case 'rebooting':
      return <Rebooting />;
    case 'sleeping':
      return (
        <>
          <Desktop />
          <SleepOverlay />
        </>
      );
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

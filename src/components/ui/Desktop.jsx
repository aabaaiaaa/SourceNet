import { useEffect, useState } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import PauseOverlay from './PauseOverlay';
import ForcedDisconnectionOverlay from './ForcedDisconnectionOverlay';
import TerminalLockoutOverlay from '../TerminalLockoutOverlay';

import InstallationQueue from './InstallationQueue';
import DebugPanel from '../../debug/DebugPanel';
import { isDebugMode } from '../../debug/debugSystem';
import './Desktop.css';

// Module-level subscription for scriptedEventStart to avoid missing events during React re-renders
let scriptedEventSubscribed = false;
let scriptedEventCallback = null;

const Desktop = () => {
  const { windows, isPaused, setIsPaused, playAlarmSound } = useGame();
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [forcedDisconnection, setForcedDisconnection] = useState(null);
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [isDeletionActive, setIsDeletionActive] = useState(false);

  // Subscribe to forced disconnection events
  useEffect(() => {
    const handleForcedDisconnection = (data) => {
      console.log('🚨 Forced disconnection event received:', data);

      // Get network name from event data or use networkId as fallback
      const networkName = data.networkName || data.networkId;

      setForcedDisconnection({
        networkId: data.networkId,
        networkName: networkName,
        reason: data.reason,
        administratorMessage: data.administratorMessage,
      });

      // Play alarm sound
      if (playAlarmSound) {
        playAlarmSound();
      }
    };

    triggerEventBus.on('forcedDisconnection', handleForcedDisconnection);

    return () => {
      triggerEventBus.off('forcedDisconnection', handleForcedDisconnection);
    };
  }, [playAlarmSound]);

  const handleAcknowledgeDisconnection = () => {
    setForcedDisconnection(null);
  };

  // Subscribe to scripted event start for terminal lockout
  // Uses module-level subscription to avoid missing events during React re-renders/strict mode
  useEffect(() => {
    // Update the callback to use current state setters
    scriptedEventCallback = (data) => {
      const { actions } = data;

      // Check if any action has playerControl: false
      const hasPlayerControlLock = actions?.some(action => action.playerControl === false);

      if (hasPlayerControlLock) {
        console.log('🔒 Terminal control locked - scripted event taking over');
        setIsTerminalLocked(true);
        setIsDeletionActive(false); // Visuals hidden during delay
      }
    };

    // Only subscribe once at module level
    if (!scriptedEventSubscribed) {
      scriptedEventSubscribed = true;
      triggerEventBus.on('scriptedEventStart', (data) => {
        // Call the current callback (may be updated by re-renders)
        if (scriptedEventCallback) {
          scriptedEventCallback(data);
        }
      });
    }

    // Don't return cleanup - keep subscription active to avoid missing events
  }, []);

  // Subscribe to sabotage file operations to show visuals
  useEffect(() => {
    const handleSabotageFileOperation = (data) => {
      if (data.operation === 'delete' && isTerminalLocked) {
        console.log('🚨 Sabotage deletion started - showing lockout visuals');
        setIsDeletionActive(true);
      }
    };

    triggerEventBus.on('sabotageFileOperation', handleSabotageFileOperation);

    return () => {
      triggerEventBus.off('sabotageFileOperation', handleSabotageFileOperation);
    };
  }, [isTerminalLocked]);

  // Subscribe to scripted event completion to restore control
  useEffect(() => {
    const handleScriptedEventComplete = (_data) => {
      console.log('✅ Scripted event complete - restoring terminal control');
      setIsTerminalLocked(false);
      setIsDeletionActive(false);
    };

    triggerEventBus.on('scriptedEventComplete', handleScriptedEventComplete);

    return () => {
      triggerEventBus.off('scriptedEventComplete', handleScriptedEventComplete);
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC to resume from pause
      if (e.key === 'Escape' && isPaused) {
        setIsPaused(false);
      }

      // Ctrl+D to toggle debug panel (development mode only)
      if (e.ctrlKey && e.key === 'd' && isDebugMode()) {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }

      // ESC to close debug panel
      if (e.key === 'Escape' && showDebugPanel) {
        setShowDebugPanel(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, setIsPaused, showDebugPanel]);

  return (
    <div className="desktop">
      <TopBar />

      <div className="desktop-content">
        {/* OSNet logo watermark will be in CSS background */}
        {windows.map((window) => (
          <div
            key={window.id}
            style={{ display: window.minimized ? 'none' : 'contents' }}
          >
            <Window window={window} />
          </div>
        ))}
      </div>

      <MinimizedWindowBar />

      <InstallationQueue />

      {isPaused && <PauseOverlay />}

      {isTerminalLocked && (
        <TerminalLockoutOverlay isVisible={isTerminalLocked} showVisuals={isDeletionActive} />
      )}

      {showDebugPanel && <DebugPanel onClose={() => setShowDebugPanel(false)} />}

      {forcedDisconnection && (
        <ForcedDisconnectionOverlay
          networkName={forcedDisconnection.networkName}
          reason={forcedDisconnection.reason}
          administratorMessage={forcedDisconnection.administratorMessage}
          onAcknowledge={handleAcknowledgeDisconnection}
        />
      )}
    </div>
  );
};

export default Desktop;

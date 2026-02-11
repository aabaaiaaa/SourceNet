import { useEffect, useState, useRef } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import { scheduleGameTimeCallback, clearGameTimeCallback } from '../../core/gameTimeScheduler';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import PauseOverlay from './PauseOverlay';
import ForcedDisconnectionOverlay from './ForcedDisconnectionOverlay';
import TerminalLockoutOverlay from '../TerminalLockoutOverlay';

import InstallationQueue from './InstallationQueue';
import RansomwareOverlay from './RansomwareOverlay';
import DebugPanel from '../../debug/DebugPanel';
import { isDebugMode } from '../../debug/debugSystem';
import './Desktop.css';

// Module-level subscription for scriptedEventStart to avoid missing events during React re-renders
let scriptedEventSubscribed = false;
let scriptedEventCallback = null;

const Desktop = () => {
  const { windows, isPaused, setIsPaused, playAlarmSound, currentTime, timeSpeed } = useGame();
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [forcedDisconnection, setForcedDisconnection] = useState(null);
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [isDeletionActive, setIsDeletionActive] = useState(false);

  // Ransomware overlay state
  const [ransomwareActive, setRansomwareActive] = useState(false);
  const [ransomwarePaused, setRansomwarePaused] = useState(false);
  const [ransomwareCleaning, setRansomwareCleaning] = useState(false);
  const [ransomwareCleanupProgress, setRansomwareCleanupProgress] = useState(0);
  const [ransomwareConfig, setRansomwareConfig] = useState({ duration: 60000, capacity: 90 });

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

  // Subscribe to ransomware events
  useEffect(() => {
    const handleTriggerRansomware = (data) => {
      console.log('🦠 Ransomware triggered:', data);
      setRansomwareConfig({
        duration: data.duration || 60000,
        capacity: data.capacity || 90,
      });
      setRansomwareActive(true);
      setRansomwarePaused(false);
      setRansomwareCleaning(false);
      setRansomwareCleanupProgress(0);

      if (playAlarmSound) playAlarmSound();
    };

    const handlePauseRansomware = () => {
      console.log('🛡️ Ransomware paused by antivirus');
      // Cancel grace period timer if antivirus activates during grace period
      if (graceTimerRef.current) {
        console.log('🛡️ Cancelling ransomware grace period timer');
        clearGameTimeCallback(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      setRansomwarePaused(true);
      setRansomwareCleaning(true);
      setRansomwareCleanupProgress(0);

      // Start cleanup progress over 30 game-time seconds
      let cleanupStart = Date.now();
      const cleanupDuration = 30000; // 30 seconds in game time
      const cleanupTimerId = { current: null };

      const updateCleanup = () => {
        const elapsed = (Date.now() - cleanupStart) * timeSpeed;
        const progress = Math.min(100, (elapsed / cleanupDuration) * 100);
        setRansomwareCleanupProgress(progress);

        if (progress >= 100) {
          console.log('✅ Ransomware cleanup complete');
          triggerEventBus.emit('ransomwareCleanupComplete', {});
        } else {
          cleanupTimerId.current = requestAnimationFrame(updateCleanup);
        }
      };

      cleanupTimerId.current = requestAnimationFrame(updateCleanup);
    };

    triggerEventBus.on('triggerRansomware', handleTriggerRansomware);
    triggerEventBus.on('pauseRansomware', handlePauseRansomware);

    return () => {
      triggerEventBus.off('triggerRansomware', handleTriggerRansomware);
      triggerEventBus.off('pauseRansomware', handlePauseRansomware);
      // Clean up grace period timer on unmount
      if (graceTimerRef.current) {
        clearGameTimeCallback(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [playAlarmSound, timeSpeed]);

  // Grace period timer ref for ransomware completion
  const graceTimerRef = useRef(null);

  const handleRansomwareComplete = () => {
    console.log('💀 Ransomware encryption hit 100% - starting 3s grace period');
    // Schedule a 3-game-second grace period before triggering ransomwareComplete
    graceTimerRef.current = scheduleGameTimeCallback(() => {
      console.log('💀 Grace period expired - triggering ransomwareComplete');
      graceTimerRef.current = null;
      triggerEventBus.emit('ransomwareComplete', {});
    }, 3000, timeSpeed);
  };

  const handleRansomwareCleanupComplete = () => {
    setRansomwareActive(false);
    setRansomwarePaused(false);
    setRansomwareCleaning(false);
    setRansomwareCleanupProgress(0);
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

      {ransomwareActive && (
        <RansomwareOverlay
          duration={ransomwareConfig.duration}
          capacity={ransomwareConfig.capacity}
          paused={ransomwarePaused}
          pausedZIndex={Math.max(1000, ...windows.map(w => w.zIndex || 1000))}
          cleaning={ransomwareCleaning}
          cleanupProgress={ransomwareCleanupProgress}
          onComplete={handleRansomwareComplete}
          onCleanupComplete={handleRansomwareCleanupComplete}
          timeSpeed={timeSpeed}
          currentTime={currentTime}
        />
      )}

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

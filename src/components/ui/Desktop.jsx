import { useEffect, useState } from 'react';
import { useGame } from '../../contexts/useGame';
import triggerEventBus from '../../core/triggerEventBus';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import PauseOverlay from './PauseOverlay';
import ForcedDisconnectionOverlay from './ForcedDisconnectionOverlay';

import InstallationQueue from './InstallationQueue';
import DebugPanel from '../../debug/DebugPanel';
import { isDebugMode } from '../../debug/debugSystem';
import './Desktop.css';

const Desktop = () => {
  const { windows, isPaused, setIsPaused, playAlarmSound, narEntries } = useGame();
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [forcedDisconnection, setForcedDisconnection] = useState(null);

  // Subscribe to forced disconnection events
  useEffect(() => {
    const handleForcedDisconnection = (data) => {
      console.log('🚨 Forced disconnection event received:', data);

      // Get network name from NAR entries
      const narEntry = narEntries?.find(e => e.networkId === data.networkId);
      const networkName = narEntry?.networkName || data.networkId;

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
  }, [playAlarmSound, narEntries]);

  const handleAcknowledgeDisconnection = () => {
    setForcedDisconnection(null);
  };

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
        {windows
          .filter((w) => !w.minimized)
          .map((window) => (
            <Window key={window.id} window={window} />
          ))}
      </div>

      <MinimizedWindowBar />

      <InstallationQueue />

      {isPaused && <PauseOverlay />}

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

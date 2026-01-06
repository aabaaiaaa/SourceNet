import { useEffect, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import TopBar from './TopBar';
import Window from './Window';
import MinimizedWindowBar from './MinimizedWindowBar';
import PauseOverlay from './PauseOverlay';

import InstallationQueue from './InstallationQueue';
import DebugPanel from '../../debug/DebugPanel';
import { isDebugMode } from '../../debug/debugSystem';
import './Desktop.css';

const Desktop = () => {
  const { windows, isPaused, setIsPaused } = useGame();
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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
            <Window key={window.appId} window={window} />
          ))}
      </div>

      <MinimizedWindowBar />

      <InstallationQueue />

      {isPaused && <PauseOverlay />}

      {showDebugPanel && <DebugPanel onClose={() => setShowDebugPanel(false)} />}
    </div>
  );
};

export default Desktop;

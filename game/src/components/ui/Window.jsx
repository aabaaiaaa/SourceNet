import { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../../contexts/GameContext';
import { WINDOW_SIZES } from '../../constants/gameConstants';
import SNetMail from '../apps/SNetMail';
import BankingApp from '../apps/BankingApp';
import Portal from '../apps/Portal';
import MissionBoard from '../apps/MissionBoard';
import VPNClient from '../apps/VPNClient';
import NetworkScanner from '../apps/NetworkScanner';
import NetworkAddressRegister from '../apps/NetworkAddressRegister';
import FileManager from '../apps/FileManager';
import './Window.css';

const Window = ({ window }) => {
  const { closeWindow, minimizeWindow, bringToFront, moveWindow } = useGame();
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const size = WINDOW_SIZES[window.appId] || { width: 600, height: 500 };

  // Ensure position is always valid (fallback if somehow NaN)
  const safePosition = {
    x: typeof window.position?.x === 'number' && !isNaN(window.position.x) ? window.position.x : 50,
    y: typeof window.position?.y === 'number' && !isNaN(window.position.y) ? window.position.y : 100,
  };

  const handleMouseDown = (e) => {
    // Only start drag if clicking on header (not buttons)
    if (e.target.closest('.window-control-btn')) {
      return;
    }

    const rect = windowRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);

    // Bring window to front
    bringToFront(window.id);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffsetRef.current.x;
    const newY = e.clientY - dragOffsetRef.current.y;

    // Keep window within viewport bounds (use globalThis to access browser window)
    const maxX = globalThis.innerWidth - size.width;
    const maxY = globalThis.innerHeight - size.height - 40; // Account for minimized bar

    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(40, Math.min(newY, maxY)); // Account for topbar

    moveWindow(window.id, { x: boundedX, y: boundedY });
  }, [isDragging, size, window.id, moveWindow]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getAppComponent = () => {
    switch (window.appId) {
      case 'mail':
        return <SNetMail />;
      case 'banking':
        return <BankingApp />;
      case 'portal':
        return <Portal />;
      case 'missionBoard':
        return <MissionBoard />;
      case 'vpnClient':
        return <VPNClient />;
      case 'networkScanner':
        return <NetworkScanner />;
      case 'networkAddressRegister':
        return <NetworkAddressRegister />;
      case 'fileManager':
        return <FileManager />;
      default:
        return <div>App not found: {window.appId}</div>;
    }
  };

  const getAppTitle = () => {
    switch (window.appId) {
      case 'mail':
        return 'SNet Mail';
      case 'banking':
        return 'SNet Banking App';
      case 'portal':
        return 'OSNet Portal';
      case 'missionBoard':
        return 'SourceNet Mission Board';
      case 'vpnClient':
        return 'SourceNet VPN Client';
      case 'networkScanner':
        return 'Network Scanner';
      case 'networkAddressRegister':
        return 'Network Address Register';
      case 'fileManager':
        return 'File Manager';
      default:
        return 'Unknown App';
    }
  };

  return (
    <div
      ref={windowRef}
      className="window"
      style={{
        left: safePosition.x,
        top: safePosition.y,
        width: size.width,
        height: size.height,
        zIndex: window.zIndex,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onClick={() => bringToFront(window.appId)}
    >
      <div className="window-header" onMouseDown={handleMouseDown} style={{ cursor: 'grab' }}>
        <div className="window-title">{getAppTitle()}</div>
        <div className="window-controls">
          <button
            className="window-control-btn"
            onClick={() => minimizeWindow(window.id)}
            title="Minimize"
          >
            _
          </button>
          <button
            className="window-control-btn"
            onClick={() => closeWindow(window.id)}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
      <div className="window-content">{getAppComponent()}</div>
    </div>
  );
};

export default Window;

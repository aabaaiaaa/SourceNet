import { useState, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { WINDOW_SIZES } from '../../constants/gameConstants';
import SNetMail from '../apps/SNetMail';
import BankingApp from '../apps/BankingApp';
import Portal from '../apps/Portal';
import './Window.css';

const Window = ({ window }) => {
  const { closeWindow, minimizeWindow, bringToFront, moveWindow } = useGame();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const size = WINDOW_SIZES[window.appId] || { width: 600, height: 500 };

  const handleMouseDown = (e) => {
    // Only start drag if clicking on header (not buttons)
    if (e.target.closest('.window-control-btn')) {
      return;
    }

    setIsDragging(true);
    const rect = windowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    // Bring window to front
    bringToFront(window.appId);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep window within viewport bounds
    const maxX = window.innerWidth - size.width;
    const maxY = window.innerHeight - size.height - 40; // Account for minimized bar

    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(40, Math.min(newY, maxY)); // Account for topbar

    moveWindow(window.appId, { x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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
      default:
        return 'Unknown App';
    }
  };

  return (
    <div
      ref={windowRef}
      className="window"
      style={{
        left: window.position.x,
        top: window.position.y,
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
            onClick={() => minimizeWindow(window.appId)}
            title="Minimize"
          >
            _
          </button>
          <button
            className="window-control-btn"
            onClick={() => closeWindow(window.appId)}
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

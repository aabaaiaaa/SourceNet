import { useGame } from '../../contexts/GameContext';
import './MinimizedWindowBar.css';

const MinimizedWindowBar = () => {
  const { windows, restoreWindow } = useGame();

  const minimizedWindows = windows.filter((w) => w.minimized);

  if (minimizedWindows.length === 0) {
    return null;
  }

  const getAppTitle = (appId) => {
    switch (appId) {
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
    <div className="minimized-bar">
      {minimizedWindows.map((window) => (
        <div
          key={window.appId}
          className="minimized-window"
          onClick={() => restoreWindow(window.appId)}
          title={`Restore ${getAppTitle(window.appId)}`}
        >
          <span className="minimized-title">{getAppTitle(window.appId)}</span>
          <span className="restore-icon">↑</span>
        </div>
      ))}
    </div>
  );
};

export default MinimizedWindowBar;

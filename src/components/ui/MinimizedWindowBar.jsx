import { useGame } from '../../contexts/useGame';
import { getAppTitle } from '../../utils/appRegistry';
import './MinimizedWindowBar.css';

const MinimizedWindowBar = () => {
  const { windows, restoreWindow } = useGame();

  const minimizedWindows = windows.filter((w) => w.minimized);

  if (minimizedWindows.length === 0) {
    return null;
  }

  return (
    <div className="minimized-bar">
      {minimizedWindows.map((window) => (
        <div
          key={window.id}
          className="minimized-window"
          onClick={() => restoreWindow(window.id)}
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

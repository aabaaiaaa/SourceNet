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

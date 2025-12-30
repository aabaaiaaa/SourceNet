import { useGame } from '../../contexts/GameContext';
import './InstallationQueue.css';

/**
 * Installation Queue Widget
 * Shows active downloads/installations in bottom-right corner of desktop
 */
const InstallationQueue = () => {
  const { downloadQueue } = useGame();

  // Only show if there are active downloads
  const activeDownloads = (downloadQueue || []).filter(
    (item) => item.status === 'downloading' || item.status === 'installing'
  );

  if (activeDownloads.length === 0) {
    return null;
  }

  return (
    <div className="installation-queue-widget">
      <div className="queue-header">Downloads</div>
      {activeDownloads.map((item) => (
        <div key={item.id} className="queue-item">
          <div className="queue-item-name">{item.softwareName || item.softwareId}</div>
          <div className="queue-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${item.progress || 0}%` }}
              />
            </div>
            <div className="progress-text">{Math.floor(item.progress || 0)}%</div>
          </div>
          <div className="queue-status">
            {item.status === 'downloading' && '↓ Downloading'}
            {item.status === 'installing' && '⚙ Installing'}
          </div>
        </div>
      ))}
    </div>
  );
};

export default InstallationQueue;

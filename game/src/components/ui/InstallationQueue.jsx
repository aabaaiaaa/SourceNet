import { useGame } from '../../contexts/GameContext';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateAvailableBandwidth,
  calculateTransferSpeed,
} from '../../systems/NetworkBandwidthSystem';
import { calculateBandwidthShare, estimateDownloadTime } from '../../systems/InstallationSystem';
import './InstallationQueue.css';

/**
 * Format bytes/MB for display
 */
const formatSize = (sizeInMB) => {
  if (sizeInMB >= 1000) {
    return `${(sizeInMB / 1000).toFixed(1)} GB`;
  }
  return `${sizeInMB} MB`;
};

/**
 * Format time remaining for display
 */
const formatTimeRemaining = (seconds) => {
  if (seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
};

/**
 * Installation Queue Widget
 * Shows active downloads/installations in bottom-right corner of desktop
 */
const InstallationQueue = () => {
  const { downloadQueue, hardware } = useGame();

  // Only show if there are active downloads
  const activeDownloads = (downloadQueue || []).filter(
    (item) => item.status === 'downloading' || item.status === 'installing' || item.status === 'complete'
  );

  if (activeDownloads.length === 0) {
    return null;
  }

  // Calculate current download speed for display
  const downloadingCount = activeDownloads.filter((item) => item.status === 'downloading').length;
  const bandwidthShare = calculateBandwidthShare(downloadingCount);
  const adapterSpeed = getAdapterSpeed(hardware);
  const connectionSpeed = getNetworkBandwidth();
  const effectiveSpeed = calculateAvailableBandwidth(adapterSpeed, connectionSpeed, 1);
  const downloadSpeedMBps = calculateTransferSpeed(effectiveSpeed * bandwidthShare);

  return (
    <div className="installation-queue-widget">
      <div className="queue-header">
        Downloads
        {downloadingCount > 0 && (
          <span className="queue-speed">{downloadSpeedMBps.toFixed(1)} MB/s</span>
        )}
      </div>
      {activeDownloads.map((item) => {
        // Calculate time remaining for downloading items
        const remainingMB = item.sizeInMB * (1 - (item.progress || 0) / 100);
        const timeRemaining = remainingMB / downloadSpeedMBps;

        return (
          <div key={item.id} className={`queue-item ${item.status}`}>
            <div className="queue-item-name">{item.softwareName || item.softwareId}</div>
            <div className="queue-progress">
              <div className="progress-bar">
                <div
                  className={`progress-fill ${item.status}`}
                  style={{ width: `${item.progress || 0}%` }}
                />
              </div>
              <div className="progress-text">{Math.floor(item.progress || 0)}%</div>
            </div>
            <div className="queue-details">
              <span className="queue-status">
                {item.status === 'downloading' && '↓ Downloading'}
                {item.status === 'installing' && '⚙ Installing...'}
                {item.status === 'complete' && '✓ Complete'}
              </span>
              {item.status === 'downloading' && item.sizeInMB && (
                <span className="queue-info">
                  {formatSize(Math.floor(item.sizeInMB * (item.progress || 0) / 100))} / {formatSize(item.sizeInMB)}
                  {timeRemaining > 0 && ` • ${formatTimeRemaining(timeRemaining)}`}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InstallationQueue;

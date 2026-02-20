import { isKnownMalicious } from '../../systems/MalwareDetectionHelper';
import { formatTransferSpeed, formatTimeRemaining } from '../../utils/formatUtils';

const FileManagerFileList = ({
  files,
  operatingFiles,
  fileProgress,
  fileOperations,
  fileOperationStats,
  selectedFileSystem,
  knownMaliciousFiles,
  clipboardSourceNetwork,
  onFileSelect,
}) => {
  return (
    <div className="file-list">
      {files.map((file, idx) => {
        const isOperating = operatingFiles.has(file.name);
        const progress = fileProgress[file.name] || 0;
        const operation = fileOperations[file.name];
        const stats = fileOperationStats[file.name] || {};
        const isCrossNetworkPaste = operation === 'paste-cross';

        const isMalicious = isKnownMalicious(file.name, selectedFileSystem, knownMaliciousFiles || []);

        return (
          <div
            key={idx}
            className={`file-item ${file.corrupted ? 'file-corrupted' : ''
              } ${file.selected ? 'file-selected' : ''
              } ${isOperating ? 'file-operating' : ''
              } ${isMalicious ? 'file-malicious' : ''
              }`}
            onClick={() => !isOperating && onFileSelect(idx)}
            style={{ cursor: isOperating ? 'default' : 'pointer' }}
          >
            {file.corrupted && <span className="corruption-icon">⚠</span>}
            {isMalicious && <span className="malware-icon">☣</span>}
            <span className="file-name">{file.name}</span>
            <span className="file-size">{file.size}</span>

            {isOperating && (
              <div className="file-progress">
                <div className="file-progress-bar">
                  <div
                    className={`file-progress-fill ${isCrossNetworkPaste ? 'cross-network' : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="file-progress-text">
                  {operation?.replace('-cross', '')} {Math.floor(progress)}%
                  {stats.transferSpeedMBps > 0 && ` • ${formatTransferSpeed(stats.transferSpeedMBps)}`}
                  {stats.remainingSeconds > 0 && ` • ${formatTimeRemaining(stats.remainingSeconds)} left`}
                  {isCrossNetworkPaste && ` • from ${clipboardSourceNetwork}`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FileManagerFileList;

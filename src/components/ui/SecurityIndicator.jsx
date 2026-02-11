import { useState } from 'react';
import './SecurityIndicator.css';

const SecurityIndicator = ({ processing, cleanupProgress, threatCount }) => {
  const [showPreview, setShowPreview] = useState(false);

  const statusText = processing ? 'Cleaning threat...' : 'Protected';
  const statusClass = processing ? 'processing' : 'active';

  return (
    <div
      className={`security-indicator ${statusClass}`}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
      title={statusText}
    >
      <span className="security-icon">
        🛡️
        {processing && <span className="security-spinner" />}
      </span>
      {processing && cleanupProgress > 0 && (
        <span className="security-progress">{Math.floor(cleanupProgress)}%</span>
      )}

      {showPreview && (
        <div className="notification-preview security-preview">
          <div className="preview-header">Advanced Firewall & Antivirus</div>
          <div className="security-section">
            <div className="security-section-title">Firewall</div>
            <div className="preview-item">
              Status: <span className="security-status-active">Active</span>
            </div>
          </div>
          <div className="security-section">
            <div className="security-section-title">Antivirus</div>
            <div className="preview-item">
              Status: <span className={`security-status-${processing ? 'cleaning' : 'active'}`}>
                {processing ? 'Cleaning' : 'Active'}
              </span>
            </div>
            {threatCount > 0 && (
              <div className="preview-item">
                Threats: {threatCount}
              </div>
            )}
            {processing && cleanupProgress > 0 && (
              <div className="preview-item">
                Cleanup: {Math.floor(cleanupProgress)}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityIndicator;

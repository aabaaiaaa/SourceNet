import { useState } from 'react';
import './SecurityIndicator.css';

const SecurityIndicator = ({ processing, cleanupProgress, threatCount, avAlerts = [] }) => {
  const [showPreview, setShowPreview] = useState(false);

  const statusText = processing ? 'Cleaning threat...' : 'Protected';
  const statusClass = processing ? 'processing' : 'active';

  // Auto-show popup when there are AV alerts
  const hasAvAlerts = avAlerts.length > 0;
  const isPopupVisible = showPreview || hasAvAlerts;

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

      {isPopupVisible && (
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

          {hasAvAlerts && (
            <div className="av-alerts-section">
              <div className="security-section-title">Scan Alerts</div>
              {avAlerts.map((alert) => (
                <div key={alert.fileName} className={`av-alert-item ${alert.phase}`}>
                  {alert.phase === 'scanning' ? (
                    <>
                      <span className="av-alert-spinner" />
                      <span className="av-alert-text">Scanning: {alert.fileName}</span>
                    </>
                  ) : (
                    <>
                      <span className="av-alert-check">✓</span>
                      <span className="av-alert-text">Removed: {alert.fileName}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityIndicator;

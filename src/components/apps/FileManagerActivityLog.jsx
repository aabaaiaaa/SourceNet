const FileManagerActivityLog = ({ activityLog, isLogCollapsed, setIsLogCollapsed }) => {
  return (
    <div className={`activity-log-panel ${isLogCollapsed ? 'collapsed' : ''}`}>
      <div className="activity-log-header" onClick={() => setIsLogCollapsed(!isLogCollapsed)}>
        <span className="activity-log-title">
          📋 Activity Log ({activityLog.length})
        </span>
        <span className="activity-log-toggle">{isLogCollapsed ? '▲' : '▼'}</span>
      </div>
      {!isLogCollapsed && (
        <div className="activity-log-content">
          {activityLog.length === 0 ? (
            <div className="activity-log-empty">No activity yet</div>
          ) : (
            activityLog.map((entry) => (
              <div
                key={entry.id}
                className={`activity-log-entry ${entry.isSabotage ? 'sabotage-entry' : ''}`}
              >
                <span className="log-timestamp">{entry.timestamp}</span>
                <span className="log-operation">{entry.operation.toUpperCase()}</span>
                <span className="log-filename">{entry.fileName}</span>
                <span className="log-location">@ {entry.location}</span>
                <span className={`log-source ${entry.isSabotage ? 'source-unknown' : ''}`}>
                  {entry.isSabotage ? '⚠️ ' : ''}{entry.source}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default FileManagerActivityLog;

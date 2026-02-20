import { getFileOperationProgress, getFileOperationDetails, getFileDecryptionProgress, getFileUploadProgress, areAllRequiredObjectivesComplete, hasIncompleteOptionalObjectives } from '../../missions/ObjectiveTracker';

const formatDeadline = (deadlineTime, currentTime) => {
  if (!deadlineTime || !currentTime) return null;

  const deadline = new Date(deadlineTime);
  const now = new Date(currentTime);
  const remainingMs = deadline - now;

  if (remainingMs <= 0) {
    return { display: 'TIME EXPIRED!', isUrgent: true, expired: true };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const isUrgent = minutes < 1;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;

  return { display, isUrgent, expired: false };
};

const MissionBoardActiveTab = ({
  activeMission,
  currentTime,
  missionFileOperations,
  missionDecryptionOperations,
  missionUploadOperations,
  missionSubmitting,
  submitMissionForCompletion,
}) => {
  if (!activeMission) {
    return (
      <div className="empty-state">
        <p>No active mission.</p>
        <p>Accept a mission from the Available tab to get started.</p>
      </div>
    );
  }

  const completedCount = activeMission.objectives?.filter((o) => o.status === 'complete').length || 0;
  const totalCount = activeMission.objectives?.length || 0;
  const deadline = formatDeadline(activeMission.deadlineTime, currentTime);

  return (
    <div className="active-mission">
      <div className="mission-header">
        <h3>{activeMission.title}</h3>
        <span className="progress-indicator">
          {completedCount}/{totalCount} objectives complete
        </span>
      </div>

      {deadline && (
        <div className={`mission-deadline ${deadline.isUrgent ? 'deadline-urgent' : ''}`}>
          <span className="deadline-icon">⏱️</span>
          <span className="deadline-text">{deadline.display}</span>
          {deadline.expired && <span className="deadline-expired-note"> - Mission will be failed!</span>}
        </div>
      )}

      {activeMission.arcId && (
        <div className="mission-arc-indicator">
          <span className="arc-icon">📖</span>
          <span className="arc-text">
            Part {activeMission.arcSequence} of {activeMission.arcTotal} - {activeMission.arcStoryline || 'Story Arc'}
          </span>
        </div>
      )}

      <div className="mission-client">Client: {activeMission.client}</div>

      {activeMission.briefing && (
        <div className="mission-briefing">
          <h4>Mission Briefing:</h4>
          <pre className="briefing-text">{activeMission.briefing}</pre>
        </div>
      )}

      <div className="objectives-section">
        <h4>Objectives:</h4>
        <ul className="objectives-list">
          {activeMission.objectives?.map((objective, index) => {
            const progress = objective.type === 'fileOperation'
              ? getFileOperationProgress(objective, missionFileOperations)
              : objective.type === 'fileDecryption'
              ? getFileDecryptionProgress(objective, missionDecryptionOperations)
              : objective.type === 'fileUpload'
              ? getFileUploadProgress(objective, missionUploadOperations)
              : null;
            const fileDetails = objective.type === 'fileOperation' && objective.status !== 'complete'
              ? getFileOperationDetails(objective, missionFileOperations)
              : null;

            const allPriorComplete = activeMission.objectives
              .slice(0, index)
              .every(obj => obj.status === 'complete');

            const isComplete = objective.status === 'complete';
            const isPendingPrior = isComplete && !allPriorComplete;

            return (
              <li
                key={objective.id}
                className={`objective-item objective-${objective.status}${isPendingPrior ? ' objective-pending-prior' : ''}`}
              >
                <span className="objective-checkbox">
                  {objective.status === 'complete' ? '☑' : '☐'}
                </span>
                <span className="objective-description">
                  {objective.description}
                  {objective.required === false && (
                    <span className="optional-label">
                      (Optional{objective.bonusPayout ? ` +${objective.bonusPayout} credits` : ''})
                    </span>
                  )}
                  {progress && objective.status !== 'complete' && (
                    <span className="objective-progress"> ({progress.current}/{progress.total})</span>
                  )}
                </span>
                {objective.status === 'complete' && (
                  <span className="objective-status-complete"> ✓</span>
                )}
                {objective.status === 'failed' && (
                  <span className="objective-status-failed"> ✗</span>
                )}
                {fileDetails && fileDetails.targetFiles.length > 0 && (
                  <div className="file-checklist">
                    {fileDetails.destination && (
                      <div className="file-destination">
                        <span className="destination-icon">📍</span>
                        <span className="destination-text">Destination: {fileDetails.destination}</span>
                      </div>
                    )}
                    <ul className="file-list">
                      {fileDetails.targetFiles.map((fileName) => {
                        const isFileComplete = fileDetails.completedFiles.includes(fileName);
                        const isWrongLocation = fileDetails.wrongLocationFiles.includes(fileName);
                        return (
                          <li key={fileName} className={`file-item ${isFileComplete ? 'file-complete' : ''} ${isWrongLocation ? 'file-wrong-location' : ''}`}>
                            <span className="file-checkbox">{isFileComplete ? '✓' : '○'}</span>
                            <span className="file-name">{fileName}</span>
                            {isWrongLocation && <span className="file-warning" title="File pasted to wrong location">⚠️</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {activeMission.status === 'completing' && (
        <div className="mission-completing">
          Mission Completing... Verifying results with client...
        </div>
      )}

      {activeMission.status === 'failed' && (
        <div className="mission-failed">
          <strong>Mission Failed</strong>
          {activeMission.failureReason && <p>{activeMission.failureReason}</p>}
        </div>
      )}

      {activeMission.status === 'active' &&
        areAllRequiredObjectivesComplete(activeMission.objectives.filter(obj => obj.type !== 'verification')) &&
        hasIncompleteOptionalObjectives(activeMission.objectives) && (
        <div className="mission-submit-section">
          <p className="submit-info">
            {missionSubmitting
              ? 'Verifying mission completion...'
              : 'All required objectives complete. You can submit now or complete optional objectives for bonus rewards.'}
          </p>
          <button
            className="submit-mission-btn"
            onClick={() => submitMissionForCompletion && submitMissionForCompletion()}
            disabled={missionSubmitting}
          >
            {missionSubmitting ? 'Submitting...' : 'Submit for Completion'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MissionBoardActiveTab;

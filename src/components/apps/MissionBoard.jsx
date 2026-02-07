import { useState } from 'react';
import { useGame } from '../../contexts/useGame';
import { canAcceptMission, calculateMissionPayout } from '../../systems/MissionSystem';
import { getReputationTier, canAccessClientType } from '../../systems/ReputationSystem';
import { getFileOperationProgress, getFileOperationDetails, areAllRequiredObjectivesComplete, hasIncompleteOptionalObjectives } from '../../missions/ObjectiveTracker';
import './MissionBoard.css';

/**
 * Format time remaining until expiration
 * @param {string} expiresAt - ISO date string
 * @param {Date} currentTime - Current game time
 * @returns {Object} { display: string, isUrgent: boolean, expired: boolean }
 */
const formatExpiration = (expiresAt, currentTime) => {
  if (!expiresAt) return null;

  const expiresDate = new Date(expiresAt);
  const now = new Date(currentTime);
  const diffMs = expiresDate - now;

  if (diffMs <= 0) {
    return { display: 'EXPIRED', isUrgent: true, expired: true };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const isUrgent = hours < 2;
  const timeDisplay = hours > 0
    ? `${hours}h ${minutes}m remaining`
    : `${minutes}m remaining`;

  const dateDisplay = expiresDate.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    display: `${timeDisplay} (${dateDisplay})`,
    isUrgent,
    expired: false
  };
};

/**
 * Format deadline countdown for active missions
 * @param {Date|string} deadlineTime - The deadline time
 * @param {Date} currentTime - Current game time
 * @returns {Object|null} { display: string, isUrgent: boolean, expired: boolean }
 */
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

const MissionBoard = () => {
  const {
    availableMissions,
    activeMission,
    completedMissions,
    software,
    reputation,
    acceptMission,
    dismissMission,
    submitMissionForCompletion,
    missionFileOperations,
    // Procedural mission state
    proceduralMissionsEnabled,
    missionPool,
    currentTime,
  } = useGame();

  const [activeTab, setActiveTab] = useState('available'); // 'available', 'active', 'completed'

  const installedSoftwareIds = software || [];

  // Combine story missions and procedural pool, filtering out not-yet-visible and replaced expired missions
  const allAvailableMissions = [
    ...(availableMissions || []),
    ...(proceduralMissionsEnabled ? (missionPool || []) : [])
  ].filter(mission => {
    // Hide missions that aren't visible yet (regenerated missions have a 1 min delay)
    if (mission.visibleAt && new Date(mission.visibleAt) > new Date(currentTime)) {
      return false;
    }
    // Hide expired missions that have a visible replacement
    // (expired missions stay visible until their replacement becomes visible)
    if (mission.replacementGeneratedAt) {
      // Find the replacement mission
      const replacement = missionPool.find(m => m.replacesExpiredMissionId === mission.missionId);
      if (replacement) {
        // If replacement is now visible, hide this expired mission
        if (!replacement.visibleAt || new Date(replacement.visibleAt) <= new Date(currentTime)) {
          return false;
        }
      }
    }
    return true;
  });

  const handleAcceptMission = (mission) => {
    const validation = canAcceptMission(mission, installedSoftwareIds, reputation, activeMission);

    if (!validation.canAccept) {
      alert(validation.reason);
      return;
    }

    // Accept the mission
    acceptMission(mission);

    // Switch to Active tab to show the mission
    setActiveTab('active');
  };

  const handleDismissMission = (mission) => {
    // Only allow dismissing procedural missions
    if (!mission.isProcedurallyGenerated) {
      return;
    }
    dismissMission(mission);
  };

  const renderAvailableTab = () => {
    if (!allAvailableMissions || allAvailableMissions.length === 0) {
      return (
        <div className="empty-state">
          <p>No missions currently available.</p>
          <p>Check back later for new contracts.</p>
        </div>
      );
    }

    return (
      <div className="missions-list">
        {allAvailableMissions.map((mission) => {
          const validation = canAcceptMission(mission, installedSoftwareIds, reputation, activeMission);
          const payout = calculateMissionPayout(mission.basePayout || mission.payout || 0, reputation);
          const tierInfo = getReputationTier(reputation);

          // Check reputation access - use clientType for procedural, minReputation for story
          const canAccessByClientType = mission.clientType
            ? canAccessClientType(mission.clientType, reputation)
            : true;
          const canAccessByMinRep = mission.minReputation ? reputation >= mission.minReputation : true;
          const canAccess = canAccessByClientType && canAccessByMinRep;

          // Check expiration for procedural missions
          const expiration = mission.expiresAt ? formatExpiration(mission.expiresAt, currentTime) : null;
          const isExpired = expiration?.expired;

          // Chain info
          const isChainMission = mission.chainId && mission.totalParts > 1;

          // Arc info for procedural missions
          const isArcMission = mission.arcId && mission.arcTotal > 1;

          return (
            <div
              key={mission.missionId || mission.id}
              className={`mission-card ${!canAccess ? 'mission-locked' : ''} ${isExpired ? 'mission-expired' : ''}`}
            >
              <div className="mission-header">
                <h3>{mission.title}</h3>
                <div className="mission-badges">
                  {!mission.isProcedurallyGenerated && (
                    <span className="story-badge">STORY</span>
                  )}
                  {isChainMission && (
                    <span className="chain-badge">
                      Part {mission.partNumber}/{mission.totalParts}
                    </span>
                  )}
                  {isArcMission && (
                    <span className="arc-badge">
                      📖 {mission.arcSequence}/{mission.arcTotal}
                    </span>
                  )}
                  <span className={`difficulty-badge difficulty-${mission.difficulty?.toLowerCase()}`}>
                    {mission.difficulty || 'Easy'}
                  </span>
                </div>
              </div>

              <div className="mission-info">
                <div className="mission-client">Client: {mission.client || 'Anonymous'}</div>
                <div className="mission-payout">
                  Payout: {payout} credits
                  {tierInfo.payoutMultiplier !== 1.0 && (
                    <span className="payout-multiplier">
                      ({tierInfo.payoutMultiplier}x rep bonus)
                    </span>
                  )}
                </div>
                {expiration && !isExpired && (
                  <div className={`mission-expiration ${expiration.isUrgent ? 'expiration-urgent' : ''}`}>
                    ⏱ {expiration.display}
                  </div>
                )}
                {isExpired && (
                  <div className="mission-expiration expiration-expired">
                    ⏱ EXPIRED
                  </div>
                )}
                {/* Show time limit - support both timeLimit and timeLimitMinutes */}
                {(mission.timeLimit || mission.timeLimitMinutes) && (
                  <div className="mission-time-limit">
                    ⏰ Time Limit: {mission.timeLimitMinutes || mission.timeLimit} minutes once accepted
                  </div>
                )}
                {/* Arc storyline indicator */}
                {isArcMission && mission.arcStoryline && (
                  <div className="mission-arc-storyline">
                    📜 {mission.arcStoryline.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                )}
              </div>

              {/* Show full description only if accessible */}
              {canAccess && mission.description && (
                <div className="mission-description">{mission.description}</div>
              )}

              {/* Show briefing for procedural missions if accessible */}
              {canAccess && mission.briefing && !mission.description && (
                <div className="mission-description">{mission.briefing.substring(0, 200)}...</div>
              )}

              {canAccess && mission.requirements && mission.requirements.software && (
                <div className="mission-requirements">
                  <strong>Requirements:</strong>
                  <ul>
                    {mission.requirements.software.map((sw, index) => (
                      <li key={`${mission.missionId || mission.id}-sw-${index}`}>
                        {sw}
                        {!installedSoftwareIds.includes(sw) && (
                          <span className="requirement-missing"> (Missing)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!canAccess && (
                <div className="mission-locked-message">
                  🔒 Requires higher reputation to access this client
                  {mission.minReputation && ` (Tier ${mission.minReputation}+)`}
                </div>
              )}

              <button
                className="accept-mission-btn"
                onClick={() => handleAcceptMission(mission)}
                disabled={!validation.canAccept || !canAccess || isExpired}
              >
                {isExpired ? 'Expired' : !canAccess ? 'Locked' : !validation.canAccept ? validation.reason : 'Accept Mission'}
              </button>

              {/* Dismiss button - only for procedural missions */}
              {mission.isProcedurallyGenerated && (
                <button
                  className="dismiss-mission-btn"
                  onClick={() => handleDismissMission(mission)}
                  disabled={isExpired}
                  title={isArcMission ? 'Dismissing will remove the entire storyline' : 'Remove this mission from the board'}
                >
                  {isArcMission ? 'Dismiss Storyline' : 'Dismiss'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderActiveTab = () => {
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

        {/* Deadline Countdown */}
        {deadline && (
          <div className={`mission-deadline ${deadline.isUrgent ? 'deadline-urgent' : ''}`}>
            <span className="deadline-icon">⏱️</span>
            <span className="deadline-text">{deadline.display}</span>
            {deadline.expired && <span className="deadline-expired-note"> - Mission will be failed!</span>}
          </div>
        )}

        {/* Arc Progress Indicator */}
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
                : null;
              const fileDetails = objective.type === 'fileOperation' && objective.status !== 'complete'
                ? getFileOperationDetails(objective, missionFileOperations)
                : null;

              // Check if all prior objectives are complete (for visual styling)
              const allPriorComplete = activeMission.objectives
                .slice(0, index)
                .every(obj => obj.status === 'complete');

              // Determine visual state: grey if pre-completed with pending priors, green if fully complete
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
                      <span className="optional-label">(Optional)</span>
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

        {/* Submit button - shown when all required objectives complete but optional remain */}
        {activeMission.status === 'active' &&
          areAllRequiredObjectivesComplete(activeMission.objectives) &&
          hasIncompleteOptionalObjectives(activeMission.objectives) && (
          <div className="mission-submit-section">
            <p className="submit-info">
              All required objectives complete. You can submit now or complete optional objectives for bonus rewards.
            </p>
            <button
              className="submit-mission-btn"
              onClick={() => submitMissionForCompletion && submitMissionForCompletion()}
            >
              Submit for Completion
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderFailedTab = () => {
    const failedMissions = completedMissions?.filter(m => m.status === 'failed') || [];

    if (failedMissions.length === 0) {
      return (
        <div className="empty-state">
          <p>No failed missions.</p>
          <p>Keep up the good work!</p>
        </div>
      );
    }

    return (
      <div className="missions-list">
        {failedMissions.map((mission) => (
          <div
            key={mission.missionId || mission.id}
            className={`mission-card mission-${mission.status}`}
          >
            <div className="mission-header">
              <h3>{mission.title}</h3>
              <span className={`status-badge status-${mission.status}`}>
                ✗ FAILED
              </span>
            </div>

            <div className="mission-info">
              <div className="mission-client">Client: {mission.client}</div>
              <div className="mission-completion">
                Failed: {new Date(mission.completionTime).toLocaleString()}
              </div>
              {mission.failureReason && (
                <div className="mission-failure-reason">
                  Reason: {mission.failureReason}
                </div>
              )}
              <div className="mission-duration">Duration: {mission.duration} minutes</div>
              <div className={`mission-payout ${mission.payout >= 0 ? 'payout-positive' : 'payout-negative'}`}>
                Penalty: {mission.payout >= 0 ? '+' : ''}{mission.payout} credits
              </div>
              {mission.reputationChange !== 0 && (
                <div className={`reputation-change ${mission.reputationChange > 0 ? 'rep-positive' : 'rep-negative'}`}>
                  Reputation: {mission.reputationChange > 0 ? '+' : ''}{mission.reputationChange}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCompletedTab = () => {
    const successfulMissions = completedMissions?.filter(m => m.status === 'success') || [];

    if (successfulMissions.length === 0) {
      return (
        <div className="empty-state">
          <p>No completed missions yet.</p>
          <p>Complete missions to build your track record.</p>
        </div>
      );
    }

    return (
      <div className="missions-list">
        {successfulMissions.map((mission) => (
          <div
            key={mission.missionId || mission.id}
            className={`mission-card mission-${mission.status}`}
          >
            <div className="mission-header">
              <h3>{mission.title}</h3>
              <span className={`status-badge status-${mission.status}`}>
                {mission.status === 'success' ? '✓ SUCCESS' : '✗ FAILED'}
              </span>
            </div>

            <div className="mission-info">
              <div className="mission-client">Client: {mission.client}</div>
              <div className="mission-completion">
                Completed: {new Date(mission.completionTime).toLocaleString()}
              </div>
              <div className="mission-duration">Duration: {mission.duration} minutes</div>
              <div className={`mission-payout ${mission.payout >= 0 ? 'payout-positive' : 'payout-negative'}`}>
                Payout: {mission.payout >= 0 ? '+' : ''}{mission.payout} credits
              </div>
              {mission.reputationChange !== 0 && (
                <div className={`reputation-change ${mission.reputationChange > 0 ? 'rep-positive' : 'rep-negative'}`}>
                  Reputation: {mission.reputationChange > 0 ? '+' : ''}{mission.reputationChange}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mission-board">
      <div className="mission-board-header">
        <h2>SourceNet Mission Board</h2>
        <p className="subtitle">Ethical Hacking Contracts</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'available' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          Available Missions
          {allAvailableMissions && allAvailableMissions.length > 0 && (
            <span className="tab-badge">{allAvailableMissions.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'active' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Mission
          {activeMission && <span className="tab-indicator">●</span>}
        </button>
        <button
          className={`tab ${activeTab === 'failed' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('failed')}
        >
          Failed
          {(() => {
            const failedCount = completedMissions?.filter(m => m.status === 'failed').length || 0;
            return failedCount > 0 && <span className="tab-badge">{failedCount}</span>;
          })()}
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
          {(() => {
            const successCount = completedMissions?.filter(m => m.status === 'success').length || 0;
            return successCount > 0 && <span className="tab-badge">{successCount}</span>;
          })()}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'available' && renderAvailableTab()}
        {activeTab === 'active' && renderActiveTab()}
        {activeTab === 'failed' && renderFailedTab()}
        {activeTab === 'completed' && renderCompletedTab()}
      </div>
    </div>
  );
};

export default MissionBoard;

import { useState } from 'react';
import { useGame } from '../../contexts/useGame';
import { canAcceptMission } from '../../systems/MissionSystem';
import MissionBoardAvailableTab from './MissionBoardAvailableTab';
import MissionBoardActiveTab from './MissionBoardActiveTab';
import './MissionBoard.css';

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
    missionSubmitting,
    missionFileOperations,
    missionDecryptionOperations,
    missionUploadOperations,
    proceduralMissionsEnabled,
    missionPool,
    currentTime,
  } = useGame();

  const [activeTab, setActiveTab] = useState('available');

  const installedSoftwareIds = software || [];

  // Combine story missions and procedural pool, filtering out not-yet-visible and replaced expired missions
  const allAvailableMissions = [
    ...(availableMissions || []),
    ...(proceduralMissionsEnabled ? (missionPool || []) : [])
  ].filter(mission => {
    if (mission.visibleAt && new Date(mission.visibleAt) > new Date(currentTime)) {
      return false;
    }
    if (mission.replacementGeneratedAt) {
      const replacement = missionPool.find(m => m.replacesExpiredMissionId === mission.missionId);
      if (replacement) {
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

    acceptMission(mission);
    setActiveTab('active');
  };

  const handleDismissMission = (mission) => {
    if (!mission.isProcedurallyGenerated) {
      return;
    }
    dismissMission(mission);
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
        {activeTab === 'available' && (
          <MissionBoardAvailableTab
            missions={allAvailableMissions}
            installedSoftwareIds={installedSoftwareIds}
            reputation={reputation}
            activeMission={activeMission}
            currentTime={currentTime}
            onAccept={handleAcceptMission}
            onDismiss={handleDismissMission}
          />
        )}
        {activeTab === 'active' && (
          <MissionBoardActiveTab
            activeMission={activeMission}
            currentTime={currentTime}
            missionFileOperations={missionFileOperations}
            missionDecryptionOperations={missionDecryptionOperations}
            missionUploadOperations={missionUploadOperations}
            missionSubmitting={missionSubmitting}
            submitMissionForCompletion={submitMissionForCompletion}
          />
        )}
        {activeTab === 'failed' && renderFailedTab()}
        {activeTab === 'completed' && renderCompletedTab()}
      </div>
    </div>
  );
};

export default MissionBoard;

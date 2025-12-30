import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { canAcceptMission, calculateMissionPayout } from '../../systems/MissionSystem';
import { getReputationTier } from '../../systems/ReputationSystem';
import './MissionBoard.css';

const MissionBoard = () => {
  const {
    availableMissions,
    activeMission,
    completedMissions,
    software,
    reputation,
    acceptMission,
  } = useGame();

  const [activeTab, setActiveTab] = useState('available'); // 'available', 'active', 'completed'

  const installedSoftwareIds = software || [];

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

  const renderAvailableTab = () => {
    if (!availableMissions || availableMissions.length === 0) {
      return (
        <div className="empty-state">
          <p>No missions currently available.</p>
          <p>Check back later for new contracts.</p>
        </div>
      );
    }

    return (
      <div className="missions-list">
        {availableMissions.map((mission) => {
          const validation = canAcceptMission(mission, installedSoftwareIds, reputation, activeMission);
          const payout = calculateMissionPayout(mission.basePayout || mission.payout || 0, reputation);
          const tierInfo = getReputationTier(reputation);
          const canAccess = mission.minReputation ? reputation >= mission.minReputation : true;

          return (
            <div
              key={mission.id}
              className={`mission-card ${!canAccess ? 'mission-locked' : ''}`}
            >
              <div className="mission-header">
                <h3>{mission.title}</h3>
                <span className={`difficulty-badge difficulty-${mission.difficulty?.toLowerCase()}`}>
                  {mission.difficulty || 'Easy'}
                </span>
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
              </div>

              {mission.description && (
                <div className="mission-description">{mission.description}</div>
              )}

              {mission.requirements && mission.requirements.software && (
                <div className="mission-requirements">
                  <strong>Requirements:</strong>
                  <ul>
                    {mission.requirements.software.map((sw) => (
                      <li key={sw}>
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
                  Requires: {mission.minReputationName || `Tier ${mission.minReputation}`} or higher
                </div>
              )}

              <button
                className="accept-mission-btn"
                onClick={() => handleAcceptMission(mission)}
                disabled={!validation.canAccept || !canAccess}
              >
                {!validation.canAccept ? validation.reason : 'Accept Mission'}
              </button>
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

    return (
      <div className="active-mission">
        <div className="mission-header">
          <h3>{activeMission.title}</h3>
          <span className="progress-indicator">
            {completedCount}/{totalCount} objectives complete
          </span>
        </div>

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
            {activeMission.objectives?.map((objective) => (
              <li
                key={objective.id}
                className={`objective-item objective-${objective.status}`}
              >
                <span className="objective-checkbox">
                  {objective.status === 'complete' ? '☑' : '☐'}
                </span>
                <span className="objective-description">{objective.description}</span>
                {objective.status === 'complete' && (
                  <span className="objective-status-complete"> ✓</span>
                )}
                {objective.status === 'failed' && (
                  <span className="objective-status-failed"> ✗</span>
                )}
              </li>
            ))}
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
      </div>
    );
  };

  const renderCompletedTab = () => {
    if (!completedMissions || completedMissions.length === 0) {
      return (
        <div className="empty-state">
          <p>No completed missions yet.</p>
          <p>Complete missions to build your track record.</p>
        </div>
      );
    }

    return (
      <div className="missions-list">
        {completedMissions.map((mission) => (
          <div
            key={mission.id}
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
          {availableMissions && availableMissions.length > 0 && (
            <span className="tab-badge">{availableMissions.length}</span>
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
          className={`tab ${activeTab === 'completed' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
          {completedMissions && completedMissions.length > 0 && (
            <span className="tab-badge">{completedMissions.length}</span>
          )}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'available' && renderAvailableTab()}
        {activeTab === 'active' && renderActiveTab()}
        {activeTab === 'completed' && renderCompletedTab()}
      </div>
    </div>
  );
};

export default MissionBoard;

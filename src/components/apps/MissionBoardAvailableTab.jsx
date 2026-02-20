import { canAcceptMission, calculateMissionPayout } from '../../systems/MissionSystem';
import { getReputationTier, canAccessClientType } from '../../systems/ReputationSystem';

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

const MissionBoardAvailableTab = ({
  missions,
  installedSoftwareIds,
  reputation,
  activeMission,
  currentTime,
  onAccept,
  onDismiss,
}) => {
  if (!missions || missions.length === 0) {
    return (
      <div className="empty-state">
        <p>No missions currently available.</p>
        <p>Check back later for new contracts.</p>
      </div>
    );
  }

  const tierInfo = getReputationTier(reputation);

  return (
    <div className="missions-list">
      {missions.map((mission) => {
        const validation = canAcceptMission(mission, installedSoftwareIds, reputation, activeMission);
        const payout = calculateMissionPayout(mission.basePayout || mission.payout || 0, reputation);

        const canAccessByClientType = mission.clientType
          ? canAccessClientType(mission.clientType, reputation)
          : true;
        const canAccessByMinRep = mission.minReputation ? reputation >= mission.minReputation : true;
        const canAccess = canAccessByClientType && canAccessByMinRep;

        const expiration = mission.expiresAt ? formatExpiration(mission.expiresAt, currentTime) : null;
        const isExpired = expiration?.expired;

        const isChainMission = mission.chainId && mission.totalParts > 1;
        const isArcMission = mission.arcId && mission.arcTotal > 1;
        const hasHostileNetwork = mission.networks?.some(n => n.hostile);

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
                {hasHostileNetwork && (
                  <span className="hostile-badge">HOSTILE</span>
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
              {(mission.timeLimit || mission.timeLimitMinutes) && (
                <div className="mission-time-limit">
                  ⏰ Time Limit: {mission.timeLimitMinutes || mission.timeLimit} minutes once accepted
                </div>
              )}
              {isArcMission && mission.arcStoryline && (
                <div className="mission-arc-storyline">
                  📜 {mission.arcStoryline.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              )}
            </div>

            {canAccess && mission.description && (
              <div className="mission-description">{mission.description}</div>
            )}

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
              onClick={() => onAccept(mission)}
              disabled={!validation.canAccept || !canAccess || isExpired}
            >
              {isExpired ? 'Expired' : !canAccess ? 'Locked' : !validation.canAccept ? validation.reason : 'Accept Mission'}
            </button>

            {mission.isProcedurallyGenerated && (
              <button
                className="dismiss-mission-btn"
                onClick={() => onDismiss(mission)}
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

export default MissionBoardAvailableTab;

/**
 * Mission System - Mission lifecycle management
 *
 * Handles:
 * - Mission acceptance (validate requirements, set as active)
 * - Objective tracking (progress, completion)
 * - Automatic completion (few moments after all objectives complete)
 * - Mission cooldowns (Easy: 0min, Medium: 10-15min, Hard: 30-45min)
 * - Reputation gating (client types, payout multipliers)
 */

/**
 * Check if player can accept mission
 * @param {object} mission - Mission object
 * @param {array} installedSoftware - Player's installed software IDs
 * @param {number} reputation - Player reputation tier
 * @param {object} activeMission - Current active mission (null if none)
 * @returns {object} {canAccept: boolean, reason: string}
 */
export const canAcceptMission = (mission, installedSoftware, reputation, activeMission) => {
  // Can only have one active mission at a time
  if (activeMission) {
    return { canAccept: false, reason: 'You already have an active mission' };
  }

  // Check software requirements
  if (mission.requirements && mission.requirements.software) {
    const missingSoftware = mission.requirements.software.filter(
      (reqSoftware) => !installedSoftware.includes(reqSoftware)
    );

    if (missingSoftware.length > 0) {
      return {
        canAccept: false,
        reason: `Missing required software: ${missingSoftware.join(', ')}`,
      };
    }
  }

  // Check reputation requirements (client type gating)
  if (mission.minReputation && reputation < mission.minReputation) {
    return {
      canAccept: false,
      reason: `Requires reputation tier ${mission.minReputation} or higher`,
    };
  }

  return { canAccept: true, reason: null };
};

/**
 * Initialize objectives for a mission
 * @param {array} objectiveDefs - Objective definitions from mission
 * @returns {array} Objective objects with status
 */
export const initializeMissionObjectives = (objectiveDefs) => {
  return objectiveDefs.map((obj) => ({
    ...obj,
    status: 'pending', // 'pending', 'in-progress', 'complete', 'failed'
  }));
};

/**
 * Check if all objectives are complete
 * @param {array} objectives - Mission objectives
 * @returns {boolean} All objectives complete
 */
export const areAllObjectivesComplete = (objectives) => {
  return objectives.every((obj) => obj.status === 'complete');
};

/**
 * Check if any objective failed
 * @param {array} objectives - Mission objectives
 * @returns {boolean} Any objective failed
 */
export const hasFailedObjective = (objectives) => {
  return objectives.some((obj) => obj.status === 'failed');
};

/**
 * Update objective status
 * @param {array} objectives - Current objectives
 * @param {string} objectiveId - Objective to update
 * @param {string} status - New status
 * @returns {array} Updated objectives
 */
export const updateObjectiveStatus = (objectives, objectiveId, status) => {
  return objectives.map((obj) =>
    obj.id === objectiveId ? { ...obj, status } : obj
  );
};

/**
 * Calculate mission cooldown end time
 * @param {string} difficulty - Mission difficulty (Easy, Medium, Hard)
 * @param {Date} currentTime - Current in-game time
 * @returns {string|null} ISO timestamp when cooldown ends, or null if no cooldown
 */
export const calculateCooldownEndTime = (difficulty, currentTime) => {
  const cooldownMinutes = {
    Easy: 0, // No cooldown
    Medium: 12, // 10-15 minutes (using middle value)
    Hard: 37, // 30-45 minutes (using middle value)
  };

  const minutes = cooldownMinutes[difficulty] || 0;

  if (minutes === 0) return null;

  const endTime = new Date(currentTime);
  endTime.setMinutes(endTime.getMinutes() + minutes);

  return endTime.toISOString();
};

/**
 * Check if cooldown has expired
 * @param {string} cooldownEndTime - ISO timestamp when cooldown ends
 * @param {Date} currentTime - Current in-game time
 * @returns {boolean} Cooldown expired (can accept new mission)
 */
export const isCooldownExpired = (cooldownEndTime, currentTime) => {
  if (!cooldownEndTime) return true; // No cooldown

  const endTime = new Date(cooldownEndTime);
  const now = new Date(currentTime);

  return now >= endTime;
};

/**
 * Calculate mission payout with reputation multiplier
 * @param {number} basePayout - Base mission payout
 * @param {number} reputation - Player reputation tier
 * @returns {number} Final payout
 */
export const calculateMissionPayout = (basePayout, reputation) => {
  const multipliers = {
    1: 0.5,
    2: 0.7,
    3: 0.85,
    4: 1.0,
    5: 1.0,
    6: 1.1,
    7: 1.2,
    8: 1.3,
    9: 1.5,
    10: 1.7,
    11: 2.0,
  };

  const multiplier = multipliers[reputation] || 1.0;
  return Math.floor(basePayout * multiplier);
};

/**
 * Calculate mission duration in minutes
 * @param {string} startTime - ISO timestamp when mission started
 * @param {string} endTime - ISO timestamp when mission completed
 * @returns {number} Duration in minutes
 */
export const calculateMissionDuration = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  return Math.floor(durationMs / 1000 / 60); // minutes
};

/**
 * Create completed mission record
 * @param {object} mission - Mission object
 * @param {string} status - 'success' or 'failed'
 * @param {number} payout - Credits awarded/deducted
 * @param {number} reputationChange - Reputation change
 * @param {Date} completionTime - When mission completed
 * @param {number} duration - Mission duration in minutes
 * @returns {object} Completed mission record
 */
export const createCompletedMission = (
  mission,
  status,
  payout,
  reputationChange,
  completionTime,
  duration
) => {
  return {
    id: mission.id,
    title: mission.title,
    client: mission.client,
    difficulty: mission.difficulty,
    status, // 'success' or 'failed'
    completionTime: completionTime.toISOString(),
    duration, // minutes
    payout,
    reputationChange,
    basePayout: mission.basePayout,
  };
};

/**
 * Reputation System - Track player performance and unlock missions
 *
 * 11-tier reputation system that affects:
 * - Mission availability (client types)
 * - Mission payouts (multipliers)
 * - Game over condition (Tier 1 = 10 min to complete mission or fired)
 *
 * Tiers:
 * 1. Should be let go (0.5x payout, 10-min termination countdown)
 * 2. On performance plan (0.7x payout, warning message)
 * 3. Accident prone (0.85x payout)
 * 4. Can work with help (1.0x payout)
 * 5. OK (1.0x payout)
 * 6. Semi-competent (1.1x payout)
 * 7. Reliable (1.2x payout)
 * 8. High achiever (1.3x payout)
 * 9. Superb (1.5x payout) - STARTING REPUTATION
 * 10. Ace agent (1.7x payout)
 * 11. Star employee (2.0x payout)
 */

export const REPUTATION_TIERS = {
  1: {
    name: 'Should be let go',
    color: '#8B0000', // Dark red
    description: 'FINAL WARNING - 10 mins to complete mission or FIRED',
    payoutMultiplier: 0.5,
    clientTypes: ['library', 'museum'], // Only non-critical clients
  },
  2: {
    name: 'On performance plan',
    color: '#DC143C', // Red
    description: 'WARNING - One more failure = Tier 1',
    payoutMultiplier: 0.7,
    clientTypes: ['small-business', 'non-profit'],
  },
  3: {
    name: 'Accident prone',
    color: '#FF6347', // Red/Orange
    description: 'Recent failures, needs practice',
    payoutMultiplier: 0.85,
    clientTypes: ['small-business', 'medium-business'],
  },
  4: {
    name: 'Can work with help',
    color: '#FFA500', // Orange
    description: 'Developing skills, improving',
    payoutMultiplier: 1.0,
    clientTypes: ['medium-business', 'retail'],
  },
  5: {
    name: 'OK',
    color: '#FFD700', // Yellow/Gold
    description: 'Meets minimum expectations',
    payoutMultiplier: 1.0,
    clientTypes: ['medium-business'],
  },
  6: {
    name: 'Semi-competent',
    color: '#9ACD32', // Light green
    description: 'Reliable for routine tasks',
    payoutMultiplier: 1.1,
    clientTypes: ['medium-business', 'large-business'],
  },
  7: {
    name: 'Reliable',
    color: '#32CD32', // Green
    description: 'Consistently good performance',
    payoutMultiplier: 1.2,
    clientTypes: ['large-business', 'corporation'],
  },
  8: {
    name: 'High achiever',
    color: '#00FA9A', // Bright green
    description: 'Exceeds expectations regularly',
    payoutMultiplier: 1.3,
    clientTypes: ['corporation', 'financial'],
  },
  9: {
    name: 'Superb',
    color: '#20B2AA', // Blue-green
    description: 'Excellent track record',
    payoutMultiplier: 1.5,
    clientTypes: ['corporation', 'bank', 'government'],
  },
  10: {
    name: 'Ace agent',
    color: '#4169E1', // Blue
    description: 'Elite performer',
    payoutMultiplier: 1.7,
    clientTypes: ['all', 'special-contract'],
  },
  11: {
    name: 'Star employee',
    color: '#FFD700', // Gold
    description: 'Top tier SourceNet agent',
    payoutMultiplier: 2.0,
    clientTypes: ['all', 'elite-contract'],
  },
};

/**
 * Get reputation tier information
 * @param {number} tier - Reputation tier (1-11)
 * @returns {object} Tier information
 */
export const getReputationTier = (tier) => {
  if (tier < 1 || tier > 11) {
    throw new Error(`Invalid reputation tier: ${tier}`);
  }
  return REPUTATION_TIERS[tier];
};

/**
 * Calculate payout with reputation multiplier
 * @param {number} basePayout - Base mission payout
 * @param {number} reputation - Current reputation tier
 * @returns {number} Final payout after reputation multiplier
 */
export const calculatePayoutWithReputation = (basePayout, reputation) => {
  const tier = getReputationTier(reputation);
  return Math.floor(basePayout * tier.payoutMultiplier);
};

/**
 * Check if player can access mission based on reputation
 * @param {string} clientType - Mission client type
 * @param {number} reputation - Player reputation tier
 * @returns {boolean} Can access mission
 */
export const canAccessMission = (clientType, reputation) => {
  const tier = getReputationTier(reputation);
  return tier.clientTypes.includes('all') || tier.clientTypes.includes(clientType);
};

/**
 * Calculate reputation change after mission
 * @param {boolean} success - Mission succeeded
 * @param {number} currentTier - Current reputation tier
 * @returns {number} New reputation tier
 */
export const calculateReputationChange = (success, currentTier) => {
  if (success) {
    // Success: +1 tier (max 11)
    return Math.min(currentTier + 1, 11);
  } else {
    // Failure: -1 to -3 tiers depending on severity (min 1)
    // For now, simple: -1 tier for normal failure
    // Could be enhanced later for different failure types
    return Math.max(currentTier - 1, 1);
  }
};

/**
 * Check if reputation change should trigger warning
 * @param {number} oldTier - Previous reputation
 * @param {number} newTier - New reputation
 * @returns {string|null} Warning type or null
 */
export const getReputationWarning = (oldTier, newTier) => {
  // Dropping to Tier 2 (On performance plan)
  if (newTier === 2 && oldTier > 2) {
    return 'performance-plan';
  }

  // Dropping to Tier 1 (Should be let go)
  if (newTier === 1) {
    return 'final-termination';
  }

  // Recovering from Tier 1
  if (newTier > 1 && oldTier === 1) {
    return 'performance-improved';
  }

  return null;
};

/**
 * Start reputation termination countdown (10 minutes)
 * @param {Date} currentTime - Current in-game time
 * @returns {object} Countdown object
 */
export const startReputationCountdown = (currentTime) => {
  const startTime = new Date(currentTime);
  const endTime = new Date(currentTime);
  endTime.setMinutes(endTime.getMinutes() + 10); // 10 minutes

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    remaining: 10 * 60, // seconds
  };
};

/**
 * Update reputation countdown based on current time
 * @param {object} countdown - Countdown object
 * @param {Date} currentTime - Current in-game time
 * @returns {object|null} Updated countdown or null if expired
 */
export const updateReputationCountdown = (countdown, currentTime) => {
  if (!countdown) return null;

  const endTime = new Date(countdown.endTime);
  const now = new Date(currentTime);
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000)); // seconds

  if (remaining <= 0) {
    return null; // Countdown expired - termination should trigger
  }

  return {
    ...countdown,
    remaining,
  };
};

/**
 * Configuration for procedural mission generation.
 * All tunable values are centralized here for easy adjustment.
 * This object is extensible - add new configuration sections as needed.
 */

export const generationConfig = {
    // Mission pool settings
    pool: {
        min: 4,                    // Minimum missions in pool
        max: 6,                    // Maximum missions in pool
        minAccessible: 2,          // Minimum missions player can accept at current rep
        refreshOnTimeAdvance: true // Whether to check pool on game time advance
    },

    // Mission expiration settings (in game hours)
    expiration: {
        easy: 8,
        medium: 6,
        hard: 4,
        // Variance range (±hours) for randomization
        variance: 1
    },

    // Time limit settings (in game minutes) - time to complete once accepted
    timeLimit: {
        easy: { min: 45, max: 60 },
        medium: { min: 30, max: 45 },
        hard: { min: 20, max: 30 },
        // Chance that a mission has a time limit (0-1)
        chance: 0.3
    },

    // Mission extension settings
    extension: {
        // Base chance for extension offer (0-1), varies by mission type
        chance: {
            default: 0.25,
            'file-backup': 0.2,
            'file-repair': 0.25,
            'file-restoration': 0.3,
            'combined-tasks': 0.35,
            'data-extraction': 0.2
        },
        // Payout multiplier range for extensions
        payoutMultiplier: {
            min: 1.3,
            max: 1.5
        },
        // When extension is offered (percentage of objectives complete)
        triggerThreshold: 0.5
    },

    // Multi-part mission chain settings
    chain: {
        minLength: 2,
        maxLength: 4,
        // Chance that a generated mission is part of a chain (0-1)
        chance: 0.15,
        // Payout escalation per part (multiplier)
        escalation: 1.25
    },

    // Base payout calculation
    payout: {
        // Base amounts by difficulty
        base: {
            easy: 800,
            medium: 1500,
            hard: 2500
        },
        // Multipliers by client tier (stacks with reputation multiplier)
        tierMultiplier: {
            // Banking
            'bank-local': 1.0,
            'bank-regional': 1.3,
            'bank-national': 1.8,
            // Government
            'gov-library': 0.8,
            'gov-municipal': 1.1,
            'gov-state': 1.4,
            'gov-federal': 2.0,
            // Healthcare
            'health-clinic': 1.0,
            'health-hospital': 1.3,
            'health-research': 1.7,
            // Corporate
            'corp-small': 1.0,
            'corp-medium': 1.3,
            'corp-enterprise': 1.8,
            // Utilities
            'util-local': 1.1,
            'util-regional': 1.5,
            // Shipping
            'ship-courier': 1.0,
            'ship-logistics': 1.3,
            'ship-global': 1.7,
            // Emergency
            'emerg-volunteer': 0.9,
            'emerg-municipal': 1.3,
            'emerg-federal': 2.0,
            // Non-profit
            'nonprofit-community': 0.7,
            'nonprofit-foundation': 1.2,
            // Cultural
            'cultural-local': 0.8,
            'cultural-major': 1.4
        },
        // Random variance range (±percentage)
        variance: 0.1
    },

    // Difficulty distribution weights (for random selection)
    difficultyWeights: {
        easy: 0.4,
        medium: 0.4,
        hard: 0.2
    },

    // Mission type weights (for random selection)
    missionTypeWeights: {
        'file-backup': 0.25,
        'file-repair': 0.25,
        'file-restoration': 0.25,
        'combined-tasks': 0.15,
        'data-extraction': 0.10
    },

    // Software requirements by difficulty
    softwareRequirements: {
        easy: {
            required: [],
            optional: ['network-scanner']
        },
        medium: {
            required: ['network-scanner'],
            optional: ['vpn-client', 'file-manager']
        },
        hard: {
            required: ['network-scanner', 'vpn-client'],
            optional: ['file-manager', 'encryption-kit']
        }
    },

    // Reputation consequences
    consequences: {
        success: {
            easy: 1,
            medium: 1,
            hard: 2
        },
        failure: {
            easy: -1,
            medium: -2,
            hard: -3
        }
    },

    // Credit penalties on failure (percentage of payout)
    failurePenalty: {
        easy: 0.25,
        medium: 0.5,
        hard: 0.75
    }
};

/**
 * Helper to get a config value with fallback
 * @param {string} path - Dot-notation path to config value (e.g., 'pool.min')
 * @param {*} defaultValue - Fallback if path doesn't exist
 * @returns {*} The config value or default
 */
export function getConfig(path, defaultValue = undefined) {
    const parts = path.split('.');
    let value = generationConfig;

    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return defaultValue;
        }
    }

    return value;
}

/**
 * Helper to get extension chance for a mission type
 * @param {string} missionType - The mission type
 * @returns {number} Extension chance (0-1)
 */
export function getExtensionChance(missionType) {
    return generationConfig.extension.chance[missionType]
        || generationConfig.extension.chance.default;
}

/**
 * Helper to get tier payout multiplier
 * @param {string} clientType - The client type
 * @returns {number} Payout multiplier
 */
export function getTierPayoutMultiplier(clientType) {
    return generationConfig.payout.tierMultiplier[clientType] || 1.0;
}

/**
 * Helper to calculate base payout for a mission
 * @param {string} difficulty - easy, medium, or hard
 * @param {string} clientType - The client type for tier multiplier
 * @returns {number} Calculated base payout
 */
export function calculateBasePayout(difficulty, clientType) {
    const base = generationConfig.payout.base[difficulty] || generationConfig.payout.base.medium;
    const tierMultiplier = getTierPayoutMultiplier(clientType);
    const variance = generationConfig.payout.variance;

    // Apply tier multiplier and random variance
    const varianceFactor = 1 + (Math.random() * variance * 2 - variance);
    return Math.round(base * tierMultiplier * varianceFactor);
}

/**
 * Helper to get expiration time for a mission
 * @param {string} difficulty - easy, medium, or hard
 * @returns {number} Expiration time in game hours
 */
export function getExpirationHours(difficulty) {
    const base = generationConfig.expiration[difficulty] || generationConfig.expiration.medium;
    const variance = generationConfig.expiration.variance;

    // Apply random variance
    const varianceFactor = (Math.random() * variance * 2 - variance);
    return Math.max(1, base + varianceFactor);
}

/**
 * Helper to get time limit for a mission (if applicable)
 * @param {string} difficulty - easy, medium, or hard
 * @returns {number|null} Time limit in game minutes, or null if no limit
 */
export function getTimeLimit(difficulty) {
    // Check if this mission should have a time limit
    if (Math.random() > generationConfig.timeLimit.chance) {
        return null;
    }

    const range = generationConfig.timeLimit[difficulty] || generationConfig.timeLimit.medium;
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

export default generationConfig;

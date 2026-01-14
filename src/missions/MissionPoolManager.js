/**
 * Mission Pool Manager - Manages the pool of available procedural missions.
 * 
 * Responsibilities:
 * - Maintain pool of 4-6 available missions
 * - Ensure minimum accessible missions at player's reputation
 * - Handle mission expiration and refresh
 * - Manage multi-part chain mission progression
 * - Track which clients have active/pending missions
 */

import { getAccessibleClients, getRandomAccessibleClient, getAllClients } from '../data/clientRegistry';
import { generateMission, generateChainMission } from './MissionGenerator';
import { generationConfig } from './config/generationConfig';
import { canAccessClientType } from '../systems/ReputationSystem';

/**
 * Initialize a new mission pool
 * @param {number} reputation - Player's current reputation tier
 * @param {Date} currentTime - Current game time
 * @returns {Object} Initial pool state
 */
export function initializePool(reputation, currentTime) {
    const pool = [];
    const pendingChains = {};
    const activeClientIds = new Set();

    const targetSize = Math.floor(
        generationConfig.pool.min +
        Math.random() * (generationConfig.pool.max - generationConfig.pool.min + 1)
    );

    // Generate initial missions
    while (pool.length < targetSize) {
        const result = generatePoolMission(reputation, currentTime, activeClientIds, pool.length < generationConfig.pool.minAccessible);

        if (result) {
            if (result.chainId) {
                // Chain mission - add first part to pool, store rest in pending
                pool.push(result.parts[0]);
                activeClientIds.add(result.clientId);
                pendingChains[result.chainId] = {
                    ...result,
                    revealedParts: 1
                };
            } else {
                // Single mission
                pool.push(result);
                activeClientIds.add(result.clientId);
            }
        } else {
            // Couldn't generate mission - break to avoid infinite loop
            break;
        }
    }

    return {
        missions: pool,
        pendingChains,
        activeClientIds: Array.from(activeClientIds),
        lastRefresh: currentTime.toISOString()
    };
}

/**
 * Generate a single mission for the pool
 * @param {number} reputation - Player reputation
 * @param {Date} currentTime - Current game time
 * @param {Set} excludeClientIds - Client IDs to exclude
 * @param {boolean} mustBeAccessible - Whether mission must be accessible at current rep
 * @returns {Object|null} Generated mission or chain
 */
function generatePoolMission(reputation, currentTime, excludeClientIds, mustBeAccessible) {
    // Get available clients
    let client;

    if (mustBeAccessible) {
        // Must pick from accessible clients only
        client = getRandomAccessibleClient(reputation, Array.from(excludeClientIds));
    } else {
        // Can pick from any client, including locked ones
        // But prefer accessible ones (70% chance)
        if (Math.random() < 0.7) {
            client = getRandomAccessibleClient(reputation, Array.from(excludeClientIds));
        }

        // If no accessible client or rolled for locked, try locked clients
        if (!client) {
            const accessibleClients = getAccessibleClients(reputation);
            const accessibleIds = new Set(accessibleClients.map(c => c.id));

            // Get all clients and filter to locked ones
            const allClients = getAllClients();
            const lockedClients = allClients.filter(c =>
                !accessibleIds.has(c.id) && !excludeClientIds.has(c.id)
            );

            if (lockedClients.length > 0) {
                client = lockedClients[Math.floor(Math.random() * lockedClients.length)];
            }
        }
    }

    if (!client) {
        return null;
    }

    // Decide if this should be a chain mission
    if (Math.random() < generationConfig.chain.chance) {
        return generateChainMission(client.id, null, currentTime);
    }

    return generateMission(client.id, null, currentTime);
}

/**
 * Refresh the mission pool - remove expired, add new missions
 * @param {Object} poolState - Current pool state
 * @param {number} reputation - Player reputation
 * @param {Date} currentTime - Current game time
 * @param {string|null} activeMissionId - Currently active mission ID (exclude from removal)
 * @returns {Object} Updated pool state
 */
export function refreshPool(poolState, reputation, currentTime, activeMissionId = null) {
    const { missions, pendingChains, activeClientIds } = poolState;
    const currentTimeMs = currentTime.getTime();
    const activeClients = new Set(activeClientIds);

    // Remove expired missions (but not the active one)
    const validMissions = missions.filter(mission => {
        if (mission.missionId === activeMissionId) {
            return true; // Keep active mission
        }

        if (mission.expiresAt) {
            const expiresAtMs = new Date(mission.expiresAt).getTime();
            if (currentTimeMs > expiresAtMs) {
                // Mission expired - remove client from active set
                activeClients.delete(mission.clientId);

                // If part of a chain, remove the whole chain
                if (mission.chainId && pendingChains[mission.chainId]) {
                    delete pendingChains[mission.chainId];
                }

                return false;
            }
        }
        return true;
    });

    // Count accessible missions
    const accessibleCount = validMissions.filter(m =>
        canAccessClientType(m.clientType, reputation)
    ).length;

    // Determine how many missions to add
    const currentSize = validMissions.length;
    const targetSize = Math.floor(
        generationConfig.pool.min +
        Math.random() * (generationConfig.pool.max - generationConfig.pool.min + 1)
    );
    const needAccessible = Math.max(0, generationConfig.pool.minAccessible - accessibleCount);
    const missionsToAdd = Math.max(needAccessible, targetSize - currentSize);

    // Generate new missions
    const newMissions = [...validMissions];
    const newPendingChains = { ...pendingChains };
    let accessibleAdded = 0;

    for (let i = 0; i < missionsToAdd; i++) {
        const mustBeAccessible = accessibleAdded < needAccessible;
        const result = generatePoolMission(reputation, currentTime, activeClients, mustBeAccessible);

        if (result) {
            if (result.chainId) {
                newMissions.push(result.parts[0]);
                activeClients.add(result.clientId);
                newPendingChains[result.chainId] = {
                    ...result,
                    revealedParts: 1
                };
            } else {
                newMissions.push(result);
                activeClients.add(result.clientId);
            }

            if (mustBeAccessible) {
                accessibleAdded++;
            }
        }
    }

    return {
        missions: newMissions,
        pendingChains: newPendingChains,
        activeClientIds: Array.from(activeClients),
        lastRefresh: currentTime.toISOString()
    };
}

/**
 * Handle chain mission progression when a part is completed
 * @param {Object} poolState - Current pool state
 * @param {string} completedMissionId - ID of completed mission
 * @param {Date} currentTime - Current game time
 * @returns {Object} Updated pool state with next chain part revealed (if applicable)
 */
export function handleChainProgression(poolState, completedMissionId, currentTime) {
    const { missions, pendingChains, activeClientIds } = poolState;

    // Find the completed mission
    const completedMission = missions.find(m => m.missionId === completedMissionId);
    if (!completedMission || !completedMission.chainId) {
        // Not a chain mission - just remove from pool
        return {
            ...poolState,
            missions: missions.filter(m => m.missionId !== completedMissionId),
            nextChainPart: null,
            transitionMessage: null
        };
    }

    const chain = pendingChains[completedMission.chainId];
    if (!chain) {
        // Chain data not found - just remove mission
        return {
            ...poolState,
            missions: missions.filter(m => m.missionId !== completedMissionId),
            nextChainPart: null,
            transitionMessage: null
        };
    }

    // Check if there are more parts
    const nextPartIndex = chain.revealedParts;
    if (nextPartIndex >= chain.totalParts) {
        // Chain complete - clean up
        const newPendingChains = { ...pendingChains };
        delete newPendingChains[completedMission.chainId];

        const newActiveClients = activeClientIds.filter(id => id !== chain.clientId);

        return {
            missions: missions.filter(m => m.missionId !== completedMissionId),
            pendingChains: newPendingChains,
            activeClientIds: newActiveClients,
            lastRefresh: poolState.lastRefresh,
            nextChainPart: null,
            transitionMessage: null,
            chainCompleted: chain.chainName
        };
    }

    // Reveal next part
    const nextPart = chain.parts[nextPartIndex];

    // Set expiration for new part
    const expirationHours = 4 + Math.random() * 2; // 4-6 hours for chain continuations
    const expiresAt = new Date(currentTime);
    expiresAt.setHours(expiresAt.getHours() + expirationHours);
    nextPart.expiresAt = expiresAt.toISOString();

    // Update chain state
    const newPendingChains = {
        ...pendingChains,
        [completedMission.chainId]: {
            ...chain,
            revealedParts: nextPartIndex + 1
        }
    };

    // Replace completed mission with next part
    const newMissions = missions.map(m =>
        m.missionId === completedMissionId ? nextPart : m
    );

    return {
        missions: newMissions,
        pendingChains: newPendingChains,
        activeClientIds,
        lastRefresh: poolState.lastRefresh,
        nextChainPart: nextPart,
        transitionMessage: completedMission.transitionMessage
    };
}

/**
 * Handle chain mission failure - remove all pending parts
 * @param {Object} poolState - Current pool state
 * @param {string} failedMissionId - ID of failed mission
 * @returns {Object} Updated pool state with chain removed
 */
export function handleChainFailure(poolState, failedMissionId) {
    const { missions, pendingChains, activeClientIds } = poolState;

    // Find the failed mission
    const failedMission = missions.find(m => m.missionId === failedMissionId);
    if (!failedMission) {
        return poolState;
    }

    // Remove from missions
    let newMissions = missions.filter(m => m.missionId !== failedMissionId);
    let newActiveClients = [...activeClientIds];
    let newPendingChains = { ...pendingChains };

    // If part of a chain, remove entire chain
    if (failedMission.chainId && pendingChains[failedMission.chainId]) {
        const chain = pendingChains[failedMission.chainId];

        // Remove client from active list
        newActiveClients = activeClientIds.filter(id => id !== chain.clientId);

        // Remove chain from pending
        delete newPendingChains[failedMission.chainId];
    } else {
        // Single mission - just remove client
        newActiveClients = activeClientIds.filter(id => id !== failedMission.clientId);
    }

    return {
        missions: newMissions,
        pendingChains: newPendingChains,
        activeClientIds: newActiveClients,
        lastRefresh: poolState.lastRefresh
    };
}

/**
 * Remove a mission from the pool (e.g., when accepted)
 * @param {Object} poolState - Current pool state
 * @param {string} missionId - Mission ID to remove
 * @returns {Object} Updated pool state
 */
export function removeMissionFromPool(poolState, missionId) {
    const { missions, pendingChains, activeClientIds } = poolState;

    const mission = missions.find(m => m.missionId === missionId);
    if (!mission) {
        return poolState;
    }

    return {
        ...poolState,
        missions: missions.filter(m => m.missionId !== missionId),
        // Keep client in activeClientIds if it's a chain (more parts coming)
        // Otherwise remove it
        activeClientIds: mission.chainId && pendingChains[mission.chainId]
            ? activeClientIds
            : activeClientIds.filter(id => id !== mission.clientId)
    };
}

/**
 * Get pool statistics for debugging
 * @param {Object} poolState - Current pool state
 * @param {number} reputation - Player reputation
 * @returns {Object} Pool statistics
 */
export function getPoolStats(poolState, reputation) {
    const { missions, pendingChains, activeClientIds } = poolState;

    const accessibleMissions = missions.filter(m =>
        canAccessClientType(m.clientType, reputation)
    );

    const lockedMissions = missions.filter(m =>
        !canAccessClientType(m.clientType, reputation)
    );

    const chainMissions = missions.filter(m => m.chainId);
    const singleMissions = missions.filter(m => !m.chainId);

    const byDifficulty = {
        easy: missions.filter(m => m.difficulty === 'Easy').length,
        medium: missions.filter(m => m.difficulty === 'Medium').length,
        hard: missions.filter(m => m.difficulty === 'Hard').length
    };

    const byMissionType = {};
    missions.forEach(m => {
        byMissionType[m.missionType] = (byMissionType[m.missionType] || 0) + 1;
    });

    return {
        totalMissions: missions.length,
        accessibleCount: accessibleMissions.length,
        lockedCount: lockedMissions.length,
        chainCount: chainMissions.length,
        singleCount: singleMissions.length,
        pendingChainCount: Object.keys(pendingChains).length,
        activeClientCount: activeClientIds.length,
        byDifficulty,
        byMissionType
    };
}

/**
 * Check if pool needs refresh based on configuration
 * @param {Object} poolState - Current pool state
 * @param {number} reputation - Player reputation
 * @returns {boolean} Whether pool should be refreshed
 */
export function shouldRefreshPool(poolState, reputation) {
    const { missions } = poolState;

    // Refresh if below minimum size
    if (missions.length < generationConfig.pool.min) {
        return true;
    }

    // Refresh if not enough accessible missions
    const accessibleCount = missions.filter(m =>
        canAccessClientType(m.clientType, reputation)
    ).length;

    if (accessibleCount < generationConfig.pool.minAccessible) {
        return true;
    }

    return false;
}

export default {
    initializePool,
    refreshPool,
    handleChainProgression,
    handleChainFailure,
    removeMissionFromPool,
    getPoolStats,
    shouldRefreshPool
};

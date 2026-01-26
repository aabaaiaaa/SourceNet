/**
 * Mission Pool Manager - Manages the pool of available procedural missions.
 * 
 * Responsibilities:
 * - Maintain pool of 4-6 available missions
 * - Ensure minimum accessible missions at player's reputation
 * - Handle mission expiration and refresh
 * - Manage multi-mission arc progression
 * - Track which clients have active/pending missions
 * - Handle arc mission visibility (only show next mission after previous completes)
 */

import { getAccessibleClients, getRandomAccessibleClient, getAllClients, getClientsByIndustry } from '../data/clientRegistry';
import { generateMission, generateMissionArc } from './MissionGenerator';
import { getRandomStoryline } from './arcStorylines';
import { canAccessClientType } from '../systems/ReputationSystem';

// Configuration for mission pool
export const poolConfig = {
    min: 4,
    max: 6,
    minAccessible: 2,
    arcChance: 0.2, // 20% chance to generate an arc instead of single mission
    expirationMinutes: { min: 15, max: 60 }, // Missions expire in 15-60 game minutes
    regenerationDelayMs: 60 * 1000, // 1 minute game time delay before regenerating expired mission
};

/**
 * Calculate expiration time for a mission
 * @param {Date} currentTime - Current game time
 * @returns {string} ISO date string for expiration
 */
function calculateExpirationTime(currentTime) {
    const { min, max } = poolConfig.expirationMinutes;
    const expirationMinutes = min + Math.floor(Math.random() * (max - min + 1));
    const expiresAt = new Date(currentTime.getTime() + expirationMinutes * 60 * 1000);
    return expiresAt.toISOString();
}

/**
 * Add expiration time to a mission
 * @param {Object} mission - Mission object
 * @param {Date} currentTime - Current game time
 * @returns {Object} Mission with expiresAt set
 */
export function addExpirationToMission(mission, currentTime) {
    return {
        ...mission,
        expiresAt: calculateExpirationTime(currentTime)
    };
}

/**
 * Initialize a new mission pool
 * @param {number} reputation - Player's current reputation tier
 * @param {Date} currentTime - Current game time
 * @returns {Object} Initial pool state
 */
export function initializePool(reputation, currentTime) {
    const pool = [];
    const pendingArcMissions = {}; // arcId -> array of hidden missions
    const activeClientIds = new Set();
    const completedMissions = new Set(); // Track completed mission IDs for arc unlocking

    const targetSize = Math.floor(
        poolConfig.min +
        Math.random() * (poolConfig.max - poolConfig.min + 1)
    );

    // Generate initial missions
    while (pool.length < targetSize) {
        const result = generatePoolMission(reputation, currentTime, activeClientIds, pool.length < poolConfig.minAccessible);

        if (result) {
            if (result.arcId) {
                // Arc - add first mission to pool with expiration, store rest in pending (no expiration yet)
                const firstMission = addExpirationToMission(result.missions[0], currentTime);
                pool.push(firstMission);
                activeClientIds.add(firstMission.clientId);
                pendingArcMissions[result.arcId] = result.missions.slice(1);
            } else {
                // Single mission - add expiration
                const mission = addExpirationToMission(result, currentTime);
                pool.push(mission);
                activeClientIds.add(mission.clientId);
            }
        } else {
            // Couldn't generate mission - break to avoid infinite loop
            break;
        }
    }

    return {
        missions: pool,
        pendingArcMissions,
        completedMissions: Array.from(completedMissions),
        activeClientIds: Array.from(activeClientIds),
        lastRefresh: currentTime.toISOString()
    };
}

/**
 * Generate a single mission or arc for the pool
 * @param {number} reputation - Player reputation
 * @param {Date} currentTime - Current game time
 * @param {Set} excludeClientIds - Client IDs to exclude
 * @param {boolean} mustBeAccessible - Whether mission must be accessible at current rep
 * @returns {Object|null} Generated mission or arc
 */
export function generatePoolMission(reputation, currentTime, excludeClientIds, mustBeAccessible) {
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

    // Decide if this should be an arc
    if (Math.random() < poolConfig.arcChance) {
        const storyline = getRandomStoryline();
        if (storyline) {
            // Get clients for each mission in the arc
            const arcClients = getClientsForArc(storyline, client, excludeClientIds, reputation);
            if (arcClients && arcClients.length === storyline.length) {
                return generateMissionArc(storyline, arcClients);
            }
        }
    }

    return generateMission(client.id, {});
}

/**
 * Get clients for each mission in an arc based on storyline filters
 * @param {Object} storyline - Storyline template
 * @param {Object} initialClient - First client (already selected)
 * @param {Set} excludeClientIds - Clients to exclude
 * @param {number} reputation - Player reputation
 * @returns {Array|null} Array of clients for the arc, or null if can't satisfy
 */
function getClientsForArc(storyline, initialClient, excludeClientIds, reputation) {
    const clients = [initialClient];
    const usedClientIds = new Set([...excludeClientIds, initialClient.id]);

    for (let i = 1; i < storyline.length; i++) {
        const step = storyline.missionSequence[i];

        // If no filter, use same client as previous
        if (!step.clientIndustryFilter) {
            clients.push(clients[i - 1]);
            continue;
        }

        // Find a client matching the industry filter
        let candidateClient = null;
        for (const industry of step.clientIndustryFilter) {
            const industryClients = getClientsByIndustry(industry);
            const validClients = industryClients.filter(c =>
                !usedClientIds.has(c.id) &&
                canAccessClientType(c.clientType, reputation)
            );

            if (validClients.length > 0) {
                candidateClient = validClients[Math.floor(Math.random() * validClients.length)];
                break;
            }
        }

        if (!candidateClient) {
            // Fallback to previous client if no match found
            candidateClient = clients[i - 1];
        }

        clients.push(candidateClient);
        usedClientIds.add(candidateClient.id);
    }

    return clients;
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
    const { missions, pendingArcMissions, activeClientIds, completedMissions } = poolState;
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

                // If part of an arc, remove all pending arc missions
                if (mission.arcId && pendingArcMissions[mission.arcId]) {
                    delete pendingArcMissions[mission.arcId];
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
        poolConfig.min +
        Math.random() * (poolConfig.max - poolConfig.min + 1)
    );
    const needAccessible = Math.max(0, poolConfig.minAccessible - accessibleCount);
    const missionsToAdd = Math.max(needAccessible, targetSize - currentSize);

    // Generate new missions
    const newMissions = [...validMissions];
    const newPendingArcMissions = { ...pendingArcMissions };
    let accessibleAdded = 0;

    for (let i = 0; i < missionsToAdd; i++) {
        const mustBeAccessible = accessibleAdded < needAccessible;
        const result = generatePoolMission(reputation, currentTime, activeClients, mustBeAccessible);

        if (result) {
            if (result.arcId) {
                // Arc - add first mission to pool with expiration, store rest in pending (no expiration yet)
                const firstMission = addExpirationToMission(result.missions[0], currentTime);
                newMissions.push(firstMission);
                activeClients.add(firstMission.clientId);
                newPendingArcMissions[result.arcId] = result.missions.slice(1);
            } else {
                // Single mission - add expiration
                const mission = addExpirationToMission(result, currentTime);
                newMissions.push(mission);
                activeClients.add(mission.clientId);
            }

            if (mustBeAccessible) {
                accessibleAdded++;
            }
        }
    }

    return {
        missions: newMissions,
        pendingArcMissions: newPendingArcMissions,
        completedMissions: completedMissions || [],
        activeClientIds: Array.from(activeClients),
        lastRefresh: currentTime.toISOString()
    };
}

/**
 * Handle arc mission progression when a mission is completed successfully
 * @param {Object} poolState - Current pool state
 * @param {Object} completedMissionData - Data about completed mission { missionId, arcId, arcName, ... }
 * @param {Date} currentTime - Current game time for setting expiration on next mission
 * @returns {Object} Updated pool state with next arc mission revealed (if applicable)
 */
export function handleArcProgression(poolState, completedMissionData, currentTime) {
    const { missions, pendingArcMissions, activeClientIds, completedMissions = [] } = poolState;

    // Extract arc info from the mission data passed directly
    const { missionId, arcId, arcName } = completedMissionData;

    // Add to completed missions list
    const newCompletedMissions = [...completedMissions, missionId];

    // If not part of an arc, just update completed list
    if (!arcId) {
        return {
            ...poolState,
            completedMissions: newCompletedMissions,
            nextArcMission: null
        };
    }

    const pendingMissions = pendingArcMissions[arcId];

    // If no more pending missions for this arc, arc is complete
    if (!pendingMissions || pendingMissions.length === 0) {
        const newPendingArcMissions = { ...pendingArcMissions };
        delete newPendingArcMissions[arcId];

        return {
            ...poolState,
            pendingArcMissions: newPendingArcMissions,
            completedMissions: newCompletedMissions,
            nextArcMission: null,
            arcCompleted: arcName
        };
    }

    // Get next mission in arc and add expiration
    const nextMission = addExpirationToMission(pendingMissions[0], currentTime);
    const remainingPending = pendingMissions.slice(1);

    // Update pending arc missions
    const newPendingArcMissions = { ...pendingArcMissions };
    if (remainingPending.length > 0) {
        newPendingArcMissions[arcId] = remainingPending;
    } else {
        delete newPendingArcMissions[arcId];
    }

    // Add next mission to the pool
    const newMissions = [...missions, nextMission];

    // Add the next mission's client to active clients
    const newActiveClients = new Set(activeClientIds);
    newActiveClients.add(nextMission.clientId);

    return {
        missions: newMissions,
        pendingArcMissions: newPendingArcMissions,
        completedMissions: newCompletedMissions,
        activeClientIds: Array.from(newActiveClients),
        lastRefresh: poolState.lastRefresh,
        nextArcMission: nextMission
    };
}

/**
 * Handle arc mission failure - remove all pending arc missions
 * @param {Object} poolState - Current pool state
 * @param {Object} failedMissionData - Data about failed mission { missionId, arcId, clientId, ... }
 * @returns {Object} Updated pool state with arc missions removed
 */
export function handleArcFailure(poolState, failedMissionData) {
    const { missions, pendingArcMissions, activeClientIds } = poolState;

    const { arcId, clientId } = failedMissionData;

    // If not part of an arc, just return current state
    if (!arcId) {
        return poolState;
    }

    let newActiveClients = [...activeClientIds];
    let newPendingArcMissions = { ...pendingArcMissions };

    // If part of an arc, remove all pending arc missions
    if (pendingArcMissions[arcId]) {
        // Remove all clients from arc from active list
        const arcMissions = pendingArcMissions[arcId];
        const arcClientIds = new Set(arcMissions.map(m => m.clientId));
        newActiveClients = activeClientIds.filter(id => !arcClientIds.has(id));

        // Remove arc from pending
        delete newPendingArcMissions[arcId];

        console.log(`🚫 Arc "${arcId}" cancelled due to mission failure`);
    }

    // Remove failed mission's client from active list
    if (clientId) {
        newActiveClients = newActiveClients.filter(id => id !== clientId);
    }

    return {
        ...poolState,
        missions,
        pendingArcMissions: newPendingArcMissions,
        activeClientIds: newActiveClients,
        arcCancelled: arcId
    };
}

/**
 * Remove a mission from the pool (e.g., when accepted)
 * @param {Object} poolState - Current pool state
 * @param {string} missionId - Mission ID to remove
 * @returns {Object} Updated pool state
 */
export function removeMissionFromPool(poolState, missionId) {
    const { missions, pendingArcMissions, activeClientIds } = poolState;

    const mission = missions.find(m => m.missionId === missionId);
    if (!mission) {
        return poolState;
    }

    return {
        ...poolState,
        missions: missions.filter(m => m.missionId !== missionId),
        // Keep client in activeClientIds if it's an arc (more missions coming)
        // Otherwise remove it
        activeClientIds: mission.arcId && pendingArcMissions[mission.arcId]
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
    const { missions, pendingArcMissions, activeClientIds } = poolState;

    const accessibleMissions = missions.filter(m =>
        canAccessClientType(m.clientType, reputation)
    );

    const lockedMissions = missions.filter(m =>
        !canAccessClientType(m.clientType, reputation)
    );

    const arcMissions = missions.filter(m => m.arcId);
    const singleMissions = missions.filter(m => !m.arcId);

    const timedMissions = missions.filter(m => m.timeLimitMinutes);
    const untimedMissions = missions.filter(m => !m.timeLimitMinutes);

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
        arcCount: arcMissions.length,
        singleCount: singleMissions.length,
        timedCount: timedMissions.length,
        untimedCount: untimedMissions.length,
        pendingArcCount: Object.keys(pendingArcMissions).length,
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
    if (missions.length < poolConfig.min) {
        return true;
    }

    // Refresh if not enough accessible missions
    const accessibleCount = missions.filter(m =>
        canAccessClientType(m.clientType, reputation)
    ).length;

    if (accessibleCount < poolConfig.minAccessible) {
        return true;
    }

    return false;
}

export default {
    initializePool,
    refreshPool,
    handleArcProgression,
    handleArcFailure,
    removeMissionFromPool,
    getPoolStats,
    shouldRefreshPool,
    generatePoolMission,
    addExpirationToMission,
    poolConfig
};

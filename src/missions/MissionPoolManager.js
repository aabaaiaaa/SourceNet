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
const poolConfig = {
    min: 4,
    max: 6,
    minAccessible: 2,
    arcChance: 0.2, // 20% chance to generate an arc instead of single mission
};

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
                // Arc - add first mission to pool, store rest in pending
                pool.push(result.missions[0]);
                activeClientIds.add(result.missions[0].clientId);
                pendingArcMissions[result.arcId] = result.missions.slice(1);
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
                // Arc - add first mission to pool, store rest in pending
                newMissions.push(result.missions[0]);
                activeClients.add(result.missions[0].clientId);
                newPendingArcMissions[result.arcId] = result.missions.slice(1);
            } else {
                // Single mission
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
        pendingArcMissions: newPendingArcMissions,
        completedMissions: completedMissions || [],
        activeClientIds: Array.from(activeClients),
        lastRefresh: currentTime.toISOString()
    };
}

/**
 * Handle arc mission progression when a mission is completed successfully
 * @param {Object} poolState - Current pool state
 * @param {string} completedMissionId - ID of completed mission
 * @param {Date} _currentTime - Current game time (reserved for future use)
 * @returns {Object} Updated pool state with next arc mission revealed (if applicable)
 */
export function handleArcProgression(poolState, completedMissionId, _currentTime) {
    const { missions, pendingArcMissions, activeClientIds, completedMissions = [] } = poolState;

    // Find the completed mission in the current pool or check if it was an active mission
    const completedMission = missions.find(m => m.missionId === completedMissionId);

    // Add to completed missions list
    const newCompletedMissions = [...completedMissions, completedMissionId];

    // If not part of an arc, just update completed list
    if (!completedMission?.arcId) {
        return {
            ...poolState,
            completedMissions: newCompletedMissions,
            nextArcMission: null
        };
    }

    const arcId = completedMission.arcId;
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
            arcCompleted: completedMission.arcName
        };
    }

    // Get next mission in arc
    const nextMission = pendingMissions[0];
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
 * @param {string} failedMissionId - ID of failed mission
 * @returns {Object} Updated pool state with arc missions removed
 */
export function handleArcFailure(poolState, failedMissionId) {
    const { missions, pendingArcMissions, activeClientIds } = poolState;

    // Find the failed mission
    const failedMission = missions.find(m => m.missionId === failedMissionId);
    if (!failedMission) {
        return poolState;
    }

    // Remove from missions
    let newMissions = missions.filter(m => m.missionId !== failedMissionId);
    let newActiveClients = [...activeClientIds];
    let newPendingArcMissions = { ...pendingArcMissions };

    // If part of an arc, remove all pending arc missions
    if (failedMission.arcId && pendingArcMissions[failedMission.arcId]) {
        // Remove all clients from arc from active list
        const arcMissions = pendingArcMissions[failedMission.arcId];
        const arcClientIds = new Set(arcMissions.map(m => m.clientId));
        newActiveClients = activeClientIds.filter(id => !arcClientIds.has(id));

        // Remove arc from pending
        delete newPendingArcMissions[failedMission.arcId];
    }

    // Remove failed mission's client
    newActiveClients = newActiveClients.filter(id => id !== failedMission.clientId);

    return {
        ...poolState,
        missions: newMissions,
        pendingArcMissions: newPendingArcMissions,
        activeClientIds: newActiveClients
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
    shouldRefreshPool
};

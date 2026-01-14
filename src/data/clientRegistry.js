/**
 * Client Registry - Utility functions for accessing the static client database.
 * Provides lookup, filtering, and accessibility checking for clients.
 */

import clientsData from './clients.json';

// Cache the clients array for quick access
const clients = clientsData.clients;
const industries = clientsData.industries;

// Build lookup maps for O(1) access
const clientsById = new Map(clients.map(c => [c.id, c]));
const clientsByIndustry = new Map();
const clientsByClientType = new Map();

// Populate industry and clientType maps
clients.forEach(client => {
    // By industry
    if (!clientsByIndustry.has(client.industry)) {
        clientsByIndustry.set(client.industry, []);
    }
    clientsByIndustry.get(client.industry).push(client);

    // By clientType
    if (!clientsByClientType.has(client.clientType)) {
        clientsByClientType.set(client.clientType, []);
    }
    clientsByClientType.get(client.clientType).push(client);
});

/**
 * Get all clients from the registry
 * @returns {Array} Array of all client objects
 */
export function getAllClients() {
    return [...clients];
}

/**
 * Get a client by their unique ID
 * @param {string} clientId - The client's unique identifier
 * @returns {Object|undefined} The client object or undefined if not found
 */
export function getClientById(clientId) {
    return clientsById.get(clientId);
}

/**
 * Get all clients in a specific industry
 * @param {string} industry - The industry name (e.g., 'banking', 'healthcare')
 * @returns {Array} Array of clients in that industry
 */
export function getClientsByIndustry(industry) {
    return clientsByIndustry.get(industry) || [];
}

/**
 * Get all clients of a specific client type
 * @param {string} clientType - The client type (e.g., 'bank-local', 'gov-federal')
 * @returns {Array} Array of clients of that type
 */
export function getClientsByClientType(clientType) {
    return clientsByClientType.get(clientType) || [];
}

/**
 * Get all clients accessible at a given reputation level
 * @param {number} reputation - The player's current reputation tier
 * @returns {Array} Array of accessible clients
 */
export function getAccessibleClients(reputation) {
    return clients.filter(client => client.minReputation <= reputation);
}

/**
 * Get all clients NOT accessible at a given reputation level (for locked display)
 * @param {number} reputation - The player's current reputation tier
 * @returns {Array} Array of locked clients
 */
export function getLockedClients(reputation) {
    return clients.filter(client => client.minReputation > reputation);
}

/**
 * Check if a specific client is accessible at a given reputation
 * @param {string} clientId - The client's unique identifier
 * @param {number} reputation - The player's current reputation tier
 * @returns {boolean} Whether the client is accessible
 */
export function isClientAccessible(clientId, reputation) {
    const client = clientsById.get(clientId);
    return client ? client.minReputation <= reputation : false;
}

/**
 * Get all unique industries
 * @returns {Array} Array of industry names
 */
export function getIndustries() {
    return Object.keys(industries);
}

/**
 * Get industry metadata
 * @param {string} industry - The industry name
 * @returns {Object|undefined} Industry metadata (displayName, tiers, description)
 */
export function getIndustryInfo(industry) {
    return industries[industry];
}

/**
 * Get all clients grouped by industry
 * @returns {Object} Object with industry names as keys and client arrays as values
 */
export function getClientsGroupedByIndustry() {
    const grouped = {};
    for (const [industry, clientList] of clientsByIndustry) {
        grouped[industry] = [...clientList];
    }
    return grouped;
}

/**
 * Get all unique client types
 * @returns {Array} Array of client type strings
 */
export function getAllClientTypes() {
    return Array.from(clientsByClientType.keys());
}

/**
 * Get clients filtered by multiple criteria
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.industry] - Filter by industry
 * @param {string} [filters.tier] - Filter by tier
 * @param {number} [filters.maxReputation] - Filter by max reputation requirement
 * @param {number} [filters.minReputation] - Filter by min reputation requirement
 * @param {Array<string>} [filters.excludeIds] - Client IDs to exclude
 * @returns {Array} Filtered array of clients
 */
export function getFilteredClients(filters = {}) {
    let result = clients;

    if (filters.industry) {
        result = result.filter(c => c.industry === filters.industry);
    }

    if (filters.tier) {
        result = result.filter(c => c.tier === filters.tier);
    }

    if (filters.maxReputation !== undefined) {
        result = result.filter(c => c.minReputation <= filters.maxReputation);
    }

    if (filters.minReputation !== undefined) {
        result = result.filter(c => c.minReputation >= filters.minReputation);
    }

    if (filters.excludeIds && filters.excludeIds.length > 0) {
        const excludeSet = new Set(filters.excludeIds);
        result = result.filter(c => !excludeSet.has(c.id));
    }

    return result;
}

/**
 * Pick a random client from those accessible at a reputation level
 * @param {number} reputation - The player's current reputation tier
 * @param {Array<string>} [excludeIds] - Client IDs to exclude (e.g., those with active missions)
 * @returns {Object|null} A random accessible client or null if none available
 */
export function getRandomAccessibleClient(reputation, excludeIds = []) {
    const accessible = getFilteredClients({
        maxReputation: reputation,
        excludeIds
    });

    if (accessible.length === 0) {
        return null;
    }

    return accessible[Math.floor(Math.random() * accessible.length)];
}

/**
 * Pick a random client from a specific industry
 * @param {string} industry - The industry to pick from
 * @param {number} reputation - The player's current reputation tier
 * @param {Array<string>} [excludeIds] - Client IDs to exclude
 * @returns {Object|null} A random client or null if none available
 */
export function getRandomClientFromIndustry(industry, reputation, excludeIds = []) {
    const accessible = getFilteredClients({
        industry,
        maxReputation: reputation,
        excludeIds
    });

    if (accessible.length === 0) {
        return null;
    }

    return accessible[Math.floor(Math.random() * accessible.length)];
}

/**
 * Get the total count of clients
 * @returns {number} Total number of clients in registry
 */
export function getClientCount() {
    return clients.length;
}

/**
 * Get statistics about the client registry
 * @returns {Object} Statistics object
 */
export function getRegistryStats() {
    const stats = {
        totalClients: clients.length,
        byIndustry: {},
        byTier: {},
        byMinReputation: {}
    };

    clients.forEach(client => {
        // Count by industry
        stats.byIndustry[client.industry] = (stats.byIndustry[client.industry] || 0) + 1;

        // Count by tier
        stats.byTier[client.tier] = (stats.byTier[client.tier] || 0) + 1;

        // Count by min reputation
        const repKey = `rep-${client.minReputation}`;
        stats.byMinReputation[repKey] = (stats.byMinReputation[repKey] || 0) + 1;
    });

    return stats;
}

export default {
    getAllClients,
    getClientById,
    getClientsByIndustry,
    getClientsByClientType,
    getAccessibleClients,
    getLockedClients,
    isClientAccessible,
    getIndustries,
    getIndustryInfo,
    getClientsGroupedByIndustry,
    getAllClientTypes,
    getFilteredClients,
    getRandomAccessibleClient,
    getRandomClientFromIndustry,
    getClientCount,
    getRegistryStats
};

/**
 * Client Registry - Utility functions for accessing the static client database.
 * Provides lookup, filtering, and accessibility checking for clients.
 */

import clientsData from './clients.json';

// Cache the clients array for quick access
const clients = clientsData.clients;
const industries = clientsData.industries;
const locationTypes = clientsData.locationTypes;
const regions = clientsData.regions;

// Build lookup maps for O(1) access
const clientsById = new Map(clients.map(c => [c.id, c]));
const clientsByIndustry = new Map();
const clientsByClientType = new Map();
const clientsByRegion = new Map();
const clientsByLocationType = new Map();
const clientsByCountry = new Map();

// Populate industry, clientType, and location maps
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

    // By location region
    if (client.location?.region) {
        if (!clientsByRegion.has(client.location.region)) {
            clientsByRegion.set(client.location.region, []);
        }
        clientsByRegion.get(client.location.region).push(client);
    }

    // By location type
    if (client.location?.type) {
        if (!clientsByLocationType.has(client.location.type)) {
            clientsByLocationType.set(client.location.type, []);
        }
        clientsByLocationType.get(client.location.type).push(client);
    }

    // By country
    if (client.location?.country) {
        if (!clientsByCountry.has(client.location.country)) {
            clientsByCountry.set(client.location.country, []);
        }
        clientsByCountry.get(client.location.country).push(client);
    }
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
 * Get all clients in a specific region
 * @param {string} region - The region name (e.g., 'West Coast', 'North Sea')
 * @returns {Array} Array of clients in that region
 */
export function getClientsByRegion(region) {
    return clientsByRegion.get(region) || [];
}

/**
 * Get all clients of a specific location type
 * @param {string} locationType - The location type (e.g., 'office', 'offshore', 'vessel')
 * @returns {Array} Array of clients of that location type
 */
export function getClientsByLocationType(locationType) {
    return clientsByLocationType.get(locationType) || [];
}

/**
 * Get all clients in a specific country
 * @param {string} country - The country name (e.g., 'USA', 'UK')
 * @returns {Array} Array of clients in that country
 */
export function getClientsByCountry(country) {
    return clientsByCountry.get(country) || [];
}

/**
 * Get all unique regions that have clients
 * @returns {Array} Array of region names
 */
export function getAllRegions() {
    return Array.from(clientsByRegion.keys());
}

/**
 * Get all unique location types that have clients
 * @returns {Array} Array of location type strings
 */
export function getAllLocationTypes() {
    return Array.from(clientsByLocationType.keys());
}

/**
 * Get all unique countries that have clients
 * @returns {Array} Array of country names
 */
export function getAllCountries() {
    return Array.from(clientsByCountry.keys());
}

/**
 * Get location type metadata
 * @param {string} locationType - The location type
 * @returns {Object|undefined} Location type metadata (displayName, description)
 */
export function getLocationTypeInfo(locationType) {
    return locationTypes[locationType];
}

/**
 * Get all defined regions (including those without clients yet)
 * @returns {Array} Array of all region names
 */
export function getDefinedRegions() {
    return [...regions];
}

/**
 * Get clients filtered by multiple criteria
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.industry] - Filter by industry
 * @param {string} [filters.tier] - Filter by tier
 * @param {number} [filters.maxReputation] - Filter by max reputation requirement
 * @param {number} [filters.minReputation] - Filter by min reputation requirement
 * @param {Array<string>} [filters.excludeIds] - Client IDs to exclude
 * @param {string} [filters.region] - Filter by location region
 * @param {string} [filters.locationType] - Filter by location type
 * @param {string} [filters.country] - Filter by country
 * @param {Array<string>} [filters.regions] - Filter by multiple regions (OR)
 * @param {Array<string>} [filters.locationTypes] - Filter by multiple location types (OR)
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

    // Single region filter
    if (filters.region) {
        result = result.filter(c => c.location?.region === filters.region);
    }

    // Multiple regions filter (OR)
    if (filters.regions && filters.regions.length > 0) {
        const regionSet = new Set(filters.regions);
        result = result.filter(c => c.location?.region && regionSet.has(c.location.region));
    }

    // Single location type filter
    if (filters.locationType) {
        result = result.filter(c => c.location?.type === filters.locationType);
    }

    // Multiple location types filter (OR)
    if (filters.locationTypes && filters.locationTypes.length > 0) {
        const typeSet = new Set(filters.locationTypes);
        result = result.filter(c => c.location?.type && typeSet.has(c.location.type));
    }

    // Country filter
    if (filters.country) {
        result = result.filter(c => c.location?.country === filters.country);
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
        byMinReputation: {},
        byRegion: {},
        byLocationType: {},
        byCountry: {}
    };

    clients.forEach(client => {
        // Count by industry
        stats.byIndustry[client.industry] = (stats.byIndustry[client.industry] || 0) + 1;

        // Count by tier
        stats.byTier[client.tier] = (stats.byTier[client.tier] || 0) + 1;

        // Count by min reputation
        const repKey = `rep-${client.minReputation}`;
        stats.byMinReputation[repKey] = (stats.byMinReputation[repKey] || 0) + 1;

        // Count by region
        if (client.location?.region) {
            stats.byRegion[client.location.region] = (stats.byRegion[client.location.region] || 0) + 1;
        }

        // Count by location type
        if (client.location?.type) {
            stats.byLocationType[client.location.type] = (stats.byLocationType[client.location.type] || 0) + 1;
        }

        // Count by country
        if (client.location?.country) {
            stats.byCountry[client.location.country] = (stats.byCountry[client.location.country] || 0) + 1;
        }
    });

    return stats;
}

/**
 * Pick a random client from a specific region
 * @param {string} region - The region to pick from
 * @param {number} reputation - The player's current reputation tier
 * @param {Array<string>} [excludeIds] - Client IDs to exclude
 * @returns {Object|null} A random client or null if none available
 */
export function getRandomClientFromRegion(region, reputation, excludeIds = []) {
    const accessible = getFilteredClients({
        region,
        maxReputation: reputation,
        excludeIds
    });

    if (accessible.length === 0) {
        return null;
    }

    return accessible[Math.floor(Math.random() * accessible.length)];
}

/**
 * Pick a random client of a specific location type
 * @param {string} locationType - The location type to pick from
 * @param {number} reputation - The player's current reputation tier
 * @param {Array<string>} [excludeIds] - Client IDs to exclude
 * @returns {Object|null} A random client or null if none available
 */
export function getRandomClientByLocationType(locationType, reputation, excludeIds = []) {
    const accessible = getFilteredClients({
        locationType,
        maxReputation: reputation,
        excludeIds
    });

    if (accessible.length === 0) {
        return null;
    }

    return accessible[Math.floor(Math.random() * accessible.length)];
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
    getClientsByRegion,
    getClientsByLocationType,
    getClientsByCountry,
    getAllRegions,
    getAllLocationTypes,
    getAllCountries,
    getLocationTypeInfo,
    getDefinedRegions,
    getFilteredClients,
    getRandomAccessibleClient,
    getRandomClientFromIndustry,
    getRandomClientFromRegion,
    getRandomClientByLocationType,
    getClientCount,
    getRegistryStats
};

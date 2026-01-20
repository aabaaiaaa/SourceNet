/**
 * Network Utilities - Shared functions for network generation and NAR attachments
 * 
 * Used by both MissionGenerator.js (procedural missions) and StoryMissionManager.js (story missions)
 * to ensure consistent network handling and prevent collisions between story and generated networks.
 */

import networkRegistry from '../systems/NetworkRegistry';
import { allMissions } from './missionData.js';

// Reserved network details from story missions (populated on first access)
let reservedNetworkDetails = null;

/**
 * Get reserved network details from story missions
 * Lazily initialized on first access
 * @returns {Object} { networkIds: Set, subnets: Set, ips: Set }
 */
export function getReservedNetworkDetails() {
    if (reservedNetworkDetails) {
        return reservedNetworkDetails;
    }

    reservedNetworkDetails = {
        networkIds: new Set(),
        subnets: new Set(),
        ips: new Set()
    };

    allMissions.forEach(mission => {
        if (mission.networks) {
            mission.networks.forEach(network => {
                if (network.networkId) {
                    reservedNetworkDetails.networkIds.add(network.networkId);
                }
                if (network.address) {
                    reservedNetworkDetails.subnets.add(network.address);
                }
                if (network.fileSystems) {
                    network.fileSystems.forEach(fs => {
                        if (fs.ip) {
                            reservedNetworkDetails.ips.add(fs.ip);
                        }
                    });
                }
            });
        }
    });

    console.log('📋 Reserved network details loaded:', {
        networkIds: Array.from(reservedNetworkDetails.networkIds),
        subnets: Array.from(reservedNetworkDetails.subnets),
        ips: Array.from(reservedNetworkDetails.ips)
    });

    return reservedNetworkDetails;
}

/**
 * Check if a subnet is reserved by story missions
 * @param {string} subnet - Subnet to check
 * @returns {boolean} True if reserved
 */
export function isSubnetReserved(subnet) {
    const reserved = getReservedNetworkDetails();
    return reserved.subnets.has(subnet);
}

/**
 * Check if an IP is reserved by story missions
 * @param {string} ip - IP to check
 * @returns {boolean} True if reserved
 */
export function isIpReserved(ip) {
    const reserved = getReservedNetworkDetails();
    return reserved.ips.has(ip);
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random IP subnet, ensuring it doesn't collide with:
 * - Existing networks in NetworkRegistry
 * - Reserved story mission subnets
 * @param {number} maxAttempts - Maximum attempts to find unique subnet (default 50)
 * @returns {string} IP address in format "10.x.x.0/24"
 */
export function generateSubnet(maxAttempts = 50) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const second = randomInt(1, 254);
        const third = randomInt(1, 254);
        const subnet = `10.${second}.${third}.0/24`;

        // Check if subnet is already in use by NetworkRegistry
        if (networkRegistry.isSubnetInUse(subnet)) {
            continue;
        }

        // Check if subnet is reserved by story missions
        if (isSubnetReserved(subnet)) {
            continue;
        }

        return subnet;
    }

    // Fallback: return a random subnet anyway (very unlikely to reach here)
    console.warn('networkUtils: Could not find unique subnet after', maxAttempts, 'attempts');
    const second = randomInt(1, 254);
    const third = randomInt(1, 254);
    return `10.${second}.${third}.0/24`;
}

/**
 * Generate an IP within a subnet, ensuring it doesn't collide with:
 * - Existing devices in NetworkRegistry
 * - Reserved story mission IPs
 * @param {string} subnet - Subnet in format "10.x.x.0/24"
 * @param {number} hostNum - Preferred host number (1-254)
 * @param {number} maxAttempts - Maximum attempts to find unique IP (default 50)
 * @returns {string} IP address
 */
export function generateIpInSubnet(subnet, hostNum, maxAttempts = 50) {
    const parts = subnet.split('.');
    const baseIp = `${parts[0]}.${parts[1]}.${parts[2]}`;

    // First try the preferred host number
    const preferredIp = `${baseIp}.${hostNum}`;
    if (!networkRegistry.isIpInUse(preferredIp) && !isIpReserved(preferredIp)) {
        return preferredIp;
    }

    // Try random host numbers
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const randomHost = randomInt(10, 250); // Avoid .1 (gateway) and very high numbers
        const ip = `${baseIp}.${randomHost}`;

        if (!networkRegistry.isIpInUse(ip) && !isIpReserved(ip)) {
            return ip;
        }
    }

    // Fallback: return the preferred IP anyway (collision possible but very unlikely)
    console.warn('networkUtils: Could not find unique IP in subnet', subnet);
    return preferredIp;
}

/**
 * Generate NAR credential attachments for mission briefing message
 * Only includes minimal data needed for the attachment - network structure
 * is registered in NetworkRegistry when mission is accepted
 * @param {Array} networks - Network definitions with fileSystems
 * @returns {Array} Array of attachment objects
 */
export function generateNarAttachments(networks) {
    if (!networks || !Array.isArray(networks)) {
        return [];
    }

    return networks.map(network => ({
        type: 'networkAddress',  // Must match SNetMail attachment type handler
        networkId: network.networkId,
        networkName: network.networkName,
        address: network.address,
        // Extract device IPs from fileSystems for granting access when NAR is activated
        deviceIps: (network.fileSystems || []).map(fs => fs.ip).filter(Boolean)
    }));
}

/**
 * Reset reserved network details cache (useful for testing)
 */
export function resetReservedNetworkDetails() {
    reservedNetworkDetails = null;
}

export default {
    getReservedNetworkDetails,
    isSubnetReserved,
    isIpReserved,
    randomInt,
    generateSubnet,
    generateIpInSubnet,
    generateNarAttachments,
    resetReservedNetworkDetails
};

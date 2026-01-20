/**
 * NetworkRegistry - Global Network System
 * 
 * Single source of truth for all network, device, and file state in the game.
 * Decouples NAR entries (access credentials) from live network state.
 * 
 * Structure:
 * - networks: Map<networkId, { networkId, networkName, address, bandwidth, accessible }>
 * - devices: Map<ip, { ip, hostname, networkId, fileSystemId, accessible }>
 * - fileSystems: Map<fileSystemId, { id, files: [] }>
 * 
 * NAR entries only store access credentials (networkId, deviceAccess list).
 * All network structure and file data lives here.
 */

import triggerEventBus from '../core/triggerEventBus';

// Helper to emit events via the event bus
const emit = (eventType, eventData) => {
    triggerEventBus.emit(eventType, eventData);
};

class NetworkRegistry {
    constructor() {
        this.networks = new Map();
        this.devices = new Map();
        this.fileSystems = new Map();
    }

    // =========================================================================
    // REGISTRATION METHODS
    // =========================================================================

    /**
     * Register a network in the registry
     * @param {Object} network - Network data
     * @param {string} network.networkId - Unique network identifier
     * @param {string} network.networkName - Display name
     * @param {string} network.address - Network subnet (e.g., "10.1.1.0/24")
     * @param {number} network.bandwidth - Bandwidth in Mbps
     * @param {boolean} [network.accessible=false] - Whether network is accessible (default false until NAR activated)
     * @param {boolean} [network.discovered=false] - Whether player has received NAR for this network
     * @returns {boolean} True if registered, false if already exists
     */
    registerNetwork(network) {
        const { networkId, networkName, address, bandwidth, accessible = false, discovered = false, revokedReason = null } = network;

        if (!networkId) {
            console.warn('NetworkRegistry: Cannot register network without networkId');
            return false;
        }

        // If network already exists, update it (for mission extensions adding to existing networks)
        if (this.networks.has(networkId)) {
            const existing = this.networks.get(networkId);
            this.networks.set(networkId, {
                ...existing,
                networkName: networkName || existing.networkName,
                address: address || existing.address,
                bandwidth: bandwidth ?? existing.bandwidth,
                accessible: accessible ?? existing.accessible,
                // Once discovered, stays discovered
                discovered: discovered || existing.discovered,
                revokedReason: revokedReason ?? existing.revokedReason,
            });
            return true;
        }

        this.networks.set(networkId, {
            networkId,
            networkName,
            address,
            bandwidth,
            accessible,
            discovered,
            revokedReason,
        });

        return true;
    }

    /**
     * Register a device in the registry
     * @param {Object} device - Device data
     * @param {string} device.ip - Device IP address
     * @param {string} device.hostname - Device hostname
     * @param {string} device.networkId - Network this device belongs to
     * @param {string} device.fileSystemId - Associated file system ID
     * @param {boolean} [device.accessible=false] - Whether device is accessible (default false until NAR activated)
     * @returns {boolean} True if registered, false if invalid
     */
    registerDevice(device) {
        const { ip, hostname, networkId, fileSystemId, accessible = false } = device;

        if (!ip) {
            console.warn('NetworkRegistry: Cannot register device without IP');
            return false;
        }

        // If device already exists, update it
        if (this.devices.has(ip)) {
            const existing = this.devices.get(ip);
            this.devices.set(ip, {
                ...existing,
                hostname: hostname || existing.hostname,
                networkId: networkId || existing.networkId,
                fileSystemId: fileSystemId || existing.fileSystemId,
                accessible: accessible ?? existing.accessible,
            });
            return true;
        }

        this.devices.set(ip, {
            ip,
            hostname,
            networkId,
            fileSystemId,
            accessible,
        });

        return true;
    }

    /**
     * Register a file system in the registry
     * @param {Object} fileSystem - File system data
     * @param {string} fileSystem.id - Unique file system identifier
     * @param {Array} [fileSystem.files=[]] - Initial files array
     * @returns {boolean} True if registered, false if invalid
     */
    registerFileSystem(fileSystem) {
        const { id, files = [] } = fileSystem;

        if (!id) {
            console.warn('NetworkRegistry: Cannot register file system without id');
            return false;
        }

        // If file system already exists, merge files (preserving existing, adding new)
        if (this.fileSystems.has(id)) {
            const existing = this.fileSystems.get(id);
            const existingFileNames = new Set(existing.files.map(f => f.name));
            const newFiles = files.filter(f => !existingFileNames.has(f.name));

            this.fileSystems.set(id, {
                ...existing,
                files: [...existing.files, ...newFiles],
            });
            return true;
        }

        this.fileSystems.set(id, {
            id,
            files: [...files], // Clone to avoid external mutations
        });

        return true;
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get a network by ID
     * @param {string} networkId - Network identifier
     * @returns {Object|null} Network data or null if not found
     */
    getNetwork(networkId) {
        return this.networks.get(networkId) || null;
    }

    /**
     * Get a device by IP
     * @param {string} ip - Device IP address
     * @returns {Object|null} Device data or null if not found
     */
    getDevice(ip) {
        return this.devices.get(ip) || null;
    }

    /**
     * Get a file system by ID
     * @param {string} fileSystemId - File system identifier
     * @returns {Object|null} File system data or null if not found
     */
    getFileSystem(fileSystemId) {
        return this.fileSystems.get(fileSystemId) || null;
    }

    /**
     * Get all devices belonging to a network
     * @param {string} networkId - Network identifier
     * @returns {Array} Array of device objects
     */
    getNetworkDevices(networkId) {
        const devices = [];
        for (const device of this.devices.values()) {
            if (device.networkId === networkId) {
                devices.push({ ...device });
            }
        }
        return devices;
    }

    /**
     * Get all file systems belonging to a network
     * @param {string} networkId - Network identifier
     * @returns {Array} Array of file system objects with device info
     */
    getNetworkFileSystems(networkId) {
        const fileSystems = [];
        for (const device of this.devices.values()) {
            if (device.networkId === networkId && device.fileSystemId) {
                const fs = this.fileSystems.get(device.fileSystemId);
                if (fs) {
                    fileSystems.push({
                        ...fs,
                        ip: device.ip,
                        hostname: device.hostname,
                        accessible: device.accessible,
                    });
                }
            }
        }
        return fileSystems;
    }

    /**
     * Get all file systems in the registry
     * @returns {Array} Array of all file system objects
     */
    getAllFileSystems() {
        return Array.from(this.fileSystems.values()).map(fs => ({ ...fs }));
    }

    // =========================================================================
    // COLLISION DETECTION METHODS
    // =========================================================================

    /**
     * Check if a subnet is already in use
     * @param {string} subnet - Subnet address (e.g., "10.1.1.0/24")
     * @returns {boolean} True if subnet is in use
     */
    isSubnetInUse(subnet) {
        for (const network of this.networks.values()) {
            if (network.address === subnet) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if an IP address is already in use
     * @param {string} ip - IP address
     * @returns {boolean} True if IP is in use
     */
    isIpInUse(ip) {
        return this.devices.has(ip);
    }

    /**
     * Get all used subnets
     * @returns {Set<string>} Set of subnet addresses
     */
    getUsedSubnets() {
        const subnets = new Set();
        for (const network of this.networks.values()) {
            if (network.address) {
                subnets.add(network.address);
            }
        }
        return subnets;
    }

    /**
     * Get all used IP addresses
     * @returns {Set<string>} Set of IP addresses
     */
    getUsedIps() {
        return new Set(this.devices.keys());
    }

    // =========================================================================
    // MODIFICATION METHODS
    // =========================================================================

    /**
     * Update files in a file system (full replacement)
     * @param {string} fileSystemId - File system identifier
     * @param {Array} files - New files array
     * @returns {boolean} True if updated, false if file system not found
     */
    updateFiles(fileSystemId, files) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        this.fileSystems.set(fileSystemId, {
            ...fs,
            files: [...files],
        });

        emit('fileSystemChanged', { fileSystemId, files });
        return true;
    }

    /**
     * Add files to an existing file system
     * @param {string} fileSystemId - File system identifier
     * @param {Array} newFiles - Files to add
     * @returns {boolean} True if added, false if file system not found
     */
    addFilesToFileSystem(fileSystemId, newFiles) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        const existingFileNames = new Set(fs.files.map(f => f.name));
        const filesToAdd = newFiles.filter(f => !existingFileNames.has(f.name));

        const updatedFiles = [...fs.files, ...filesToAdd];
        this.fileSystems.set(fileSystemId, {
            ...fs,
            files: updatedFiles,
        });

        emit('fileSystemChanged', { fileSystemId, files: updatedFiles });
        return true;
    }

    /**
     * Modify properties of specific files in a file system
     * @param {string} fileSystemId - File system identifier
     * @param {Array<string>} fileNames - Names of files to modify
     * @param {Object} properties - Properties to set (e.g., { corrupted: true })
     * @returns {boolean} True if modified, false if file system not found
     */
    modifyFileProperties(fileSystemId, fileNames, properties) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        const fileNameSet = new Set(fileNames);
        const updatedFiles = fs.files.map(file => {
            if (fileNameSet.has(file.name)) {
                return { ...file, ...properties };
            }
            return file;
        });

        this.fileSystems.set(fileSystemId, {
            ...fs,
            files: updatedFiles,
        });

        emit('fileSystemChanged', { fileSystemId, files: updatedFiles });
        return true;
    }

    /**
     * Set network accessibility
     * @param {string} networkId - Network identifier
     * @param {boolean} accessible - Whether network is accessible
     * @param {string} [reason] - Reason for change (for revocation)
     * @returns {boolean} True if updated, false if network not found
     */
    setNetworkAccessible(networkId, accessible, reason) {
        const network = this.networks.get(networkId);
        if (!network) {
            console.warn(`NetworkRegistry: Network not found: ${networkId}`);
            return false;
        }

        this.networks.set(networkId, {
            ...network,
            accessible,
            revokedReason: accessible ? undefined : reason,
        });

        // Also update all devices on this network
        for (const device of this.devices.values()) {
            if (device.networkId === networkId) {
                this.devices.set(device.ip, {
                    ...device,
                    accessible,
                });
            }
        }

        return true;
    }

    /**
     * Set device accessibility
     * @param {string} ip - Device IP address
     * @param {boolean} accessible - Whether device is accessible
     * @returns {boolean} True if updated, false if device not found
     */
    setDeviceAccessible(ip, accessible) {
        const device = this.devices.get(ip);
        if (!device) {
            console.warn(`NetworkRegistry: Device not found: ${ip}`);
            return false;
        }

        this.devices.set(ip, {
            ...device,
            accessible,
        });

        return true;
    }

    // =========================================================================
    // ACCESS CONTROL METHODS (single source of truth for NAR access)
    // =========================================================================

    /**
     * Grant access to a network and specific devices
     * Called when player activates a NAR attachment
     * @param {string} networkId - Network identifier
     * @param {Array<string>} [deviceIps=[]] - List of device IPs to grant access to
     * @returns {boolean} True if access granted, false if network not found
     */
    grantNetworkAccess(networkId, deviceIps = []) {
        const network = this.networks.get(networkId);
        if (!network) {
            console.warn(`NetworkRegistry: Cannot grant access - network not found: ${networkId}`);
            return false;
        }

        // Mark network as accessible and discovered
        this.networks.set(networkId, {
            ...network,
            accessible: true,
            discovered: true,
            revokedReason: undefined,
            accessGrantedDate: new Date().toISOString(),
        });

        // Grant access to specified devices
        for (const ip of deviceIps) {
            const device = this.devices.get(ip);
            if (device && device.networkId === networkId) {
                this.devices.set(ip, {
                    ...device,
                    accessible: true,
                });
            }
        }

        // Emit event for objective tracking and other systems
        emit('networkAccessGranted', {
            networkId,
            networkName: network.networkName,
            deviceIps,
        });

        console.log(`✅ NetworkRegistry: Granted access to ${network.networkName} (${deviceIps.length} devices)`);
        return true;
    }

    /**
     * Revoke access to a network and all its devices
     * Called when mission completes or scripted event revokes access
     * @param {string} networkId - Network identifier
     * @param {string} [reason] - Reason for revocation (displayed in NAR app)
     * @returns {boolean} True if access revoked, false if network not found
     */
    revokeNetworkAccess(networkId, reason) {
        const network = this.networks.get(networkId);
        if (!network) {
            console.warn(`NetworkRegistry: Cannot revoke access - network not found: ${networkId}`);
            return false;
        }

        // Mark network as inaccessible but keep discovered=true
        this.networks.set(networkId, {
            ...network,
            accessible: false,
            revokedReason: reason,
        });

        // Revoke access to all devices on this network
        for (const device of this.devices.values()) {
            if (device.networkId === networkId) {
                this.devices.set(device.ip, {
                    ...device,
                    accessible: false,
                });
            }
        }

        // Emit event for VPN disconnect and other systems
        emit('networkAccessRevoked', {
            networkId,
            networkName: network.networkName,
            reason,
        });

        console.log(`🚫 NetworkRegistry: Revoked access to ${network.networkName} - ${reason}`);
        return true;
    }

    /**
     * Check if player has access to a network
     * @param {string} networkId - Network identifier
     * @returns {boolean} True if network exists and is accessible
     */
    hasNetworkAccess(networkId) {
        const network = this.networks.get(networkId);
        return network?.accessible === true;
    }

    /**
     * Get all networks the player has discovered (received NAR for)
     * Used by NAR app to display known networks
     * @returns {Array} Array of network objects with discovered=true
     */
    getKnownNetworks() {
        const known = [];
        for (const network of this.networks.values()) {
            if (network.discovered) {
                known.push({ ...network });
            }
        }
        return known;
    }

    /**
     * Get accessible devices for a network
     * Used by Network Scanner and File Manager
     * @param {string} networkId - Network identifier
     * @returns {Array} Array of accessible device objects
     */
    getAccessibleDevices(networkId) {
        const devices = [];
        for (const device of this.devices.values()) {
            if (device.networkId === networkId && device.accessible) {
                devices.push({ ...device });
            }
        }
        return devices;
    }

    // =========================================================================
    // SERIALIZATION METHODS (for save/load)
    // =========================================================================

    /**
     * Get a serializable snapshot of the registry state
     * @returns {Object} Snapshot containing networks, devices, and fileSystems
     */
    getSnapshot() {
        return {
            networks: Array.from(this.networks.values()),
            devices: Array.from(this.devices.values()),
            fileSystems: Array.from(this.fileSystems.values()),
        };
    }

    /**
     * Load state from a snapshot
     * @param {Object} snapshot - Snapshot from getSnapshot()
     */
    loadSnapshot(snapshot) {
        this.clear();

        if (snapshot.networks) {
            for (const network of snapshot.networks) {
                this.networks.set(network.networkId, network);
            }
        }

        if (snapshot.devices) {
            for (const device of snapshot.devices) {
                this.devices.set(device.ip, device);
            }
        }

        if (snapshot.fileSystems) {
            for (const fs of snapshot.fileSystems) {
                this.fileSystems.set(fs.id, fs);
            }
        }

        // Emit event to notify components that registry state has changed
        triggerEventBus.emit('networkRegistryLoaded');
    }

    /**
     * Clear all registry data
     */
    clear() {
        this.networks.clear();
        this.devices.clear();
        this.fileSystems.clear();
    }

    /**
     * Reset the registry (alias for clear, used in tests)
     */
    reset() {
        this.clear();
    }

    // =========================================================================
    // CONVENIENCE METHODS (shorthand for common operations)
    // =========================================================================

    /**
     * Add a network with minimal required parameters
     * @param {string} networkId - Network identifier
     * @param {string} networkName - Display name
     * @param {Object} [options] - Optional network properties
     * @returns {boolean} True if added
     */
    addNetwork(networkId, networkName, options = {}) {
        return this.registerNetwork({
            networkId,
            networkName,
            address: options.address || '10.0.0.0/24',
            bandwidth: options.bandwidth || 50,
            accessible: options.accessible ?? true,
        });
    }

    /**
     * Add a device with minimal required parameters
     * @param {string} networkId - Network the device belongs to
     * @param {Object} device - Device data
     * @param {string} device.ip - Device IP address
     * @param {string} device.name - Device hostname
     * @param {boolean} [device.accessible=true] - Whether device is accessible
     * @returns {boolean} True if added
     */
    addDevice(networkId, device) {
        const fileSystemId = device.ip; // Use IP as file system ID for simplicity

        // Register a file system for this device if it doesn't exist
        if (!this.fileSystems.has(fileSystemId)) {
            this.registerFileSystem({ id: fileSystemId, files: [] });
        }

        return this.registerDevice({
            ip: device.ip,
            hostname: device.name,
            networkId,
            fileSystemId,
            accessible: device.accessible ?? true,
        });
    }

    /**
     * Add a file to a device's file system
     * @param {string} ip - Device IP address (used as file system ID)
     * @param {Object} file - File object
     * @returns {boolean} True if added
     */
    addFileSystem(ip, file) {
        const fileSystemId = ip;

        // Ensure file system exists
        if (!this.fileSystems.has(fileSystemId)) {
            this.registerFileSystem({ id: fileSystemId, files: [] });
        }

        // Add file to the file system
        const fs = this.fileSystems.get(fileSystemId);
        if (fs) {
            const existingNames = new Set(fs.files.map(f => f.name));
            if (!existingNames.has(file.name)) {
                fs.files.push({ ...file });
            }
            return true;
        }
        return false;
    }

    /**
     * Get devices by network ID
     * @param {string} networkId - Network identifier
     * @returns {Array} Array of device objects
     */
    getDevicesByNetwork(networkId) {
        return this.getNetworkDevices(networkId);
    }

    // =========================================================================
    // DEBUG METHODS
    // =========================================================================

    /**
     * Get a summary of registry contents for debugging
     * @returns {Object} Summary with counts and details
     */
    getDebugSummary() {
        return {
            networkCount: this.networks.size,
            deviceCount: this.devices.size,
            fileSystemCount: this.fileSystems.size,
            networks: Array.from(this.networks.values()).map(n => ({
                id: n.networkId,
                name: n.networkName,
                address: n.address,
                accessible: n.accessible,
            })),
            devices: Array.from(this.devices.values()).map(d => ({
                ip: d.ip,
                hostname: d.hostname,
                networkId: d.networkId,
                accessible: d.accessible,
            })),
        };
    }
}

// Singleton instance
const networkRegistry = new NetworkRegistry();

// Export singleton and class (class export useful for testing with fresh instances)
export { NetworkRegistry };
export default networkRegistry;

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
     * @param {string} [device.fileSystemId] - Associated file system ID (single, for backward compat)
     * @param {Array<string>} [device.fileSystemIds] - Associated file system IDs (multiple volumes)
     * @param {boolean} [device.accessible=false] - Whether device is accessible (default false until NAR activated)
     * @param {Array} [device.logs] - Activity logs for this device (used by investigation missions)
     * @returns {boolean} True if registered, false if invalid
     */
    registerDevice(device) {
        const { ip, hostname, networkId, fileSystemId, fileSystemIds, accessible = false, logs } = device;

        if (!ip) {
            console.warn('NetworkRegistry: Cannot register device without IP');
            return false;
        }

        // Support both single fileSystemId and array fileSystemIds
        // If both provided, fileSystemIds takes precedence
        let fsIds = fileSystemIds;
        if (!fsIds && fileSystemId) {
            fsIds = [fileSystemId];
        }

        // If device already exists, update it
        if (this.devices.has(ip)) {
            const existing = this.devices.get(ip);
            // Merge file system IDs if both old and new have them
            let mergedFsIds = fsIds;
            if (existing.fileSystemIds && fsIds) {
                const existingSet = new Set(existing.fileSystemIds);
                fsIds.forEach(id => existingSet.add(id));
                mergedFsIds = Array.from(existingSet);
            } else if (existing.fileSystemIds && !fsIds) {
                mergedFsIds = existing.fileSystemIds;
            }

            // Merge logs if both old and new have them
            let mergedLogs = logs;
            if (existing.logs && logs) {
                mergedLogs = [...existing.logs, ...logs];
            } else if (existing.logs && !logs) {
                mergedLogs = existing.logs;
            }

            this.devices.set(ip, {
                ...existing,
                hostname: hostname || existing.hostname,
                networkId: networkId || existing.networkId,
                fileSystemIds: mergedFsIds,
                // Keep single fileSystemId for backward compatibility (first in array)
                fileSystemId: mergedFsIds?.[0] || existing.fileSystemId,
                accessible: accessible ?? existing.accessible,
                logs: mergedLogs,
            });
            return true;
        }

        this.devices.set(ip, {
            ip,
            hostname,
            networkId,
            fileSystemIds: fsIds,
            // Keep single fileSystemId for backward compatibility (first in array)
            fileSystemId: fsIds?.[0] || fileSystemId,
            accessible,
            logs: logs || [],
        });

        return true;
    }

    /**
     * Get all file systems for a device (supports multi-volume devices)
     * @param {string} ip - Device IP address
     * @returns {Array} Array of file system objects (empty if device not found)
     */
    getDeviceFileSystems(ip) {
        const device = this.devices.get(ip);
        if (!device) return [];

        const fsIds = device.fileSystemIds || (device.fileSystemId ? [device.fileSystemId] : []);
        return fsIds
            .map(id => this.fileSystems.get(id))
            .filter(Boolean)
            .map(fs => ({ ...fs }));
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
     * Get a device by its file system ID
     * @param {string} fileSystemId - File system identifier
     * @returns {Object|null} Device data or null if not found
     */
    getDeviceByFileSystem(fileSystemId) {
        for (const device of this.devices.values()) {
            const fsIds = device.fileSystemIds || (device.fileSystemId ? [device.fileSystemId] : []);
            if (fsIds.includes(fileSystemId)) {
                return { ...device };
            }
        }
        return null;
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
    // DEVICE LOGGING METHODS
    // =========================================================================

    /**
     * Add a log entry to a device
     * @param {string} ip - Device IP address
     * @param {Object} logEntry - Log entry data
     * @param {string} logEntry.action - Action type ('copy', 'paste', 'delete', 'download', 'upload')
     * @param {string} logEntry.fileName - Name of the file
     * @param {string} logEntry.fileSystemId - REQUIRED: File system ID where activity occurred
     * @param {string} [logEntry.filePath] - Full path of the file
     * @param {number} [logEntry.sizeBytes] - File size in bytes
     * @param {string} [logEntry.sourceIp] - Source IP for transfers
     * @param {string} [logEntry.destIp] - Destination IP for transfers
     * @param {Date|string} [logEntry.timestamp] - Timestamp (defaults to now)
     * @returns {boolean} True if logged, false if device not found
     */
    addDeviceLog(ip, logEntry) {
        const device = this.devices.get(ip);
        if (!device) {
            console.warn(`NetworkRegistry: Cannot add log - device ${ip} not found`);
            return false;
        }

        // Initialize logs array if needed
        if (!device.logs) {
            device.logs = [];
        }

        // Require explicit log type (no backward compatibility)
        if (!logEntry.type) {
            throw new Error('NetworkRegistry.addDeviceLog requires logEntry.type to be set (file|remote|process)');
        }

        // Require fileSystemId for file logs
        if (logEntry.type === 'file' && !logEntry.fileSystemId) {
            throw new Error('NetworkRegistry.addDeviceLog requires logEntry.fileSystemId for file type logs');
        }

        // Create log entry with timestamp, unique ID and type
        const entry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: logEntry.timestamp || new Date().toISOString(),
            type: logEntry.type,
            action: logEntry.action,
            user: logEntry.user,
            fileName: logEntry.fileName,
            filePath: logEntry.filePath,
            fileSystemId: logEntry.fileSystemId,  // REQUIRED: which file system
            sizeBytes: logEntry.sizeBytes,
            sourceIp: logEntry.sourceIp,
            destIp: logEntry.destIp,
        };

        device.logs.push(entry);

        // Keep only last 100 logs per device
        if (device.logs.length > 100) {
            device.logs = device.logs.slice(-100);
        }

        return true;
    }

    /**
     * Get logs for a device
     * @param {string} ip - Device IP address
     * @returns {Array} Array of log entries (empty if device not found)
     */
    getDeviceLogs(ip) {
        const device = this.devices.get(ip);
        return device?.logs ? [...device.logs] : [];
    }

    /**
     * Add a log entry to a network (e.g., connection events)
     * @param {string} networkId - Network identifier
     * @param {Object} logEntry - Log entry data (requires `type`)
     * @returns {boolean} True if logged, false if network not found
     */
    addNetworkLog(networkId, logEntry) {
        const network = this.networks.get(networkId);
        if (!network) {
            console.warn(`NetworkRegistry: Cannot add log - network ${networkId} not found`);
            return false;
        }

        if (!network.logs) {
            network.logs = [];
        }

        if (!logEntry.type) {
            throw new Error('NetworkRegistry.addNetworkLog requires logEntry.type to be set (file|remote|process)');
        }

        const entry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: logEntry.timestamp || new Date().toISOString(),
            type: logEntry.type,
            action: logEntry.action,
            user: logEntry.user,
            note: logEntry.note,
            sourceIp: logEntry.sourceIp,
            destIp: logEntry.destIp,
        };

        network.logs.push(entry);

        // Keep only last 200 logs at network level
        if (network.logs.length > 200) {
            network.logs = network.logs.slice(-200);
        }

        return true;
    }

    /**
     * Get logs for a network
     * @param {string} networkId
     * @returns {Array} Array of log entries (empty if network not found)
     */
    getNetworkLogs(networkId) {
        const network = this.networks.get(networkId);
        return network?.logs ? [...network.logs] : [];
    }

    /**
     * Clear logs for a network
     * @param {string} networkId
     * @returns {boolean} True if cleared, false if network not found
     */
    clearNetworkLogs(networkId) {
        const network = this.networks.get(networkId);
        if (!network) return false;
        network.logs = [];
        return true;
    }

    /**
     * Clear logs for a device
     * @param {string} ip - Device IP address
     * @returns {boolean} True if cleared, false if device not found
     */
    clearDeviceLogs(ip) {
        const device = this.devices.get(ip);
        if (!device) {
            return false;
        }
        device.logs = [];
        return true;
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
     * Mark files as deleted (soft delete - can be restored)
     * @param {string} fileSystemId - File system identifier
     * @param {Array<string>} fileNames - Names of files to mark as deleted
     * @returns {boolean} True if modified, false if file system not found
     */
    markFilesDeleted(fileSystemId, fileNames) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        const fileNameSet = new Set(fileNames);
        const updatedFiles = fs.files.map(file => {
            if (fileNameSet.has(file.name)) {
                return { ...file, status: 'deleted' };
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
     * Securely delete files (permanent removal - cannot be restored)
     * @param {string} fileSystemId - File system identifier
     * @param {Array<string>} fileNames - Names of files to permanently remove
     * @returns {boolean} True if modified, false if file system not found
     */
    secureDeleteFiles(fileSystemId, fileNames) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        const fileNameSet = new Set(fileNames);
        const updatedFiles = fs.files.filter(file => !fileNameSet.has(file.name));

        this.fileSystems.set(fileSystemId, {
            ...fs,
            files: updatedFiles,
        });

        emit('fileSystemChanged', { fileSystemId, files: updatedFiles });
        return true;
    }

    /**
     * Restore deleted files back to normal status
     * @param {string} fileSystemId - File system identifier
     * @param {Array<string>} fileNames - Names of files to restore
     * @returns {boolean} True if modified, false if file system not found
     */
    restoreFiles(fileSystemId, fileNames) {
        const fs = this.fileSystems.get(fileSystemId);
        if (!fs) {
            console.warn(`NetworkRegistry: File system not found: ${fileSystemId}`);
            return false;
        }

        const fileNameSet = new Set(fileNames);
        const updatedFiles = fs.files.map(file => {
            if (fileNameSet.has(file.name) && file.status === 'deleted') {
                return { ...file, status: 'normal' };
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
     * Reset a network for mission retry
     * Restores file systems to original state and revokes access
     * @param {string} networkId - Network identifier
     * @param {Object} originalNetworkData - Original mission network data with fileSystems
     * @returns {boolean} True if reset successful
     */
    resetNetworkForRetry(networkId, originalNetworkData) {
        const network = this.networks.get(networkId);
        if (!network) {
            console.warn(`NetworkRegistry: Cannot reset - network not found: ${networkId}`);
            return false;
        }

        console.log(`🔄 NetworkRegistry: Resetting network ${network.networkName} for retry`);

        // Reset file systems to original state
        if (originalNetworkData.fileSystems) {
            for (const fsData of originalNetworkData.fileSystems) {
                const fsId = fsData.id;
                const fs = this.fileSystems.get(fsId);

                if (fs) {
                    // Restore original files (this resets any changes made during the mission)
                    const originalFiles = (fsData.files || []).map(f => ({
                        ...f,
                        corrupted: f.corrupted || false,
                    }));

                    this.fileSystems.set(fsId, {
                        ...fs,
                        files: originalFiles,
                        // Restore deleted files list if it existed
                        deletedFiles: fsData.deletedFiles || [],
                    });

                    console.log(`  ✅ Reset file system ${fsId} with ${originalFiles.length} files`);
                }
            }
        }

        // Revoke network access (player will need to re-activate NAR)
        this.networks.set(networkId, {
            ...network,
            accessible: false,
            discovered: false,
            revokedReason: null, // Clear any previous revocation reason
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

        console.log(`🔄 NetworkRegistry: Reset complete for ${network.networkName}`);
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

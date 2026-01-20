/**
 * Mission Extension Generator - Creates mid-mission extension objectives
 * 
 * Extensions are mandatory additions to active missions that:
 * - Trigger at ~50% objective completion (25% chance) or post-completion (20% chance)
 * - Add 1-2 new objectives before the verification step
 * - Increase payout by 1.3-1.5x (mid-mission) or 1.5-1.8x (post-completion)
 * - May include new NAR credentials for additional network/device access
 * 
 * Each mission type has 3 extension patterns:
 * - Pattern A: More work on same server (no new NAR - files added directly to registry)
 * - Pattern B: Additional server on same network (NAR required for new device access)
 * - Pattern C: New network/server (NAR required for new network access)
 */

import { getClientById } from '../data/clientRegistry';
import networkRegistry from '../systems/NetworkRegistry';
import { generateSubnet, generateIpInSubnet, randomInt } from './networkUtils';

// Extension configuration
export const extensionConfig = {
    // Trigger thresholds
    midMissionThreshold: 0.5,    // 50% of non-verification objectives complete
    midMissionChance: 0.25,      // 25% chance at threshold
    postCompletionChance: 0.20,  // 20% chance after last real objective

    // Payout multipliers
    midMissionMultiplier: { min: 1.3, max: 1.5 },
    postCompletionMultiplier: { min: 1.5, max: 1.8 },

    // Chance of extension requiring new network (Pattern C)
    newNetworkChance: 0.30       // 30% chance for new NAR
};

/**
 * Pick a random item from an array
 */
function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random number between min and max
 */
function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * File size profiles by file extension (realistic sizes)
 * Returns { minBytes, maxBytes } for the file type
 */
function getFileSizeProfile(filename, missionType) {
    const ext = filename.split('.').pop().toLowerCase();

    // Database files - large for backup/repair
    if (ext === 'db') {
        if (missionType === 'backup') {
            return { minBytes: 50 * 1024 * 1024, maxBytes: 2 * 1024 * 1024 * 1024 }; // 50MB - 2GB
        }
        return { minBytes: 10 * 1024 * 1024, maxBytes: 500 * 1024 * 1024 }; // 10MB - 500MB
    }

    // Archive files - generally large
    if (['tar', 'zip', 'gz', 'bz2'].includes(ext)) {
        return { minBytes: 10 * 1024 * 1024, maxBytes: 500 * 1024 * 1024 }; // 10MB - 500MB
    }

    // Encrypted files - medium to large
    if (ext === 'enc') {
        return { minBytes: 5 * 1024 * 1024, maxBytes: 100 * 1024 * 1024 }; // 5MB - 100MB
    }

    // Data files - medium
    if (ext === 'dat') {
        return { minBytes: 1 * 1024 * 1024, maxBytes: 50 * 1024 * 1024 }; // 1MB - 50MB
    }

    // Log files - small
    if (['txt', 'log', 'csv'].includes(ext)) {
        return { minBytes: 1 * 1024, maxBytes: 500 * 1024 }; // 1KB - 500KB
    }

    // Default - small to medium
    return { minBytes: 10 * 1024, maxBytes: 5 * 1024 * 1024 }; // 10KB - 5MB
}

/**
 * Generate random file size within profile range
 */
function generateFileSize(filename, missionType) {
    const profile = getFileSizeProfile(filename, missionType);
    const bytes = Math.floor(profile.minBytes + Math.random() * (profile.maxBytes - profile.minBytes));

    let size;
    if (bytes >= 1024 * 1024 * 1024) {
        size = `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
        size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytes >= 1024) {
        size = `${(bytes / 1024).toFixed(1)} KB`;
    } else {
        size = `${bytes} B`;
    }

    return { size, sizeBytes: bytes };
}

/**
 * Generate a server hostname
 */
function generateHostname(clientName, purpose, index = 1) {
    const prefix = clientName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${prefix}-${purpose}-${String(index).padStart(2, '0')}`;
}

/**
 * Generate extension files based on industry and mission type
 * Returns { files, targetFiles, totalDataBytes }
 */
function generateExtensionFiles(industry, missionType, targetCount, corrupted = false) {
    const fileTemplates = {
        repair: ['system_{date}.db', 'config_{date}.dat', 'backup_{date}.enc', 'recovery_{date}.log', 'cache_{date}.tmp'],
        backup: ['archive_{date}.db', 'snapshot_{date}.dat', 'mirror_{date}.enc', 'delta_{date}.tar'],
        transfer: ['export_{date}.tar', 'migration_{date}.zip', 'sync_{date}.db', 'batch_{date}.dat']
    };

    const industryPrefix = {
        banking: 'financial',
        government: 'records',
        healthcare: 'medical',
        corporate: 'business',
        utilities: 'infrastructure',
        shipping: 'logistics',
        emergency: 'dispatch',
        nonprofit: 'donor',
        cultural: 'catalog'
    };

    const prefix = industryPrefix[industry] || 'data';
    const templates = fileTemplates[missionType] || fileTemplates.repair;
    const dateFormats = ['2024_03', '2024_04', '2024_Q2', '2023_Q4', '2024_05', '2024_06'];

    // Generate more files than targets (add 1-2 non-target files)
    const extraFiles = randomInt(1, 2);
    const totalFiles = targetCount + extraFiles;

    const files = [];
    const usedNames = new Set();

    while (files.length < totalFiles) {
        const template = randomPick(templates);
        const date = randomPick(dateFormats);
        const name = `${prefix}_${template.replace('{date}', date)}`;

        if (!usedNames.has(name)) {
            usedNames.add(name);
            const { size, sizeBytes } = generateFileSize(name, missionType);
            files.push({
                name,
                size,
                sizeBytes,
                corrupted: false,
                targetFile: false
            });
        }
    }

    // Shuffle and mark first targetCount as targets
    const shuffled = files.sort(() => Math.random() - 0.5);
    const targetFiles = [];
    let totalDataBytes = 0;

    for (let i = 0; i < shuffled.length; i++) {
        if (i < targetCount) {
            shuffled[i].targetFile = true;
            shuffled[i].corrupted = corrupted;
            targetFiles.push(shuffled[i].name);
            totalDataBytes += shuffled[i].sizeBytes;
        }
    }

    return { files: shuffled, targetFiles, totalDataBytes };
}

/**
 * Extension patterns for each mission type
 * Each pattern returns { objectives, networks, message }
 */
const extensionPatterns = {
    repair: {
        // Pattern A: More corrupted files on same server (no new NAR - files added directly to registry)
        moreFiles: (mission, client) => {
            const targetCount = randomInt(3, 5);
            const { files: newFiles, targetFiles } = generateExtensionFiles(client.industry, 'repair', targetCount, true);
            const existingFs = mission.networks[0]?.fileSystems[0];

            if (!existingFs) return null;

            // Get the file system ID from the mission data
            const fileSystemId = existingFs.id;

            // Add files directly to NetworkRegistry (this is the source of truth)
            // The files are already marked as corrupted from generateExtensionFiles
            const addSuccess = networkRegistry.addFilesToFileSystem(fileSystemId, newFiles);

            if (!addSuccess) {
                console.warn(`MissionExtensionGenerator: Failed to add files to file system ${fileSystemId}`);
                return null;
            }

            console.log(`📁 Pattern A: Added ${newFiles.length} corrupted files to ${fileSystemId}`);

            // Also update mission.networks for consistency (handler will use this)
            const updatedNetworks = mission.networks.map((net, idx) => {
                if (idx === 0) {
                    return {
                        ...net,
                        fileSystems: net.fileSystems.map((fs, fsIdx) => {
                            if (fsIdx === 0) {
                                // Get the current files from registry to stay in sync
                                const registryFs = networkRegistry.getFileSystem(fs.id);
                                return {
                                    ...fs,
                                    files: registryFs ? registryFs.files : [...fs.files, ...newFiles]
                                };
                            }
                            return fs;
                        })
                    };
                }
                return net;
            });

            return {
                objectives: [{
                    id: `obj-ext-${Date.now()}-1`,
                    description: `Repair ${targetFiles.length} additional corrupted files`,
                    type: 'fileOperation',
                    operation: 'repair',
                    target: 'specific-files',
                    targetFiles: targetFiles,
                    count: targetFiles.length,
                    status: 'pending'
                }],
                networks: updatedNetworks,
                newNarRequired: false,
                registryUpdated: true, // Flag indicating files were added directly to registry
                messageTemplate: 'moreCorruptedFiles',
                targetFiles: targetFiles
            };
        },

        // Pattern B: Second damaged server on same network (NAR required for new device access)
        secondServer: (mission, client) => {
            const targetCount = randomInt(3, 4);
            const { files: newFiles, targetFiles } = generateExtensionFiles(client.industry, 'repair', targetCount, true);
            const existingNet = mission.networks[0];

            if (!existingNet) return null;

            const subnet = existingNet.address;
            const newIp = generateIpInSubnet(subnet, randomInt(30, 50));
            const newHostname = generateHostname(client.name, 'server', 2);
            const newFileSystemId = `fs-ext-${Date.now()}`;

            // Register the new device and file system in NetworkRegistry
            networkRegistry.registerDevice({
                ip: newIp,
                hostname: newHostname,
                networkId: existingNet.networkId,
                fileSystemId: newFileSystemId,
                accessible: true,
            });
            networkRegistry.registerFileSystem({
                id: newFileSystemId,
                files: newFiles,
            });
            console.log(`📁 Pattern B: Registered new device ${newHostname} (${newIp}) with ${newFiles.length} corrupted files`);

            // Add new file system to network data for mission tracking
            const updatedNetworks = mission.networks.map((net, idx) => {
                if (idx === 0) {
                    return {
                        ...net,
                        fileSystems: [
                            ...net.fileSystems,
                            {
                                id: newFileSystemId,
                                ip: newIp,
                                name: newHostname,
                                files: newFiles
                            }
                        ]
                    };
                }
                return net;
            });

            // Create NAR attachment with updated device access for existing network
            const narAttachment = {
                type: 'networkAddress',
                networkId: existingNet.networkId,
                networkName: existingNet.networkName,
                address: existingNet.address,
                bandwidth: existingNet.bandwidth,
                // Only include the new device in the attachment
                fileSystems: [{
                    id: newFileSystemId,
                    ip: newIp,
                    name: newHostname,
                    files: newFiles
                }]
            };

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newHostname} file system`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Repair ${targetFiles.length} corrupted files on ${newHostname}`,
                        type: 'fileOperation',
                        operation: 'repair',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        status: 'pending'
                    }
                ],
                networks: updatedNetworks,
                newNarRequired: true, // NAR required for new device access
                narAttachment: narAttachment,
                registryUpdated: true, // Device/fileSystem already registered
                messageTemplate: 'additionalServer',
                targetFiles: targetFiles
            };
        },

        // Pattern C: New network with damaged server (new NAR)
        newNetwork: (mission, client) => {
            const targetCount = randomInt(3, 5);
            const { files: newFiles, targetFiles } = generateExtensionFiles(client.industry, 'repair', targetCount, true);

            const newNetworkId = `${client.id}-ext-${Date.now()}`;
            const newSubnet = generateSubnet();
            const newIp = generateIpInSubnet(newSubnet, 10);
            const newHostname = generateHostname(client.name, 'archive');
            const newFileSystemId = `fs-ext-${Date.now()}`;

            // Register the new network, device, and file system in NetworkRegistry
            networkRegistry.registerNetwork({
                networkId: newNetworkId,
                networkName: `${client.name.split(' ')[0]}-Archive`,
                address: newSubnet,
                bandwidth: randomPick([25, 50, 75]),
                accessible: true,
            });
            networkRegistry.registerDevice({
                ip: newIp,
                hostname: newHostname,
                networkId: newNetworkId,
                fileSystemId: newFileSystemId,
                accessible: true,
            });
            networkRegistry.registerFileSystem({
                id: newFileSystemId,
                files: newFiles,
            });
            console.log(`📁 Pattern C: Registered new network ${newNetworkId} with device ${newHostname} (${newIp})`);

            const newNetwork = {
                networkId: newNetworkId,
                networkName: `${client.name.split(' ')[0]}-Archive`,
                address: newSubnet,
                bandwidth: randomPick([25, 50, 75]),
                revokeOnComplete: true,
                revokeReason: 'Mission access expired',
                fileSystems: [{
                    id: newFileSystemId,
                    ip: newIp,
                    name: newHostname,
                    files: newFiles
                }]
            };

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newNetwork.networkName} network`,
                        type: 'networkConnection',
                        target: newNetworkId,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Scan network to find ${newHostname}`,
                        type: 'networkScan',
                        target: newNetworkId,
                        expectedResult: newHostname,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-3`,
                        description: `Connect to ${newHostname} file system`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-4`,
                        description: `Repair ${targetFiles.length} corrupted files`,
                        type: 'fileOperation',
                        operation: 'repair',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        status: 'pending'
                    }
                ],
                networks: [...mission.networks, newNetwork],
                newNarRequired: true,
                narNetwork: newNetwork,
                registryUpdated: true, // Network/device/fileSystem already registered
                messageTemplate: 'newNetworkRepair',
                targetFiles: targetFiles
            };
        }
    },

    backup: {
        // Pattern A: Additional files to backup (no NAR required - existing device)
        moreFiles: (mission, client) => {
            const targetCount = randomInt(3, 5);
            const { files: newFiles, targetFiles } = generateExtensionFiles(client.industry, 'backup', targetCount, false);
            const existingFs = mission.networks[0]?.fileSystems[0];

            if (!existingFs) return null;

            // Add files directly to registry (Pattern A - no NAR needed)
            networkRegistry.addFilesToFileSystem(existingFs.ip, newFiles);

            // Also update mission.networks for mission tracking
            const updatedNetworks = mission.networks.map((net, idx) => {
                if (idx === 0) {
                    return {
                        ...net,
                        fileSystems: net.fileSystems.map((fs, fsIdx) => {
                            if (fsIdx === 0) {
                                return {
                                    ...fs,
                                    files: [...fs.files, ...newFiles]
                                };
                            }
                            return fs;
                        })
                    };
                }
                return net;
            });

            // Find backup destination
            const backupDest = mission.networks[0]?.fileSystems[1]?.ip ||
                mission.networks[1]?.fileSystems[0]?.ip;

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Copy ${targetFiles.length} additional files`,
                        type: 'fileOperation',
                        operation: 'copy',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Paste ${targetFiles.length} additional files to backup`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        destination: backupDest,
                        status: 'pending'
                    }
                ],
                networks: updatedNetworks,
                newNarRequired: false,
                registryUpdated: true,
                messageTemplate: 'additionalBackupFiles',
                targetFiles: targetFiles
            };
        },

        // Pattern B: Second backup destination on same/existing network (NAR required)
        secondDestination: (mission, client) => {
            const existingNet = mission.networks[0];
            if (!existingNet) return null;

            const subnet = existingNet.address;
            const newIp = generateIpInSubnet(subnet, randomInt(30, 50));
            const newHostname = generateHostname(client.name, 'backup', 2);

            // Get existing target files to backup
            const sourceFiles = mission.networks[0]?.fileSystems[0]?.files || [];
            const targetFileNames = sourceFiles.filter(f => f.targetFile).map(f => f.name).slice(0, 4);

            const newDevice = {
                id: `device-ext-${Date.now()}`,
                ip: newIp,
                hostname: newHostname,
                type: 'server',
                accessible: true
            };

            const newFileSystem = {
                id: `fs-ext-${Date.now()}`,
                ip: newIp,
                name: newHostname,
                files: []
            };

            // Register new device/fileSystem to registry (Pattern B - NAR required)
            networkRegistry.registerDevice(subnet, newDevice);
            networkRegistry.registerFileSystem(newIp, newFileSystem);

            // Also update mission.networks for mission tracking
            const updatedNetworks = mission.networks.map((net, idx) => {
                if (idx === 0) {
                    return {
                        ...net,
                        fileSystems: [
                            ...net.fileSystems,
                            newFileSystem
                        ]
                    };
                }
                return net;
            });

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newHostname} (secondary backup)`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Paste ${targetFileNames.length} files to secondary backup`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFileNames,
                        count: targetFileNames.length,
                        destination: newIp,
                        status: 'pending'
                    }
                ],
                networks: updatedNetworks,
                newNarRequired: true,
                registryUpdated: true,
                narAttachment: {
                    networkAddress: subnet,
                    deviceAccess: [newIp]
                },
                messageTemplate: 'secondaryBackupServer',
                targetFiles: targetFileNames
            };
        },

        // Pattern C: New backup network (new NAR required)
        newNetwork: (mission, client) => {
            const newNetworkId = `${client.id}-offsite-${Date.now()}`;
            const newSubnet = generateSubnet();
            const newIp = generateIpInSubnet(newSubnet, 10);
            const newHostname = generateHostname(client.name, 'offsite');

            // Get existing target files to backup
            const sourceFiles = mission.networks[0]?.fileSystems[0]?.files || [];
            const targetFileNames = sourceFiles.filter(f => f.targetFile).map(f => f.name).slice(0, 4);

            const newDevice = {
                id: `device-ext-${Date.now()}`,
                ip: newIp,
                hostname: newHostname,
                type: 'server',
                accessible: true
            };

            const newFileSystem = {
                id: `fs-ext-${Date.now()}`,
                ip: newIp,
                name: newHostname,
                files: []
            };

            const newNetworkData = {
                networkId: newNetworkId,
                networkName: `${client.name.split(' ')[0]}-Offsite`,
                address: newSubnet,
                bandwidth: randomPick([25, 50, 75]),
                accessible: true
            };

            // Register new network/device/fileSystem to registry (Pattern C - NAR required)
            networkRegistry.registerNetwork(newNetworkId, newNetworkData);
            networkRegistry.registerDevice(newSubnet, newDevice);
            networkRegistry.registerFileSystem(newIp, newFileSystem);

            // Keep mission.networks format for mission tracking
            const newNetworkForMission = {
                networkId: newNetworkId,
                networkName: newNetworkData.networkName,
                address: newSubnet,
                bandwidth: newNetworkData.bandwidth,
                revokeOnComplete: true,
                revokeReason: 'Mission access expired',
                fileSystems: [newFileSystem]
            };

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newNetworkData.networkName} network`,
                        type: 'networkConnection',
                        target: newNetworkId,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Scan network to find ${newHostname}`,
                        type: 'networkScan',
                        target: newNetworkId,
                        expectedResult: newHostname,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-3`,
                        description: `Connect to ${newHostname} file system`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-4`,
                        description: `Paste ${targetFileNames.length} files to offsite backup`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFileNames,
                        count: targetFileNames.length,
                        destination: newIp,
                        status: 'pending'
                    }
                ],
                networks: [...mission.networks, newNetworkForMission],
                newNarRequired: true,
                registryUpdated: true,
                narNetwork: newNetworkForMission,
                messageTemplate: 'offsiteBackup',
                targetFiles: targetFileNames
            };
        }
    },

    transfer: {
        // Pattern A: More files to transfer (no NAR required - existing device)
        moreFiles: (mission, client) => {
            const targetCount = randomInt(3, 5);
            const { files: newFiles, targetFiles } = generateExtensionFiles(client.industry, 'transfer', targetCount, false);
            const existingFs = mission.networks[0]?.fileSystems[0];

            if (!existingFs) return null;

            // Add files directly to registry (Pattern A - no NAR needed)
            networkRegistry.addFilesToFileSystem(existingFs.ip, newFiles);

            // Also update mission.networks for mission tracking
            const updatedNetworks = mission.networks.map((net, idx) => {
                if (idx === 0) {
                    return {
                        ...net,
                        fileSystems: net.fileSystems.map((fs, fsIdx) => {
                            if (fsIdx === 0) {
                                return {
                                    ...fs,
                                    files: [...fs.files, ...newFiles]
                                };
                            }
                            return fs;
                        })
                    };
                }
                return net;
            });

            // Find transfer destination
            const destIp = mission.networks[1]?.fileSystems[0]?.ip;

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Copy ${targetFiles.length} additional files`,
                        type: 'fileOperation',
                        operation: 'copy',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Paste ${targetFiles.length} additional files to destination`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFiles,
                        count: targetFiles.length,
                        destination: destIp,
                        status: 'pending'
                    }
                ],
                networks: updatedNetworks,
                newNarRequired: false,
                registryUpdated: true,
                messageTemplate: 'additionalTransferFiles',
                targetFiles: targetFiles
            };
        },

        // Pattern B: Additional destination server (NAR required)
        secondDestination: (mission, client) => {
            const destNet = mission.networks[1] || mission.networks[0];
            if (!destNet) return null;

            const subnet = destNet.address;
            const newIp = generateIpInSubnet(subnet, randomInt(30, 50));
            const newHostname = generateHostname(client.name, 'archive');

            // Get existing source files and filter to those marked as targets
            const sourceFiles = mission.networks[0]?.fileSystems[0]?.files || [];
            const existingTargets = sourceFiles.filter(f => f.targetFile).map(f => f.name);
            const targetFileNames = existingTargets.slice(0, Math.min(4, existingTargets.length));

            if (targetFileNames.length === 0) return null;

            const newDevice = {
                id: `device-ext-${Date.now()}`,
                ip: newIp,
                hostname: newHostname,
                type: 'server',
                accessible: true
            };

            const newFileSystem = {
                id: `fs-ext-${Date.now()}`,
                ip: newIp,
                name: newHostname,
                files: []
            };

            // Register new device/fileSystem to registry (Pattern B - NAR required)
            networkRegistry.registerDevice(subnet, newDevice);
            networkRegistry.registerFileSystem(newIp, newFileSystem);

            // Also update mission.networks for mission tracking
            const updatedNetworks = mission.networks.map((net) => {
                if (net.networkId === destNet.networkId) {
                    return {
                        ...net,
                        fileSystems: [
                            ...net.fileSystems,
                            newFileSystem
                        ]
                    };
                }
                return net;
            });

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newHostname} (archive)`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Paste ${targetFileNames.length} files to archive server`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFileNames,
                        count: targetFileNames.length,
                        destination: newIp,
                        status: 'pending'
                    }
                ],
                networks: updatedNetworks,
                newNarRequired: true,
                registryUpdated: true,
                narAttachment: {
                    networkAddress: subnet,
                    deviceAccess: [newIp]
                },
                messageTemplate: 'archiveServer',
                targetFiles: targetFileNames
            };
        },

        // Pattern C: New destination network (new NAR required)
        newNetwork: (mission, client) => {
            const newNetworkId = `${client.id}-partner-${Date.now()}`;
            const newSubnet = generateSubnet();
            const newIp = generateIpInSubnet(newSubnet, 10);
            const newHostname = generateHostname(client.name, 'partner');

            // Get existing source files and filter to those marked as targets
            const sourceFiles = mission.networks[0]?.fileSystems[0]?.files || [];
            const existingTargets = sourceFiles.filter(f => f.targetFile).map(f => f.name);
            const targetFileNames = existingTargets.slice(0, Math.min(4, existingTargets.length));

            if (targetFileNames.length === 0) return null;

            const newDevice = {
                id: `device-ext-${Date.now()}`,
                ip: newIp,
                hostname: newHostname,
                type: 'server',
                accessible: true
            };

            const newFileSystem = {
                id: `fs-ext-${Date.now()}`,
                ip: newIp,
                name: newHostname,
                files: []
            };

            const newNetworkData = {
                networkId: newNetworkId,
                networkName: `${client.name.split(' ')[0]}-Partner`,
                address: newSubnet,
                bandwidth: randomPick([25, 50, 75]),
                accessible: true
            };

            // Register new network/device/fileSystem to registry (Pattern C - NAR required)
            networkRegistry.registerNetwork(newNetworkId, newNetworkData);
            networkRegistry.registerDevice(newSubnet, newDevice);
            networkRegistry.registerFileSystem(newIp, newFileSystem);

            // Keep mission.networks format for mission tracking
            const newNetworkForMission = {
                networkId: newNetworkId,
                networkName: newNetworkData.networkName,
                address: newSubnet,
                bandwidth: newNetworkData.bandwidth,
                revokeOnComplete: true,
                revokeReason: 'Mission access expired',
                fileSystems: [newFileSystem]
            };

            return {
                objectives: [
                    {
                        id: `obj-ext-${Date.now()}-1`,
                        description: `Connect to ${newNetworkData.networkName} network`,
                        type: 'networkConnection',
                        target: newNetworkId,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-2`,
                        description: `Scan network to find ${newHostname}`,
                        type: 'networkScan',
                        target: newNetworkId,
                        expectedResult: newHostname,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-3`,
                        description: `Connect to ${newHostname} file system`,
                        type: 'fileSystemConnection',
                        target: newIp,
                        status: 'pending'
                    },
                    {
                        id: `obj-ext-${Date.now()}-4`,
                        description: `Paste ${targetFileNames.length} files to partner server`,
                        type: 'fileOperation',
                        operation: 'paste',
                        target: 'specific-files',
                        targetFiles: targetFileNames,
                        count: targetFileNames.length,
                        destination: newIp,
                        status: 'pending'
                    }
                ],
                networks: [...mission.networks, newNetworkForMission],
                newNarRequired: true,
                registryUpdated: true,
                narNetwork: newNetworkForMission,
                messageTemplate: 'partnerTransfer',
                targetFiles: targetFileNames
            };
        }
    }
};

/**
 * Check if a mission should receive an extension
 * @param {Object} mission - Active mission
 * @param {number} completedCount - Number of completed objectives (excluding verification)
 * @param {number} totalCount - Total objectives (excluding verification)
 * @param {boolean} isPostCompletion - True if all real objectives are complete
 * @param {Object} extensionOffers - Existing extension offers (to prevent double-extension)
 * @returns {boolean} Whether extension should trigger
 */
export function shouldTriggerExtension(mission, completedCount, totalCount, isPostCompletion, extensionOffers) {
    const missionId = mission.missionId || mission.id;

    // Already extended this mission
    if (extensionOffers && extensionOffers[missionId]) {
        return false;
    }

    if (isPostCompletion) {
        // Post-completion trigger
        return Math.random() < extensionConfig.postCompletionChance;
    } else {
        // Mid-mission trigger - check if we've hit threshold
        const completionRatio = completedCount / totalCount;
        if (completionRatio >= extensionConfig.midMissionThreshold) {
            return Math.random() < extensionConfig.midMissionChance;
        }
    }

    return false;
}

/**
 * Generate an extension for a mission
 * @param {Object} mission - Active mission
 * @param {boolean} isPostCompletion - Whether this is post-completion extension
 * @returns {Object|null} Extension data { objectives, networks, message, payoutMultiplier, narAttachment }
 */
export function generateExtension(mission, isPostCompletion = false) {
    const missionType = mission.missionType || 'repair';
    const patterns = extensionPatterns[missionType];

    if (!patterns) {
        console.warn(`No extension patterns for mission type: ${missionType}`);
        return null;
    }

    // Get client info
    const client = getClientById(mission.clientId);
    if (!client) {
        console.warn(`Client not found for extension: ${mission.clientId}`);
        return null;
    }

    // Select pattern based on chance
    const useNewNetwork = Math.random() < extensionConfig.newNetworkChance;
    let patternName;

    if (useNewNetwork) {
        patternName = 'newNetwork';
    } else {
        // 50/50 between pattern A and B
        patternName = Math.random() < 0.5 ? 'moreFiles' : 'secondServer';
        // Backup and transfer use 'secondDestination' instead of 'secondServer'
        if (missionType !== 'repair' && patternName === 'secondServer') {
            patternName = 'secondDestination';
        }
    }

    const patternFn = patterns[patternName];
    if (!patternFn) {
        console.warn(`Pattern not found: ${missionType}.${patternName}`);
        return null;
    }

    const extensionData = patternFn(mission, client);
    if (!extensionData) {
        return null;
    }

    // Calculate payout multiplier
    const multiplierRange = isPostCompletion
        ? extensionConfig.postCompletionMultiplier
        : extensionConfig.midMissionMultiplier;
    const payoutMultiplier = randomRange(multiplierRange.min, multiplierRange.max);

    // Generate NAR attachment for new network access
    // Pattern B: narAttachment is directly provided (new device on existing network)
    // Pattern C: narNetwork is provided (entire new network)
    let narAttachment = null;
    if (extensionData.newNarRequired) {
        if (extensionData.narAttachment) {
            // Pattern B: Direct attachment for new device access on existing network
            narAttachment = {
                type: 'networkAddress',
                ...extensionData.narAttachment
            };
        } else if (extensionData.narNetwork) {
            // Pattern C: Full network attachment
            const net = extensionData.narNetwork;
            narAttachment = {
                type: 'networkAddress',
                networkId: net.networkId,
                networkName: net.networkName,
                address: net.address,
                bandwidth: net.bandwidth,
                fileSystems: net.fileSystems.map(fs => ({
                    id: fs.id,
                    ip: fs.ip,
                    name: fs.name,
                    files: fs.files
                }))
            };
        }
    }

    return {
        objectives: extensionData.objectives,
        networks: extensionData.networks,
        messageTemplate: extensionData.messageTemplate,
        payoutMultiplier,
        narAttachment,
        isPostCompletion,
        clientId: client.id,
        clientName: client.name,
        targetFiles: extensionData.targetFiles || []
    };
}

/**
 * Get the count of non-verification objectives that are complete/pending
 * @param {Array} objectives - Mission objectives
 * @returns {{ completed: number, total: number, isAllRealComplete: boolean }}
 */
export function getObjectiveProgress(objectives) {
    if (!objectives) return { completed: 0, total: 0, isAllRealComplete: false };

    const realObjectives = objectives.filter(obj => obj.type !== 'verification');
    const completed = realObjectives.filter(obj => obj.status === 'complete').length;
    const total = realObjectives.length;
    const isAllRealComplete = completed === total && total > 0;

    return { completed, total, isAllRealComplete };
}

export default {
    extensionConfig,
    shouldTriggerExtension,
    generateExtension,
    getObjectiveProgress
};

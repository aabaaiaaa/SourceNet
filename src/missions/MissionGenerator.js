/**
 * Mission Generator - Creates procedural missions with complete network infrastructure
 * 
 * Generates:
 * - Single standalone missions (repair, backup, transfer)
 * - Multi-mission arcs with sequential unlocking and cohesive narratives
 * - Complete networks with file systems, files, and NAR credentials
 * - Optional time limits with payout scaling
 * 
 * All generated missions are fully playable with proper:
 * - Network infrastructure (networks[], fileSystems[], files[])
 * - Objective types matching ObjectiveTracker expectations
 * - NAR credential attachments in mission briefing messages
 * - Failure consequences and client messages
 */

import { getClientById } from '../data/clientRegistry';
import { generateSubnet, generateIpInSubnet, generateNarAttachments, randomInt } from './networkUtils';
import { getSanitizedNamePrefix } from '../utils/helpers';

// Track generated mission IDs to ensure uniqueness
let missionIdCounter = 0;

/**
 * Generate a unique mission ID
 * @param {string} prefix - ID prefix (e.g., 'repair', 'backup', 'transfer')
 * @param {string} clientId - Client ID for uniqueness
 * @returns {string} Unique mission ID
 */
function generateMissionId(prefix, clientId) {
    missionIdCounter++;
    return `${prefix}-${clientId}-${Date.now()}-${missionIdCounter}`;
}

/**
 * Generate a unique arc ID
 * @returns {string} Unique arc ID
 */
function generateArcId() {
    return `arc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pick a random item from an array
 * @param {Array} arr - Array to pick from
 * @returns {*} Random item
 */
function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**\n * Generate a server hostname based on client and purpose
 * @param {Object} client - Client object
 * @param {string} purpose - Server purpose (e.g., 'fileserver', 'backup', 'archive')
 * @param {number} index - Server index for uniqueness
 * @returns {string} Generated hostname
 */
function generateHostname(client, purpose, index = 1) {
    const prefix = getSanitizedNamePrefix(client.name, { lowercase: true });
    return `${prefix}-${purpose}-${String(index).padStart(2, '0')}`;
}

/**
 * File size profiles by file extension (realistic sizes)
 * Returns { minBytes, maxBytes } for the file type
 */
function getFileSizeProfile(filename, missionType) {
    const ext = filename.split('.').pop().toLowerCase();

    // Database files - large for backup/repair, medium otherwise
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

    // Documents (xlsx, pdf) - small to medium
    if (['xlsx', 'pdf', 'docx'].includes(ext)) {
        return { minBytes: 100 * 1024, maxBytes: 10 * 1024 * 1024 }; // 100KB - 10MB
    }

    // Log/text files - small
    if (['txt', 'log', 'csv'].includes(ext)) {
        return { minBytes: 1 * 1024, maxBytes: 500 * 1024 }; // 1KB - 500KB
    }

    // Config files - small
    if (['cfg', 'conf', 'ini', 'json', 'xml'].includes(ext)) {
        return { minBytes: 512, maxBytes: 50 * 1024 }; // 512B - 50KB
    }

    // Default - small to medium
    return { minBytes: 10 * 1024, maxBytes: 5 * 1024 * 1024 }; // 10KB - 5MB
}

/**
 * Generate random file size within profile range
 * @param {string} filename - File name to determine type
 * @param {string} missionType - Mission type for context
 * @returns {object} { size: string, sizeBytes: number }
 */
function generateFileSize(filename, missionType) {
    const profile = getFileSizeProfile(filename, missionType);
    const bytes = Math.floor(profile.minBytes + Math.random() * (profile.maxBytes - profile.minBytes));

    // Format for display
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
 * Generate file names based on industry and mission type
 * @param {string} industry - Client industry
 * @param {string} missionType - Type of mission (repair, backup, transfer)
 * @param {number} targetCount - Number of TARGET files needed (actual files generated will be more)
 * @param {boolean} corrupted - Whether TARGET files should be marked corrupted
 * @returns {object} { files: Array, targetFiles: Array<string> }
 */
function generateFiles(industry, missionType, targetCount, corrupted = false) {
    const fileTemplates = {
        banking: {
            repair: ['ledger_{date}.db', 'transactions_{date}.dat', 'accounts_{date}.enc', 'audit_log_{date}.txt', 'system_config_{date}.cfg', 'backup_index_{date}.log'],
            backup: ['customer_data_{date}.db', 'loan_records_{date}.dat', 'compliance_{date}.enc', 'daily_report_{date}.pdf', 'branch_config_{date}.cfg', 'audit_trail_{date}.log'],
            transfer: ['quarterly_report_{date}.xlsx', 'financial_summary_{date}.pdf', 'archive_{date}.tar', 'temp_cache_{date}.dat', 'sync_log_{date}.txt']
        },
        government: {
            repair: ['citizen_records_{date}.db', 'permit_system_{date}.dat', 'case_files_{date}.enc', 'index_{date}.log', 'system_state_{date}.cfg'],
            backup: ['registry_{date}.db', 'tax_filings_{date}.dat', 'license_data_{date}.enc', 'form_templates_{date}.pdf', 'process_log_{date}.txt'],
            transfer: ['archive_records_{date}.tar', 'historical_data_{date}.zip', 'backup_{date}.db', 'readme_{date}.txt', 'manifest_{date}.log']
        },
        healthcare: {
            repair: ['patient_records_{date}.enc', 'ehr_system_{date}.db', 'lab_results_{date}.dat', 'scheduler_config_{date}.cfg', 'error_log_{date}.txt'],
            backup: ['medical_imaging_{date}.dat', 'prescriptions_{date}.db', 'appointments_{date}.enc', 'staff_schedule_{date}.xlsx', 'backup_status_{date}.log'],
            transfer: ['hipaa_archive_{date}.enc', 'patient_history_{date}.tar', 'compliance_{date}.zip', 'transfer_log_{date}.txt', 'checksum_{date}.dat']
        },
        corporate: {
            repair: ['crm_database_{date}.db', 'erp_system_{date}.dat', 'hr_records_{date}.enc', 'email_archive_{date}.tar', 'config_{date}.cfg', 'error_{date}.log'],
            backup: ['sales_data_{date}.db', 'inventory_{date}.dat', 'project_files_{date}.zip', 'meeting_notes_{date}.pdf', 'system_{date}.cfg'],
            transfer: ['quarterly_backup_{date}.tar', 'financial_records_{date}.enc', 'contracts_{date}.zip', 'index_{date}.db', 'manifest_{date}.txt']
        },
        utilities: {
            repair: ['scada_config_{date}.db', 'grid_telemetry_{date}.dat', 'meter_data_{date}.enc', 'sensor_calibration_{date}.cfg', 'event_log_{date}.txt'],
            backup: ['outage_logs_{date}.dat', 'maintenance_{date}.db', 'sensor_data_{date}.enc', 'grid_map_{date}.pdf', 'backup_schedule_{date}.cfg'],
            transfer: ['infrastructure_{date}.tar', 'network_config_{date}.zip', 'system_backup_{date}.db', 'migration_log_{date}.txt', 'readme_{date}.pdf']
        },
        shipping: {
            repair: ['tracking_system_{date}.db', 'logistics_{date}.dat', 'manifest_{date}.enc', 'route_cache_{date}.dat', 'driver_log_{date}.txt'],
            backup: ['shipment_records_{date}.db', 'customs_{date}.dat', 'routes_{date}.enc', 'fleet_status_{date}.xlsx', 'backup_config_{date}.cfg'],
            transfer: ['warehouse_{date}.tar', 'fleet_data_{date}.zip', 'inventory_{date}.db', 'transfer_receipt_{date}.pdf', 'sync_log_{date}.txt']
        },
        emergency: {
            repair: ['dispatch_logs_{date}.db', 'incident_reports_{date}.dat', 'personnel_{date}.enc', 'radio_config_{date}.cfg', 'system_status_{date}.log'],
            backup: ['call_records_{date}.db', 'response_times_{date}.dat', 'equipment_{date}.enc', 'training_docs_{date}.pdf', 'schedule_{date}.xlsx'],
            transfer: ['emergency_archive_{date}.tar', 'training_{date}.zip', 'protocols_{date}.db', 'handover_notes_{date}.txt', 'audit_{date}.log']
        },
        nonprofit: {
            repair: ['donor_database_{date}.db', 'volunteer_{date}.dat', 'programs_{date}.enc', 'newsletter_draft_{date}.pdf', 'config_{date}.cfg'],
            backup: ['fundraising_{date}.db', 'grants_{date}.dat', 'events_{date}.enc', 'annual_summary_{date}.xlsx', 'email_templates_{date}.zip'],
            transfer: ['annual_report_{date}.tar', 'financial_{date}.zip', 'membership_{date}.db', 'media_assets_{date}.tar', 'readme_{date}.txt']
        },
        cultural: {
            repair: ['catalog_{date}.db', 'collections_{date}.dat', 'exhibitions_{date}.enc', 'visitor_log_{date}.csv', 'settings_{date}.cfg'],
            backup: ['archives_{date}.db', 'digitization_{date}.dat', 'metadata_{date}.enc', 'restoration_notes_{date}.pdf', 'index_{date}.log'],
            transfer: ['preservation_{date}.tar', 'restoration_{date}.zip', 'inventory_{date}.db', 'accession_log_{date}.csv', 'readme_{date}.txt']
        }
    };

    const templates = fileTemplates[industry]?.[missionType] || fileTemplates.corporate[missionType];
    const dateFormats = ['2024_01', '2024_02', '2024_03', '2024_Q1', '2024_Q2', '2023_12', '2023_11', '2024_04', '2024_05', '2023_Q4'];

    const files = [];
    const usedNames = new Set();

    // Generate more files than needed - file system should have non-target files too
    // Total files = target count + 2-4 extra non-target files
    const extraFiles = randomInt(2, 4);
    const totalFiles = targetCount + extraFiles;

    while (files.length < totalFiles) {
        const template = randomPick(templates);
        const date = randomPick(dateFormats);
        const name = template.replace('{date}', date);

        if (!usedNames.has(name)) {
            usedNames.add(name);
            const { size, sizeBytes } = generateFileSize(name, missionType);
            files.push({
                name,
                size,
                sizeBytes,
                corrupted: false, // Will set for targets later
                targetFile: false // Will set for targets later
            });
        }
    }

    // Shuffle files and mark first targetCount as targets
    const shuffled = files.sort(() => Math.random() - 0.5);
    const targetFileNames = [];

    for (let i = 0; i < shuffled.length; i++) {
        if (i < targetCount) {
            shuffled[i].targetFile = true;
            shuffled[i].corrupted = corrupted;
            targetFileNames.push(shuffled[i].name);
        }
    }

    return {
        files: shuffled,
        targetFiles: targetFileNames
    };
}

/**
 * Generate complete network infrastructure for a mission
 * @param {Object} client - Client object
 * @param {string} missionType - Mission type (repair, backup, transfer)
 * @param {number} targetFileCount - Number of TARGET files to include
 * @param {Object} options - Additional options { corrupted, secondNetwork, sameNetworkBackup, sourceCount }
 * @returns {Object} { networks, primaryNetworkId, primaryIp, targetFiles, totalDataBytes, ... }
 */
export function generateNetworkInfrastructure(client, missionType, targetFileCount, options = {}) {
    const { corrupted = false, secondNetwork = false, sameNetworkBackup = false, sourceCount = 1 } = options;

    const networks = [];
    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();

    // Track all target files across all source file systems
    let allTargetFiles = [];
    let totalDataBytes = 0;

    // Distribute target files across source file systems
    const filesPerSource = Math.ceil(targetFileCount / sourceCount);

    // Generate primary network with potentially multiple source file systems
    const primaryFileSystems = [];

    for (let i = 0; i < sourceCount; i++) {
        const ip = generateIpInSubnet(primarySubnet, 10 + i);
        const purpose = sourceCount > 1 ? `fileserver-${String(i + 1).padStart(2, '0')}` : 'fileserver';
        const hostname = generateHostname(client, purpose.replace('-', ''));

        // Calculate how many target files for this file system
        const remainingTargets = targetFileCount - allTargetFiles.length;
        const thisSourceTargets = Math.min(filesPerSource, remainingTargets);

        const { files, targetFiles } = generateFiles(client.industry, missionType, thisSourceTargets, corrupted);

        allTargetFiles = [...allTargetFiles, ...targetFiles];
        totalDataBytes += files.filter(f => f.targetFile).reduce((sum, f) => sum + f.sizeBytes, 0);

        primaryFileSystems.push({
            id: `fs-${client.id}-${Date.now()}-${String(i + 1).padStart(2, '0')}`,
            ip,
            name: hostname,
            files,
            accessible: true
        });
    }

    networks.push({
        networkId: primaryNetworkId,
        networkName: `${getSanitizedNamePrefix(client.name)}-Network`,
        address: primarySubnet,
        bandwidth: randomPick([25, 50, 75, 100]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems: primaryFileSystems
    });

    // Add backup server to same network (for simpler backup missions)
    let backupServerIp = null;
    let backupServerName = null;

    if (sameNetworkBackup) {
        backupServerIp = generateIpInSubnet(primarySubnet, 20); // Different IP in same subnet
        backupServerName = generateHostname(client, 'backup');

        // Add backup server as second file system in same network
        networks[0].fileSystems.push({
            id: `fs-${client.id}-${Date.now()}-backup`,
            ip: backupServerIp,
            name: backupServerName,
            files: [], // Empty - files will be backed up here
            accessible: true
        });
    }

    // Generate secondary network for backup/transfer missions (separate network)
    let secondaryNetworkId = null;
    let secondaryIp = null;
    let secondaryHostname = null;

    if (secondNetwork) {
        secondaryNetworkId = `${client.id}-dest-${Date.now()}`;
        const secondarySubnet = generateSubnet();
        secondaryIp = generateIpInSubnet(secondarySubnet, 10);
        secondaryHostname = generateHostname(client, 'backup');

        networks.push({
            networkId: secondaryNetworkId,
            networkName: `${getSanitizedNamePrefix(client.name)}-Backup`,
            address: secondarySubnet,
            bandwidth: randomPick([25, 50, 75, 100]),
            revokeOnComplete: true,
            revokeReason: 'Mission access expired',
            fileSystems: [{
                id: `fs-${client.id}-${Date.now()}-dest`,
                ip: secondaryIp,
                name: secondaryHostname,
                files: [], // Empty - files will be transferred/backed up here
                accessible: true
            }]
        });
    }

    return {
        networks,
        primaryNetworkId,
        primaryIp: primaryFileSystems[0].ip,
        primaryFileSystems,
        secondaryNetworkId,
        secondaryIp,
        secondaryHostname,
        backupServerIp,
        backupServerName,
        useSameNetwork: sameNetworkBackup,
        targetFiles: allTargetFiles,
        totalDataBytes,
        hostname: networks[0].fileSystems[0].name,
        sourceCount
    };
}

/**
 * Calculate time limit based on objective count
 * Range: 3-10 minutes, scaled by complexity
 * @param {number} objectiveCount - Number of objectives
 * @returns {number} Time limit in minutes
 */
export function calculateTimeLimit(objectiveCount) {
    // Base: 3 minutes + 1 minute per objective, capped at 10
    const calculated = 3 + Math.floor(objectiveCount * 0.8);
    return Math.min(10, Math.max(3, calculated));
}

/**
 * Calculate mission payout based on objectives, time limit, and data size
 * @param {number} objectiveCount - Number of objectives
 * @param {number|null} timeLimitMinutes - Time limit in minutes, or null for untimed
 * @param {Object} client - Client object for tier multiplier
 * @param {number} totalDataBytes - Total data size in bytes (optional, for data size scaling)
 * @returns {number} Calculated payout
 */
export function calculatePayout(objectiveCount, timeLimitMinutes, client, totalDataBytes = 0) {
    const basePerObjective = 200;
    const tierMultipliers = {
        'bank-local': 1.0, 'bank-regional': 1.3, 'bank-national': 1.8,
        'gov-library': 0.8, 'gov-municipal': 1.1, 'gov-state': 1.4, 'gov-federal': 2.0,
        'health-clinic': 1.0, 'health-hospital': 1.3, 'health-research': 1.7,
        'corp-small': 1.0, 'corp-medium': 1.3, 'corp-enterprise': 1.8,
        'util-local': 1.1, 'util-regional': 1.5,
        'ship-courier': 1.0, 'ship-logistics': 1.3, 'ship-global': 1.7,
        'emerg-volunteer': 0.9, 'emerg-municipal': 1.3,
        'nonprofit-local': 0.7, 'nonprofit-national': 1.0,
        'cultural-local': 0.8, 'cultural-major': 1.2
    };

    const tierMultiplier = tierMultipliers[client.clientType] || 1.0;
    let basePayout = basePerObjective * objectiveCount * tierMultiplier;

    // Data size bonus: +$50 per 100MB of data
    if (totalDataBytes > 0) {
        const dataSizeBonus = Math.floor((totalDataBytes / (100 * 1024 * 1024)) * 50);
        basePayout += dataSizeBonus;
    }

    // Time bonus: tighter deadline = more pay
    if (timeLimitMinutes) {
        const timeBonus = 300 * (10 / timeLimitMinutes);
        basePayout += timeBonus;
    }

    return Math.floor(basePayout);
}

/**
 * Generate objectives for a repair mission
 * @param {Object} infra - Network infrastructure from generateNetworkInfrastructure
 * @returns {Array} Array of objective objects
 */
function generateRepairObjectives(infra) {
    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${infra.networks[0].networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find file servers`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        }
    ];

    let objIndex = 3;

    // Add objectives for each source file system
    for (let i = 0; i < infra.primaryFileSystems.length; i++) {
        const fs = infra.primaryFileSystems[i];
        const filesOnThisFs = infra.targetFiles.filter((_, idx) => {
            // Distribute target files across file systems
            const filesPerFs = Math.ceil(infra.targetFiles.length / infra.primaryFileSystems.length);
            return Math.floor(idx / filesPerFs) === i;
        });

        if (filesOnThisFs.length === 0) continue;

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Connect to ${fs.name} file system`,
            type: 'fileSystemConnection',
            target: fs.ip
        });

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Repair ${filesOnThisFs.length} corrupted files on ${fs.name}`,
            type: 'fileOperation',
            operation: 'repair',
            target: 'specific-files',
            targetFiles: filesOnThisFs,
            count: filesOnThisFs.length
        });
    }

    return objectives;
}

/**
 * Generate objectives for a backup mission
 * @param {Object} infra - Network infrastructure
 * @returns {Array} Array of objective objects
 */
function generateBackupObjectives(infra) {
    // Same-network backup: simpler, fewer objectives
    if (infra.useSameNetwork) {
        const objectives = [
            {
                id: 'obj-1',
                description: `Connect to ${infra.networks[0].networkName} network`,
                type: 'networkConnection',
                target: infra.primaryNetworkId
            },
            {
                id: 'obj-2',
                description: `Scan network to find file servers`,
                type: 'networkScan',
                target: infra.primaryNetworkId,
                expectedResult: infra.hostname
            }
        ];

        let objIndex = 3;

        // Add copy objectives for each source file system
        for (let i = 0; i < infra.primaryFileSystems.length; i++) {
            const fs = infra.primaryFileSystems[i];
            // Skip the backup server (last file system in same-network backup)
            if (fs.ip === infra.backupServerIp) continue;

            const filesOnThisFs = fs.files.filter(f => f.targetFile).map(f => f.name);
            if (filesOnThisFs.length === 0) continue;

            objectives.push({
                id: `obj-${objIndex++}`,
                description: `Connect to ${fs.name} (source)`,
                type: 'fileSystemConnection',
                target: fs.ip
            });

            objectives.push({
                id: `obj-${objIndex++}`,
                description: `Copy ${filesOnThisFs.length} files from ${fs.name}`,
                type: 'fileOperation',
                operation: 'copy',
                target: 'specific-files',
                targetFiles: filesOnThisFs,
                count: filesOnThisFs.length
            });
        }

        // Add paste to backup server
        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Connect to ${infra.backupServerName} (backup)`,
            type: 'fileSystemConnection',
            target: infra.backupServerIp
        });

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Paste ${infra.targetFiles.length} files to backup server`,
            type: 'fileOperation',
            operation: 'paste',
            target: 'specific-files',
            targetFiles: infra.targetFiles,
            count: infra.targetFiles.length,
            destination: infra.backupServerIp
        });

        return objectives;
    }

    // Different-network backup: more complex, requires connecting to second network
    const destNetwork = infra.networks[1];
    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${infra.networks[0].networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find file servers`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        }
    ];

    let objIndex = 3;

    // Add copy objectives for each source file system
    for (let i = 0; i < infra.primaryFileSystems.length; i++) {
        const fs = infra.primaryFileSystems[i];
        const filesOnThisFs = fs.files.filter(f => f.targetFile).map(f => f.name);
        if (filesOnThisFs.length === 0) continue;

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Connect to ${fs.name} (source)`,
            type: 'fileSystemConnection',
            target: fs.ip
        });

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Copy ${filesOnThisFs.length} files from ${fs.name}`,
            type: 'fileOperation',
            operation: 'copy',
            target: 'specific-files',
            targetFiles: filesOnThisFs,
            count: filesOnThisFs.length
        });
    }

    // Add destination network objectives
    objectives.push(
        {
            id: `obj-${objIndex++}`,
            description: `Connect to ${destNetwork.networkName} network`,
            type: 'networkConnection',
            target: infra.secondaryNetworkId
        },
        {
            id: `obj-${objIndex++}`,
            description: `Scan backup network to find ${infra.secondaryHostname}`,
            type: 'networkScan',
            target: infra.secondaryNetworkId,
            expectedResult: infra.secondaryHostname
        },
        {
            id: `obj-${objIndex++}`,
            description: `Connect to ${infra.secondaryHostname} (backup)`,
            type: 'fileSystemConnection',
            target: infra.secondaryIp
        },
        {
            id: `obj-${objIndex++}`,
            description: `Paste ${infra.targetFiles.length} files to backup server`,
            type: 'fileOperation',
            operation: 'paste',
            target: 'specific-files',
            targetFiles: infra.targetFiles,
            count: infra.targetFiles.length,
            destination: infra.secondaryIp
        }
    );

    return objectives;
}

/**
 * Generate objectives for a transfer mission (two networks)
 * @param {Object} infra - Network infrastructure with two networks
 * @returns {Array} Array of objective objects
 */
function generateTransferObjectives(infra) {
    const sourceNetwork = infra.networks[0];
    const destNetwork = infra.networks[1];
    const destHostname = destNetwork.fileSystems[0].name;

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${sourceNetwork.networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan ${sourceNetwork.networkName} to find file servers`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        }
    ];

    let objIndex = 3;

    // Add copy objectives for each source file system
    for (let i = 0; i < infra.primaryFileSystems.length; i++) {
        const fs = infra.primaryFileSystems[i];
        const filesOnThisFs = fs.files.filter(f => f.targetFile).map(f => f.name);
        if (filesOnThisFs.length === 0) continue;

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Connect to ${fs.name} file system`,
            type: 'fileSystemConnection',
            target: fs.ip
        });

        objectives.push({
            id: `obj-${objIndex++}`,
            description: `Copy ${filesOnThisFs.length} files from ${fs.name}`,
            type: 'fileOperation',
            operation: 'copy',
            target: 'specific-files',
            targetFiles: filesOnThisFs,
            count: filesOnThisFs.length
        });
    }

    // Add destination network objectives
    objectives.push(
        {
            id: `obj-${objIndex++}`,
            description: `Connect to ${destNetwork.networkName} network`,
            type: 'networkConnection',
            target: infra.secondaryNetworkId
        },
        {
            id: `obj-${objIndex++}`,
            description: `Scan ${destNetwork.networkName} to find ${destHostname}`,
            type: 'networkScan',
            target: infra.secondaryNetworkId,
            expectedResult: destHostname
        },
        {
            id: `obj-${objIndex++}`,
            description: `Connect to ${destHostname} file system`,
            type: 'fileSystemConnection',
            target: infra.secondaryIp
        },
        {
            id: `obj-${objIndex++}`,
            description: `Paste ${infra.targetFiles.length} files to destination`,
            type: 'fileOperation',
            operation: 'paste',
            target: 'specific-files',
            targetFiles: infra.targetFiles,
            count: infra.targetFiles.length
        }
    );

    return objectives;
}

/**
 * Generate mission briefing message with NAR attachments
 * @param {Object} client - Client object
 * @param {string} missionType - Mission type
 * @param {Array} networks - Network definitions
 * @param {number|null} timeLimitMinutes - Time limit or null
 * @param {Object} context - Additional context { arcSequence, arcTotal, referralText, targetFiles, totalDataBytes }
 * @returns {Object} Message object for initial briefing
 */
function generateBriefingMessage(client, missionType, networks, timeLimitMinutes, context = {}) {
    const { arcSequence, arcTotal, referralText, targetFiles = [], totalDataBytes = 0 } = context;

    const briefingTemplates = {
        repair: [
            `We've experienced some data corruption on our file server. We need someone to repair the affected files as soon as possible.`,
            `Several critical files have become corrupted due to a system error. Your expertise in file repair would be greatly appreciated.`,
            `Our IT team discovered corruption in our database files. We need these repaired urgently to resume operations.`
        ],
        backup: [
            `We need to create secure backups of critical files before our scheduled maintenance window.`,
            `As part of our disaster recovery plan, we require immediate backup of essential data files.`,
            `Our compliance team has requested an emergency backup of sensitive records. Time is of the essence.`
        ],
        transfer: [
            `We're migrating data to a new backup server and need files transferred securely between systems.`,
            `Our infrastructure upgrade requires moving critical files from the old server to the new one.`,
            `We need to consolidate files from our primary server to our backup facility for redundancy.`
        ],
        restore: [
            `We've had a critical system failure and need to restore files from our backup server. The corrupted files need to be deleted first.`,
            `Our primary file server experienced data corruption. We need the bad files removed and replaced with clean copies from backup.`,
            `Emergency restoration needed - our main server has corrupted data that must be deleted and replaced from backup archives.`
        ],
        'repair-backup': [
            `We have corrupted files that need to be repaired, and once fixed, we need secure backups created immediately.`,
            `Critical database files have become corrupted. After repair, we need them backed up to prevent future data loss.`,
            `Our files need repair work and then a complete backup. This is part of our recovery and prevention protocol.`
        ]
    };

    let body = 'Dear {username},\n\n';
    body += referralText ? `${referralText}\n\n` : '';
    body += randomPick(briefingTemplates[missionType] || briefingTemplates.repair);

    // Add target files list
    if (targetFiles.length > 0) {
        const operationVerbs = {
            'repair': 'repair',
            'backup': 'back up',
            'transfer': 'transfer',
            'restore': 'restore',
            'repair-backup': 'repair and back up'
        };
        const operationVerb = operationVerbs[missionType] || 'process';
        body += `\n\n📁 Files to ${operationVerb}:`;
        targetFiles.forEach(file => {
            body += `\n• ${file}`;
        });

        // Add total data size if significant
        if (totalDataBytes > 0) {
            let sizeStr;
            if (totalDataBytes >= 1024 * 1024 * 1024) {
                sizeStr = `${(totalDataBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
            } else if (totalDataBytes >= 1024 * 1024) {
                sizeStr = `${(totalDataBytes / (1024 * 1024)).toFixed(0)} MB`;
            } else {
                sizeStr = `${(totalDataBytes / 1024).toFixed(0)} KB`;
            }
            body += `\n\nTotal data: ${sizeStr}`;
        }
    }

    if (timeLimitMinutes) {
        body += `\n\n⚠️ TIME SENSITIVE: This task must be completed within ${timeLimitMinutes} minutes of acceptance.`;
    }

    body += `\n\nAttached are the network credentials you'll need to access our systems.`;

    if (arcSequence && arcTotal) {
        body += `\n\n[Mission ${arcSequence} of ${arcTotal}]`;
    }

    body += `\n\nSincerely,\n{clientName}`;

    // Generate mission type display name
    const missionTypeNames = {
        'repair': 'Repair',
        'backup': 'Backup',
        'transfer': 'Transfer',
        'restore': 'Restoration',
        'repair-backup': 'Repair & Backup'
    };
    const displayType = missionTypeNames[missionType] || missionType.charAt(0).toUpperCase() + missionType.slice(1);

    // Generate unique message ID using mission type, client ID, and timestamp with random suffix
    const uniqueId = `msg-briefing-${missionType}-${client.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
        id: uniqueId,
        from: client.name,
        fromId: client.id,
        fromName: client.name,
        subject: `Mission Briefing: ${displayType} Request`,
        body,
        attachments: generateNarAttachments(networks),
        read: false,
        timestamp: new Date().toISOString()
    };
}

/**
 * Generate failure consequences for a mission
 * @param {Object} client - Client object
 * @param {number} basePayout - Mission payout
 * @param {string} failureReason - Why mission might fail (deadline, etc)
 * @returns {Object} Failure consequences object
 */
function generateFailureConsequences(client, basePayout, failureReason = 'incomplete') {
    const failureMessages = {
        deadline: [
            `Unfortunately, you failed to complete the task within the required timeframe. We've had to find alternative solutions.`,
            `The deadline has passed and we can no longer use your services for this task. This is very disappointing.`,
            `Time ran out before the work was completed. We expected better from someone with your reputation.`
        ],
        incomplete: [
            `We're disappointed that you were unable to complete the assigned task. We may need to reconsider future engagements.`,
            `The mission was not completed as requested. This has caused significant inconvenience to our operations.`
        ]
    };

    const messageBody = `Dear {username},\n\n${randomPick(failureMessages[failureReason] || failureMessages.incomplete)}\n\nSincerely,\n{clientName}`;

    return {
        credits: -Math.floor(basePayout * 0.25),
        reputation: -1,
        messages: [{
            id: `msg-failure-${Date.now()}`,
            from: client.name,
            fromId: client.id,
            fromName: client.name,
            subject: 'Mission Failed',
            body: messageBody,
            attachments: [],
            delay: 2000
        }]
    };
}

/**
 * Generate success consequences for a mission
 * @param {Object} client - Client object
 * @param {number} basePayout - Mission payout
 * @returns {Object} Success consequences object
 */
function generateSuccessConsequences(client, basePayout) {
    const successMessages = [
        `Excellent work! The task has been completed to our satisfaction. Payment has been authorized.`,
        `Thank you for your efficient work. We're pleased with the results and have processed your payment.`,
        `Great job on completing the mission. Your professionalism is appreciated. Payment attached.`
    ];

    const messageBody = `Dear {username},\n\n${randomPick(successMessages)}\n\nSincerely,\n{clientName}`;

    return {
        credits: basePayout,
        reputation: 1,
        messages: [{
            id: `msg-success-${Date.now()}`,
            from: client.name,
            fromId: client.id,
            fromName: client.name,
            subject: 'Mission Complete - Payment Enclosed',
            body: messageBody,
            attachments: [{
                type: 'cheque',
                amount: basePayout,
                description: `Payment for completed mission`
            }],
            delay: 3000
        }]
    };
}

/**
 * Generate a repair mission
 * @param {Object} client - Client object
 * @param {Object} options - { hasTimed, arcId, arcSequence, arcTotal, arcContext }
 * @returns {Object} Complete mission object
 */
export function generateRepairMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 4-8 files
    const targetFileCount = randomInt(4, 8);

    // Randomly choose number of source file systems (1-3 for repair)
    const sourceCount = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3;

    const infra = generateNetworkInfrastructure(client, 'repair', targetFileCount, {
        corrupted: true,
        sourceCount
    });
    const objectives = generateRepairObjectives(infra);

    // Cap base mission objectives at 15 (extensions can exceed)
    if (objectives.length > 15) {
        objectives.splice(15);
    }

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, infra.totalDataBytes);

    const missionId = generateMissionId('repair', client.id);

    // Build briefing context with target files
    const briefingContext = {
        ...arcContext,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes
    };

    return {
        missionId,
        title: `File Repair for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: targetFileCount <= 5 ? 'Easy' : targetFileCount <= 7 ? 'Medium' : 'Hard',
        missionType: 'repair',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'repair', infra.networks, timeLimitMinutes, briefingContext),
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        // Arc fields
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null
    };
}

/**
 * Generate a backup mission
 * @param {Object} client - Client object
 * @param {Object} options - { hasTimed, arcId, arcSequence, arcTotal, arcContext }
 * @returns {Object} Complete mission object
 */
export function generateBackupMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 3-8 files (larger for backup missions)
    const targetFileCount = randomInt(3, 8);

    // Randomly choose: backup to same network (simpler) or different network (more complex)
    const useSameNetwork = Math.random() < 0.4; // 40% same network, 60% different network

    // Randomly choose number of source file systems (1-4 for backup - consolidation scenario)
    const sourceCount = Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : Math.random() < 0.8 ? 3 : 4;

    const infra = generateNetworkInfrastructure(client, 'backup', targetFileCount, {
        corrupted: false,
        secondNetwork: !useSameNetwork,
        sameNetworkBackup: useSameNetwork,
        sourceCount
    });
    const objectives = generateBackupObjectives(infra);

    // Cap base mission objectives at 15 (extensions can exceed)
    if (objectives.length > 15) {
        objectives.splice(15);
    }

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, infra.totalDataBytes);

    const missionId = generateMissionId('backup', client.id);

    // Build briefing context with target files
    const briefingContext = {
        ...arcContext,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes
    };

    return {
        missionId,
        title: `Data Backup for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: targetFileCount <= 4 ? 'Easy' : targetFileCount <= 6 ? 'Medium' : 'Hard',
        missionType: 'backup',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'backup', infra.networks, timeLimitMinutes, briefingContext),
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        // Arc fields
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null
    };
}

/**
 * Generate a transfer mission (copy from one network to another)
 * @param {Object} client - Client object
 * @param {Object} options - { hasTimed, arcId, arcSequence, arcTotal, arcContext }
 * @returns {Object} Complete mission object
 */
export function generateTransferMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 3-6 files
    const targetFileCount = randomInt(3, 6);

    // Randomly choose number of source file systems (1-3 for transfer)
    const sourceCount = Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : 3;

    const infra = generateNetworkInfrastructure(client, 'transfer', targetFileCount, {
        corrupted: false,
        secondNetwork: true,
        sourceCount
    });
    const objectives = generateTransferObjectives(infra);

    // Cap base mission objectives at 15 (extensions can exceed)
    if (objectives.length > 15) {
        objectives.splice(15);
    }

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, infra.totalDataBytes);

    const missionId = generateMissionId('transfer', client.id);

    // Build briefing context with target files
    const briefingContext = {
        ...arcContext,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes
    };

    return {
        missionId,
        title: `Data Transfer for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: sourceCount > 1 ? 'Hard' : 'Medium',
        missionType: 'transfer',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        targetFiles: infra.targetFiles,
        totalDataBytes: infra.totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'transfer', infra.networks, timeLimitMinutes, briefingContext),
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        // Arc fields
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null
    };
}

/**
 * Generate a restore-from-backup mission (delete corrupt files, then restore from backup)
 * Compound mission type: requires deleting corrupt files first, then copying from backup
 * @param {Object} client - Client object
 * @param {Object} options - { hasTimed, arcId, arcSequence, arcTotal, arcContext }
 * @returns {Object} Complete mission object
 */
export function generateRestoreFromBackupMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 3-6 files for restore missions
    const targetFileCount = randomInt(3, 6);

    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();
    const primaryIp = generateIpInSubnet(primarySubnet, 10);
    const backupIp = generateIpInSubnet(primarySubnet, 20);

    // Generate corrupt files for primary server
    const { files: corruptFiles, targetFiles } = generateFiles(client.industry, 'repair', targetFileCount, true);

    // Generate backup files (same names, not corrupt)
    const backupFiles = targetFiles.map(name => {
        const { size, sizeBytes } = generateFileSize(name, 'backup');
        return {
            name,
            size,
            sizeBytes,
            corrupted: false,
            targetFile: true
        };
    });

    const hostname = generateHostname(client, 'fileserver');
    const backupHostname = generateHostname(client, 'backup');

    const networks = [{
        networkId: primaryNetworkId,
        networkName: `${getSanitizedNamePrefix(client.name)}-Network`,
        address: primarySubnet,
        bandwidth: randomPick([25, 50, 75, 100]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems: [
            {
                id: `fs-${client.id}-${Date.now()}-primary`,
                ip: primaryIp,
                name: hostname,
                files: corruptFiles,
                accessible: true
            },
            {
                id: `fs-${client.id}-${Date.now()}-backup`,
                ip: backupIp,
                name: backupHostname,
                files: backupFiles,
                accessible: true
            }
        ]
    }];

    // Calculate total data size from backup files
    const totalDataBytes = backupFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find file servers`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResult: hostname
        },
        {
            id: 'obj-3',
            description: `Connect to ${hostname} (corrupted server)`,
            type: 'fileSystemConnection',
            target: primaryIp
        },
        {
            id: 'obj-4',
            description: `Delete ${targetFiles.length} corrupted files`,
            type: 'fileOperation',
            operation: 'delete',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length
        },
        {
            id: 'obj-5',
            description: `Connect to ${backupHostname} (backup server)`,
            type: 'fileSystemConnection',
            target: backupIp
        },
        {
            id: 'obj-6',
            description: `Copy ${targetFiles.length} files from backup`,
            type: 'fileOperation',
            operation: 'copy',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length
        },
        {
            id: 'obj-7',
            description: `Connect to ${hostname} to restore files`,
            type: 'fileSystemConnection',
            target: primaryIp
        },
        {
            id: 'obj-8',
            description: `Paste ${targetFiles.length} restored files`,
            type: 'fileOperation',
            operation: 'paste',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length,
            destination: primaryIp
        }
    ];

    // Cap base mission objectives at 15
    if (objectives.length > 15) {
        objectives.splice(15);
    }

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, totalDataBytes);

    const missionId = generateMissionId('restore', client.id);

    const briefingContext = {
        ...arcContext,
        targetFiles,
        totalDataBytes
    };

    return {
        missionId,
        title: `Data Restoration for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Hard',
        missionType: 'restore',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks,
        objectives,
        targetFiles,
        totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'restore', networks, timeLimitMinutes, briefingContext),
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null
    };
}

/**
 * Generate a repair-and-backup mission (repair files, then backup)
 * Compound mission type: repair corrupted files, then back them up
 * @param {Object} client - Client object
 * @param {Object} options - { hasTimed, arcId, arcSequence, arcTotal, arcContext }
 * @returns {Object} Complete mission object
 */
export function generateRepairAndBackupMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 4-7 files
    const targetFileCount = randomInt(4, 7);

    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();
    const primaryIp = generateIpInSubnet(primarySubnet, 10);
    const backupIp = generateIpInSubnet(primarySubnet, 20);

    // Generate corrupt files for primary server
    const { files: primaryFiles, targetFiles } = generateFiles(client.industry, 'repair', targetFileCount, true);

    const hostname = generateHostname(client, 'fileserver');
    const backupHostname = generateHostname(client, 'backup');

    // Calculate total data from target files
    const totalDataBytes = primaryFiles.filter(f => f.targetFile).reduce((sum, f) => sum + f.sizeBytes, 0);

    const networks = [{
        networkId: primaryNetworkId,
        networkName: `${getSanitizedNamePrefix(client.name)}-Network`,
        address: primarySubnet,
        bandwidth: randomPick([25, 50, 75, 100]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems: [
            {
                id: `fs-${client.id}-${Date.now()}-primary`,
                ip: primaryIp,
                name: hostname,
                files: primaryFiles,
                accessible: true
            },
            {
                id: `fs-${client.id}-${Date.now()}-backup`,
                ip: backupIp,
                name: backupHostname,
                files: [], // Empty backup destination
                accessible: true
            }
        ]
    }];

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find file servers`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResult: hostname
        },
        {
            id: 'obj-3',
            description: `Connect to ${hostname}`,
            type: 'fileSystemConnection',
            target: primaryIp
        },
        {
            id: 'obj-4',
            description: `Repair ${targetFiles.length} corrupted files`,
            type: 'fileOperation',
            operation: 'repair',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length
        },
        {
            id: 'obj-5',
            description: `Copy ${targetFiles.length} repaired files`,
            type: 'fileOperation',
            operation: 'copy',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length
        },
        {
            id: 'obj-6',
            description: `Connect to ${backupHostname} (backup)`,
            type: 'fileSystemConnection',
            target: backupIp
        },
        {
            id: 'obj-7',
            description: `Paste ${targetFiles.length} files to backup`,
            type: 'fileOperation',
            operation: 'paste',
            target: 'specific-files',
            targetFiles: targetFiles,
            count: targetFiles.length,
            destination: backupIp
        }
    ];

    // Cap base mission objectives at 15
    if (objectives.length > 15) {
        objectives.splice(15);
    }

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, totalDataBytes);

    const missionId = generateMissionId('repair-backup', client.id);

    const briefingContext = {
        ...arcContext,
        targetFiles,
        totalDataBytes
    };

    return {
        missionId,
        title: `Repair & Backup for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Hard',
        missionType: 'repair-backup',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks,
        objectives,
        targetFiles,
        totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'repair-backup', networks, timeLimitMinutes, briefingContext),
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null
    };
}

/**
 * Generate a standalone mission (random type)
 * @param {string} clientId - Client ID
 * @param {Object} options - { hasTimed }
 * @returns {Object|null} Mission object or null if client not found
 */
export function generateMission(clientId, options = {}) {
    const client = getClientById(clientId);
    if (!client) {
        console.warn(`Client not found: ${clientId}`);
        return null;
    }

    // Mission types with weights: repair 30%, backup 25%, transfer 20%, restore 15%, repair-backup 10%
    const missionTypes = ['repair', 'backup', 'transfer', 'restore', 'repair-backup'];
    const weights = [0.30, 0.25, 0.20, 0.15, 0.10];

    // Weighted random selection
    const random = Math.random();
    let cumulative = 0;
    let selectedType = 'repair';

    for (let i = 0; i < missionTypes.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
            selectedType = missionTypes[i];
            break;
        }
    }

    // Random chance of being timed (50%)
    const hasTimed = options.hasTimed !== undefined ? options.hasTimed : Math.random() < 0.5;

    switch (selectedType) {
        case 'repair':
            return generateRepairMission(client, { hasTimed });
        case 'backup':
            return generateBackupMission(client, { hasTimed });
        case 'transfer':
            return generateTransferMission(client, { hasTimed });
        case 'restore':
            return generateRestoreFromBackupMission(client, { hasTimed });
        case 'repair-backup':
            return generateRepairAndBackupMission(client, { hasTimed });
        default:
            return generateRepairMission(client, { hasTimed });
    }
}

/**
 * Generate a multi-mission arc from a storyline template
 * @param {Object} storyline - Storyline template from arcStorylines.js
 * @param {Array} clients - Array of clients (one per mission, or same client repeated)
 * @returns {Object} Arc object with all missions
 */
export function generateMissionArc(storyline, clients) {
    if (!storyline || !clients || clients.length < storyline.length) {
        console.warn('Invalid storyline or insufficient clients for arc');
        return null;
    }

    const arcId = generateArcId();
    const missions = [];
    let previousMissionId = null;

    for (let i = 0; i < storyline.length; i++) {
        const step = storyline.missionSequence[i];
        const client = clients[i];

        const arcContext = {
            arcSequence: i + 1,
            arcTotal: storyline.length,
            previousMissionId,
            referralText: step.referralText || null,
            narrativeTemplate: step.narrativeTemplate
        };

        const options = {
            hasTimed: step.hasTimed || false,
            arcId,
            arcSequence: i + 1,
            arcTotal: storyline.length,
            arcContext
        };

        let mission;
        switch (step.missionType) {
            case 'repair':
                mission = generateRepairMission(client, options);
                break;
            case 'backup':
                mission = generateBackupMission(client, options);
                break;
            case 'transfer':
                mission = generateTransferMission(client, options);
                break;
            case 'restore':
                mission = generateRestoreFromBackupMission(client, options);
                break;
            case 'repair-backup':
                mission = generateRepairAndBackupMission(client, options);
                break;
            default:
                mission = generateRepairMission(client, options);
        }

        // Update title to include arc info
        mission.title = `${storyline.name} (${i + 1}/${storyline.length}): ${mission.title}`;
        mission.arcName = storyline.name;

        missions.push(mission);
        previousMissionId = mission.missionId;
    }

    return {
        arcId,
        arcName: storyline.name,
        description: storyline.description,
        totalMissions: storyline.length,
        missions,
        // Only the first mission is initially visible
        visibleMissionIds: [missions[0].missionId],
        status: 'active'
    };
}

/**
 * Reset mission ID counter (useful for testing)
 */
export function resetMissionIdCounter() {
    missionIdCounter = 0;
}

export default {
    generateMission,
    generateRepairMission,
    generateBackupMission,
    generateTransferMission,
    generateRestoreFromBackupMission,
    generateRepairAndBackupMission,
    generateMissionArc,
    generateNetworkInfrastructure,
    calculateTimeLimit,
    calculatePayout,
    resetMissionIdCounter
};

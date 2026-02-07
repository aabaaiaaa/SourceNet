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
import { getVolumeNames } from '../data/deviceTemplates';

// Track generated mission IDs to ensure uniqueness
let missionIdCounter = 0;

/**
 * Network complexity configuration by difficulty
 * Controls how many NAR entries, devices, and multi-file-system chances
 */
export const networkComplexityConfig = {
    // NAR count by difficulty
    narCountRange: {
        Easy: { min: 2, max: 3 },
        Medium: { min: 2, max: 4 },
        Hard: { min: 3, max: 5 }
    },
    // Additional narrative devices per network (beyond file servers)
    narrativeDevicesPerNetwork: {
        Easy: { min: 1, max: 2 },
        Medium: { min: 2, max: 4 },
        Hard: { min: 3, max: 5 }
    },
    // Chance a device has multiple file systems (for investigation missions)
    multiFileSystemChance: {
        server: 0.4,    // 40% chance for servers
        database: 0.3   // 30% chance for DB servers
    }
};

/**
 * Corruption backstory patterns for pre-populating device logs
 * Used in investigation missions to help player identify correct volume
 */
const corruptionBackstoryPatterns = {
    diskFailure: [
        { type: 'system', action: 'disk_error', note: 'Bad sector detected', delayBefore: 120000 },
        { type: 'system', action: 'corruption_detected', note: 'CRC check failed - file integrity compromised', delayBefore: 0 }
    ],
    malware: [
        { type: 'remote', action: 'unauthorized_access', user: 'unknown', note: 'Connection from external IP', delayBefore: 300000 },
        { type: 'process', action: 'file_modified', note: 'File modified by external process', delayBefore: 60000 },
        { type: 'system', action: 'corruption_detected', note: 'File integrity check failed', delayBefore: 0 }
    ],
    networkIssue: [
        { type: 'remote', action: 'transfer_interrupted', note: 'Network timeout during file sync', delayBefore: 180000 },
        { type: 'system', action: 'corruption_detected', note: 'Incomplete write detected', delayBefore: 0 }
    ],
    powerLoss: [
        { type: 'system', action: 'unexpected_shutdown', note: 'Power failure detected', delayBefore: 240000 },
        { type: 'system', action: 'corruption_detected', note: 'Write operation interrupted', delayBefore: 0 }
    ]
};

/**
 * Deletion backstory patterns for recovery investigation missions
 */
const deletionBackstoryPatterns = {
    maliciousDeletion: [
        { type: 'remote', action: 'unauthorized_access', user: 'unknown', note: 'Suspicious login attempt', delayBefore: 600000 },
        { type: 'file', action: 'delete', user: 'unknown', note: 'Files deleted by external actor', delayBefore: 0 }
    ],
    accidentalDeletion: [
        { type: 'file', action: 'delete', note: 'Batch cleanup operation', delayBefore: 0 }
    ],
    ransomware: [
        { type: 'process', action: 'execute', note: 'Suspicious process started: cryptolocker.exe', delayBefore: 300000 },
        { type: 'file', action: 'encrypt', note: 'File encrypted', delayBefore: 60000 },
        { type: 'file', action: 'delete', note: 'Original file removed', delayBefore: 0 }
    ],
    cleanupGoneWrong: [
        { type: 'file', action: 'delete', user: 'admin', note: 'Maintenance cleanup script', delayBefore: 0 }
    ]
};

/**
 * Secure deletion backstory patterns (files that need secure removal)
 */
const secureDeleteBackstoryPatterns = {
    complianceFlag: [
        { type: 'system', action: 'compliance_flag', user: 'compliance-bot', note: 'Flagged for secure removal - audit compliance', delayBefore: 0 }
    ],
    piracy: [
        { type: 'remote', action: 'upload', user: 'anonymous@external', note: 'Unauthorized file upload detected', delayBefore: 300000 },
        { type: 'system', action: 'compliance_flag', user: 'content-scanner', note: 'Copyright violation detected - marked for removal', delayBefore: 0 }
    ],
    malwareDetection: [
        { type: 'process', action: 'execute', note: 'Suspicious process activity detected', delayBefore: 300000 },
        { type: 'system', action: 'malware_detected', note: 'Antivirus flagged file as malicious', delayBefore: 0 }
    ]
};

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

/**
 * Generate a network name based on client and optional suffix
 * For special location types (offshore, vessel, remote), includes region for immersion
 * @param {Object} client - Client object with location data
 * @param {string} suffix - Optional suffix (e.g., 'Backup')
 * @returns {string} Generated network name
 */
function generateNetworkName(client, suffix = 'Network') {
    const prefix = getSanitizedNamePrefix(client.name);
    const locationType = client.location?.type;
    const region = client.location?.region;

    // For special locations, include region in name for flavor
    if (region && ['offshore', 'vessel', 'remote'].includes(locationType)) {
        const sanitizedRegion = getSanitizedNamePrefix(region);
        return `${prefix}-${sanitizedRegion}-${suffix}`;
    }

    return `${prefix}-${suffix}`;
}

/**
 * Generate a server hostname based on client and purpose
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
    const {
        corrupted = false,
        secondNetwork = false,
        sameNetworkBackup = false,
        deviceConfigs = [{ fileSystemCount: 1 }]  // NEW: Array of device configs
    } = options;

    const networks = [];
    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();

    let allTargetFiles = [];
    let totalDataBytes = 0;
    const primaryFileSystems = [];
    const devices = [];

    // Generate devices and their file systems
    deviceConfigs.forEach((deviceConfig, deviceIndex) => {
        const deviceIp = generateIpInSubnet(primarySubnet, 10 + deviceIndex);
        const purpose = deviceConfigs.length > 1
            ? `fileserver-${String(deviceIndex + 1).padStart(2, '0')}`
            : 'fileserver';
        const hostname = generateHostname(client, purpose.replace('-', ''));

        const { fileSystemCount = 1 } = deviceConfig;

        // Get file system names for this device
        const fileSystemNames = fileSystemCount > 1
            ? getVolumeNames('server', fileSystemCount)
            : [''];

        // Generate file systems for this device
        for (let fsIndex = 0; fsIndex < fileSystemCount; fsIndex++) {
            const fsName = fileSystemNames[fsIndex] || '';
            const fsId = `fs-${client.id}-${Date.now()}-d${deviceIndex}-fs${fsIndex}`;

            // Distribute target files across all file systems
            const remainingTargets = targetFileCount - allTargetFiles.length;
            const totalRemainingFs = deviceConfigs
                .slice(deviceIndex)
                .reduce((sum, dc, idx) =>
                    idx === 0
                        ? sum + (dc.fileSystemCount - fsIndex)
                        : sum + dc.fileSystemCount
                , 0);
            const filesPerFs = Math.ceil(remainingTargets / totalRemainingFs);
            const thisFsTargets = Math.min(filesPerFs, remainingTargets);

            const { files, targetFiles } = generateFiles(
                client.industry,
                missionType,
                thisFsTargets,
                corrupted
            );

            allTargetFiles = [...allTargetFiles, ...targetFiles];
            totalDataBytes += files.filter(f => f.targetFile).reduce((sum, f) => sum + f.sizeBytes, 0);

            primaryFileSystems.push({
                id: fsId,
                ip: deviceIp,  // Same IP for all file systems on this device
                name: fsName ? `${hostname}${fsName}` : hostname,
                fileSystemName: fsName || undefined,
                files,
                accessible: true
            });
        }

        devices.push({
            ip: deviceIp,
            hostname,
            fileSystemCount
        });
    });

    networks.push({
        networkId: primaryNetworkId,
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems: primaryFileSystems
    });

    // Backup/destination server (if needed)
    let backupServerIp = null;
    let backupServerName = null;

    if (sameNetworkBackup) {
        backupServerIp = generateIpInSubnet(primarySubnet, 20);
        backupServerName = generateHostname(client, 'backup');

        networks[0].fileSystems.push({
            id: `fs-${client.id}-${Date.now()}-backup`,
            ip: backupServerIp,
            name: backupServerName,
            files: [],
            accessible: true
        });
    }

    // Secondary network (if needed)
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
            networkName: generateNetworkName(client, 'Backup'),
            address: secondarySubnet,
            bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
            revokeOnComplete: true,
            revokeReason: 'Mission access expired',
            fileSystems: [{
                id: `fs-${client.id}-${Date.now()}-dest`,
                ip: secondaryIp,
                name: secondaryHostname,
                files: [],
                accessible: true
            }]
        });
    }

    return {
        networks,
        primaryNetworkId,
        primaryIp: devices[0].ip,
        primaryFileSystems,
        devices,  // NEW: Array of device info
        secondaryNetworkId,
        secondaryIp,
        secondaryHostname,
        backupServerIp,
        backupServerName,
        useSameNetwork: sameNetworkBackup,
        targetFiles: allTargetFiles,
        totalDataBytes,
        hostname: networks[0].fileSystems[0].name.split('/')[0]  // Base hostname without file system suffix
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

    // Location-based multipliers - remote/offshore locations pay more due to difficulty/urgency
    const locationMultipliers = {
        'offshore': 1.25,    // Oil rigs, wind farms - remote and challenging
        'vessel': 1.20,      // Ships - at sea, limited connectivity
        'remote': 1.30,      // Antarctic stations, island outposts - extreme conditions
        'datacenter': 1.10,  // Large scale, critical infrastructure
        'facility': 1.0,     // Standard facility
        'warehouse': 1.0,    // Standard warehouse
        'office': 1.0        // Standard office
    };

    const tierMultiplier = tierMultipliers[client.clientType] || 1.0;
    const locationType = client.location?.type || 'office';
    const locationMultiplier = locationMultipliers[locationType] || 1.0;

    let basePayout = basePerObjective * objectiveCount * tierMultiplier * locationMultiplier;

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
    const { primaryNetworkId, networks, devices, targetFiles } = infra;

    // 1. Network scan objective (finds all devices)
    const deviceCount = devices.length;
    const deviceLabel = deviceCount === 1 ? 'the file server' : `${deviceCount} file servers`;

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Use Network Scanner to locate ${deviceLabel}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResults: devices.map(d => d.ip)  // Find all device IPs
        }
    ];

    // 2. Single repair objective across ALL devices and file systems
    const totalFileSystems = devices.reduce((sum, d) => sum + d.fileSystemCount, 0);
    const fsLabel = totalFileSystems > 1 ? ` across ${totalFileSystems} file systems` : '';

    objectives.push({
        id: 'obj-3',
        description: `Repair ${targetFiles.length} corrupted files${fsLabel}`,
        type: 'fileOperation',
        operation: 'repair',
        targetFiles
    });

    return objectives;
}

/**
 * Generate objectives for a backup mission
 * @param {Object} infra - Network infrastructure
 * @returns {Array} Array of objective objects
 */
function generateBackupObjectives(infra) {
    const { primaryNetworkId, networks, devices, targetFiles } = infra;

    // Same-network backup: simpler, fewer objectives
    if (infra.useSameNetwork) {
        const deviceCount = devices.length;
        const deviceLabel = deviceCount === 1 ? 'file server' : `${deviceCount} file servers`;
        const totalFileSystems = devices.reduce((sum, d) => sum + d.fileSystemCount, 0);
        const fsLabel = totalFileSystems > 1 ? ` from ${totalFileSystems} file systems` : '';

        const objectives = [
            {
                id: 'obj-1',
                description: `Connect to ${networks[0].networkName} network`,
                type: 'networkConnection',
                target: primaryNetworkId
            },
            {
                id: 'obj-2',
                description: `Use Network Scanner to locate ${deviceLabel}`,
                type: 'networkScan',
                target: primaryNetworkId,
                expectedResults: devices.map(d => d.ip)
            },
            {
                id: 'obj-3',
                description: `Copy ${targetFiles.length} files${fsLabel} to backup server`,
                type: 'fileOperation',
                operation: 'copy',
                targetFiles
            },
            {
                id: 'obj-4',
                description: `Paste ${targetFiles.length} files to ${infra.backupServerName}`,
                type: 'fileOperation',
                operation: 'paste',
                targetFiles,
                destination: infra.backupServerIp
            }
        ];

        return objectives;
    }

    // Different-network backup: more complex, requires connecting to second network
    const deviceCount = devices.length;
    const deviceLabel = deviceCount === 1 ? 'file server' : `${deviceCount} file servers`;
    const totalFileSystems = devices.reduce((sum, d) => sum + d.fileSystemCount, 0);
    const fsLabel = totalFileSystems > 1 ? ` from ${totalFileSystems} file systems` : '';

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Use Network Scanner to locate ${deviceLabel}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResults: devices.map(d => d.ip)
        },
        {
            id: 'obj-3',
            description: `Copy ${targetFiles.length} files${fsLabel}`,
            type: 'fileOperation',
            operation: 'copy',
            targetFiles
        },
        {
            id: 'obj-4',
            description: `Connect to ${infra.networks[1].networkName} network`,
            type: 'networkConnection',
            target: infra.secondaryNetworkId
        },
        {
            id: 'obj-5',
            description: `Use Network Scanner to find ${infra.secondaryHostname}`,
            type: 'networkScan',
            target: infra.secondaryNetworkId,
            expectedResult: infra.secondaryHostname
        },
        {
            id: 'obj-6',
            description: `Paste ${targetFiles.length} files to backup server`,
            type: 'fileOperation',
            operation: 'paste',
            targetFiles,
            destination: infra.secondaryIp
        }
    ];

    return objectives;
}

/**
 * Generate objectives for a transfer mission (two networks)
 * @param {Object} infra - Network infrastructure with two networks
 * @returns {Array} Array of objective objects
 */
function generateTransferObjectives(infra) {
    const { primaryNetworkId, networks, devices, targetFiles, secondaryNetworkId, secondaryIp, secondaryHostname } = infra;

    const deviceCount = devices.length;
    const deviceLabel = deviceCount === 1 ? 'file server' : `${deviceCount} file servers`;
    const totalFileSystems = devices.reduce((sum, d) => sum + d.fileSystemCount, 0);
    const fsLabel = totalFileSystems > 1 ? ` from ${totalFileSystems} file systems` : '';

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Use Network Scanner to locate ${deviceLabel}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResults: devices.map(d => d.ip)
        },
        {
            id: 'obj-3',
            description: `Copy ${targetFiles.length} files${fsLabel}`,
            type: 'fileOperation',
            operation: 'copy',
            targetFiles
        },
        {
            id: 'obj-4',
            description: `Connect to ${networks[1].networkName} network`,
            type: 'networkConnection',
            target: secondaryNetworkId
        },
        {
            id: 'obj-5',
            description: `Use Network Scanner to find ${secondaryHostname}`,
            type: 'networkScan',
            target: secondaryNetworkId,
            expectedResult: secondaryHostname
        },
        {
            id: 'obj-6',
            description: `Paste ${targetFiles.length} files to destination`,
            type: 'fileOperation',
            operation: 'paste',
            targetFiles,
            destination: secondaryIp
        }
    ];

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

    // Location-specific opening phrases
    const locationOpenings = {
        offshore: [
            `Our offshore platform has encountered an issue that requires immediate remote assistance.`,
            `Due to the remote nature of our offshore operations, we need specialized technical support.`,
            `Conditions at our offshore facility make this particularly urgent.`
        ],
        vessel: [
            `Our vessel's systems require urgent attention while we're at sea.`,
            `With limited connectivity from our current position, we need efficient remote assistance.`,
            `Our ship's IT infrastructure needs immediate attention.`
        ],
        remote: [
            `Given our remote location, finding qualified local support isn't feasible.`,
            `Our isolated facility relies heavily on remote technical assistance.`,
            `The extreme conditions at our station make remote support essential.`
        ]
    };

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

    // Add location-specific opening for special locations
    const locationType = client.location?.type;
    if (locationType && locationOpenings[locationType]) {
        body += randomPick(locationOpenings[locationType]) + ' ';
    }

    body += randomPick(briefingTemplates[missionType] || briefingTemplates.repair);

    // Add location context for immersion
    if (client.location) {
        const { region, city, country } = client.location;
        if (locationType === 'offshore' || locationType === 'vessel') {
            body += `\n\n📍 Location: ${region}`;
        } else if (city && country && country !== 'USA') {
            body += `\n\n📍 Location: ${city}, ${country}`;
        } else if (region && ['remote'].includes(locationType)) {
            body += `\n\n📍 Location: ${region}`;
        }
    }

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
 * Includes message variants for different failure reasons (deadline, incomplete, filesDeleted)
 * The actual message used is selected at failure time based on the failureReason
 * @param {Object} client - Client object
 * @param {number} basePayout - Mission payout
 * @returns {Object} Failure consequences object with messageVariants
 */
function generateFailureConsequences(client, basePayout) {
    const failureMessages = {
        deadline: [
            `Unfortunately, you failed to complete the task within the required timeframe. We've had to find alternative solutions.`,
            `The deadline has passed and we can no longer use your services for this task. This is very disappointing.`,
            `Time ran out before the work was completed. We expected better from someone with your reputation.`
        ],
        incomplete: [
            `We're disappointed that you were unable to complete the assigned task. We may need to reconsider future engagements.`,
            `The mission was not completed as requested. This has caused significant inconvenience to our operations.`
        ],
        filesDeleted: [
            `Critical files required for this task have been deleted. We cannot proceed and must terminate this engagement immediately.`,
            `The files we needed you to work with no longer exist. Your access has been revoked effective immediately.`,
            `We've detected that essential mission files have been removed from our systems. This mission cannot be completed.`
        ]
    };

    // Generate a message variant for each failure reason type
    const messageVariants = {};
    for (const [reason, templates] of Object.entries(failureMessages)) {
        const messageBody = `Dear {username},\n\n${randomPick(templates)}\n\nSincerely,\n{clientName}`;
        messageVariants[reason] = {
            id: `msg-failure-${reason}-${Date.now()}`,
            from: client.name,
            fromId: client.id,
            fromName: client.name,
            subject: 'Mission Failed',
            body: messageBody,
            attachments: [],
            delay: 2000
        };
    }

    return {
        credits: -Math.floor(basePayout * 0.25),
        reputation: -1,
        // Default message for backwards compatibility
        messages: [messageVariants.incomplete],
        // All message variants for dynamic selection at failure time
        messageVariants
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

    // Determine difficulty based on file count
    const difficulty = targetFileCount <= 5 ? 'Easy' : targetFileCount <= 7 ? 'Medium' : 'Hard';

    // Generate varied infrastructure based on difficulty
    let deviceConfigs;
    const roll = Math.random();

    if (difficulty === 'Easy') {
        // Easy: Simple configurations
        deviceConfigs = roll < 0.5
            ? [{ fileSystemCount: 1 }]  // 1 device, 1 file system
            : [{ fileSystemCount: randomInt(2, 3) }];  // 1 device, 2-3 file systems
    } else if (difficulty === 'Medium') {
        // Medium: More variety
        if (roll < 0.3) {
            deviceConfigs = [{ fileSystemCount: randomInt(3, 5) }];  // 1 device, 3-5 file systems
        } else if (roll < 0.6) {
            deviceConfigs = [
                { fileSystemCount: randomInt(1, 3) },
                { fileSystemCount: randomInt(1, 3) }
            ];  // 2 devices with varied file systems
        } else {
            deviceConfigs = [
                { fileSystemCount: 1 },
                { fileSystemCount: 1 },
                { fileSystemCount: randomInt(1, 2) }
            ];  // 3 devices, mixed
        }
    } else {  // Hard
        // Hard: Complex configurations
        if (roll < 0.25) {
            deviceConfigs = [{ fileSystemCount: randomInt(5, 8) }];  // 1 device, many file systems
        } else if (roll < 0.5) {
            deviceConfigs = Array(randomInt(2, 4)).fill(null).map(() => ({
                fileSystemCount: randomInt(2, 4)
            }));  // 2-4 devices, each with 2-4 file systems
        } else if (roll < 0.75) {
            deviceConfigs = Array(randomInt(3, 5)).fill(null).map(() => ({
                fileSystemCount: randomInt(1, 2)
            }));  // 3-5 devices, 1-2 file systems each
        } else {
            deviceConfigs = [
                { fileSystemCount: randomInt(3, 5) },
                { fileSystemCount: 1 },
                { fileSystemCount: randomInt(1, 3) }
            ];  // Mixed: one big device, others smaller
        }
    }

    const infra = generateNetworkInfrastructure(client, 'repair', targetFileCount, {
        corrupted: true,
        deviceConfigs
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
        difficulty,
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
            failure: generateFailureConsequences(client, basePayout)
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

    // Generate varied device/file system configurations
    let deviceConfigs;
    const roll = Math.random();

    if (roll < 0.4) {
        deviceConfigs = [{ fileSystemCount: 1 }];  // Simple: 1 device, 1 file system
    } else if (roll < 0.7) {
        deviceConfigs = [{ fileSystemCount: randomInt(2, 4) }];  // 1 device, multiple file systems
    } else {
        deviceConfigs = Array(randomInt(2, 3)).fill(null).map(() => ({
            fileSystemCount: randomInt(1, 2)
        }));  // 2-3 devices
    }

    const infra = generateNetworkInfrastructure(client, 'backup', targetFileCount, {
        corrupted: false,
        secondNetwork: !useSameNetwork,
        sameNetworkBackup: useSameNetwork,
        deviceConfigs
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
            failure: generateFailureConsequences(client, basePayout)
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

    // Generate varied device/file system configurations
    let deviceConfigs;
    const roll = Math.random();

    if (roll < 0.4) {
        deviceConfigs = [{ fileSystemCount: 1 }];  // Simple: 1 device, 1 file system
    } else if (roll < 0.7) {
        deviceConfigs = [{ fileSystemCount: randomInt(2, 4) }];  // 1 device, multiple file systems
    } else {
        deviceConfigs = Array(randomInt(2, 3)).fill(null).map(() => ({
            fileSystemCount: randomInt(1, 2)
        }));  // 2-3 devices
    }

    const infra = generateNetworkInfrastructure(client, 'transfer', targetFileCount, {
        corrupted: false,
        secondNetwork: true,
        deviceConfigs
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
        difficulty: infra.devices.length > 1 ? 'Hard' : 'Medium',
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
            failure: generateFailureConsequences(client, basePayout)
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
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
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
            description: `Use Network Scanner to find file servers`,
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
            failure: generateFailureConsequences(client, basePayout)
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
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
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
            description: `Use Network Scanner to find file servers`,
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
            failure: generateFailureConsequences(client, basePayout)
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

/**
 * Generate pre-populated activity logs for a file system
 * Used in investigation missions to help player identify correct volume
 * @param {Array} files - Files that need activity logs
 * @param {string} pattern - Backstory pattern type (diskFailure, malware, etc.)
 * @param {Date} baseTime - Base time for log entries (corruption/deletion time)
 * @returns {Array} Array of log entries
 */
function generateActivityLogs(files, pattern, baseTime, fileSystemId) {
    const logs = [];

    // Determine which pattern set to use
    let patterns;
    let patternKey;

    if (pattern.includes('delete') || pattern.includes('Delete')) {
        patterns = deletionBackstoryPatterns;
        patternKey = Object.keys(patterns)[Math.floor(Math.random() * Object.keys(patterns).length)];
    } else if (pattern === 'compliance' || pattern === 'piracy' || pattern === 'malware') {
        // Secure deletion variants - map to specific backstory patterns
        patterns = secureDeleteBackstoryPatterns;
        if (pattern === 'compliance') {
            patternKey = 'complianceFlag';
        } else if (pattern === 'piracy') {
            patternKey = 'piracy';
        } else if (pattern === 'malware') {
            patternKey = 'malwareDetection';
        }
    } else if (pattern.includes('secure') || pattern.includes('Secure')) {
        patterns = secureDeleteBackstoryPatterns;
        patternKey = Object.keys(patterns)[Math.floor(Math.random() * Object.keys(patterns).length)];
    } else {
        patterns = corruptionBackstoryPatterns;
        patternKey = Object.keys(patterns)[Math.floor(Math.random() * Object.keys(patterns).length)];
    }

    const backstory = patterns[patternKey] || patterns[Object.keys(patterns)[0]];

    files.forEach(file => {
        // Generate backstory events for this file
        let currentTime = new Date(baseTime.getTime());

        backstory.forEach(event => {
            currentTime = new Date(currentTime.getTime() - event.delayBefore);
            logs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: currentTime.toISOString(),
                type: event.type,
                action: event.action,
                user: event.user || 'SYSTEM',
                fileName: file.name,
                note: event.note,
                fileSystemId
            });
        });
    });

    // Sort logs by timestamp (oldest first)
    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return logs;
}

/**
 * Generate decoy files for non-target file systems
 * These are legitimate-looking files but not related to the mission
 * @param {string} industry - Client industry
 * @param {number} count - Number of decoy files
 * @returns {Array} Array of file objects
 */
function generateDecoyFiles(industry, count = 3) {
    const decoyTemplates = {
        banking: ['readme.txt', 'system_config.cfg', 'old_backup_2019.dat', 'temp_cache.tmp', 'archive_index.log'],
        healthcare: ['system_readme.txt', 'calibration_data.cfg', 'archive_2018.dat', 'temp.tmp', 'maintenance_log.log'],
        government: ['policy_manual.pdf', 'config_backup.cfg', 'archive_records.dat', 'session_temp.tmp', 'audit_history.log'],
        corporate: ['onboarding_guide.pdf', 'network_config.cfg', 'legacy_data.dat', 'cache.tmp', 'system_events.log'],
        utilities: ['safety_protocols.pdf', 'sensor_config.cfg', 'historical_data.dat', 'buffer.tmp', 'maintenance_history.log'],
        shipping: ['driver_handbook.pdf', 'route_config.cfg', 'archive_manifests.dat', 'gps_cache.tmp', 'delivery_history.log'],
        emergency: ['protocol_manual.pdf', 'radio_config.cfg', 'call_archive.dat', 'dispatch_cache.tmp', 'incident_history.log'],
        nonprofit: ['volunteer_guide.pdf', 'settings.cfg', 'historical_donors.dat', 'temp_uploads.tmp', 'event_history.log'],
        cultural: ['visitor_guide.pdf', 'display_config.cfg', 'old_catalog.dat', 'media_cache.tmp', 'loan_history.log']
    };

    const templates = decoyTemplates[industry] || decoyTemplates.corporate;
    const files = [];
    const usedNames = new Set();

    while (files.length < count && files.length < templates.length) {
        const name = templates[Math.floor(Math.random() * templates.length)];
        if (!usedNames.has(name)) {
            usedNames.add(name);
            const { size, sizeBytes } = generateFileSize(name, 'backup');
            files.push({
                name,
                size,
                sizeBytes,
                corrupted: false,
                targetFile: false
            });
        }
    }

    return files;
}

/**
 * Generate an investigation repair mission
 * Player must use Log Viewer to identify which file system contains corrupted files
 * @param {Object} client - Client object
 * @param {Object} options - Mission options
 * @returns {Object} Complete mission object
 */
export function generateInvestigationRepairMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 3-5 files for investigation missions
    const targetFileCount = randomInt(3, 5);

    // Create needle in haystack - lots of devices OR lots of file systems OR both
    const roll = Math.random();
    let deviceConfigs;
    let totalFileSystemCount;

    if (roll < 0.3) {
        // Pattern A: Many file systems on single device
        const fsCount = randomInt(10, 15);
        deviceConfigs = [{ fileSystemCount: fsCount }];
        totalFileSystemCount = fsCount;
    } else if (roll < 0.6) {
        // Pattern B: Many devices with 1-2 file systems each
        const deviceCount = randomInt(8, 12);
        deviceConfigs = Array(deviceCount).fill(null).map(() => ({
            fileSystemCount: randomInt(1, 2)
        }));
        totalFileSystemCount = deviceConfigs.reduce((sum, dc) => sum + dc.fileSystemCount, 0);
    } else {
        // Pattern C: Mix - several devices with varied file system counts
        const deviceCount = randomInt(3, 6);
        deviceConfigs = Array(deviceCount).fill(null).map(() => ({
            fileSystemCount: randomInt(2, 5)
        }));
        totalFileSystemCount = deviceConfigs.reduce((sum, dc) => sum + dc.fileSystemCount, 0);
    }

    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();

    // One file system is the target (has corrupted files with recent activity)
    const targetFsIndex = randomInt(0, totalFileSystemCount - 1);

    const fileSystems = [];
    const devices = [];
    let targetFileSystemId = null;
    let allTargetFiles = [];
    let totalDataBytes = 0;
    let targetDeviceIp = null;

    // Base time for corruption events (a few hours before mission)
    const corruptionTime = new Date(Date.now() - randomInt(2, 8) * 60 * 60 * 1000);

    let globalFsIndex = 0;

    deviceConfigs.forEach((deviceConfig, deviceIndex) => {
        const deviceIp = generateIpInSubnet(primarySubnet, 10 + deviceIndex);
        const purpose = deviceConfigs.length > 1
            ? `fileserver-${String(deviceIndex + 1).padStart(2, '0')}`
            : 'server';
        const hostname = generateHostname(client, purpose.replace('-', ''));

        const { fileSystemCount = 1 } = deviceConfig;
        const volumeNames = fileSystemCount > 1 ? getVolumeNames('server', fileSystemCount) : [''];

        for (let fsIndex = 0; fsIndex < fileSystemCount; fsIndex++) {
            const fsId = `fs-${client.id}-${Date.now()}-d${deviceIndex}-fs${fsIndex}`;
            const isTargetFs = (globalFsIndex === targetFsIndex);
            const volumeName = volumeNames[fsIndex] || '';

            let files;
            let activityLogs = [];

            if (isTargetFs) {
                // Generate target files with corruption
                const result = generateFiles(client.industry, 'repair', targetFileCount, true);
                files = result.files;
                allTargetFiles = result.targetFiles;
                totalDataBytes = files.filter(f => f.targetFile).reduce((sum, f) => sum + f.sizeBytes, 0);
                targetFileSystemId = fsId;
                targetDeviceIp = deviceIp;

                // Generate activity logs showing corruption
                activityLogs = generateActivityLogs(
                    files.filter(f => f.corrupted),
                    'corruption',
                    corruptionTime,
                    fsId
                );
            } else {
                // Generate decoy files (no corruption, old activity or none)
                files = generateDecoyFiles(client.industry, randomInt(2, 4));
            }

            fileSystems.push({
                id: fsId,
                ip: deviceIp,
                name: volumeName ? `${hostname}${volumeName}` : hostname,
                fileSystemName: volumeName || undefined,
                files,
                accessible: true,
                logs: activityLogs
            });

            globalFsIndex++;
        }

        devices.push({
            ip: deviceIp,
            hostname,
            fileSystemCount
        });
    });

    const networks = [{
        networkId: primaryNetworkId,
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems
    }];

    // Objectives - note that briefing does NOT specify which file system
    const deviceLabel = devices.length === 1 ? 'file server' : `${devices.length} file servers`;
    const fsLabel = totalFileSystemCount > 1 ? ` across ${totalFileSystemCount} file systems` : '';

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Use Network Scanner to find ${deviceLabel}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResults: devices.map(d => d.ip)
        },
        {
            id: 'obj-3',
            description: `Use Log Viewer to identify which file system has corrupted files${fsLabel}`,
            type: 'investigation',
            correctFileSystemId: targetFileSystemId,
            target: targetDeviceIp
        },
        {
            id: 'obj-4',
            description: `Connect to the correct file system`,
            type: 'fileSystemConnection',
            target: targetFileSystemId
        },
        {
            id: 'obj-5',
            description: `Repair ${allTargetFiles.length} corrupted files`,
            type: 'fileOperation',
            operation: 'repair',
            targetFiles: allTargetFiles.map(f => f.name)
        }
    ];

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, totalDataBytes);

    const missionId = generateMissionId('investigation-repair', client.id);

    const briefingContext = {
        ...arcContext,
        targetFiles: allTargetFiles,
        totalDataBytes
    };

    // Generate briefing that doesn't reveal which volume
    const briefingBody = generateInvestigationBriefing(client, 'repair', networks, timeLimitMinutes, briefingContext);

    return {
        missionId,
        title: `Investigation: File Repair for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Hard',
        missionType: 'investigation-repair',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks,
        objectives,
        targetFiles: allTargetFiles,
        totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager', 'log-viewer'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout)
        },
        timeLimitMinutes,
        briefingMessage: briefingBody,
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null,
        // Investigation-specific fields
        isInvestigation: true,
        targetFileSystemId,
        targetDeviceIp,
        devices,
        fileSystemCount: totalFileSystemCount
    };
}

/**
 * Generate an investigation recovery mission
 * Player must use Log Viewer to find where files were deleted, then use Data Recovery Tool
 * @param {Object} client - Client object
 * @param {Object} options - Mission options
 * @returns {Object} Complete mission object
 */
export function generateInvestigationRecoveryMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Target file count: 3-5 files for recovery
    const targetFileCount = randomInt(3, 5);

    // Create needle in haystack - lots of devices OR lots of file systems OR both
    const roll = Math.random();
    let deviceConfigs;
    let totalFileSystemCount;

    if (roll < 0.3) {
        // Pattern A: Many file systems on single device
        const fsCount = randomInt(10, 15);
        deviceConfigs = [{ fileSystemCount: fsCount }];
        totalFileSystemCount = fsCount;
    } else if (roll < 0.6) {
        // Pattern B: Many devices with 1-2 file systems each
        const deviceCount = randomInt(8, 12);
        deviceConfigs = Array(deviceCount).fill(null).map(() => ({
            fileSystemCount: randomInt(1, 2)
        }));
        totalFileSystemCount = deviceConfigs.reduce((sum, dc) => sum + dc.fileSystemCount, 0);
    } else {
        // Pattern C: Mix - several devices with varied file system counts
        const deviceCount = randomInt(3, 6);
        deviceConfigs = Array(deviceCount).fill(null).map(() => ({
            fileSystemCount: randomInt(2, 5)
        }));
        totalFileSystemCount = deviceConfigs.reduce((sum, dc) => sum + dc.fileSystemCount, 0);
    }

    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();

    // One file system is the target (has deleted files with deletion logs)
    const targetFsIndex = randomInt(0, totalFileSystemCount - 1);

    const fileSystems = [];
    const devices = [];
    let targetFileSystemId = null;
    let allTargetFiles = [];
    let totalDataBytes = 0;
    let targetDeviceIp = null;

    // Base time for deletion events
    const deletionTime = new Date(Date.now() - randomInt(1, 4) * 60 * 60 * 1000);

    let globalFsIndex = 0;

    deviceConfigs.forEach((deviceConfig, deviceIndex) => {
        const deviceIp = generateIpInSubnet(primarySubnet, 10 + deviceIndex);
        const purpose = deviceConfigs.length > 1
            ? `fileserver-${String(deviceIndex + 1).padStart(2, '0')}`
            : 'server';
        const hostname = generateHostname(client, purpose.replace('-', ''));

        const { fileSystemCount = 1 } = deviceConfig;
        const volumeNames = fileSystemCount > 1 ? getVolumeNames('server', fileSystemCount) : [''];

        for (let fsIndex = 0; fsIndex < fileSystemCount; fsIndex++) {
            const fsId = `fs-${client.id}-${Date.now()}-d${deviceIndex}-fs${fsIndex}`;
            const isTargetFs = (globalFsIndex === targetFsIndex);
            const volumeName = volumeNames[fsIndex] || '';

            let files;
            let activityLogs = [];

            if (isTargetFs) {
                // Generate target files marked as deleted
                const result = generateFiles(client.industry, 'backup', targetFileCount, false);
                files = result.files.map(f => ({
                    ...f,
                    status: f.targetFile ? 'deleted' : (f.status || 'normal')
                }));
                allTargetFiles = result.targetFiles;
                totalDataBytes = files.filter(f => f.targetFile).reduce((sum, f) => sum + f.sizeBytes, 0);
                targetFileSystemId = fsId;
                targetDeviceIp = deviceIp;

                // Generate activity logs showing deletion
                activityLogs = generateActivityLogs(
                    files.filter(f => f.status === 'deleted'),
                    'deletion',
                    deletionTime,
                    fsId
                );
            } else {
                // Generate decoy files (no deleted files, old activity)
                files = generateDecoyFiles(client.industry, randomInt(2, 4));
            }

            fileSystems.push({
                id: fsId,
                ip: deviceIp,
                name: volumeName ? `${hostname}${volumeName}` : hostname,
                fileSystemName: volumeName || undefined,
                files,
                accessible: true,
                logs: activityLogs
            });

            globalFsIndex++;
        }

        devices.push({
            ip: deviceIp,
            hostname,
            fileSystemCount
        });
    });

    const networks = [{
        networkId: primaryNetworkId,
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems
    }];

    const deviceLabel = devices.length === 1 ? 'file server' : `${devices.length} file servers`;
    const fsLabel = totalFileSystemCount > 1 ? ` across ${totalFileSystemCount} file systems` : '';

    const objectives = [
        {
            id: 'obj-1',
            description: `Connect to ${networks[0].networkName} network`,
            type: 'networkConnection',
            target: primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Use Network Scanner to find ${deviceLabel}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResults: devices.map(d => d.ip)
        },
        {
            id: 'obj-3',
            description: `Use Log Viewer to identify which file system had files deleted${fsLabel}`,
            type: 'investigation',
            correctFileSystemId: targetFileSystemId,
            target: targetDeviceIp
        },
        {
            id: 'obj-4',
            description: `Connect Data Recovery Tool to the correct file system`,
            type: 'fileSystemConnection',
            app: 'dataRecoveryTool',
            target: targetFileSystemId
        },
        {
            id: 'obj-5',
            description: `Scan for deleted files using Data Recovery Tool`,
            type: 'dataRecoveryScan',
            target: targetFileSystemId
        },
        {
            id: 'obj-6',
            description: `Recover ${allTargetFiles.length} deleted files`,
            type: 'fileRecovery',
            targetFiles: allTargetFiles.map(f => f.name)
        }
    ];

    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, totalDataBytes);

    const missionId = generateMissionId('investigation-recovery', client.id);

    const briefingContext = {
        ...arcContext,
        targetFiles: allTargetFiles,
        totalDataBytes
    };

    const briefingBody = generateInvestigationBriefing(client, 'recovery', networks, timeLimitMinutes, briefingContext);

    return {
        missionId,
        title: `Investigation: Data Recovery for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Hard',
        missionType: 'investigation-recovery',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks,
        objectives,
        targetFiles: allTargetFiles,
        totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager', 'log-viewer', 'data-recovery-tool'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout)
        },
        timeLimitMinutes,
        briefingMessage: briefingBody,
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null,
        isInvestigation: true,
        targetFileSystemId,
        targetDeviceIp,
        devices,
        fileSystemCount: totalFileSystemCount
    };
}

/**
 * Generate a secure deletion mission
 * Player must locate and securely delete unwanted files (malware, piracy, compliance)
 * @param {Object} client - Client object
 * @param {Object} options - Mission options
 * @returns {Object} Complete mission object
 */
export function generateSecureDeletionMission(client, options = {}) {
    const { hasTimed = false, arcId = null, arcSequence = null, arcTotal = null, arcContext = {} } = options;

    // Choose a narrative variant
    const variants = ['compliance', 'piracy', 'malware'];
    const variant = variants[Math.floor(Math.random() * variants.length)];

    // Target file count: 2-4 files to securely delete
    const targetFileCount = randomInt(2, 4);

    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();
    const deviceIp = generateIpInSubnet(primarySubnet, 10);
    const hostname = generateHostname(client, 'server');

    // Generate files to delete based on variant
    const filesToDelete = generateMaliciousFiles(variant, targetFileCount);
    const targetFileNames = filesToDelete.map(f => f.name);

    // Add some normal files too
    const normalFiles = generateDecoyFiles(client.industry, randomInt(2, 4));
    const allFiles = [...normalFiles, ...filesToDelete];

    const targetFileSystemId = `fs-${client.id}-${Date.now()}`;

    // Generate activity logs showing the problematic files
    // Pass variant name to select matching backstory pattern
    const flagTime = new Date(Date.now() - randomInt(1, 4) * 60 * 60 * 1000);
    const activityLogs = generateActivityLogs(filesToDelete, variant, flagTime, targetFileSystemId);
    const fileSystems = [{
        id: targetFileSystemId,
        ip: deviceIp,
        name: hostname,
        files: allFiles,
        accessible: true,
        logs: activityLogs
    }];

    const networks = [{
        networkId: primaryNetworkId,
        networkName: generateNetworkName(client),
        address: primarySubnet,
        bandwidth: randomPick([500, 750, 1000, 1500, 2000]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems
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
            description: `Use Network Scanner to find ${hostname}`,
            type: 'networkScan',
            target: primaryNetworkId,
            expectedResult: hostname
        },
        {
            id: 'obj-3',
            description: `Use Log Viewer to identify flagged files`,
            type: 'investigation',
            correctFileSystemId: targetFileSystemId
        },
        {
            id: 'obj-4',
            description: `Connect Data Recovery Tool to ${hostname}`,
            type: 'fileSystemConnection',
            app: 'dataRecoveryTool',
            target: targetFileSystemId
        },
        {
            id: 'obj-5',
            description: `Securely delete ${targetFileCount} ${variant === 'malware' ? 'malicious' : variant === 'piracy' ? 'pirated' : 'flagged'} files`,
            type: 'secureDelete',
            targetFiles: targetFileNames,
            count: targetFileCount
        }
    ];

    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const totalDataBytes = filesToDelete.reduce((sum, f) => sum + f.sizeBytes, 0);
    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client, totalDataBytes);

    const missionId = generateMissionId('secure-deletion', client.id);

    const briefingContext = {
        ...arcContext,
        targetFiles: targetFileNames,
        totalDataBytes,
        variant
    };

    const briefingBody = generateSecureDeletionBriefing(client, variant, networks, timeLimitMinutes, briefingContext);

    return {
        missionId,
        title: `Secure Deletion: ${variant === 'malware' ? 'Malware Removal' : variant === 'piracy' ? 'Unauthorized Content' : 'Compliance Cleanup'} for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Medium',
        missionType: 'secure-deletion',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks,
        objectives,
        targetFiles: targetFileNames,
        totalDataBytes,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'log-viewer', 'data-recovery-tool'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout)
        },
        timeLimitMinutes,
        briefingMessage: briefingBody,
        isProcedurallyGenerated: true,
        generatedAt: new Date().toISOString(),
        arcId,
        arcSequence,
        arcTotal,
        requiresCompletedMission: arcSequence > 1 ? arcContext.previousMissionId : null,
        secureDeleteVariant: variant,
        isInvestigation: true,
        targetFileSystemId,
        deviceIp
    };
}

/**
 * Generate malicious/unwanted files for secure deletion missions
 * @param {string} variant - Type of files (compliance, piracy, malware)
 * @param {number} count - Number of files to generate
 * @returns {Array} Array of file objects
 */
function generateMaliciousFiles(variant, count) {
    const fileTemplates = {
        compliance: [
            'unencrypted_customer_data.csv',
            'personal_info_export.xlsx',
            'old_passwords_backup.txt',
            'credit_card_batch.dat',
            'ssn_records_temp.csv'
        ],
        piracy: [
            'movie_2020_pirated.iso',
            'software_crack.zip',
            'premium_content_rip.tar',
            'streaming_download.mp4',
            'bootleg_album.zip'
        ],
        malware: [
            'cryptolocker.exe',
            'trojan_dropper.dll',
            'ransomware_payload.bin',
            'keylogger_service.exe',
            'backdoor_client.dat'
        ]
    };

    const templates = fileTemplates[variant] || fileTemplates.malware;
    const files = [];
    const usedNames = new Set();

    while (files.length < count && files.length < templates.length) {
        const name = templates[Math.floor(Math.random() * templates.length)];
        if (!usedNames.has(name)) {
            usedNames.add(name);
            const sizeBytes = randomInt(1024 * 1024, 500 * 1024 * 1024); // 1MB - 500MB
            const size = sizeBytes >= 1024 * 1024
                ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                : `${(sizeBytes / 1024).toFixed(1)} KB`;

            files.push({
                name,
                size,
                sizeBytes,
                corrupted: false,
                targetFile: true,
                flagged: true // For secure deletion missions
            });
        }
    }

    return files;
}

/**
 * Generate investigation briefing message (doesn't reveal which volume)
 * @param {Object} client - Client object
 * @param {string} investigationType - 'repair' or 'recovery'
 * @param {Array} networks - Network definitions
 * @param {number|null} timeLimitMinutes - Time limit
 * @param {Object} context - Additional context
 * @returns {Object} Message object
 */
function generateInvestigationBriefing(client, investigationType, networks, timeLimitMinutes, context = {}) {
    const { arcSequence, arcTotal, referralText, targetFiles = [], totalDataBytes = 0 } = context;

    const templates = {
        repair: [
            `We've detected corruption on one of our file server's volumes. Unfortunately, we're not sure which volume is affected. We need you to investigate and repair the damaged files.`,
            `Our monitoring systems flagged file integrity issues on a server, but the specific volume wasn't identified. Please use your tools to locate and repair the corrupted data.`,
            `There's been corruption reported on our main server. The IT team couldn't pinpoint exactly where. We need a specialist to investigate and fix this.`
        ],
        recovery: [
            `Critical files were accidentally deleted from our server. We're not certain which volume they were on. Please investigate and recover the lost data.`,
            `An employee reported missing files but couldn't remember which volume they were stored on. We need you to locate and restore them.`,
            `Our backup verification showed missing files on the server, but the exact location is unknown. Please investigate and recover what you can.`
        ]
    };

    let body = 'Dear {username},\n\n';
    body += referralText ? `${referralText}\n\n` : '';
    body += randomPick(templates[investigationType] || templates.repair);

    body += `\n\n⚠️ INVESTIGATION REQUIRED: Use the Log Viewer to examine device activity and identify which volume contains the affected files.`;

    if (targetFiles.length > 0) {
        body += `\n\n📁 Files to ${investigationType === 'repair' ? 'repair' : 'recover'}:`;
        targetFiles.forEach(file => {
            body += `\n• ${file}`;
        });

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

    body += `\n\nAttached are the network credentials you'll need.`;

    if (arcSequence && arcTotal) {
        body += `\n\n[Mission ${arcSequence} of ${arcTotal}]`;
    }

    body += `\n\nSincerely,\n{clientName}`;

    const uniqueId = `msg-briefing-investigation-${client.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
        id: uniqueId,
        from: client.name,
        fromId: client.id,
        fromName: client.name,
        subject: `Mission Briefing: ${investigationType === 'repair' ? 'File Repair Investigation' : 'Data Recovery Investigation'}`,
        body,
        attachments: generateNarAttachments(networks),
        read: false,
        timestamp: new Date().toISOString()
    };
}

/**
 * Generate secure deletion briefing message
 * @param {Object} client - Client object
 * @param {string} variant - 'compliance', 'piracy', or 'malware'
 * @param {Array} networks - Network definitions
 * @param {number|null} timeLimitMinutes - Time limit
 * @param {Object} context - Additional context
 * @returns {Object} Message object
 */
function generateSecureDeletionBriefing(client, variant, networks, timeLimitMinutes, context = {}) {
    const { arcSequence, arcTotal, referralText, targetFiles = [] } = context;

    const templates = {
        compliance: [
            `Our compliance team has flagged several files that need to be securely removed before our upcoming audit. These files contain sensitive data that should not be stored on this server.`,
            `We're preparing for a regulatory audit and discovered some files that violate our data retention policies. They need to be permanently and securely deleted.`
        ],
        piracy: [
            `Unknown actors have uploaded unauthorized content to our server. We need these files securely removed before we face legal action.`,
            `Our monitoring detected pirated content on our file server. This needs to be permanently deleted immediately to protect the company.`
        ],
        malware: [
            `Our security team has detected malware on one of our servers. We need these malicious files securely removed to prevent further damage.`,
            `A virus scan flagged several suspicious files on our server. They need to be securely deleted - regular deletion won't be sufficient.`
        ]
    };

    let body = 'Dear {username},\n\n';
    body += referralText ? `${referralText}\n\n` : '';
    body += randomPick(templates[variant] || templates.compliance);

    body += `\n\n🔍 Use the Log Viewer to identify the flagged files, then use the Data Recovery Tool's Secure Delete feature to permanently remove them.`;

    if (targetFiles.length > 0) {
        body += `\n\n📁 Expected files to remove: ${targetFiles.length} files`;
    }

    if (timeLimitMinutes) {
        body += `\n\n⚠️ URGENT: This task must be completed within ${timeLimitMinutes} minutes of acceptance.`;
    }

    body += `\n\nAttached are the network credentials you'll need.`;

    if (arcSequence && arcTotal) {
        body += `\n\n[Mission ${arcSequence} of ${arcTotal}]`;
    }

    body += `\n\nSincerely,\n{clientName}`;

    const uniqueId = `msg-briefing-secure-delete-${client.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
        id: uniqueId,
        from: client.name,
        fromId: client.id,
        fromName: client.name,
        subject: `Mission Briefing: Secure File Removal Required`,
        body,
        attachments: generateNarAttachments(networks),
        read: false,
        timestamp: new Date().toISOString()
    };
}

/**
 * Get available mission types based on unlocked features
 * Investigation missions require 'investigation-missions' unlock (earned by completing data-detective)
 * @param {Array} unlockedSoftware - Array of unlocked software/feature IDs
 * @returns {Array} Array of available mission type strings
 */
export function getMissionTypesForPlayer(unlockedSoftware = []) {
    const types = ['repair', 'backup', 'transfer', 'restore', 'repair-backup']; // Always available

    // Check if investigation missions are unlocked (unlocked by completing data-detective story mission)
    const hasInvestigationMissions = unlockedSoftware.includes('investigation-missions');

    if (hasInvestigationMissions) {
        types.push('investigation-repair');    // Log Viewer -> find corruption -> repair
        types.push('investigation-recovery');  // Log Viewer -> find deletion -> Data Recovery
        types.push('secure-deletion');         // Log Viewer -> find flagged files -> Secure Delete
    }

    return types;
}

export default {
    generateMission,
    generateRepairMission,
    generateBackupMission,
    generateTransferMission,
    generateRestoreFromBackupMission,
    generateRepairAndBackupMission,
    generateInvestigationRepairMission,
    generateInvestigationRecoveryMission,
    generateSecureDeletionMission,
    generateMissionArc,
    generateNetworkInfrastructure,
    calculateTimeLimit,
    calculatePayout,
    resetMissionIdCounter,
    getMissionTypesForPlayer,
    networkComplexityConfig
};

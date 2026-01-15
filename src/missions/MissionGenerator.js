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

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random IP subnet
 * @returns {string} IP address in format "10.x.x.0/24"
 */
function generateSubnet() {
    const second = randomInt(1, 254);
    const third = randomInt(1, 254);
    return `10.${second}.${third}.0/24`;
}

/**
 * Generate an IP within a subnet
 * @param {string} subnet - Subnet in format "10.x.x.0/24"
 * @param {number} hostNum - Host number (1-254)
 * @returns {string} IP address
 */
function generateIpInSubnet(subnet, hostNum) {
    const parts = subnet.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.${hostNum}`;
}

/**
 * Generate a server hostname based on client and purpose
 * @param {Object} client - Client object
 * @param {string} purpose - Server purpose (e.g., 'fileserver', 'backup', 'archive')
 * @param {number} index - Server index for uniqueness
 * @returns {string} Generated hostname
 */
function generateHostname(client, purpose, index = 1) {
    const prefix = client.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${prefix}-${purpose}-${String(index).padStart(2, '0')}`;
}

/**
 * Generate file names based on industry and mission type
 * @param {string} industry - Client industry
 * @param {string} missionType - Type of mission (repair, backup, transfer)
 * @param {number} count - Number of files to generate
 * @param {boolean} corrupted - Whether files should be marked corrupted
 * @returns {Array} Array of file objects
 */
function generateFiles(industry, missionType, count, corrupted = false) {
    const fileTemplates = {
        banking: {
            repair: ['ledger_{date}.db', 'transactions_{date}.dat', 'accounts_{date}.enc', 'audit_log_{date}.txt'],
            backup: ['customer_data_{date}.db', 'loan_records_{date}.dat', 'compliance_{date}.enc'],
            transfer: ['quarterly_report_{date}.xlsx', 'financial_summary_{date}.pdf', 'archive_{date}.tar']
        },
        government: {
            repair: ['citizen_records_{date}.db', 'permit_system_{date}.dat', 'case_files_{date}.enc'],
            backup: ['registry_{date}.db', 'tax_filings_{date}.dat', 'license_data_{date}.enc'],
            transfer: ['archive_records_{date}.tar', 'historical_data_{date}.zip', 'backup_{date}.db']
        },
        healthcare: {
            repair: ['patient_records_{date}.enc', 'ehr_system_{date}.db', 'lab_results_{date}.dat'],
            backup: ['medical_imaging_{date}.dat', 'prescriptions_{date}.db', 'appointments_{date}.enc'],
            transfer: ['hipaa_archive_{date}.enc', 'patient_history_{date}.tar', 'compliance_{date}.zip']
        },
        corporate: {
            repair: ['crm_database_{date}.db', 'erp_system_{date}.dat', 'hr_records_{date}.enc'],
            backup: ['sales_data_{date}.db', 'inventory_{date}.dat', 'project_files_{date}.zip'],
            transfer: ['quarterly_backup_{date}.tar', 'financial_records_{date}.enc', 'contracts_{date}.zip']
        },
        utilities: {
            repair: ['scada_config_{date}.db', 'grid_telemetry_{date}.dat', 'meter_data_{date}.enc'],
            backup: ['outage_logs_{date}.dat', 'maintenance_{date}.db', 'sensor_data_{date}.enc'],
            transfer: ['infrastructure_{date}.tar', 'network_config_{date}.zip', 'system_backup_{date}.db']
        },
        shipping: {
            repair: ['tracking_system_{date}.db', 'logistics_{date}.dat', 'manifest_{date}.enc'],
            backup: ['shipment_records_{date}.db', 'customs_{date}.dat', 'routes_{date}.enc'],
            transfer: ['warehouse_{date}.tar', 'fleet_data_{date}.zip', 'inventory_{date}.db']
        },
        emergency: {
            repair: ['dispatch_logs_{date}.db', 'incident_reports_{date}.dat', 'personnel_{date}.enc'],
            backup: ['call_records_{date}.db', 'response_times_{date}.dat', 'equipment_{date}.enc'],
            transfer: ['emergency_archive_{date}.tar', 'training_{date}.zip', 'protocols_{date}.db']
        },
        nonprofit: {
            repair: ['donor_database_{date}.db', 'volunteer_{date}.dat', 'programs_{date}.enc'],
            backup: ['fundraising_{date}.db', 'grants_{date}.dat', 'events_{date}.enc'],
            transfer: ['annual_report_{date}.tar', 'financial_{date}.zip', 'membership_{date}.db']
        },
        cultural: {
            repair: ['catalog_{date}.db', 'collections_{date}.dat', 'exhibitions_{date}.enc'],
            backup: ['archives_{date}.db', 'digitization_{date}.dat', 'metadata_{date}.enc'],
            transfer: ['preservation_{date}.tar', 'restoration_{date}.zip', 'inventory_{date}.db']
        }
    };

    const templates = fileTemplates[industry]?.[missionType] || fileTemplates.corporate[missionType];
    const dateFormats = ['2024_01', '2024_02', '2024_03', '2024_Q1', '2024_Q2', '2023_12', '2023_11'];
    const sizes = ['1.2 KB', '2.5 KB', '3.1 KB', '4.8 KB', '5.2 KB', '6.7 KB', '8.3 KB'];

    const files = [];
    const usedNames = new Set();

    while (files.length < count) {
        const template = randomPick(templates);
        const date = randomPick(dateFormats);
        const name = template.replace('{date}', date);

        if (!usedNames.has(name)) {
            usedNames.add(name);
            files.push({
                name,
                size: randomPick(sizes),
                corrupted
            });
        }
    }

    return files;
}

/**
 * Generate complete network infrastructure for a mission
 * @param {Object} client - Client object
 * @param {string} missionType - Mission type (repair, backup, transfer)
 * @param {number} fileCount - Number of files to include
 * @param {Object} options - Additional options { corrupted, secondNetwork }
 * @returns {Object} { networks, primaryNetworkId, primaryIp, fileNames }
 */
export function generateNetworkInfrastructure(client, missionType, fileCount, options = {}) {
    const { corrupted = false, secondNetwork = false } = options;

    const networks = [];
    const primaryNetworkId = `${client.id}-network-${Date.now()}`;
    const primarySubnet = generateSubnet();
    const primaryIp = generateIpInSubnet(primarySubnet, 10);

    // Generate primary network
    const primaryFiles = generateFiles(client.industry, missionType, fileCount, corrupted);

    networks.push({
        networkId: primaryNetworkId,
        networkName: `${client.name.split(' ')[0]}-Network`,
        address: primarySubnet,
        bandwidth: randomPick([25, 50, 75, 100]),
        revokeOnComplete: true,
        revokeReason: 'Mission access expired',
        fileSystems: [{
            id: `fs-${client.id}-01`,
            ip: primaryIp,
            name: generateHostname(client, 'fileserver'),
            files: primaryFiles
        }]
    });

    // Generate secondary network for transfer missions
    let secondaryNetworkId = null;
    let secondaryIp = null;

    if (secondNetwork) {
        secondaryNetworkId = `${client.id}-dest-${Date.now()}`;
        const secondarySubnet = generateSubnet();
        secondaryIp = generateIpInSubnet(secondarySubnet, 10);

        networks.push({
            networkId: secondaryNetworkId,
            networkName: `${client.name.split(' ')[0]}-Backup`,
            address: secondarySubnet,
            bandwidth: randomPick([25, 50, 75, 100]),
            revokeOnComplete: true,
            revokeReason: 'Mission access expired',
            fileSystems: [{
                id: `fs-${client.id}-02`,
                ip: secondaryIp,
                name: generateHostname(client, 'backup'),
                files: [] // Empty - files will be transferred here
            }]
        });
    }

    return {
        networks,
        primaryNetworkId,
        primaryIp,
        secondaryNetworkId,
        secondaryIp,
        fileNames: primaryFiles.map(f => f.name),
        hostname: networks[0].fileSystems[0].name
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
 * Calculate mission payout based on objectives and time limit
 * @param {number} objectiveCount - Number of objectives
 * @param {number|null} timeLimitMinutes - Time limit in minutes, or null for untimed
 * @param {Object} client - Client object for tier multiplier
 * @returns {number} Calculated payout
 */
export function calculatePayout(objectiveCount, timeLimitMinutes, client) {
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
    return [
        {
            id: 'obj-1',
            description: `Connect to ${infra.networks[0].networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find ${infra.hostname}`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        },
        {
            id: 'obj-3',
            description: `Connect to ${infra.hostname} file system`,
            type: 'fileSystemConnection',
            target: infra.primaryIp
        },
        {
            id: 'obj-4',
            description: `Repair all corrupted files (${infra.fileNames.length} files)`,
            type: 'fileOperation',
            operation: 'repair',
            target: 'all-corrupted',
            targetFiles: infra.fileNames,
            count: infra.fileNames.length
        }
    ];
}

/**
 * Generate objectives for a backup mission
 * @param {Object} infra - Network infrastructure
 * @returns {Array} Array of objective objects
 */
function generateBackupObjectives(infra) {
    return [
        {
            id: 'obj-1',
            description: `Connect to ${infra.networks[0].networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan network to find ${infra.hostname}`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        },
        {
            id: 'obj-3',
            description: `Connect to ${infra.hostname} file system`,
            type: 'fileSystemConnection',
            target: infra.primaryIp
        },
        {
            id: 'obj-4',
            description: `Copy ${infra.fileNames.length} files to secure backup`,
            type: 'fileOperation',
            operation: 'copy',
            targetFiles: infra.fileNames,
            count: infra.fileNames.length
        }
    ];
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

    return [
        {
            id: 'obj-1',
            description: `Connect to ${sourceNetwork.networkName} network`,
            type: 'networkConnection',
            target: infra.primaryNetworkId
        },
        {
            id: 'obj-2',
            description: `Scan ${sourceNetwork.networkName} to find ${infra.hostname}`,
            type: 'networkScan',
            target: infra.primaryNetworkId,
            expectedResult: infra.hostname
        },
        {
            id: 'obj-3',
            description: `Connect to ${infra.hostname} file system`,
            type: 'fileSystemConnection',
            target: infra.primaryIp
        },
        {
            id: 'obj-4',
            description: `Copy ${infra.fileNames.length} files from source`,
            type: 'fileOperation',
            operation: 'copy',
            targetFiles: infra.fileNames,
            count: infra.fileNames.length
        },
        {
            id: 'obj-5',
            description: `Connect to ${destNetwork.networkName} network`,
            type: 'networkConnection',
            target: infra.secondaryNetworkId
        },
        {
            id: 'obj-6',
            description: `Scan ${destNetwork.networkName} to find ${destHostname}`,
            type: 'networkScan',
            target: infra.secondaryNetworkId,
            expectedResult: destHostname
        },
        {
            id: 'obj-7',
            description: `Connect to ${destHostname} file system`,
            type: 'fileSystemConnection',
            target: infra.secondaryIp
        },
        {
            id: 'obj-8',
            description: `Paste ${infra.fileNames.length} files to destination`,
            type: 'fileOperation',
            operation: 'paste',
            targetFiles: infra.fileNames,
            count: infra.fileNames.length
        }
    ];
}

/**
 * Generate NAR credential attachments for mission briefing message
 * @param {Array} networks - Network definitions
 * @returns {Array} Array of attachment objects
 */
function generateNarAttachments(networks) {
    return networks.map(network => ({
        type: 'networkAddress',  // Must match SNetMail attachment type handler
        networkId: network.networkId,
        networkName: network.networkName,
        address: network.address,
        bandwidth: network.bandwidth,
        fileSystems: network.fileSystems.map(fs => ({
            id: fs.id,
            ip: fs.ip,
            name: fs.name,
            files: fs.files
        }))
    }));
}

/**
 * Generate mission briefing message with NAR attachments
 * @param {Object} client - Client object
 * @param {string} missionType - Mission type
 * @param {Array} networks - Network definitions
 * @param {number|null} timeLimitMinutes - Time limit or null
 * @param {Object} context - Additional context { arcSequence, arcTotal, referralText }
 * @returns {Object} Message object for initial briefing
 */
function generateBriefingMessage(client, missionType, networks, timeLimitMinutes, context = {}) {
    const { arcSequence, arcTotal, referralText } = context;

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
        ]
    };

    let body = referralText ? `${referralText}\n\n` : '';
    body += randomPick(briefingTemplates[missionType]);

    if (timeLimitMinutes) {
        body += `\n\n⚠️ TIME SENSITIVE: This task must be completed within ${timeLimitMinutes} minutes of acceptance.`;
    }

    body += `\n\nAttached are the network credentials you'll need to access our systems.`;

    if (arcSequence && arcTotal) {
        body += `\n\n[Mission ${arcSequence} of ${arcTotal}]`;
    }

    return {
        id: `msg-briefing-${Date.now()}`,
        from: client.name,
        fromId: client.id,
        fromName: client.name,
        subject: `Mission Briefing: ${missionType.charAt(0).toUpperCase() + missionType.slice(1)} Request`,
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

    return {
        credits: -Math.floor(basePayout * 0.25),
        reputation: -1,
        messages: [{
            id: `msg-failure-${Date.now()}`,
            from: client.name,
            fromId: client.id,
            fromName: client.name,
            subject: 'Mission Failed',
            body: randomPick(failureMessages[failureReason] || failureMessages.incomplete),
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

    return {
        credits: basePayout,
        reputation: 1,
        messages: [{
            id: `msg-success-${Date.now()}`,
            from: client.name,
            fromId: client.id,
            fromName: client.name,
            subject: 'Mission Complete - Payment Enclosed',
            body: randomPick(successMessages),
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

    const fileCount = randomInt(4, 8);
    const infra = generateNetworkInfrastructure(client, 'repair', fileCount, { corrupted: true });
    const objectives = generateRepairObjectives(infra);

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client);

    const missionId = generateMissionId('repair', client.id);

    return {
        missionId,
        title: `File Repair for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: fileCount <= 5 ? 'Easy' : fileCount <= 7 ? 'Medium' : 'Hard',
        missionType: 'repair',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'repair', infra.networks, timeLimitMinutes, arcContext),
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

    const fileCount = randomInt(3, 6);
    const infra = generateNetworkInfrastructure(client, 'backup', fileCount, { corrupted: false });
    const objectives = generateBackupObjectives(infra);

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client);

    const missionId = generateMissionId('backup', client.id);

    return {
        missionId,
        title: `Data Backup for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: fileCount <= 4 ? 'Easy' : 'Medium',
        missionType: 'backup',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'backup', infra.networks, timeLimitMinutes, arcContext),
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

    const fileCount = randomInt(3, 5);
    const infra = generateNetworkInfrastructure(client, 'transfer', fileCount, {
        corrupted: false,
        secondNetwork: true
    });
    const objectives = generateTransferObjectives(infra);

    // Add verification objective
    objectives.push({
        id: 'obj-verify',
        description: 'Verify mission completion',
        type: 'verification',
        autoComplete: false
    });

    const timeLimitMinutes = hasTimed ? calculateTimeLimit(objectives.length) : null;
    const basePayout = calculatePayout(objectives.length, timeLimitMinutes, client);

    const missionId = generateMissionId('transfer', client.id);

    return {
        missionId,
        title: `Data Transfer for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: 'Medium', // Transfer missions are inherently more complex
        missionType: 'transfer',
        basePayout,
        category: arcId ? 'procedural-arc' : 'procedural',
        networks: infra.networks,
        objectives,
        requirements: {
            software: ['vpn-client', 'network-address-register', 'network-scanner', 'file-manager'],
            minReputation: client.minReputation
        },
        consequences: {
            success: generateSuccessConsequences(client, basePayout),
            failure: generateFailureConsequences(client, basePayout, hasTimed ? 'deadline' : 'incomplete')
        },
        timeLimitMinutes,
        briefingMessage: generateBriefingMessage(client, 'transfer', infra.networks, timeLimitMinutes, arcContext),
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

    const missionTypes = ['repair', 'backup', 'transfer'];
    const weights = [0.4, 0.35, 0.25]; // Repair most common, transfer least

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
    generateMissionArc,
    generateNetworkInfrastructure,
    calculateTimeLimit,
    calculatePayout,
    resetMissionIdCounter
};

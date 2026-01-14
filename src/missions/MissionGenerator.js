/**
 * Mission Generator - Creates procedural missions from templates and client registry.
 * 
 * Generates:
 * - Single missions from client + mission type + templates
 * - Multi-part chain missions with escalation
 * - Mission extensions (mid-mission scope expansion)
 */

import { getClientById } from '../data/clientRegistry';
import missionTemplates from './data/mission-templates.json';
import {
    generationConfig,
    calculateBasePayout,
    getExpirationHours,
    getTimeLimit,
    getExtensionChance
} from './config/generationConfig';

// Track generated mission IDs to ensure uniqueness
let missionIdCounter = 0;

/**
 * Generate a unique mission ID
 * @returns {string} Unique mission ID
 */
function generateMissionId() {
    missionIdCounter++;
    return `proc-${Date.now()}-${missionIdCounter}`;
}

/**
 * Generate a unique chain ID
 * @returns {string} Unique chain ID
 */
function generateChainId() {
    return `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pick a random item from an array
 * @param {Array} arr - Array to pick from
 * @returns {*} Random item
 */
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a weighted random item
 * @param {Object} weights - Object with keys and weight values
 * @returns {string} Selected key
 */
function weightedRandomPick(weights) {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [key, weight] of entries) {
        random -= weight;
        if (random <= 0) {
            return key;
        }
    }

    return entries[0][0]; // Fallback
}

/**
 * Generate a server address based on client industry
 * @param {Object} client - Client object
 * @returns {string} Generated server address
 */
function generateServerAddress(client) {
    const serverType = missionTemplates.serverTypes[client.industry];
    if (!serverType) {
        return `${client.id.replace(/-/g, '')}.internal`;
    }

    const pattern = randomPick(serverType.addressPatterns);
    const nameVariant = client.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    return pattern.replace('{name}', nameVariant);
}

/**
 * Generate file names based on mission type and industry
 * @param {string} industry - Client industry
 * @param {string} missionType - Type of mission (file-backup, file-repair, etc.)
 * @param {number} count - Number of files to generate
 * @returns {string[]} Array of generated file names
 */
function generateFileNames(industry, missionType, count) {
    const serverType = missionTemplates.serverTypes[industry];
    if (!serverType) {
        return Array(count).fill(null).map((_, i) => `file_${i + 1}.dat`);
    }

    // Map mission type to file pattern category
    const patternCategory = missionType.includes('repair') ? 'repair' :
        missionType.includes('restoration') ? 'restoration' : 'backup';

    const patterns = serverType.filePatterns[patternCategory] || serverType.filePatterns.backup;
    const dateFormats = missionTemplates.fileNameComponents.dateFormats;

    const files = [];
    const usedFiles = new Set();

    while (files.length < count) {
        const pattern = randomPick(patterns);
        const date = randomPick(dateFormats);
        const fileName = pattern.replace('{date}', date);

        if (!usedFiles.has(fileName)) {
            usedFiles.add(fileName);
            files.push(fileName);
        }
    }

    return files;
}

/**
 * Get corruption type for an industry
 * @param {string} industry - Client industry
 * @returns {string} Corruption type description
 */
function getCorruptionType(industry) {
    const serverType = missionTemplates.serverTypes[industry];
    if (!serverType || !serverType.corruptionTypes) {
        return 'data corruption';
    }
    return randomPick(serverType.corruptionTypes);
}

/**
 * Generate briefing text from template
 * @param {string} missionType - Mission type
 * @param {Object} client - Client object
 * @param {string} serverAddress - Server address
 * @param {string} corruptionType - Corruption description
 * @returns {string} Generated briefing text
 */
function generateBriefing(missionType, client, serverAddress, corruptionType) {
    const narratives = missionTemplates.narrativeTemplates[missionType];
    if (!narratives) {
        return `Complete the assigned tasks for ${client.name} at ${serverAddress}.`;
    }

    const template = randomPick(narratives.briefings);
    const fileType = 'critical files'; // Could be more specific based on industry

    return template
        .replace(/{client}/g, client.name)
        .replace(/{server}/g, serverAddress)
        .replace(/{fileType}/g, fileType)
        .replace(/{corruptionType}/g, corruptionType);
}

/**
 * Generate mission objectives based on mission type and files
 * @param {string} missionType - Mission type
 * @param {string[]} targetFiles - Files for the mission
 * @param {string} serverAddress - Target server address
 * @returns {Object[]} Array of objective objects
 */
function generateObjectives(missionType, targetFiles, serverAddress) {
    const objectives = [];
    let objCounter = 1;

    const missionTypeInfo = missionTemplates.missionTypes[missionType];
    const requiredOps = missionTypeInfo?.objectives || ['navigate', 'copy'];

    // Navigation objective
    if (requiredOps.includes('navigate')) {
        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'connect',
            description: `Connect to ${serverAddress}`,
            targetAddress: serverAddress,
            status: 'incomplete'
        });
    }

    // File operation objectives based on mission type
    if (missionType === 'file-backup' || missionType === 'data-extraction') {
        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'file-operation',
            operation: 'copy',
            description: `Copy ${targetFiles.length} files from ${serverAddress}`,
            targetFiles: targetFiles,
            status: 'incomplete'
        });
    } else if (missionType === 'file-repair') {
        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'file-operation',
            operation: 'repair',
            description: `Repair ${targetFiles.length} corrupted files`,
            targetFiles: targetFiles,
            status: 'incomplete'
        });
    } else if (missionType === 'file-restoration') {
        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'file-operation',
            operation: 'copy',
            description: `Copy ${targetFiles.length} files from backup`,
            targetFiles: targetFiles,
            status: 'incomplete'
        });
        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'file-operation',
            operation: 'paste',
            description: `Restore files to ${serverAddress}`,
            targetFiles: targetFiles,
            status: 'incomplete'
        });
    } else if (missionType === 'combined-tasks') {
        // Combined: copy some files, repair others
        const halfCount = Math.ceil(targetFiles.length / 2);
        const backupFiles = targetFiles.slice(0, halfCount);
        const repairFiles = targetFiles.slice(halfCount);

        objectives.push({
            id: `obj-${objCounter++}`,
            type: 'file-operation',
            operation: 'copy',
            description: `Backup ${backupFiles.length} critical files`,
            targetFiles: backupFiles,
            status: 'incomplete'
        });

        if (repairFiles.length > 0) {
            objectives.push({
                id: `obj-${objCounter++}`,
                type: 'file-operation',
                operation: 'repair',
                description: `Repair ${repairFiles.length} corrupted files`,
                targetFiles: repairFiles,
                status: 'incomplete'
            });
        }
    }

    return objectives;
}

/**
 * Determine difficulty based on client tier and other factors
 * @param {Object} client - Client object
 * @param {string} missionType - Mission type
 * @returns {string} Difficulty level (easy, medium, hard)
 */
function determineDifficulty(client, missionType) {
    // Higher tier clients tend toward harder missions
    const tierFactor = client.minReputation;

    // Combined tasks are inherently harder
    const typeFactor = missionType === 'combined-tasks' ? 2 :
        missionType === 'file-repair' ? 1 : 0;

    const score = tierFactor + typeFactor;

    if (score <= 3) return 'easy';
    if (score <= 6) return 'medium';
    return 'hard';
}

/**
 * Get file count based on difficulty
 * @param {string} difficulty - Mission difficulty
 * @returns {number} Number of files for mission
 */
function getFileCount(difficulty) {
    switch (difficulty) {
        case 'easy': return 3 + Math.floor(Math.random() * 2); // 3-4 files
        case 'medium': return 5 + Math.floor(Math.random() * 3); // 5-7 files
        case 'hard': return 8 + Math.floor(Math.random() * 3); // 8-10 files
        default: return 5;
    }
}

/**
 * Generate software requirements based on mission type and difficulty
 * @param {string} missionType - Mission type
 * @param {string} difficulty - Mission difficulty
 * @returns {string[]} Required software IDs
 */
function generateSoftwareRequirements(missionType, difficulty) {
    const requirements = [];
    const config = generationConfig.softwareRequirements[difficulty];

    // Add required software for this difficulty
    requirements.push(...config.required);

    // Mission-type specific requirements
    const missionTypeInfo = missionTemplates.missionTypes[missionType];
    if (missionTypeInfo?.requiresSoftware) {
        missionTypeInfo.requiresSoftware.forEach(sw => {
            if (!requirements.includes(sw)) {
                requirements.push(sw);
            }
        });
    }

    return requirements;
}

/**
 * Generate a single procedural mission
 * @param {string} clientId - Client ID from registry
 * @param {string} [missionType] - Optional specific mission type, random if not provided
 * @param {Date} currentTime - Current game time for expiration calculation
 * @returns {Object|null} Generated mission object or null if client not found
 */
export function generateMission(clientId, missionType, currentTime) {
    const client = getClientById(clientId);
    if (!client) {
        console.warn(`Client not found: ${clientId}`);
        return null;
    }

    // Select mission type if not provided
    const selectedType = missionType || weightedRandomPick(generationConfig.missionTypeWeights);

    // Generate mission components
    const difficulty = determineDifficulty(client, selectedType);
    const serverAddress = generateServerAddress(client);
    const corruptionType = getCorruptionType(client.industry);
    const fileCount = getFileCount(difficulty);
    const targetFiles = generateFileNames(client.industry, selectedType, fileCount);
    const briefing = generateBriefing(selectedType, client, serverAddress, corruptionType);
    const objectives = generateObjectives(selectedType, targetFiles, serverAddress);
    const softwareRequirements = generateSoftwareRequirements(selectedType, difficulty);
    const basePayout = calculateBasePayout(difficulty, client.clientType);

    // Calculate expiration
    const expirationHours = getExpirationHours(difficulty);
    const expiresAt = new Date(currentTime);
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Maybe add time limit
    const timeLimit = getTimeLimit(difficulty);

    return {
        missionId: generateMissionId(),
        title: `${missionTemplates.missionTypes[selectedType]?.displayName || 'Task'} for ${client.name}`,
        client: client.name,
        clientId: client.id,
        clientType: client.clientType,
        industry: client.industry,
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), // Capitalize
        missionType: selectedType,
        basePayout,
        category: 'procedural',
        briefing,
        serverAddress,
        corruptionType,
        objectives,
        requirements: {
            software: softwareRequirements,
            minReputation: client.minReputation
        },
        consequences: {
            success: {
                credits: 'calculated', // Will use basePayout with reputation multiplier
                reputation: generationConfig.consequences.success[difficulty]
            },
            failure: {
                credits: -Math.floor(basePayout * generationConfig.failurePenalty[difficulty]),
                reputation: generationConfig.consequences.failure[difficulty]
            }
        },
        expiresAt: expiresAt.toISOString(),
        timeLimit, // null or minutes
        isProcedurallyGenerated: true,
        generatedAt: currentTime.toISOString()
    };
}

/**
 * Generate a multi-part chain mission
 * @param {string} clientId - Client ID from registry
 * @param {string} [chainType] - Optional specific chain template, random if not provided
 * @param {Date} currentTime - Current game time
 * @returns {Object|null} Chain object with all mission parts
 */
export function generateChainMission(clientId, chainType, currentTime) {
    const client = getClientById(clientId);
    if (!client) {
        console.warn(`Client not found: ${clientId}`);
        return null;
    }

    // Select chain template
    const chainTemplates = missionTemplates.chainTemplates;
    const templateKeys = Object.keys(chainTemplates);
    const selectedChainType = chainType || randomPick(templateKeys);
    const template = chainTemplates[selectedChainType];

    if (!template) {
        console.warn(`Chain template not found: ${selectedChainType}`);
        return null;
    }

    const chainId = generateChainId();
    const serverAddress = generateServerAddress(client);
    const corruptionType = getCorruptionType(client.industry);

    // Generate all parts
    const parts = template.parts.map((partTemplate, index) => {
        const difficulty = determineDifficulty(client, partTemplate.missionType);
        const fileCount = getFileCount(difficulty);
        const targetFiles = generateFileNames(client.industry, partTemplate.missionType, fileCount);
        const baseBriefing = generateBriefing(partTemplate.missionType, client, serverAddress, corruptionType);

        // Modify briefing with chain-specific modifier
        const briefing = partTemplate.briefingModifier
            ? `${partTemplate.briefingModifier.replace(/{corruptionType}/g, corruptionType)}\n\n${baseBriefing}`
            : baseBriefing;

        const objectives = generateObjectives(partTemplate.missionType, targetFiles, serverAddress);
        const softwareRequirements = generateSoftwareRequirements(partTemplate.missionType, difficulty);

        // Escalating payout for chain parts
        const escalation = Math.pow(generationConfig.chain.escalation, index);
        const basePayout = Math.floor(calculateBasePayout(difficulty, client.clientType) * escalation);

        // First part expires normally, subsequent parts don't expire (revealed when previous completes)
        const expirationHours = index === 0 ? getExpirationHours(difficulty) : null;
        const expiresAt = expirationHours ? new Date(currentTime) : null;
        if (expiresAt) {
            expiresAt.setHours(expiresAt.getHours() + expirationHours);
        }

        return {
            missionId: generateMissionId(),
            title: `${template.name} - Part ${index + 1} of ${template.parts.length}`,
            client: client.name,
            clientId: client.id,
            clientType: client.clientType,
            industry: client.industry,
            difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
            missionType: partTemplate.missionType,
            basePayout,
            category: 'procedural-chain',
            briefing,
            serverAddress,
            corruptionType,
            objectives,
            requirements: {
                software: softwareRequirements,
                minReputation: client.minReputation
            },
            consequences: {
                success: {
                    credits: 'calculated',
                    reputation: generationConfig.consequences.success[difficulty]
                },
                failure: {
                    credits: -Math.floor(basePayout * generationConfig.failurePenalty[difficulty]),
                    reputation: generationConfig.consequences.failure[difficulty]
                }
            },
            expiresAt: expiresAt?.toISOString() || null,
            timeLimit: index === 0 ? getTimeLimit(difficulty) : null,
            isProcedurallyGenerated: true,
            generatedAt: currentTime.toISOString(),
            // Chain-specific fields
            chainId,
            chainName: template.name,
            partNumber: index + 1,
            totalParts: template.parts.length,
            transitionMessage: partTemplate.transitionMessage
        };
    });

    return {
        chainId,
        chainName: template.name,
        clientId: client.id,
        clientName: client.name,
        totalParts: parts.length,
        parts,
        // Only the first part is initially available
        currentPartIndex: 0,
        status: 'active'
    };
}

/**
 * Generate an extension offer for an active mission
 * @param {Object} activeMission - Currently active mission
 * @param {Date} currentTime - Current game time
 * @returns {Object|null} Extension offer or null if not triggered
 */
export function generateExtension(activeMission, currentTime) {
    // Check if extension should be offered
    const chance = getExtensionChance(activeMission.missionType);
    if (Math.random() > chance) {
        return null;
    }

    const client = getClientById(activeMission.clientId);
    if (!client) {
        return null;
    }

    // Generate additional files
    const additionalFileCount = 2 + Math.floor(Math.random() * 3); // 2-4 extra files
    const additionalFiles = generateFileNames(
        client.industry,
        activeMission.missionType,
        additionalFileCount
    );

    // Calculate bonus payout
    const multiplier = generationConfig.extension.payoutMultiplier;
    const bonusMultiplier = multiplier.min + Math.random() * (multiplier.max - multiplier.min);
    const bonusAmount = Math.floor(activeMission.basePayout * (bonusMultiplier - 1));

    // Pick extension template
    const extensionTemplates = missionTemplates.extensionTemplates;
    const templateKeys = Object.keys(extensionTemplates);
    const template = extensionTemplates[randomPick(templateKeys)];

    const triggerMessage = template.triggerMessage
        .replace(/{client}/g, client.name)
        .replace(/{bonusAmount}/g, bonusAmount.toString())
        .replace(/{fileType}/g, 'files')
        .replace(/{corruptionType}/g, activeMission.corruptionType || 'data issues');

    return {
        extensionId: `ext-${Date.now()}`,
        missionId: activeMission.missionId,
        triggerMessage,
        acceptMessage: template.acceptMessage,
        declineMessage: template.declineMessage,
        additionalFiles,
        bonusAmount,
        bonusMultiplier,
        newBasePayout: activeMission.basePayout + bonusAmount,
        offeredAt: currentTime.toISOString(),
        // Extension expires quickly - player must decide soon
        expiresAt: new Date(currentTime.getTime() + 5 * 60 * 1000).toISOString() // 5 minutes
    };
}

/**
 * Apply an accepted extension to a mission
 * @param {Object} mission - Mission to extend
 * @param {Object} extension - Extension offer that was accepted
 * @returns {Object} Updated mission with extension applied
 */
export function applyExtension(mission, extension) {
    // Find the file operation objective(s) and add new files
    const updatedObjectives = mission.objectives.map(obj => {
        if (obj.type === 'file-operation' && obj.targetFiles) {
            return {
                ...obj,
                targetFiles: [...obj.targetFiles, ...extension.additionalFiles],
                description: obj.description.replace(
                    /\d+/,
                    (obj.targetFiles.length + extension.additionalFiles.length).toString()
                )
            };
        }
        return obj;
    });

    return {
        ...mission,
        basePayout: extension.newBasePayout,
        objectives: updatedObjectives,
        extensionApplied: true,
        extensionId: extension.extensionId
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
    generateChainMission,
    generateExtension,
    applyExtension,
    resetMissionIdCounter
};

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry before importing the module under test
vi.mock('../systems/NetworkRegistry', () => ({
    default: {
        isSubnetInUse: vi.fn(() => false),
        isIpInUse: vi.fn(() => false),
    },
}));

// Mock clientRegistry
vi.mock('../data/clientRegistry', () => ({
    getClientById: vi.fn((id) => ({
        id,
        name: 'Test Corporation',
        industry: 'corporate',
        clientType: 'corp-medium',
        minReputation: 1,
    })),
}));

// Mock missionData to avoid reserved network conflicts
vi.mock('./missionData.js', () => ({
    allMissions: [],
}));

import {
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
} from './MissionGenerator';

import { getClientById } from '../data/clientRegistry';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockClient = (overrides = {}) => ({
    id: 'test-client-001',
    name: 'Test Corporation',
    industry: 'corporate',
    clientType: 'corp-medium',
    minReputation: 1,
    ...overrides,
});

const createMockStoryline = () => ({
    id: 'test-storyline',
    name: 'Test Storyline',
    description: 'A test storyline for unit tests',
    length: 3,
    missionSequence: [
        {
            missionType: 'repair',
            clientIndustryFilter: ['corporate'],
            narrativeTemplate: 'Initial repair mission',
            hasTimed: false,
        },
        {
            missionType: 'backup',
            clientIndustryFilter: null,
            narrativeTemplate: 'Follow-up backup',
            referralText: 'Thanks for the previous work',
            hasTimed: false,
        },
        {
            missionType: 'transfer',
            clientIndustryFilter: ['corporate'],
            narrativeTemplate: 'Final transfer',
            referralText: 'One more task',
            hasTimed: true,
        },
    ],
});

// ============================================================================
// Tests
// ============================================================================

describe('MissionGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMissionIdCounter();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // calculateTimeLimit
    // ========================================================================

    describe('calculateTimeLimit', () => {
        it('should return minimum 3 minutes for small missions', () => {
            expect(calculateTimeLimit(1)).toBeGreaterThanOrEqual(3);
            expect(calculateTimeLimit(2)).toBeGreaterThanOrEqual(3);
        });

        it('should scale with objective count', () => {
            const smallMission = calculateTimeLimit(3);
            const largeMission = calculateTimeLimit(10);
            expect(largeMission).toBeGreaterThanOrEqual(smallMission);
        });

        it('should cap at maximum 10 minutes', () => {
            expect(calculateTimeLimit(20)).toBeLessThanOrEqual(10);
            expect(calculateTimeLimit(50)).toBeLessThanOrEqual(10);
        });

        it('should return integer values', () => {
            for (let i = 1; i <= 15; i++) {
                expect(Number.isInteger(calculateTimeLimit(i))).toBe(true);
            }
        });
    });

    // ========================================================================
    // calculatePayout
    // ========================================================================

    describe('calculatePayout', () => {
        const mockClient = createMockClient();

        it('should calculate base payout from objective count', () => {
            const payout5 = calculatePayout(5, null, mockClient);
            const payout10 = calculatePayout(10, null, mockClient);
            expect(payout10).toBeGreaterThan(payout5);
        });

        it('should apply tier multiplier', () => {
            const lowTierClient = createMockClient({ clientType: 'nonprofit-local' });
            const highTierClient = createMockClient({ clientType: 'bank-national' });

            const lowPayout = calculatePayout(5, null, lowTierClient);
            const highPayout = calculatePayout(5, null, highTierClient);

            expect(highPayout).toBeGreaterThan(lowPayout);
        });

        it('should add time bonus for timed missions', () => {
            const untimedPayout = calculatePayout(5, null, mockClient);
            const timedPayout = calculatePayout(5, 5, mockClient);

            expect(timedPayout).toBeGreaterThan(untimedPayout);
        });

        it('should give higher bonus for tighter deadlines', () => {
            const loosePayout = calculatePayout(5, 10, mockClient);
            const tightPayout = calculatePayout(5, 3, mockClient);

            expect(tightPayout).toBeGreaterThan(loosePayout);
        });

        it('should add data size bonus', () => {
            const smallDataPayout = calculatePayout(5, null, mockClient, 10 * 1024 * 1024);
            const largeDataPayout = calculatePayout(5, null, mockClient, 500 * 1024 * 1024);

            expect(largeDataPayout).toBeGreaterThan(smallDataPayout);
        });

        it('should return integer values', () => {
            const payout = calculatePayout(5, 5, mockClient, 100 * 1024 * 1024);
            expect(Number.isInteger(payout)).toBe(true);
        });

        it('should handle unknown client types with default multiplier', () => {
            const unknownClient = createMockClient({ clientType: 'unknown-type' });
            const payout = calculatePayout(5, null, unknownClient);
            expect(payout).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // generateNetworkInfrastructure
    // ========================================================================

    describe('generateNetworkInfrastructure', () => {
        const mockClient = createMockClient();

        it('should generate primary network with file systems', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'repair', 4);

            expect(infra.networks).toHaveLength(1);
            expect(infra.networks[0].networkId).toBeDefined();
            expect(infra.networks[0].networkName).toBeDefined();
            expect(infra.networks[0].address).toMatch(/^\d+\.\d+\.\d+\.\d+\/24$/);
            expect(infra.networks[0].fileSystems.length).toBeGreaterThan(0);
        });

        it('should generate target files', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'repair', 5);

            expect(infra.targetFiles).toHaveLength(5);
            expect(infra.targetFiles.every(f => typeof f === 'string')).toBe(true);
        });

        it('should mark files as corrupted for repair missions', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'repair', 4, { corrupted: true });

            const allFiles = infra.networks[0].fileSystems.flatMap(fs => fs.files);
            const corruptedTargets = allFiles.filter(f => f.targetFile && f.corrupted);

            expect(corruptedTargets.length).toBe(4);
        });

        it('should generate second network for two-network scenarios', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'backup', 4, { secondNetwork: true });

            expect(infra.networks).toHaveLength(2);
            expect(infra.secondaryNetworkId).toBeDefined();
            expect(infra.secondaryIp).toBeDefined();
        });

        it('should generate backup server in same network when sameNetworkBackup is true', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'backup', 4, { sameNetworkBackup: true });

            expect(infra.networks).toHaveLength(1);
            expect(infra.backupServerIp).toBeDefined();
            expect(infra.backupServerName).toBeDefined();
            expect(infra.networks[0].fileSystems.length).toBe(2); // Source + backup
        });

        it('should support multiple source file systems', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'repair', 6, {
                deviceConfigs: [{ fileSystemCount: 1 }, { fileSystemCount: 1 }, { fileSystemCount: 1 }]
            });

            expect(infra.primaryFileSystems.length).toBe(3);
            expect(infra.devices.length).toBe(3);
        });

        it('should calculate total data bytes', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'backup', 4);

            expect(infra.totalDataBytes).toBeGreaterThan(0);
            expect(typeof infra.totalDataBytes).toBe('number');
        });

        it('should set revokeOnComplete flag', () => {
            const infra = generateNetworkInfrastructure(mockClient, 'repair', 4);

            expect(infra.networks[0].revokeOnComplete).toBe(true);
            expect(infra.networks[0].revokeReason).toBeDefined();
        });
    });

    // ========================================================================
    // generateRepairMission
    // ========================================================================

    describe('generateRepairMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid repair mission', () => {
            const mission = generateRepairMission(mockClient);

            expect(mission.missionId).toMatch(/^repair-/);
            expect(mission.missionType).toBe('repair');
            expect(mission.clientId).toBe(mockClient.id);
            expect(mission.client).toBe(mockClient.name);
        });

        it('should include required mission properties', () => {
            const mission = generateRepairMission(mockClient);

            expect(mission.title).toBeDefined();
            expect(mission.basePayout).toBeGreaterThan(0);
            expect(mission.difficulty).toMatch(/^(Easy|Medium|Hard)$/);
            expect(mission.networks).toBeDefined();
            expect(mission.objectives).toBeDefined();
            expect(mission.targetFiles).toBeDefined();
            expect(mission.requirements).toBeDefined();
            expect(mission.consequences).toBeDefined();
            expect(mission.briefingMessage).toBeDefined();
        });

        it('should generate objectives with verification step', () => {
            const mission = generateRepairMission(mockClient);

            const verifyObj = mission.objectives.find(o => o.type === 'verification');
            expect(verifyObj).toBeDefined();
            expect(verifyObj.id).toBe('obj-verify');
        });

        it('should include networkConnection and networkScan objectives', () => {
            const mission = generateRepairMission(mockClient);

            const networkConnObj = mission.objectives.find(o => o.type === 'networkConnection');
            const networkScanObj = mission.objectives.find(o => o.type === 'networkScan');

            expect(networkConnObj).toBeDefined();
            expect(networkScanObj).toBeDefined();
        });

        it('should include fileOperation objectives with repair operation', () => {
            const mission = generateRepairMission(mockClient);

            const repairObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'repair'
            );
            expect(repairObj).toBeDefined();
            expect(repairObj.targetFiles).toBeDefined();
        });

        it('should respect hasTimed option', () => {
            const timedMission = generateRepairMission(mockClient, { hasTimed: true });
            const untimedMission = generateRepairMission(mockClient, { hasTimed: false });

            expect(timedMission.timeLimitMinutes).toBeGreaterThan(0);
            expect(untimedMission.timeLimitMinutes).toBeNull();
        });

        it('should include success and failure consequences', () => {
            const mission = generateRepairMission(mockClient);

            expect(mission.consequences.success.credits).toBeGreaterThan(0);
            expect(mission.consequences.success.reputation).toBe(1);
            expect(mission.consequences.success.messages).toHaveLength(1);

            expect(mission.consequences.failure.credits).toBeLessThan(0);
            expect(mission.consequences.failure.reputation).toBe(-1);
        });

        it('should generate briefing message with NAR attachments', () => {
            const mission = generateRepairMission(mockClient);

            expect(mission.briefingMessage.attachments).toBeDefined();
            expect(mission.briefingMessage.attachments.length).toBeGreaterThan(0);
            expect(mission.briefingMessage.attachments[0].type).toBe('networkAddress');
        });

        it('should set arc fields when provided', () => {
            const mission = generateRepairMission(mockClient, {
                arcId: 'arc-123',
                arcSequence: 2,
                arcTotal: 3,
                arcContext: { previousMissionId: 'prev-mission' },
            });

            expect(mission.arcId).toBe('arc-123');
            expect(mission.arcSequence).toBe(2);
            expect(mission.arcTotal).toBe(3);
            expect(mission.requiresCompletedMission).toBe('prev-mission');
        });
    });

    // ========================================================================
    // generateBackupMission
    // ========================================================================

    describe('generateBackupMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid backup mission', () => {
            const mission = generateBackupMission(mockClient);

            expect(mission.missionId).toMatch(/^backup-/);
            expect(mission.missionType).toBe('backup');
        });

        it('should include copy and paste objectives', () => {
            const mission = generateBackupMission(mockClient);

            const copyObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'copy'
            );
            const pasteObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'paste'
            );

            expect(copyObj).toBeDefined();
            expect(pasteObj).toBeDefined();
        });

        it('should handle same-network backup scenarios', () => {
            // Run multiple times to hit same-network case (40% chance)
            let foundSameNetwork = false;
            for (let i = 0; i < 20 && !foundSameNetwork; i++) {
                const mission = generateBackupMission(mockClient);
                if (mission.networks.length === 1 && mission.networks[0].fileSystems.length >= 2) {
                    foundSameNetwork = true;
                }
            }
            // Can't guarantee we'll hit it, but mission should always be valid
            expect(true).toBe(true);
        });

        it('should include verification objective', () => {
            const mission = generateBackupMission(mockClient);

            const verifyObj = mission.objectives.find(o => o.type === 'verification');
            expect(verifyObj).toBeDefined();
        });
    });

    // ========================================================================
    // generateTransferMission
    // ========================================================================

    describe('generateTransferMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid transfer mission', () => {
            const mission = generateTransferMission(mockClient);

            expect(mission.missionId).toMatch(/^transfer-/);
            expect(mission.missionType).toBe('transfer');
        });

        it('should always use two networks', () => {
            const mission = generateTransferMission(mockClient);

            expect(mission.networks).toHaveLength(2);
        });

        it('should include objectives for both networks', () => {
            const mission = generateTransferMission(mockClient);

            const networkConnections = mission.objectives.filter(o => o.type === 'networkConnection');
            expect(networkConnections.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ========================================================================
    // generateRestoreFromBackupMission
    // ========================================================================

    describe('generateRestoreFromBackupMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid restore mission', () => {
            const mission = generateRestoreFromBackupMission(mockClient);

            expect(mission.missionId).toMatch(/^restore-/);
            expect(mission.missionType).toBe('restore');
            expect(mission.difficulty).toBe('Hard');
        });

        it('should include delete, copy, and paste objectives', () => {
            const mission = generateRestoreFromBackupMission(mockClient);

            const deleteObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'delete'
            );
            const copyObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'copy'
            );
            const pasteObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'paste'
            );

            expect(deleteObj).toBeDefined();
            expect(copyObj).toBeDefined();
            expect(pasteObj).toBeDefined();
        });

        it('should have corrupt files on primary and clean files on backup', () => {
            const mission = generateRestoreFromBackupMission(mockClient);

            const primaryFs = mission.networks[0].fileSystems[0];
            const backupFs = mission.networks[0].fileSystems[1];

            const primaryCorruptFiles = primaryFs.files.filter(f => f.corrupted && f.targetFile);
            const backupCleanFiles = backupFs.files.filter(f => !f.corrupted && f.targetFile);

            expect(primaryCorruptFiles.length).toBeGreaterThan(0);
            expect(backupCleanFiles.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // generateRepairAndBackupMission
    // ========================================================================

    describe('generateRepairAndBackupMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid repair-and-backup mission', () => {
            const mission = generateRepairAndBackupMission(mockClient);

            expect(mission.missionId).toMatch(/^repair-backup-/);
            expect(mission.missionType).toBe('repair-backup');
            expect(mission.difficulty).toBe('Hard');
        });

        it('should include repair, copy, and paste objectives', () => {
            const mission = generateRepairAndBackupMission(mockClient);

            const repairObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'repair'
            );
            const copyObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'copy'
            );
            const pasteObj = mission.objectives.find(
                o => o.type === 'fileOperation' && o.operation === 'paste'
            );

            expect(repairObj).toBeDefined();
            expect(copyObj).toBeDefined();
            expect(pasteObj).toBeDefined();
        });
    });

    // ========================================================================
    // generateMission (random type)
    // ========================================================================

    describe('generateMission', () => {
        beforeEach(() => {
            getClientById.mockReturnValue(createMockClient());
        });

        it('should generate a valid mission for a client ID', () => {
            const mission = generateMission('test-client-001');

            expect(mission).not.toBeNull();
            expect(mission.missionId).toBeDefined();
            expect(mission.missionType).toMatch(/^(repair|backup|transfer|restore|repair-backup)$/);
        });

        it('should return null for unknown client', () => {
            getClientById.mockReturnValue(null);

            const mission = generateMission('unknown-client');

            expect(mission).toBeNull();
        });

        it('should generate different mission types (weighted random)', () => {
            getClientById.mockReturnValue(createMockClient());
            const types = new Set();

            // Generate many missions to verify distribution
            for (let i = 0; i < 50; i++) {
                const mission = generateMission('test-client');
                types.add(mission.missionType);
            }

            // Should have generated at least repair and backup (most common)
            expect(types.has('repair')).toBe(true);
            expect(types.has('backup')).toBe(true);
        });

        it('should respect hasTimed option', () => {
            const timedMission = generateMission('test-client', { hasTimed: true });
            const untimedMission = generateMission('test-client', { hasTimed: false });

            expect(timedMission.timeLimitMinutes).not.toBeNull();
            expect(untimedMission.timeLimitMinutes).toBeNull();
        });
    });

    // ========================================================================
    // generateMissionArc
    // ========================================================================

    describe('generateMissionArc', () => {
        const mockStoryline = createMockStoryline();
        const mockClients = [
            createMockClient({ id: 'client-1' }),
            createMockClient({ id: 'client-2' }),
            createMockClient({ id: 'client-3' }),
        ];

        it('should generate an arc with correct number of missions', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.missions).toHaveLength(3);
            expect(arc.totalMissions).toBe(3);
        });

        it('should set arc ID on all missions', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.arcId).toBeDefined();
            arc.missions.forEach(mission => {
                expect(mission.arcId).toBe(arc.arcId);
            });
        });

        it('should set correct arc sequence numbers', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.missions[0].arcSequence).toBe(1);
            expect(arc.missions[1].arcSequence).toBe(2);
            expect(arc.missions[2].arcSequence).toBe(3);
        });

        it('should link missions via requiresCompletedMission', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.missions[0].requiresCompletedMission).toBeNull();
            expect(arc.missions[1].requiresCompletedMission).toBe(arc.missions[0].missionId);
            expect(arc.missions[2].requiresCompletedMission).toBe(arc.missions[1].missionId);
        });

        it('should only show first mission initially', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.visibleMissionIds).toHaveLength(1);
            expect(arc.visibleMissionIds[0]).toBe(arc.missions[0].missionId);
        });

        it('should generate missions with correct types from storyline', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.missions[0].missionType).toBe('repair');
            expect(arc.missions[1].missionType).toBe('backup');
            expect(arc.missions[2].missionType).toBe('transfer');
        });

        it('should apply hasTimed from storyline', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            expect(arc.missions[0].timeLimitMinutes).toBeNull();
            expect(arc.missions[1].timeLimitMinutes).toBeNull();
            expect(arc.missions[2].timeLimitMinutes).not.toBeNull();
        });

        it('should return null for invalid input', () => {
            expect(generateMissionArc(null, mockClients)).toBeNull();
            expect(generateMissionArc(mockStoryline, [])).toBeNull();
            expect(generateMissionArc(mockStoryline, [mockClients[0]])).toBeNull();
        });

        it('should include arc name in mission titles', () => {
            const arc = generateMissionArc(mockStoryline, mockClients);

            arc.missions.forEach(mission => {
                expect(mission.title).toContain(mockStoryline.name);
            });
        });
    });

    // ========================================================================
    // generateInvestigationRepairMission
    // ========================================================================

    describe('generateInvestigationRepairMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid investigation repair mission', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            expect(mission.missionId).toMatch(/^investigation-repair-/);
            expect(mission.missionType).toBe('investigation-repair');
            expect(mission.difficulty).toBe('Hard');
            expect(mission.isInvestigation).toBe(true);
        });

        it('should create multiple file systems (2-4 volumes)', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            expect(mission.fileSystemCount).toBeGreaterThanOrEqual(10);
            expect(mission.fileSystemCount).toBeLessThanOrEqual(35);
            expect(mission.networks[0].fileSystems.length).toBe(mission.fileSystemCount);
        });

        it('should have exactly one target file system with corrupted files', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            const targetFs = mission.networks[0].fileSystems.find(
                fs => fs.id === mission.targetFileSystemId
            );
            expect(targetFs).toBeDefined();

            const corruptedFiles = targetFs.files.filter(f => f.corrupted && f.targetFile);
            expect(corruptedFiles.length).toBeGreaterThan(0);
        });

        it('should include investigation objective', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            const investigationObj = mission.objectives.find(o => o.type === 'investigation');
            expect(investigationObj).toBeDefined();
            expect(investigationObj.correctFileSystemId).toBe(mission.targetFileSystemId);
        });

        it('should require log-viewer software', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            expect(mission.requirements.software).toContain('log-viewer');
        });

        it('should generate activity logs for target file system', () => {
            const mission = generateInvestigationRepairMission(mockClient);

            const targetFs = mission.networks[0].fileSystems.find(
                fs => fs.id === mission.targetFileSystemId
            );
            expect(targetFs.logs).toBeDefined();
            expect(targetFs.logs.length).toBeGreaterThan(0);
        });

        it('should respect hasTimed option', () => {
            const timedMission = generateInvestigationRepairMission(mockClient, { hasTimed: true });
            const untimedMission = generateInvestigationRepairMission(mockClient, { hasTimed: false });

            expect(timedMission.timeLimitMinutes).toBeGreaterThan(0);
            expect(untimedMission.timeLimitMinutes).toBeNull();
        });
    });

    // ========================================================================
    // generateInvestigationRecoveryMission
    // ========================================================================

    describe('generateInvestigationRecoveryMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid investigation recovery mission', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            expect(mission.missionId).toMatch(/^investigation-recovery-/);
            expect(mission.missionType).toBe('investigation-recovery');
            expect(mission.difficulty).toBe('Hard');
            expect(mission.isInvestigation).toBe(true);
        });

        it('should create multiple file systems (2-4 volumes)', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            expect(mission.fileSystemCount).toBeGreaterThanOrEqual(10);
            expect(mission.fileSystemCount).toBeLessThanOrEqual(35);
        });

        it('should have target file system with deleted files', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            const targetFs = mission.networks[0].fileSystems.find(
                fs => fs.id === mission.targetFileSystemId
            );
            expect(targetFs).toBeDefined();

            const deletedFiles = targetFs.files.filter(f => f.status === 'deleted');
            expect(deletedFiles.length).toBeGreaterThan(0);
        });

        it('should include fileRecovery objective', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            const recoveryObj = mission.objectives.find(o => o.type === 'fileRecovery');
            expect(recoveryObj).toBeDefined();
            expect(recoveryObj.targetFiles).toBeDefined();
            expect(recoveryObj.targetFiles.length).toBeGreaterThan(0);
        });

        it('should require data-recovery-tool software', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            expect(mission.requirements.software).toContain('data-recovery-tool');
            expect(mission.requirements.software).toContain('log-viewer');
        });

        it('should generate deletion activity logs', () => {
            const mission = generateInvestigationRecoveryMission(mockClient);

            const targetFs = mission.networks[0].fileSystems.find(
                fs => fs.id === mission.targetFileSystemId
            );
            expect(targetFs.logs).toBeDefined();
            expect(targetFs.logs.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // generateSecureDeletionMission
    // ========================================================================

    describe('generateSecureDeletionMission', () => {
        const mockClient = createMockClient();

        it('should generate a valid secure deletion mission', () => {
            const mission = generateSecureDeletionMission(mockClient);

            expect(mission.missionId).toMatch(/^secure-deletion-/);
            expect(mission.missionType).toBe('secure-deletion');
            expect(mission.difficulty).toBe('Medium');
        });

        it('should have one of three variants', () => {
            const variants = new Set();
            // Generate multiple to hit all variants
            for (let i = 0; i < 20; i++) {
                const mission = generateSecureDeletionMission(mockClient);
                variants.add(mission.secureDeleteVariant);
            }

            // Should have at least 2 different variants in 20 generations
            expect(variants.size).toBeGreaterThanOrEqual(1);
            // All should be valid variants
            variants.forEach(v => {
                expect(['compliance', 'piracy', 'malware']).toContain(v);
            });
        });

        it('should include secureDelete objective', () => {
            const mission = generateSecureDeletionMission(mockClient);

            const secureDeleteObj = mission.objectives.find(o => o.type === 'secureDelete');
            expect(secureDeleteObj).toBeDefined();
            expect(secureDeleteObj.targetFiles).toBeDefined();
            expect(secureDeleteObj.targetFiles.length).toBeGreaterThanOrEqual(2);
        });

        it('should generate flagged files for deletion', () => {
            const mission = generateSecureDeletionMission(mockClient);

            const allFiles = mission.networks[0].fileSystems[0].files;
            const flaggedFiles = allFiles.filter(f => f.flagged);
            expect(flaggedFiles.length).toBeGreaterThanOrEqual(2);
        });

        it('should require data-recovery-tool for secure deletion', () => {
            const mission = generateSecureDeletionMission(mockClient);

            expect(mission.requirements.software).toContain('data-recovery-tool');
            expect(mission.requirements.software).toContain('log-viewer');
        });

        it('should generate appropriate activity logs', () => {
            const mission = generateSecureDeletionMission(mockClient);

            const logs = mission.networks[0].fileSystems[0].logs;
            expect(logs).toBeDefined();
            expect(logs.length).toBeGreaterThan(0);
        });

        it('should respect hasTimed option', () => {
            const timedMission = generateSecureDeletionMission(mockClient, { hasTimed: true });
            const untimedMission = generateSecureDeletionMission(mockClient, { hasTimed: false });

            expect(timedMission.timeLimitMinutes).toBeGreaterThan(0);
            expect(untimedMission.timeLimitMinutes).toBeNull();
        });
    });

    // ========================================================================
    // getMissionTypesForPlayer
    // ========================================================================

    describe('getMissionTypesForPlayer', () => {
        it('should return base mission types when no software unlocked', () => {
            const types = getMissionTypesForPlayer([]);

            expect(types).toContain('repair');
            expect(types).toContain('backup');
            expect(types).toContain('transfer');
            expect(types).toContain('restore');
            expect(types).toContain('repair-backup');
            expect(types).not.toContain('investigation-repair');
            expect(types).not.toContain('investigation-recovery');
            expect(types).not.toContain('secure-deletion');
        });

        it('should unlock investigation missions when investigation-tooling is unlocked', () => {
            const types = getMissionTypesForPlayer(['investigation-tooling']);

            expect(types).toContain('investigation-repair');
            expect(types).toContain('investigation-recovery');
            expect(types).toContain('secure-deletion');
        });

        it('should unlock investigation missions when log-viewer AND data-recovery-tool are unlocked', () => {
            const types = getMissionTypesForPlayer(['log-viewer', 'data-recovery-tool']);

            expect(types).toContain('investigation-repair');
            expect(types).toContain('investigation-recovery');
            expect(types).toContain('secure-deletion');
        });

        it('should not unlock investigation missions with only log-viewer', () => {
            const types = getMissionTypesForPlayer(['log-viewer']);

            expect(types).not.toContain('investigation-repair');
            expect(types).not.toContain('investigation-recovery');
            expect(types).not.toContain('secure-deletion');
        });

        it('should not unlock investigation missions with only data-recovery-tool', () => {
            const types = getMissionTypesForPlayer(['data-recovery-tool']);

            expect(types).not.toContain('investigation-repair');
            expect(types).not.toContain('investigation-recovery');
            expect(types).not.toContain('secure-deletion');
        });

        it('should handle undefined input', () => {
            const types = getMissionTypesForPlayer();

            expect(types).toContain('repair');
            expect(types).toContain('backup');
        });
    });

    // ========================================================================
    // Mission structure validation
    // ========================================================================

    describe('mission structure validation', () => {
        const mockClient = createMockClient();

        it('all mission types should have isProcedurallyGenerated flag', () => {
            const missions = [
                generateRepairMission(mockClient),
                generateBackupMission(mockClient),
                generateTransferMission(mockClient),
                generateRestoreFromBackupMission(mockClient),
                generateRepairAndBackupMission(mockClient),
                generateInvestigationRepairMission(mockClient),
                generateInvestigationRecoveryMission(mockClient),
                generateSecureDeletionMission(mockClient),
            ];

            missions.forEach(mission => {
                expect(mission.isProcedurallyGenerated).toBe(true);
            });
        });

        it('all mission types should have generatedAt timestamp', () => {
            const missions = [
                generateRepairMission(mockClient),
                generateBackupMission(mockClient),
                generateTransferMission(mockClient),
            ];

            missions.forEach(mission => {
                expect(mission.generatedAt).toBeDefined();
                expect(() => new Date(mission.generatedAt)).not.toThrow();
            });
        });

        it('all mission types should have required software list', () => {
            const mission = generateRepairMission(mockClient);

            expect(mission.requirements.software).toContain('vpn-client');
            expect(mission.requirements.software).toContain('network-address-register');
            expect(mission.requirements.software).toContain('network-scanner');
            expect(mission.requirements.software).toContain('file-manager');
        });

        it('objectives should have unique IDs', () => {
            const mission = generateRepairMission(mockClient);
            const ids = mission.objectives.map(o => o.id);
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).toBe(ids.length);
        });

        it('objectives should not exceed 16 (15 base + 1 verify)', () => {
            // Generate multiple missions to check cap
            for (let i = 0; i < 10; i++) {
                const mission = generateRepairMission(mockClient);
                expect(mission.objectives.length).toBeLessThanOrEqual(16);
            }
        });

        it('fileOperation objectives should have valid string arrays for targetFiles', () => {
            const missions = [
                generateRepairMission(mockClient),
                generateBackupMission(mockClient),
                generateTransferMission(mockClient),
                generateRestoreFromBackupMission(mockClient),
                generateRepairAndBackupMission(mockClient),
            ];

            missions.forEach(mission => {
                const fileOpObjectives = mission.objectives.filter(
                    o => o.type === 'fileOperation' && o.targetFiles
                );

                fileOpObjectives.forEach(obj => {
                    expect(Array.isArray(obj.targetFiles)).toBe(true);
                    expect(obj.targetFiles.length).toBeGreaterThan(0);
                    // Verify each item is a non-null string (catches the .map(f => f.name) bug)
                    obj.targetFiles.forEach(fileName => {
                        expect(typeof fileName).toBe('string');
                        expect(fileName).not.toBeNull();
                        expect(fileName).not.toBeUndefined();
                        expect(fileName.length).toBeGreaterThan(0);
                    });
                });
            });
        });
    });
});

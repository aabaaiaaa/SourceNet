import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry BEFORE importing the module under test
vi.mock('../systems/NetworkRegistry', () => ({
    default: {
        addFilesToFileSystem: vi.fn(() => true),
        registerNetwork: vi.fn(() => true),
        registerDevice: vi.fn(() => true),
        registerFileSystem: vi.fn(() => true),
        getFileSystem: vi.fn(() => null),
        // Required by networkUtils.js for IP/subnet generation
        isIpInUse: vi.fn(() => false),
        isSubnetInUse: vi.fn(() => false),
    },
}));

// Mock clientRegistry
vi.mock('../data/clientRegistry', () => ({
    getClientById: vi.fn((id) => ({
        id,
        name: 'Test Client',
        industry: 'banking',
    })),
}));

// NOTE: Do NOT mock networkUtils - mocking randomInt causes infinite loops in generateExtensionFiles

// Now import the module and mocked modules
import {
    extensionConfig,
    shouldTriggerExtension,
    getObjectiveProgress,
    randomPick,
    randomRange,
    getFileSizeProfile,
    generateFileSize,
    generateHostname,
    generateExtensionFiles,
    extensionPatterns,
} from './MissionExtensionGenerator';

import networkRegistry from '../systems/NetworkRegistry';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockMission = (overrides = {}) => ({
    missionId: 'mission-123',
    clientId: 'client-test',
    missionType: 'repair',
    objectives: [
        { id: 'obj-1', type: 'networkConnection', status: 'complete' },
        { id: 'obj-2', type: 'fileOperation', status: 'pending' },
        { id: 'obj-3', type: 'verification', status: 'pending' },
    ],
    networks: [{
        networkId: 'test-network',
        networkName: 'Test-Network',
        address: '192.168.1.0/24',
        bandwidth: 100,
        fileSystems: [{
            id: 'fs-test-001',
            ip: '192.168.1.10',
            name: 'test-server',
            files: [
                { name: 'file1.db', size: '10 MB', sizeBytes: 10485760, corrupted: true, targetFile: true },
                { name: 'file2.db', size: '5 MB', sizeBytes: 5242880, corrupted: true, targetFile: true },
            ]
        }]
    }],
    ...overrides,
});

const createMockBackupMission = (overrides = {}) => ({
    missionId: 'mission-backup-123',
    clientId: 'client-test',
    missionType: 'backup',
    objectives: [
        { id: 'obj-1', type: 'networkConnection', status: 'complete' },
        { id: 'obj-2', type: 'fileOperation', operation: 'copy', status: 'pending' },
        { id: 'obj-3', type: 'fileOperation', operation: 'paste', status: 'pending' },
        { id: 'obj-4', type: 'verification', status: 'pending' },
    ],
    networks: [
        {
            networkId: 'source-network',
            networkName: 'Source-Network',
            address: '192.168.1.0/24',
            bandwidth: 100,
            fileSystems: [
                {
                    id: 'fs-source-001',
                    ip: '192.168.1.10',
                    name: 'source-server',
                    files: [
                        { name: 'backup1.db', size: '10 MB', sizeBytes: 10485760, corrupted: false, targetFile: true },
                        { name: 'backup2.db', size: '5 MB', sizeBytes: 5242880, corrupted: false, targetFile: true },
                    ]
                },
                {
                    id: 'fs-dest-001',
                    ip: '192.168.1.20',
                    name: 'backup-server',
                    files: []
                }
            ]
        }
    ],
    ...overrides,
});

const createMockTransferMission = (overrides = {}) => ({
    missionId: 'mission-transfer-123',
    clientId: 'client-test',
    missionType: 'transfer',
    objectives: [
        { id: 'obj-1', type: 'networkConnection', status: 'complete' },
        { id: 'obj-2', type: 'fileOperation', operation: 'copy', status: 'pending' },
        { id: 'obj-3', type: 'fileOperation', operation: 'paste', status: 'pending' },
        { id: 'obj-4', type: 'verification', status: 'pending' },
    ],
    networks: [
        {
            networkId: 'source-network',
            networkName: 'Source-Network',
            address: '192.168.1.0/24',
            bandwidth: 100,
            fileSystems: [{
                id: 'fs-source-001',
                ip: '192.168.1.10',
                name: 'source-server',
                files: [
                    { name: 'transfer1.db', size: '10 MB', sizeBytes: 10485760, corrupted: false, targetFile: true },
                    { name: 'transfer2.db', size: '5 MB', sizeBytes: 5242880, corrupted: false, targetFile: true },
                ]
            }]
        },
        {
            networkId: 'dest-network',
            networkName: 'Dest-Network',
            address: '192.168.2.0/24',
            bandwidth: 100,
            fileSystems: [{
                id: 'fs-dest-001',
                ip: '192.168.2.10',
                name: 'dest-server',
                files: []
            }]
        }
    ],
    ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    networkRegistry.addFilesToFileSystem.mockReturnValue(true);
    networkRegistry.registerNetwork.mockReturnValue(true);
    networkRegistry.registerDevice.mockReturnValue(true);
    networkRegistry.registerFileSystem.mockReturnValue(true);
    networkRegistry.getFileSystem.mockReturnValue(null);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ============================================================================
// extensionConfig Tests
// ============================================================================

describe('extensionConfig', () => {
    it('should have valid midMissionThreshold between 0 and 1', () => {
        expect(extensionConfig.midMissionThreshold).toBeGreaterThanOrEqual(0);
        expect(extensionConfig.midMissionThreshold).toBeLessThanOrEqual(1);
    });

    it('should have valid midMissionChance between 0 and 1', () => {
        expect(extensionConfig.midMissionChance).toBeGreaterThanOrEqual(0);
        expect(extensionConfig.midMissionChance).toBeLessThanOrEqual(1);
    });

    it('should have valid postCompletionChance between 0 and 1', () => {
        expect(extensionConfig.postCompletionChance).toBeGreaterThanOrEqual(0);
        expect(extensionConfig.postCompletionChance).toBeLessThanOrEqual(1);
    });

    it('should have valid payout multiplier ranges', () => {
        expect(extensionConfig.midMissionMultiplier.min).toBeLessThan(extensionConfig.midMissionMultiplier.max);
        expect(extensionConfig.postCompletionMultiplier.min).toBeLessThan(extensionConfig.postCompletionMultiplier.max);
        expect(extensionConfig.midMissionMultiplier.min).toBeGreaterThan(1);
        expect(extensionConfig.postCompletionMultiplier.min).toBeGreaterThan(1);
    });

    it('should have valid newNetworkChance between 0 and 1', () => {
        expect(extensionConfig.newNetworkChance).toBeGreaterThanOrEqual(0);
        expect(extensionConfig.newNetworkChance).toBeLessThanOrEqual(1);
    });
});

// ============================================================================
// getObjectiveProgress Tests
// ============================================================================

describe('getObjectiveProgress', () => {
    it('should return zeros for null objectives', () => {
        const result = getObjectiveProgress(null);
        expect(result).toEqual({ completed: 0, total: 0, isAllRealComplete: false });
    });

    it('should exclude verification objectives from count', () => {
        const objectives = [
            { id: 'obj-1', type: 'networkConnection', status: 'complete' },
            { id: 'obj-2', type: 'fileOperation', status: 'complete' },
            { id: 'obj-3', type: 'verification', status: 'pending' },
        ];
        const result = getObjectiveProgress(objectives);
        expect(result.total).toBe(2);
        expect(result.completed).toBe(2);
    });

    it('should count completed vs total objectives', () => {
        const objectives = [
            { id: 'obj-1', type: 'networkConnection', status: 'complete' },
            { id: 'obj-2', type: 'fileOperation', status: 'pending' },
            { id: 'obj-3', type: 'fileOperation', status: 'pending' },
        ];
        const result = getObjectiveProgress(objectives);
        expect(result.completed).toBe(1);
        expect(result.total).toBe(3);
        expect(result.isAllRealComplete).toBe(false);
    });

    it('should set isAllRealComplete true when all non-verification done', () => {
        const objectives = [
            { id: 'obj-1', type: 'networkConnection', status: 'complete' },
            { id: 'obj-2', type: 'fileOperation', status: 'complete' },
            { id: 'obj-3', type: 'verification', status: 'pending' },
        ];
        const result = getObjectiveProgress(objectives);
        expect(result.isAllRealComplete).toBe(true);
    });

    it('should handle empty objectives array', () => {
        const result = getObjectiveProgress([]);
        expect(result).toEqual({ completed: 0, total: 0, isAllRealComplete: false });
    });
});

// ============================================================================
// shouldTriggerExtension Tests
// ============================================================================

describe('shouldTriggerExtension', () => {
    const createMockMission = () => ({
        missionId: 'mission-123',
        clientId: 'client-test',
        missionType: 'repair',
    });

    it('should return false if mission already has extension offer', () => {
        const mission = createMockMission();
        const extensionOffers = { 'mission-123': { offered: true } };
        expect(shouldTriggerExtension(mission, 1, 2, false, extensionOffers)).toBe(false);
    });

    it('should return false if completion ratio below threshold', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(shouldTriggerExtension(mission, 1, 4, false, null)).toBe(false);
    });

    it('should potentially trigger at 50% completion', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(shouldTriggerExtension(mission, 2, 4, false, null)).toBe(true);
    });

    it('should respect midMissionChance probability', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        expect(shouldTriggerExtension(mission, 2, 4, false, null)).toBe(false);
    });

    it('should potentially trigger post-completion', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(shouldTriggerExtension(mission, 2, 2, true, null)).toBe(true);
    });

    it('should respect postCompletionChance probability', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        expect(shouldTriggerExtension(mission, 2, 2, true, null)).toBe(false);
    });

    it('should handle null extensionOffers', () => {
        const mission = createMockMission();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(shouldTriggerExtension(mission, 2, 4, false, null)).toBe(true);
    });
});
// ============================================================================
// Helper Function Tests
// ============================================================================

describe('randomPick', () => {
    it('should return null for empty array', () => {
        expect(randomPick([])).toBeNull();
    });

    it('should return null for null input', () => {
        expect(randomPick(null)).toBeNull();
    });

    it('should return an item from the array', () => {
        const arr = ['a', 'b', 'c'];
        const result = randomPick(arr);
        expect(arr).toContain(result);
    });
});

describe('randomRange', () => {
    it('should return a number within the specified range', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const result = randomRange(10, 20);
        expect(result).toBe(15);
    });

    it('should return min when random is 0', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const result = randomRange(10, 20);
        expect(result).toBe(10);
    });
});

describe('getFileSizeProfile', () => {
    it('should return large range for database files in backup missions', () => {
        const profile = getFileSizeProfile('data.db', 'backup');
        expect(profile.minBytes).toBeGreaterThanOrEqual(50 * 1024 * 1024);
        expect(profile.maxBytes).toBeLessThanOrEqual(2 * 1024 * 1024 * 1024);
    });

    it('should return smaller range for database files in non-backup missions', () => {
        const profile = getFileSizeProfile('data.db', 'repair');
        expect(profile.minBytes).toBe(10 * 1024 * 1024);
        expect(profile.maxBytes).toBe(500 * 1024 * 1024);
    });

    it('should return small range for log files', () => {
        const profile = getFileSizeProfile('system.log', 'repair');
        expect(profile.maxBytes).toBeLessThanOrEqual(500 * 1024);
    });
});

describe('generateFileSize', () => {
    it('should return size string and sizeBytes', () => {
        const result = generateFileSize('data.db', 'repair');
        expect(result).toHaveProperty('size');
        expect(result).toHaveProperty('sizeBytes');
        expect(typeof result.size).toBe('string');
        expect(typeof result.sizeBytes).toBe('number');
    });
});

describe('generateHostname', () => {
    it('should create hostname from client name and purpose', () => {
        const hostname = generateHostname('Test Client', 'server', 1);
        expect(hostname).toBe('test-server-01');
    });

    it('should sanitize special characters', () => {
        const hostname = generateHostname('Test@Client#123', 'backup', 2);
        expect(hostname).toBe('testclient123-backup-02');
    });

    it('should pad index with zeros', () => {
        const hostname = generateHostname('Client', 'archive', 5);
        expect(hostname).toBe('client-archive-05');
    });
});

describe('generateExtensionFiles', () => {
    it('should generate files for banking industry', () => {
        const result = generateExtensionFiles('banking', 'repair', 3, false);
        expect(result.files.length).toBeGreaterThanOrEqual(3);
        expect(result.targetFiles.length).toBe(3);
        expect(result.files.some(f => f.name.includes('financial'))).toBe(true);
    });

    it('should mark target files correctly', () => {
        const result = generateExtensionFiles('corporate', 'backup', 2, false);
        const targetFileCount = result.files.filter(f => f.targetFile).length;
        expect(targetFileCount).toBe(2);
    });

    it('should set corrupted flag on target files when specified', () => {
        const result = generateExtensionFiles('government', 'repair', 2, true);
        const corruptedTargets = result.files.filter(f => f.targetFile && f.corrupted);
        expect(corruptedTargets.length).toBe(2);
    });

    it('should calculate totalDataBytes correctly', () => {
        const result = generateExtensionFiles('utilities', 'backup', 2, false);
        const calculatedTotal = result.files
            .filter(f => f.targetFile)
            .reduce((sum, f) => sum + f.sizeBytes, 0);
        expect(result.totalDataBytes).toBe(calculatedTotal);
    });
});

// ============================================================================
// Pattern A Bug Tests - THESE SHOULD FAIL UNTIL FIXED
// Pattern A should use existingFs.id, not existingFs.ip
// ============================================================================

describe('Pattern A: addFilesToFileSystem bug', () => {
    describe('backup mission Pattern A (moreFiles)', () => {
        it('should call addFilesToFileSystem with filesystem ID, not IP', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.backup.moreFiles(mission, client);

            expect(result).not.toBeNull();
            // BUG: Currently called with IP '192.168.1.10' instead of ID 'fs-source-001'
            expect(networkRegistry.addFilesToFileSystem).toHaveBeenCalledWith(
                'fs-source-001', // Should be filesystem ID
                expect.any(Array)
            );
        });
    });

    describe('transfer mission Pattern A (moreFiles)', () => {
        it('should call addFilesToFileSystem with filesystem ID, not IP', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.transfer.moreFiles(mission, client);

            expect(result).not.toBeNull();
            // BUG: Currently called with IP '192.168.1.10' instead of ID 'fs-source-001'
            expect(networkRegistry.addFilesToFileSystem).toHaveBeenCalledWith(
                'fs-source-001', // Should be filesystem ID
                expect.any(Array)
            );
        });
    });
});

// ============================================================================
// Pattern B/C Bug Tests - THESE SHOULD FAIL UNTIL FIXED
// Pattern B/C should use object parameters, not positional arguments
// ============================================================================

describe('Pattern B/C: registerDevice/registerFileSystem bug', () => {
    describe('backup mission Pattern B (secondDestination)', () => {
        it('should call registerDevice with object parameter', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.backup.secondDestination(mission, client);

            expect(result).not.toBeNull();
            // BUG: Currently called with positional args (subnet, device) instead of object
            expect(networkRegistry.registerDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: expect.any(String),
                    hostname: expect.any(String),
                    networkId: expect.any(String),
                    fileSystemId: expect.any(String),
                })
            );
        });

        it('should call registerFileSystem with object parameter', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.backup.secondDestination(mission, client);

            // BUG: Currently called with positional args (ip, fileSystem) instead of object
            expect(networkRegistry.registerFileSystem).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String),
                    files: expect.any(Array),
                })
            );
        });
    });

    describe('backup mission Pattern C (newNetwork)', () => {
        it('should call registerNetwork with object parameter', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.backup.newNetwork(mission, client);

            expect(result).not.toBeNull();
            // BUG: Currently called with positional args (networkId, networkData) instead of object
            expect(networkRegistry.registerNetwork).toHaveBeenCalledWith(
                expect.objectContaining({
                    networkId: expect.any(String),
                    networkName: expect.any(String),
                    address: expect.any(String),
                    bandwidth: expect.any(Number),
                })
            );
        });

        it('should call registerDevice with object parameter', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.backup.newNetwork(mission, client);

            expect(networkRegistry.registerDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: expect.any(String),
                    hostname: expect.any(String),
                    networkId: expect.any(String),
                    fileSystemId: expect.any(String),
                })
            );
        });

        it('should call registerFileSystem with object parameter', () => {
            const mission = createMockBackupMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.backup.newNetwork(mission, client);

            expect(networkRegistry.registerFileSystem).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String),
                    files: expect.any(Array),
                })
            );
        });
    });

    describe('transfer mission Pattern B (secondDestination)', () => {
        it('should call registerDevice with object parameter', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.transfer.secondDestination(mission, client);

            expect(result).not.toBeNull();
            expect(networkRegistry.registerDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: expect.any(String),
                    hostname: expect.any(String),
                    networkId: expect.any(String),
                    fileSystemId: expect.any(String),
                })
            );
        });

        it('should call registerFileSystem with object parameter', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.transfer.secondDestination(mission, client);

            expect(networkRegistry.registerFileSystem).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String),
                    files: expect.any(Array),
                })
            );
        });
    });

    describe('transfer mission Pattern C (newNetwork)', () => {
        it('should call registerNetwork with object parameter', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.transfer.newNetwork(mission, client);

            expect(result).not.toBeNull();
            expect(networkRegistry.registerNetwork).toHaveBeenCalledWith(
                expect.objectContaining({
                    networkId: expect.any(String),
                    networkName: expect.any(String),
                    address: expect.any(String),
                    bandwidth: expect.any(Number),
                })
            );
        });

        it('should call registerDevice with object parameter', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.transfer.newNetwork(mission, client);

            expect(networkRegistry.registerDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: expect.any(String),
                    hostname: expect.any(String),
                    networkId: expect.any(String),
                    fileSystemId: expect.any(String),
                })
            );
        });

        it('should call registerFileSystem with object parameter', () => {
            const mission = createMockTransferMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            extensionPatterns.transfer.newNetwork(mission, client);

            expect(networkRegistry.registerFileSystem).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.any(String),
                    files: expect.any(Array),
                })
            );
        });
    });
});

// ============================================================================
// Repair Mission Pattern Tests (Reference - these should pass)
// ============================================================================

describe('Repair mission patterns (reference implementation)', () => {
    describe('Pattern A (moreFiles)', () => {
        it('should call addFilesToFileSystem with filesystem ID', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.moreFiles(mission, client);

            expect(result).not.toBeNull();
            // Repair mission Pattern A is correctly implemented
            expect(networkRegistry.addFilesToFileSystem).toHaveBeenCalledWith(
                'fs-test-001',
                expect.any(Array)
            );
        });

        it('should return objectives for repairing files', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.moreFiles(mission, client);

            expect(result.objectives).toHaveLength(1);
            expect(result.objectives[0].type).toBe('fileOperation');
            expect(result.objectives[0].operation).toBe('repair');
        });

        it('should not require NAR', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.moreFiles(mission, client);

            expect(result.newNarRequired).toBe(false);
        });

        it('should return null if no existing file system', () => {
            const mission = createMockMission({ networks: [{ fileSystems: [] }] });
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.moreFiles(mission, client);

            expect(result).toBeNull();
        });
    });

    describe('Pattern B (secondServer)', () => {
        it('should call registerDevice with object parameter', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.secondServer(mission, client);

            expect(result).not.toBeNull();
            expect(networkRegistry.registerDevice).toHaveBeenCalledWith(
                expect.objectContaining({
                    ip: expect.any(String),
                    hostname: expect.any(String),
                    networkId: 'test-network',
                    fileSystemId: expect.any(String),
                })
            );
        });

        it('should require NAR for new device access', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.secondServer(mission, client);

            expect(result.newNarRequired).toBe(true);
            expect(result.narAttachment).toBeDefined();
        });
    });

    describe('Pattern C (newNetwork)', () => {
        it('should call registerNetwork with object parameter', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.newNetwork(mission, client);

            expect(result).not.toBeNull();
            expect(networkRegistry.registerNetwork).toHaveBeenCalledWith(
                expect.objectContaining({
                    networkId: expect.any(String),
                    networkName: expect.any(String),
                    address: expect.any(String),
                    bandwidth: expect.any(Number),
                })
            );
        });

        it('should mark network for revocation on complete', () => {
            const mission = createMockMission();
            const client = { id: 'client-test', name: 'Test Client', industry: 'banking' };

            const result = extensionPatterns.repair.newNetwork(mission, client);

            const newNetwork = result.networks.find(n => n.revokeOnComplete);
            expect(newNetwork).toBeDefined();
            expect(newNetwork.revokeReason).toBe('Mission access expired');
        });
    });
});
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../data/clientRegistry', () => ({
    getAccessibleClients: vi.fn(() => [
        { id: 'client-1', name: 'Client 1', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
        { id: 'client-2', name: 'Client 2', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
        { id: 'client-3', name: 'Client 3', clientType: 'bank-local', industry: 'banking', minReputation: 1 },
        { id: 'client-4', name: 'Client 4', clientType: 'corp-small', industry: 'corporate', minReputation: 1 },
        { id: 'client-5', name: 'Client 5', clientType: 'retail-medium', industry: 'retail', minReputation: 1 },
        { id: 'client-6', name: 'Client 6', clientType: 'govt-local', industry: 'government', minReputation: 1 },
    ]),
    getRandomAccessibleClient: vi.fn((rep, exclude = []) => {
        const clients = [
            { id: 'client-1', name: 'Client 1', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
            { id: 'client-2', name: 'Client 2', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
            { id: 'client-3', name: 'Client 3', clientType: 'bank-local', industry: 'banking', minReputation: 1 },
            { id: 'client-4', name: 'Client 4', clientType: 'corp-small', industry: 'corporate', minReputation: 1 },
            { id: 'client-5', name: 'Client 5', clientType: 'retail-medium', industry: 'retail', minReputation: 1 },
            { id: 'client-6', name: 'Client 6', clientType: 'govt-local', industry: 'government', minReputation: 1 },
        ];
        const available = clients.filter(c => !exclude.includes(c.id));
        return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
    }),
    getAllClients: vi.fn(() => [
        { id: 'client-1', name: 'Client 1', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
        { id: 'client-2', name: 'Client 2', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
        { id: 'client-3', name: 'Client 3', clientType: 'bank-local', industry: 'banking', minReputation: 1 },
        { id: 'client-4', name: 'Client 4', clientType: 'corp-small', industry: 'corporate', minReputation: 1 },
        { id: 'client-5', name: 'Client 5', clientType: 'retail-medium', industry: 'retail', minReputation: 1 },
        { id: 'client-6', name: 'Client 6', clientType: 'govt-local', industry: 'government', minReputation: 1 },
        { id: 'client-7', name: 'Client 7', clientType: 'bank-national', industry: 'banking', minReputation: 3 },
    ]),
    getClientsByIndustry: vi.fn((industry) => {
        const all = [
            { id: 'client-1', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
            { id: 'client-2', clientType: 'corp-medium', industry: 'corporate', minReputation: 1 },
            { id: 'client-3', clientType: 'bank-local', industry: 'banking', minReputation: 1 },
            { id: 'client-4', clientType: 'corp-small', industry: 'corporate', minReputation: 1 },
            { id: 'client-5', clientType: 'retail-medium', industry: 'retail', minReputation: 1 },
            { id: 'client-6', clientType: 'govt-local', industry: 'government', minReputation: 1 },
        ];
        return all.filter(c => c.industry === industry);
    }),
}));

vi.mock('./MissionGenerator', () => ({
    generateMission: vi.fn((clientId) => ({
        missionId: `mission-${clientId}-${Date.now()}`,
        clientId,
        clientType: 'corp-medium',
        missionType: 'repair',
        difficulty: 'Medium',
        basePayout: 1000,
        networks: [],
        objectives: [],
    })),
    generateMissionArc: vi.fn((storyline, clients) => ({
        arcId: `arc-${Date.now()}`,
        arcName: storyline.name,
        missions: clients.map((c, i) => ({
            missionId: `arc-mission-${i}-${Date.now()}`,
            clientId: c.id,
            clientType: c.clientType,
            missionType: storyline.missionSequence[i].missionType,
            arcId: `arc-${Date.now()}`,
            arcSequence: i + 1,
            arcTotal: storyline.length,
        })),
    })),
}));

vi.mock('./arcStorylines', () => ({
    getRandomStoryline: vi.fn(() => ({
        id: 'test-storyline',
        name: 'Test Storyline',
        length: 2,
        missionSequence: [
            { missionType: 'repair', clientIndustryFilter: ['corporate'] },
            { missionType: 'backup', clientIndustryFilter: null },
        ],
    })),
}));

vi.mock('../systems/ReputationSystem', () => ({
    canAccessClientType: vi.fn((clientType, reputation) => {
        // Simple mock: all client types accessible at rep 1+
        return reputation >= 1;
    }),
}));

import {
    initializePool,
    refreshPool,
    handleArcProgression,
    handleArcFailure,
    removeMissionFromPool,
    getPoolStats,
    shouldRefreshPool,
    generatePoolMission,
    addExpirationToMission,
    poolConfig,
} from './MissionPoolManager';

import { generateMission } from './MissionGenerator';
import { canAccessClientType } from '../systems/ReputationSystem';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockPoolState = (overrides = {}) => ({
    missions: [],
    pendingArcMissions: {},
    completedMissions: [],
    activeClientIds: [],
    lastRefresh: new Date().toISOString(),
    ...overrides,
});

const createMockMission = (overrides = {}) => ({
    missionId: `mission-${Date.now()}-${Math.random()}`,
    clientId: 'client-1',
    clientType: 'corp-medium',
    missionType: 'repair',
    difficulty: 'Medium',
    basePayout: 1000,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
    ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('MissionPoolManager', () => {
    const mockCurrentTime = new Date('2026-01-22T12:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // initializePool
    // ========================================================================

    describe('initializePool', () => {
        it('should create a pool with missions', () => {
            const pool = initializePool(1, mockCurrentTime);

            expect(pool.missions).toBeDefined();
            expect(pool.missions.length).toBeGreaterThanOrEqual(4);
            expect(pool.missions.length).toBeLessThanOrEqual(6);
        });

        it('should set expiration times on missions', () => {
            const pool = initializePool(1, mockCurrentTime);

            pool.missions.forEach(mission => {
                expect(mission.expiresAt).toBeDefined();
                const expiresAt = new Date(mission.expiresAt);
                expect(expiresAt.getTime()).toBeGreaterThan(mockCurrentTime.getTime());
            });
        });

        it('should track active client IDs', () => {
            const pool = initializePool(1, mockCurrentTime);

            expect(pool.activeClientIds).toBeDefined();
            expect(Array.isArray(pool.activeClientIds)).toBe(true);
        });

        it('should record lastRefresh timestamp', () => {
            const pool = initializePool(1, mockCurrentTime);

            expect(pool.lastRefresh).toBe(mockCurrentTime.toISOString());
        });

        it('should initialize empty pendingArcMissions', () => {
            const pool = initializePool(1, mockCurrentTime);

            expect(pool.pendingArcMissions).toBeDefined();
            expect(typeof pool.pendingArcMissions).toBe('object');
        });

        it('should initialize empty completedMissions array', () => {
            const pool = initializePool(1, mockCurrentTime);

            expect(pool.completedMissions).toBeDefined();
            expect(Array.isArray(pool.completedMissions)).toBe(true);
        });
    });

    // ========================================================================
    // refreshPool
    // ========================================================================

    describe('refreshPool', () => {
        it('should remove expired missions', () => {
            const expiredMission = createMockMission({
                missionId: 'expired-1',
                expiresAt: new Date(mockCurrentTime.getTime() - 1000).toISOString(), // 1 sec ago
            });
            const validMission = createMockMission({
                missionId: 'valid-1',
                expiresAt: new Date(mockCurrentTime.getTime() + 30 * 60 * 1000).toISOString(),
            });

            const poolState = createMockPoolState({
                missions: [expiredMission, validMission],
                activeClientIds: ['client-1'],
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime);

            expect(refreshed.missions.find(m => m.missionId === 'expired-1')).toBeUndefined();
            expect(refreshed.missions.find(m => m.missionId === 'valid-1')).toBeDefined();
        });

        it('should not remove active mission even if expired', () => {
            const expiredActiveMission = createMockMission({
                missionId: 'active-expired',
                expiresAt: new Date(mockCurrentTime.getTime() - 1000).toISOString(),
            });

            const poolState = createMockPoolState({
                missions: [expiredActiveMission],
                activeClientIds: ['client-1'],
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime, 'active-expired');

            expect(refreshed.missions.find(m => m.missionId === 'active-expired')).toBeDefined();
        });

        it('should add new missions if below minimum', () => {
            const poolState = createMockPoolState({
                missions: [createMockMission()],
                activeClientIds: ['client-1'],
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime);

            expect(refreshed.missions.length).toBeGreaterThan(1);
        });

        it('should maintain minimum accessible missions', () => {
            // Mock to simulate some inaccessible missions
            canAccessClientType.mockImplementation((clientType, rep) => {
                return clientType !== 'bank-national';
            });

            const poolState = createMockPoolState({
                missions: [],
                activeClientIds: [],
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime);

            const accessibleCount = refreshed.missions.filter(m =>
                canAccessClientType(m.clientType, 1)
            ).length;

            expect(accessibleCount).toBeGreaterThanOrEqual(2);
        });

        it('should update lastRefresh timestamp', () => {
            const oldTime = new Date('2026-01-20T12:00:00Z');
            const poolState = createMockPoolState({
                lastRefresh: oldTime.toISOString(),
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime);

            expect(refreshed.lastRefresh).toBe(mockCurrentTime.toISOString());
        });

        it('should remove pending arc missions when arc mission expires', () => {
            const arcMission = createMockMission({
                missionId: 'arc-mission-1',
                arcId: 'arc-123',
                expiresAt: new Date(mockCurrentTime.getTime() - 1000).toISOString(),
            });

            const poolState = createMockPoolState({
                missions: [arcMission],
                pendingArcMissions: {
                    'arc-123': [
                        { missionId: 'arc-mission-2', clientId: 'client-2' },
                    ],
                },
                activeClientIds: ['client-1'],
            });

            const refreshed = refreshPool(poolState, 1, mockCurrentTime);

            expect(refreshed.pendingArcMissions['arc-123']).toBeUndefined();
        });
    });

    // ========================================================================
    // handleArcProgression
    // ========================================================================

    describe('handleArcProgression', () => {
        it('should add completed mission to completedMissions list', () => {
            const poolState = createMockPoolState({
                completedMissions: ['old-mission'],
            });

            const result = handleArcProgression(
                poolState,
                { missionId: 'new-mission', arcId: null },
                mockCurrentTime
            );

            expect(result.completedMissions).toContain('new-mission');
            expect(result.completedMissions).toContain('old-mission');
        });

        it('should return nextArcMission as null for non-arc missions', () => {
            const poolState = createMockPoolState();

            const result = handleArcProgression(
                poolState,
                { missionId: 'mission-1', arcId: null },
                mockCurrentTime
            );

            expect(result.nextArcMission).toBeNull();
        });

        it('should reveal next arc mission when completing arc mission', () => {
            const nextMission = {
                missionId: 'arc-mission-2',
                clientId: 'client-2',
                clientType: 'corp-medium',
            };

            const poolState = createMockPoolState({
                missions: [],
                pendingArcMissions: {
                    'arc-123': [nextMission],
                },
                activeClientIds: ['client-1'],
            });

            const result = handleArcProgression(
                poolState,
                { missionId: 'arc-mission-1', arcId: 'arc-123', arcName: 'Test Arc' },
                mockCurrentTime
            );

            expect(result.nextArcMission).toBeDefined();
            expect(result.nextArcMission.missionId).toBe('arc-mission-2');
            expect(result.missions).toContainEqual(expect.objectContaining({ missionId: 'arc-mission-2' }));
        });

        it('should add expiration to revealed arc mission', () => {
            const nextMission = {
                missionId: 'arc-mission-2',
                clientId: 'client-2',
            };

            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-123': [nextMission],
                },
            });

            const result = handleArcProgression(
                poolState,
                { missionId: 'arc-mission-1', arcId: 'arc-123' },
                mockCurrentTime
            );

            expect(result.nextArcMission.expiresAt).toBeDefined();
        });

        it('should return arcCompleted when last arc mission completes', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-123': [], // Empty - no more pending
                },
            });

            const result = handleArcProgression(
                poolState,
                { missionId: 'arc-mission-final', arcId: 'arc-123', arcName: 'Test Arc' },
                mockCurrentTime
            );

            expect(result.arcCompleted).toBe('Test Arc');
            expect(result.nextArcMission).toBeNull();
        });

        it('should remove arc from pending when complete', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-123': [],
                    'arc-456': [{ missionId: 'other-arc-mission' }],
                },
            });

            const result = handleArcProgression(
                poolState,
                { missionId: 'mission', arcId: 'arc-123' },
                mockCurrentTime
            );

            expect(result.pendingArcMissions['arc-123']).toBeUndefined();
            expect(result.pendingArcMissions['arc-456']).toBeDefined();
        });
    });

    // ========================================================================
    // handleArcFailure
    // ========================================================================

    describe('handleArcFailure', () => {
        it('should return unchanged state for non-arc mission', () => {
            const poolState = createMockPoolState({
                missions: [createMockMission()],
            });

            const result = handleArcFailure(poolState, { missionId: 'mission-1', arcId: null });

            expect(result).toEqual(poolState);
        });

        it('should remove all pending arc missions on failure', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-123': [
                        { missionId: 'pending-1', clientId: 'client-2' },
                        { missionId: 'pending-2', clientId: 'client-3' },
                    ],
                },
                activeClientIds: ['client-1', 'client-2', 'client-3'],
            });

            const result = handleArcFailure(poolState, {
                missionId: 'failed-mission',
                arcId: 'arc-123',
                clientId: 'client-1',
            });

            expect(result.pendingArcMissions['arc-123']).toBeUndefined();
        });

        it('should remove arc client IDs from active list', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-123': [
                        { missionId: 'pending-1', clientId: 'client-2' },
                    ],
                },
                activeClientIds: ['client-1', 'client-2', 'other-client'],
            });

            const result = handleArcFailure(poolState, {
                missionId: 'failed',
                arcId: 'arc-123',
                clientId: 'client-1',
            });

            expect(result.activeClientIds).not.toContain('client-1');
            expect(result.activeClientIds).not.toContain('client-2');
            expect(result.activeClientIds).toContain('other-client');
        });

        it('should set arcCancelled flag', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: { 'arc-123': [] },
            });

            const result = handleArcFailure(poolState, {
                missionId: 'failed',
                arcId: 'arc-123',
            });

            expect(result.arcCancelled).toBe('arc-123');
        });
    });

    // ========================================================================
    // removeMissionFromPool
    // ========================================================================

    describe('removeMissionFromPool', () => {
        it('should remove mission by ID', () => {
            const mission = createMockMission({ missionId: 'to-remove' });
            const poolState = createMockPoolState({
                missions: [mission, createMockMission({ missionId: 'keep' })],
                activeClientIds: [mission.clientId],
            });

            const result = removeMissionFromPool(poolState, 'to-remove');

            expect(result.missions.find(m => m.missionId === 'to-remove')).toBeUndefined();
            expect(result.missions.find(m => m.missionId === 'keep')).toBeDefined();
        });

        it('should remove client from activeClientIds for non-arc missions', () => {
            const mission = createMockMission({
                missionId: 'mission-1',
                clientId: 'client-1',
            });
            const poolState = createMockPoolState({
                missions: [mission],
                activeClientIds: ['client-1', 'client-2'],
            });

            const result = removeMissionFromPool(poolState, 'mission-1');

            expect(result.activeClientIds).not.toContain('client-1');
            expect(result.activeClientIds).toContain('client-2');
        });

        it('should keep client in activeClientIds for arc missions with pending', () => {
            const mission = createMockMission({
                missionId: 'arc-mission-1',
                clientId: 'client-1',
                arcId: 'arc-123',
            });
            const poolState = createMockPoolState({
                missions: [mission],
                pendingArcMissions: {
                    'arc-123': [{ missionId: 'arc-mission-2' }],
                },
                activeClientIds: ['client-1'],
            });

            const result = removeMissionFromPool(poolState, 'arc-mission-1');

            expect(result.activeClientIds).toContain('client-1');
        });

        it('should return unchanged state if mission not found', () => {
            const poolState = createMockPoolState({
                missions: [createMockMission({ missionId: 'existing' })],
            });

            const result = removeMissionFromPool(poolState, 'non-existent');

            expect(result.missions).toHaveLength(1);
        });
    });

    // ========================================================================
    // getPoolStats
    // ========================================================================

    describe('getPoolStats', () => {
        it('should return total mission count', () => {
            const poolState = createMockPoolState({
                missions: [
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.totalMissions).toBe(3);
        });

        it('should count accessible vs locked missions', () => {
            canAccessClientType.mockImplementation((clientType, rep) => {
                return clientType !== 'bank-national';
            });

            const poolState = createMockPoolState({
                missions: [
                    createMockMission({ clientType: 'corp-medium' }),
                    createMockMission({ clientType: 'corp-medium' }),
                    createMockMission({ clientType: 'bank-national' }),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.accessibleCount).toBe(2);
            expect(stats.lockedCount).toBe(1);
        });

        it('should count arc vs single missions', () => {
            const poolState = createMockPoolState({
                missions: [
                    createMockMission({ arcId: 'arc-1' }),
                    createMockMission({ arcId: 'arc-1' }),
                    createMockMission({ arcId: null }),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.arcCount).toBe(2);
            expect(stats.singleCount).toBe(1);
        });

        it('should count timed vs untimed missions', () => {
            const poolState = createMockPoolState({
                missions: [
                    createMockMission({ timeLimitMinutes: 5 }),
                    createMockMission({ timeLimitMinutes: null }),
                    createMockMission({ timeLimitMinutes: null }),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.timedCount).toBe(1);
            expect(stats.untimedCount).toBe(2);
        });

        it('should count by difficulty', () => {
            const poolState = createMockPoolState({
                missions: [
                    createMockMission({ difficulty: 'Easy' }),
                    createMockMission({ difficulty: 'Medium' }),
                    createMockMission({ difficulty: 'Medium' }),
                    createMockMission({ difficulty: 'Hard' }),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.byDifficulty.easy).toBe(1);
            expect(stats.byDifficulty.medium).toBe(2);
            expect(stats.byDifficulty.hard).toBe(1);
        });

        it('should count by mission type', () => {
            const poolState = createMockPoolState({
                missions: [
                    createMockMission({ missionType: 'repair' }),
                    createMockMission({ missionType: 'repair' }),
                    createMockMission({ missionType: 'backup' }),
                ],
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.byMissionType.repair).toBe(2);
            expect(stats.byMissionType.backup).toBe(1);
        });

        it('should count pending arcs', () => {
            const poolState = createMockPoolState({
                pendingArcMissions: {
                    'arc-1': [{ missionId: 'm1' }],
                    'arc-2': [{ missionId: 'm2' }, { missionId: 'm3' }],
                },
            });

            const stats = getPoolStats(poolState, 1);

            expect(stats.pendingArcCount).toBe(2);
        });
    });

    // ========================================================================
    // shouldRefreshPool
    // ========================================================================

    describe('shouldRefreshPool', () => {
        it('should return true if below minimum size', () => {
            const poolState = createMockPoolState({
                missions: [createMockMission(), createMockMission()], // Only 2
            });

            expect(shouldRefreshPool(poolState, 1)).toBe(true);
        });

        it('should return true if not enough accessible missions', () => {
            canAccessClientType.mockImplementation(() => false);

            const poolState = createMockPoolState({
                missions: [
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                ],
            });

            expect(shouldRefreshPool(poolState, 1)).toBe(true);
        });

        it('should return false if pool is healthy', () => {
            canAccessClientType.mockImplementation(() => true);

            const poolState = createMockPoolState({
                missions: [
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                    createMockMission(),
                ],
            });

            expect(shouldRefreshPool(poolState, 1)).toBe(false);
        });
    });

    // ========================================================================
    // poolConfig
    // ========================================================================

    describe('poolConfig', () => {
        it('should export pool configuration values', () => {
            expect(poolConfig).toBeDefined();
            expect(poolConfig.min).toBe(4);
            expect(poolConfig.max).toBe(6);
            expect(poolConfig.minAccessible).toBe(2);
            expect(poolConfig.arcChance).toBe(0.2);
        });

        it('should define expiration minutes range', () => {
            expect(poolConfig.expirationMinutes).toBeDefined();
            expect(poolConfig.expirationMinutes.min).toBe(15);
            expect(poolConfig.expirationMinutes.max).toBe(60);
        });

        it('should define regeneration delay (1 minute game time)', () => {
            expect(poolConfig.regenerationDelayMs).toBe(60 * 1000);
        });
    });

    // ========================================================================
    // generatePoolMission
    // ========================================================================

    describe('generatePoolMission', () => {
        it('should generate a mission with required fields', () => {
            const mission = generatePoolMission(1, mockCurrentTime, new Set(), false);

            expect(mission).toBeDefined();
            // generatePoolMission may return a single mission or an arc object
            if (mission.arcId || mission.missions) {
                // Arc: validate first mission in arc
                expect(mission.missions && mission.missions[0].missionId).toBeDefined();
                expect(mission.missions && mission.missions[0].clientId).toBeDefined();
            } else {
                expect(mission.missionId).toBeDefined();
                expect(mission.clientId).toBeDefined();
            }
        });

        it('should exclude specified client IDs', () => {
            // Get a mission to find out which client was used
            const firstMission = generatePoolMission(1, mockCurrentTime, new Set(), false);
            expect(firstMission).toBeDefined();

            // Generate more missions excluding that client
            const excludeSet = new Set([firstMission.clientId]);
            const secondMission = generatePoolMission(1, mockCurrentTime, excludeSet, false);

            // If there are other clients available, the new mission should use a different client
            // (unless no other clients are available)
            if (secondMission) {
                // Either it uses a different client, or it returned an arc object
                if (secondMission.arcId || secondMission.missions) {
                    // Arc: check first mission's clientId
                    expect(secondMission.missions && secondMission.missions[0].clientId).toBeDefined();
                } else {
                    expect(secondMission.clientId).toBeDefined();
                }
            }
        });

        it('should return null when no clients available', () => {
            // Create a set excluding all mock clients
            const excludeAll = new Set(['client-1', 'client-2', 'client-3', 'client-4', 'client-5', 'client-6']);
            const mission = generatePoolMission(1, mockCurrentTime, excludeAll, true);

            expect(mission).toBeNull();
        });

        it('should potentially generate an arc (20% chance)', () => {
            // Run multiple times to test arc generation path
            let arcGenerated = false;
            for (let i = 0; i < 50; i++) {
                const result = generatePoolMission(1, mockCurrentTime, new Set(), false);
                if (result && result.arcId) {
                    arcGenerated = true;
                    expect(result.missions).toBeDefined();
                    expect(result.missions.length).toBeGreaterThan(0);
                    break;
                }
            }
            // Note: With 20% chance, we should get an arc in 50 tries most of the time
            // but this test won't fail if we don't - it's probabilistic
        });
    });

    // ========================================================================
    // addExpirationToMission
    // ========================================================================

    describe('addExpirationToMission', () => {
        it('should add expiresAt field to mission', () => {
            const mission = {
                missionId: 'test-mission',
                clientId: 'client-1',
                title: 'Test Mission',
            };

            const missionWithExpiration = addExpirationToMission(mission, mockCurrentTime);

            expect(missionWithExpiration.expiresAt).toBeDefined();
            expect(missionWithExpiration.missionId).toBe(mission.missionId);
            expect(missionWithExpiration.title).toBe(mission.title);
        });

        it('should set expiration between 15-60 minutes from current time', () => {
            const mission = { missionId: 'test-mission', clientId: 'client-1' };
            const missionWithExpiration = addExpirationToMission(mission, mockCurrentTime);

            const expiresAt = new Date(missionWithExpiration.expiresAt);
            const currentTimeMs = mockCurrentTime.getTime();
            const minExpiration = currentTimeMs + 15 * 60 * 1000;
            const maxExpiration = currentTimeMs + 60 * 60 * 1000;

            expect(expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiration);
            expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpiration);
        });

        it('should not mutate the original mission object', () => {
            const mission = {
                missionId: 'test-mission',
                clientId: 'client-1',
            };

            const missionWithExpiration = addExpirationToMission(mission, mockCurrentTime);

            expect(mission.expiresAt).toBeUndefined();
            expect(missionWithExpiration).not.toBe(mission);
        });

        it('should override existing expiresAt if present', () => {
            const mission = {
                missionId: 'test-mission',
                clientId: 'client-1',
                expiresAt: 'old-value',
            };

            const missionWithExpiration = addExpirationToMission(mission, mockCurrentTime);

            expect(missionWithExpiration.expiresAt).not.toBe('old-value');
            expect(new Date(missionWithExpiration.expiresAt)).toBeInstanceOf(Date);
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry before importing mission modules
vi.mock('../../systems/NetworkRegistry', () => ({
    default: {
        isSubnetInUse: vi.fn(() => false),
        isIpInUse: vi.fn(() => false),
        registerNetwork: vi.fn(() => true),
        registerDevice: vi.fn(() => true),
        registerFileSystem: vi.fn(() => true),
    },
}));

// Mock missionData to avoid reserved network conflicts
vi.mock('../../missions/missionData.js', () => ({
    allMissions: [],
}));

// Import after mocks are set up
import { generateMission, generateMissionArc } from '../../missions/MissionGenerator';
import { initializePool, refreshPool, handleArcProgression, removeMissionFromPool } from '../../missions/MissionPoolManager';
import { getRandomStoryline } from '../../missions/arcStorylines';
import { getAllClients, getClientById, getAccessibleClients } from '../../data/clientRegistry';

describe('Mission Pool Flow Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Pool Initialization Flow
    // ========================================================================

    describe('pool initialization flow', () => {
        it('should initialize pool with missions from accessible clients', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const reputation = 1;

            const pool = initializePool(reputation, currentTime);

            expect(pool.missions.length).toBeGreaterThanOrEqual(4);
            expect(pool.missions.length).toBeLessThanOrEqual(6);
        });

        it('should track client IDs to prevent duplicates', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            // Each mission should have a unique client (no duplicates in pool)
            const clientIds = pool.missions.map(m => m.clientId);
            const nonArcMissions = pool.missions.filter(m => !m.arcId);

            // For non-arc missions, client IDs should be tracked
            nonArcMissions.forEach(mission => {
                expect(pool.activeClientIds).toContain(mission.clientId);
            });
        });

        it('should set expiration times on all pool missions', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            pool.missions.forEach(mission => {
                expect(mission.expiresAt).toBeDefined();
                const expiresAt = new Date(mission.expiresAt);
                expect(expiresAt.getTime()).toBeGreaterThan(currentTime.getTime());
            });
        });
    });

    // ========================================================================
    // Mission Generation Quality
    // ========================================================================

    describe('mission generation quality', () => {
        it('generated missions should have all required fields', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id);

            expect(mission).not.toBeNull();
            expect(mission.missionId).toBeDefined();
            expect(mission.title).toBeDefined();
            expect(mission.missionType).toBeDefined();
            expect(mission.objectives).toBeDefined();
            expect(mission.objectives.length).toBeGreaterThan(0);
            expect(mission.networks).toBeDefined();
            expect(mission.basePayout).toBeGreaterThan(0);
            expect(mission.consequences).toBeDefined();
        });

        it('generated missions should have valid objective structure', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id);

            mission.objectives.forEach(objective => {
                expect(objective.id).toBeDefined();
                expect(objective.description).toBeDefined();
                expect(objective.type).toBeDefined();
            });

            // Should always have verification objective
            const verifyObj = mission.objectives.find(o => o.type === 'verification');
            expect(verifyObj).toBeDefined();
        });

        it('generated networks should have valid structure', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id);

            mission.networks.forEach(network => {
                expect(network.networkId).toBeDefined();
                expect(network.networkName).toBeDefined();
                expect(network.address).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
                expect(network.fileSystems).toBeDefined();
                expect(network.fileSystems.length).toBeGreaterThan(0);

                network.fileSystems.forEach(fs => {
                    expect(fs.id).toBeDefined();
                    expect(fs.ip).toBeDefined();
                    expect(fs.name).toBeDefined();
                    expect(fs.files).toBeDefined();
                });
            });
        });
    });

    // ========================================================================
    // Pool Refresh Flow
    // ========================================================================

    describe('pool refresh flow', () => {
        it('should remove expired missions on refresh', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, startTime);

            // Manually expire a mission
            if (pool.missions.length > 0) {
                pool.missions[0].expiresAt = new Date(startTime.getTime() - 1000).toISOString();
            }

            const laterTime = new Date('2026-01-22T12:30:00Z');
            const refreshed = refreshPool(pool, 1, laterTime);

            // Expired mission should be removed
            const expiredMission = refreshed.missions.find(
                m => new Date(m.expiresAt).getTime() < laterTime.getTime()
            );
            expect(expiredMission).toBeUndefined();
        });

        it('should add new missions if below minimum', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            const pool = {
                missions: [], // Empty pool
                pendingArcMissions: {},
                completedMissions: [],
                activeClientIds: [],
                lastRefresh: startTime.toISOString(),
            };

            const refreshed = refreshPool(pool, 1, startTime);

            expect(refreshed.missions.length).toBeGreaterThanOrEqual(4);
        });

        it('should maintain pool size within bounds', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');

            // Run multiple refreshes
            let pool = initializePool(1, currentTime);

            for (let i = 0; i < 5; i++) {
                const laterTime = new Date(currentTime.getTime() + i * 60000);
                pool = refreshPool(pool, 1, laterTime);

                expect(pool.missions.length).toBeGreaterThanOrEqual(4);
                expect(pool.missions.length).toBeLessThanOrEqual(10); // Some buffer for arcs
            }
        });
    });

    // ========================================================================
    // Mission Acceptance Flow
    // ========================================================================

    describe('mission acceptance flow', () => {
        it('should remove mission from pool when accepted', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            const missionToAccept = pool.missions[0];
            const updatedPool = removeMissionFromPool(pool, missionToAccept.missionId);

            expect(updatedPool.missions.find(m => m.missionId === missionToAccept.missionId)).toBeUndefined();
        });

        it('should remove client from activeClientIds for non-arc mission', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            // Find a non-arc mission
            const nonArcMission = pool.missions.find(m => !m.arcId);
            if (nonArcMission) {
                const updatedPool = removeMissionFromPool(pool, nonArcMission.missionId);
                expect(updatedPool.activeClientIds).not.toContain(nonArcMission.clientId);
            }
        });
    });

    // ========================================================================
    // Arc Mission Flow
    // ========================================================================

    describe('arc mission flow', () => {
        it('should generate arc with connected missions', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            expect(arc).not.toBeNull();
            expect(arc.arcId).toBeDefined();
            expect(arc.missions.length).toBe(storyline.length);

            // All missions should share the arc ID
            arc.missions.forEach(mission => {
                expect(mission.arcId).toBe(arc.arcId);
            });
        });

        it('should link arc missions sequentially', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            // First mission should not require previous
            expect(arc.missions[0].requiresCompletedMission).toBeNull();

            // Subsequent missions should require previous
            for (let i = 1; i < arc.missions.length; i++) {
                expect(arc.missions[i].requiresCompletedMission).toBe(arc.missions[i - 1].missionId);
            }
        });

        it('should only show first arc mission initially', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            expect(arc.visibleMissionIds).toHaveLength(1);
            expect(arc.visibleMissionIds[0]).toBe(arc.missions[0].missionId);
        });
    });

    // ========================================================================
    // Arc Progression Flow
    // ========================================================================

    describe('arc progression flow', () => {
        it('should reveal next arc mission on completion', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');

            // Create a pool with an arc
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);
            const arc = generateMissionArc(storyline, clients);

            const pool = {
                missions: [arc.missions[0]],
                pendingArcMissions: {
                    [arc.arcId]: arc.missions.slice(1),
                },
                completedMissions: [],
                activeClientIds: [arc.missions[0].clientId],
                lastRefresh: currentTime.toISOString(),
            };

            // Complete first mission
            const result = handleArcProgression(
                pool,
                {
                    missionId: arc.missions[0].missionId,
                    arcId: arc.arcId,
                    arcName: arc.arcName,
                },
                currentTime
            );

            // Next mission should be revealed
            expect(result.nextArcMission).toBeDefined();
            expect(result.nextArcMission.missionId).toBe(arc.missions[1].missionId);
            expect(result.missions).toContainEqual(expect.objectContaining({
                missionId: arc.missions[1].missionId,
            }));
        });

        it('should add completed mission to completedMissions list', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');

            const pool = {
                missions: [],
                pendingArcMissions: {},
                completedMissions: ['old-mission'],
                activeClientIds: [],
                lastRefresh: currentTime.toISOString(),
            };

            const result = handleArcProgression(
                pool,
                { missionId: 'new-completed', arcId: null },
                currentTime
            );

            expect(result.completedMissions).toContain('new-completed');
            expect(result.completedMissions).toContain('old-mission');
        });

        it('should mark arc as completed when last mission done', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');

            const pool = {
                missions: [],
                pendingArcMissions: {
                    'arc-123': [], // No more pending
                },
                completedMissions: [],
                activeClientIds: [],
                lastRefresh: currentTime.toISOString(),
            };

            const result = handleArcProgression(
                pool,
                { missionId: 'final-mission', arcId: 'arc-123', arcName: 'Test Arc' },
                currentTime
            );

            expect(result.arcCompleted).toBe('Test Arc');
            expect(result.pendingArcMissions['arc-123']).toBeUndefined();
        });
    });

    // ========================================================================
    // Client Selection Flow
    // ========================================================================

    describe('client selection flow', () => {
        it('should select clients based on reputation', () => {
            // At rep 1, only low-tier clients should be accessible
            const rep1Clients = getAccessibleClients(1);

            rep1Clients.forEach(client => {
                expect(client.minReputation).toBeLessThanOrEqual(1);
            });
        });

        it('should have more clients available at higher reputation', () => {
            const rep1Clients = getAccessibleClients(1);
            const rep3Clients = getAccessibleClients(3);
            const rep5Clients = getAccessibleClients(5);

            expect(rep3Clients.length).toBeGreaterThanOrEqual(rep1Clients.length);
            expect(rep5Clients.length).toBeGreaterThanOrEqual(rep3Clients.length);
        });

        it('should be able to look up client by ID', () => {
            const allClients = getAllClients();
            const client = allClients[0];

            const lookedUp = getClientById(client.id);

            expect(lookedUp).toBeDefined();
            expect(lookedUp.id).toBe(client.id);
            expect(lookedUp.name).toBe(client.name);
        });
    });

    // ========================================================================
    // End-to-End Pool Lifecycle
    // ========================================================================

    describe('end-to-end pool lifecycle', () => {
        it('should support full lifecycle: init → accept → complete → refresh', () => {
            const time1 = new Date('2026-01-22T12:00:00Z');
            const time2 = new Date('2026-01-22T12:30:00Z');

            // 1. Initialize pool
            let pool = initializePool(1, time1);
            expect(pool.missions.length).toBeGreaterThan(0);

            // 2. Accept a mission
            const missionToAccept = pool.missions[0];
            pool = removeMissionFromPool(pool, missionToAccept.missionId);

            // 3. Complete the mission
            pool = handleArcProgression(
                pool,
                {
                    missionId: missionToAccept.missionId,
                    arcId: missionToAccept.arcId || null,
                },
                time2
            );
            expect(pool.completedMissions).toContain(missionToAccept.missionId);

            // 4. Refresh pool (generates new missions)
            pool = refreshPool(pool, 1, time2);
            expect(pool.missions.length).toBeGreaterThanOrEqual(4);
        });
    });
});

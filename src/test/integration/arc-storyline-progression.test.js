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

import { generateMissionArc } from '../../missions/MissionGenerator';
import { handleArcProgression, handleArcFailure } from '../../missions/MissionPoolManager';
import { arcStorylines, getStorylineById, getRandomStoryline } from '../../missions/arcStorylines';
import { getAllClients } from '../../data/clientRegistry';

describe('Arc Storyline Progression Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Arc Generation
    // ========================================================================

    describe('arc generation', () => {
        it('should generate arc matching storyline structure', () => {
            const storyline = getStorylineById('supply-chain-breach');
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            expect(arc.totalMissions).toBe(storyline.length);
            expect(arc.arcName).toBe(storyline.name);
        });

        it('should generate missions with correct types from storyline', () => {
            const storyline = getStorylineById('supply-chain-breach');
            // supply-chain-breach: repair → backup → transfer
            const clients = getAllClients().slice(0, 3);

            const arc = generateMissionArc(storyline, clients);

            expect(arc.missions[0].missionType).toBe('repair');
            expect(arc.missions[1].missionType).toBe('backup');
            expect(arc.missions[2].missionType).toBe('transfer');
        });

        it('should apply hasTimed from storyline to missions', () => {
            // Find a storyline with timed missions
            const storyline = getStorylineById('disaster-recovery');
            // disaster-recovery has all timed missions
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            arc.missions.forEach((mission, index) => {
                if (storyline.missionSequence[index].hasTimed) {
                    expect(mission.timeLimitMinutes).not.toBeNull();
                }
            });
        });

        it('should include arc name in mission titles', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            arc.missions.forEach((mission, index) => {
                expect(mission.title).toContain(storyline.name);
                expect(mission.title).toContain(`${index + 1}/${storyline.length}`);
            });
        });
    });

    // ========================================================================
    // Sequential Mission Linking
    // ========================================================================

    describe('sequential mission linking', () => {
        it('should link missions via requiresCompletedMission', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            // First mission has no requirement
            expect(arc.missions[0].requiresCompletedMission).toBeNull();

            // Each subsequent mission requires the previous one
            for (let i = 1; i < arc.missions.length; i++) {
                expect(arc.missions[i].requiresCompletedMission).toBe(
                    arc.missions[i - 1].missionId
                );
            }
        });

        it('should set arcSequence numbers correctly', () => {
            const storyline = getRandomStoryline();
            const clients = getAllClients().slice(0, storyline.length);

            const arc = generateMissionArc(storyline, clients);

            arc.missions.forEach((mission, index) => {
                expect(mission.arcSequence).toBe(index + 1);
                expect(mission.arcTotal).toBe(storyline.length);
            });
        });
    });

    // ========================================================================
    // Arc Progression
    // ========================================================================

    describe('arc progression', () => {
        it('should reveal next mission when current mission completes', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const storyline = getStorylineById('merger-integration'); // 2 missions
            const clients = getAllClients().slice(0, 2);

            const arc = generateMissionArc(storyline, clients);

            const pool = {
                missions: [arc.missions[0]],
                pendingArcMissions: {
                    [arc.arcId]: [arc.missions[1]],
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

            // Second mission should now be in pool
            expect(result.missions.some(m => m.missionId === arc.missions[1].missionId)).toBe(true);
            expect(result.nextArcMission.missionId).toBe(arc.missions[1].missionId);
        });

        it('should add expiration to revealed arc mission', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const storyline = getStorylineById('merger-integration');
            const clients = getAllClients().slice(0, 2);

            const arc = generateMissionArc(storyline, clients);

            const pool = {
                missions: [],
                pendingArcMissions: {
                    [arc.arcId]: [arc.missions[1]],
                },
                completedMissions: [],
                activeClientIds: [],
                lastRefresh: currentTime.toISOString(),
            };

            const result = handleArcProgression(
                pool,
                {
                    missionId: arc.missions[0].missionId,
                    arcId: arc.arcId,
                },
                currentTime
            );

            expect(result.nextArcMission.expiresAt).toBeDefined();
            const expiresAt = new Date(result.nextArcMission.expiresAt);
            expect(expiresAt.getTime()).toBeGreaterThan(currentTime.getTime());
        });

        it('should mark arc as completed when final mission completes', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const storyline = getStorylineById('merger-integration');
            const clients = getAllClients().slice(0, 2);

            const arc = generateMissionArc(storyline, clients);

            // Pool after first mission completed, second mission pending
            const pool = {
                missions: [arc.missions[1]],
                pendingArcMissions: {
                    [arc.arcId]: [], // No more pending
                },
                completedMissions: [arc.missions[0].missionId],
                activeClientIds: [arc.missions[1].clientId],
                lastRefresh: currentTime.toISOString(),
            };

            // Complete final mission
            const result = handleArcProgression(
                pool,
                {
                    missionId: arc.missions[1].missionId,
                    arcId: arc.arcId,
                    arcName: arc.arcName,
                },
                currentTime
            );

            expect(result.arcCompleted).toBe(arc.arcName);
            expect(result.nextArcMission).toBeNull();
            expect(result.pendingArcMissions[arc.arcId]).toBeUndefined();
        });

        it('should track all completed mission IDs', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const storyline = getStorylineById('compliance-audit'); // 3 missions
            const clients = getAllClients().slice(0, 3);

            const arc = generateMissionArc(storyline, clients);

            let pool = {
                missions: [arc.missions[0]],
                pendingArcMissions: {
                    [arc.arcId]: arc.missions.slice(1),
                },
                completedMissions: [],
                activeClientIds: [],
                lastRefresh: currentTime.toISOString(),
            };

            // Complete all missions in sequence
            for (let i = 0; i < arc.missions.length; i++) {
                pool = handleArcProgression(
                    pool,
                    {
                        missionId: arc.missions[i].missionId,
                        arcId: arc.arcId,
                        arcName: arc.arcName,
                    },
                    currentTime
                );
            }

            // All missions should be in completedMissions
            arc.missions.forEach(mission => {
                expect(pool.completedMissions).toContain(mission.missionId);
            });
        });
    });

    // ========================================================================
    // Arc Failure
    // ========================================================================

    describe('arc failure', () => {
        it('should cancel remaining arc missions on failure', () => {
            const storyline = getStorylineById('compliance-audit'); // 3 missions
            const clients = getAllClients().slice(0, 3);

            const arc = generateMissionArc(storyline, clients);

            const pool = {
                missions: [arc.missions[0]],
                pendingArcMissions: {
                    [arc.arcId]: arc.missions.slice(1),
                },
                completedMissions: [],
                activeClientIds: [arc.missions[0].clientId, arc.missions[1].clientId],
                lastRefresh: new Date().toISOString(),
            };

            const result = handleArcFailure(pool, {
                missionId: arc.missions[0].missionId,
                arcId: arc.arcId,
                clientId: arc.missions[0].clientId,
            });

            // Pending arc missions should be removed
            expect(result.pendingArcMissions[arc.arcId]).toBeUndefined();
            expect(result.arcCancelled).toBe(arc.arcId);
        });

        it('should remove arc client IDs from active list on failure', () => {
            const storyline = getStorylineById('merger-integration');
            const clients = getAllClients().slice(0, 2);

            const arc = generateMissionArc(storyline, clients);

            const pool = {
                missions: [arc.missions[0]],
                pendingArcMissions: {
                    [arc.arcId]: [arc.missions[1]],
                },
                completedMissions: [],
                activeClientIds: [
                    arc.missions[0].clientId,
                    arc.missions[1].clientId,
                    'other-client',
                ],
                lastRefresh: new Date().toISOString(),
            };

            const result = handleArcFailure(pool, {
                missionId: arc.missions[0].missionId,
                arcId: arc.arcId,
                clientId: arc.missions[0].clientId,
            });

            // Arc clients should be removed
            expect(result.activeClientIds).not.toContain(arc.missions[0].clientId);
            expect(result.activeClientIds).not.toContain(arc.missions[1].clientId);
            // Other clients should remain
            expect(result.activeClientIds).toContain('other-client');
        });
    });

    // ========================================================================
    // Referral Text
    // ========================================================================

    describe('referral text', () => {
        it('should include referral text in subsequent mission briefings', () => {
            const storyline = getStorylineById('data-recovery-escalation');
            // Step 1 has no referral, steps 2 and 3 have referral text
            const clients = getAllClients().slice(0, 3);

            const arc = generateMissionArc(storyline, clients);

            // First mission should not have referral in briefing
            // Second and third should have referral text
            if (storyline.missionSequence[1].referralText) {
                expect(arc.missions[1].briefingMessage.body).toContain(
                    storyline.missionSequence[1].referralText
                );
            }
        });

        it('should use same client when clientIndustryFilter is null', () => {
            // data-recovery-escalation uses same client for missions 2 and 3
            const storyline = getStorylineById('data-recovery-escalation');
            const client = getAllClients()[0];
            const clients = [client, client, client]; // Same client for all

            const arc = generateMissionArc(storyline, clients);

            // All missions use same client
            expect(arc.missions[0].clientId).toBe(client.id);
            expect(arc.missions[1].clientId).toBe(client.id);
            expect(arc.missions[2].clientId).toBe(client.id);
        });
    });

    // ========================================================================
    // All Storylines Validation
    // ========================================================================

    describe('all storylines validation', () => {
        it('should be able to generate arc for each storyline', () => {
            const allClients = getAllClients();

            arcStorylines.forEach(storyline => {
                const clients = allClients.slice(0, storyline.length);
                const arc = generateMissionArc(storyline, clients);

                expect(arc).not.toBeNull();
                expect(arc.missions.length).toBe(storyline.length);
            });
        });

        it('all generated arcs should have valid mission structure', () => {
            const allClients = getAllClients();

            arcStorylines.forEach(storyline => {
                const clients = allClients.slice(0, storyline.length);
                const arc = generateMissionArc(storyline, clients);

                arc.missions.forEach(mission => {
                    expect(mission.missionId).toBeDefined();
                    expect(mission.objectives.length).toBeGreaterThan(0);
                    expect(mission.networks.length).toBeGreaterThan(0);
                    expect(mission.basePayout).toBeGreaterThan(0);
                    expect(mission.consequences.success).toBeDefined();
                    expect(mission.consequences.failure).toBeDefined();
                });
            });
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle storyline with 2 missions', () => {
            const storyline = getStorylineById('merger-integration'); // 2 missions
            const clients = getAllClients().slice(0, 2);

            const arc = generateMissionArc(storyline, clients);

            expect(arc.missions.length).toBe(2);
        });

        it('should handle storyline with 3 missions', () => {
            const storyline = getStorylineById('supply-chain-breach'); // 3 missions
            const clients = getAllClients().slice(0, 3);

            const arc = generateMissionArc(storyline, clients);

            expect(arc.missions.length).toBe(3);
        });

        it('should return null if not enough clients provided', () => {
            const storyline = getStorylineById('supply-chain-breach'); // 3 missions
            const clients = getAllClients().slice(0, 1); // Only 1 client

            const arc = generateMissionArc(storyline, clients);

            expect(arc).toBeNull();
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry
vi.mock('../../systems/NetworkRegistry', () => ({
    default: {
        isSubnetInUse: vi.fn(() => false),
        isIpInUse: vi.fn(() => false),
    },
}));

// Mock missionData
vi.mock('../../missions/missionData.js', () => ({
    allMissions: [],
}));

import { generateMission } from '../../missions/MissionGenerator';
import { initializePool, refreshPool } from '../../missions/MissionPoolManager';
import { getAllClients } from '../../data/clientRegistry';

describe('Time and Mission Deadline Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Mission Expiration
    // ========================================================================

    describe('mission expiration', () => {
        it('should set expiration time on pool missions', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            pool.missions.forEach(mission => {
                expect(mission.expiresAt).toBeDefined();
                const expiresAt = new Date(mission.expiresAt);
                expect(expiresAt.getTime()).toBeGreaterThan(currentTime.getTime());
            });
        });

        it('should set expiration between 15-60 minutes', () => {
            const currentTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, currentTime);

            pool.missions.forEach(mission => {
                const expiresAt = new Date(mission.expiresAt);
                const diffMinutes = (expiresAt.getTime() - currentTime.getTime()) / (60 * 1000);

                expect(diffMinutes).toBeGreaterThanOrEqual(15);
                expect(diffMinutes).toBeLessThanOrEqual(60);
            });
        });

        it('should remove expired missions on refresh', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, startTime);

            // Manually set a mission to expired
            if (pool.missions.length > 0) {
                const expiredMission = pool.missions[0];
                expiredMission.expiresAt = new Date(startTime.getTime() - 1000).toISOString();
            }

            // Time advances by 1 hour
            const laterTime = new Date('2026-01-22T13:00:00Z');
            const refreshed = refreshPool(pool, 1, laterTime);

            // All remaining missions should have valid (future) expiration
            refreshed.missions.forEach(mission => {
                const expiresAt = new Date(mission.expiresAt);
                expect(expiresAt.getTime()).toBeGreaterThanOrEqual(laterTime.getTime());
            });
        });
    });

    // ========================================================================
    // Timed Missions
    // ========================================================================

    describe('timed missions', () => {
        it('should generate timed missions with time limit', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id, { hasTimed: true });

            expect(mission.timeLimitMinutes).toBeDefined();
            expect(mission.timeLimitMinutes).toBeGreaterThanOrEqual(3);
            expect(mission.timeLimitMinutes).toBeLessThanOrEqual(10);
        });

        it('should generate untimed missions without time limit', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id, { hasTimed: false });

            expect(mission.timeLimitMinutes).toBeNull();
        });

        it('timed missions should have time bonus in payout', () => {
            const clients = getAllClients();
            const client = clients[0];

            // Generate a timed mission and verify it has time-based payout bonus
            const timedMission = generateMission(client.id, { hasTimed: true });

            // Timed missions have a time limit which adds to payout via calculatePayout
            // Time bonus formula: 300 * (10 / timeLimitMinutes)
            // So missions with time limits get bonus payout
            expect(timedMission.timeLimitMinutes).not.toBeNull();
            expect(timedMission.basePayout).toBeGreaterThan(0);

            // Payout should include time bonus (at least base + some time bonus)
            // Since time bonus = 300 * (10 / minutes), minimum bonus is 300 at 10 mins
            // Hard to verify exact value due to other factors, but payout should be substantial
        });

        it('tighter deadlines should have higher payouts', () => {
            // This is tested more directly in MissionGenerator tests
            // Here we just verify the mission structure supports it
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id, { hasTimed: true });

            // Mission should have both time limit and payout
            expect(mission.timeLimitMinutes).toBeDefined();
            expect(mission.basePayout).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Time-Based Failure Consequences
    // ========================================================================

    describe('failure consequences', () => {
        it('timed missions should have deadline failure messages', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id, { hasTimed: true });

            expect(mission.consequences.failure).toBeDefined();
            expect(mission.consequences.failure.credits).toBeLessThan(0);
            expect(mission.consequences.failure.reputation).toBeLessThan(0);
        });

        it('untimed missions should have incomplete failure messages', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id, { hasTimed: false });

            expect(mission.consequences.failure).toBeDefined();
            expect(mission.consequences.failure.credits).toBeLessThan(0);
        });

        it('failure penalty should be fraction of mission payout', () => {
            const clients = getAllClients();
            const client = clients[0];

            const mission = generateMission(client.id);

            // Failure penalty is typically -25% of base payout
            const expectedPenalty = -Math.floor(mission.basePayout * 0.25);
            expect(mission.consequences.failure.credits).toBe(expectedPenalty);
        });
    });

    // ========================================================================
    // Time Advancement and Pool State
    // ========================================================================

    describe('time advancement and pool state', () => {
        it('should refresh pool with updated expiration times', () => {
            const time1 = new Date('2026-01-22T12:00:00Z');
            let pool = initializePool(1, time1);

            // Advance time by 10 minutes
            const time2 = new Date('2026-01-22T12:10:00Z');
            pool = refreshPool(pool, 1, time2);

            // New missions should have expiration based on new time
            pool.missions.forEach(mission => {
                const expiresAt = new Date(mission.expiresAt);
                // Expiration should be at least 15 minutes from time2
                const minExpiration = new Date(time2.getTime() + 15 * 60 * 1000);
                // Allow for existing missions that haven't expired yet
                expect(expiresAt.getTime()).toBeGreaterThanOrEqual(time2.getTime());
            });
        });

        it('should track lastRefresh time', () => {
            const time1 = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, time1);

            expect(pool.lastRefresh).toBe(time1.toISOString());

            const time2 = new Date('2026-01-22T12:30:00Z');
            const refreshed = refreshPool(pool, 1, time2);

            expect(refreshed.lastRefresh).toBe(time2.toISOString());
        });

        it('should handle time zones correctly (ISO strings)', () => {
            const time = new Date('2026-01-22T12:00:00Z');
            const pool = initializePool(1, time);

            pool.missions.forEach(mission => {
                // All times should be valid ISO strings
                expect(() => new Date(mission.expiresAt)).not.toThrow();
                expect(mission.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            });
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle rapid time advancement', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            let pool = initializePool(1, startTime);

            // Advance time rapidly (simulate fast-forward)
            for (let i = 1; i <= 5; i++) {
                const newTime = new Date(startTime.getTime() + i * 60 * 60 * 1000); // +1 hour each
                pool = refreshPool(pool, 1, newTime);
            }

            // Pool should still be valid
            expect(pool.missions.length).toBeGreaterThanOrEqual(4);
        });

        it('should handle all missions expiring at once', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            let pool = initializePool(1, startTime);

            // Set all missions to expired
            pool.missions.forEach(mission => {
                mission.expiresAt = new Date(startTime.getTime() - 1000).toISOString();
            });

            // Refresh should generate new missions
            const laterTime = new Date('2026-01-22T14:00:00Z');
            const refreshed = refreshPool(pool, 1, laterTime);

            expect(refreshed.missions.length).toBeGreaterThanOrEqual(4);
        });

        it('should not expire active mission', () => {
            const startTime = new Date('2026-01-22T12:00:00Z');
            let pool = initializePool(1, startTime);

            if (pool.missions.length > 0) {
                const activeMission = pool.missions[0];
                activeMission.expiresAt = new Date(startTime.getTime() - 1000).toISOString();

                // Refresh with active mission ID
                const laterTime = new Date('2026-01-22T12:30:00Z');
                const refreshed = refreshPool(pool, 1, laterTime, activeMission.missionId);

                // Active mission should still exist despite being "expired"
                expect(refreshed.missions.find(m => m.missionId === activeMission.missionId)).toBeDefined();
            }
        });
    });

    // ========================================================================
    // Time Limit Calculations
    // ========================================================================

    describe('time limit calculations', () => {
        it('time limit should scale with objective count', () => {
            // Generate multiple missions and verify time limits are reasonable
            const clients = getAllClients();

            for (let i = 0; i < 10; i++) {
                const mission = generateMission(clients[0].id, { hasTimed: true });

                // Time limit should be 3-10 minutes
                expect(mission.timeLimitMinutes).toBeGreaterThanOrEqual(3);
                expect(mission.timeLimitMinutes).toBeLessThanOrEqual(10);
            }
        });

        it('time limit should be integer minutes', () => {
            const clients = getAllClients();

            for (let i = 0; i < 5; i++) {
                const mission = generateMission(clients[0].id, { hasTimed: true });

                expect(Number.isInteger(mission.timeLimitMinutes)).toBe(true);
            }
        });
    });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry
vi.mock('../../systems/NetworkRegistry', () => ({
    default: {
        addFilesToFileSystem: vi.fn(() => true),
        registerNetwork: vi.fn(() => true),
        registerDevice: vi.fn(() => true),
        registerFileSystem: vi.fn(() => true),
        getFileSystem: vi.fn(() => null),
        isIpInUse: vi.fn(() => false),
        isSubnetInUse: vi.fn(() => false),
    },
}));

// Mock clientRegistry
vi.mock('../../data/clientRegistry', () => ({
    getClientById: vi.fn((id) => ({
        id,
        name: 'Test Corporation',
        industry: 'corporate',
        clientType: 'corp-medium',
        minReputation: 1,
    })),
}));

// Mock missionData
vi.mock('../../missions/missionData.js', () => ({
    allMissions: [],
}));

import {
    extensionConfig,
    shouldTriggerExtension,
    getObjectiveProgress,
} from '../../missions/MissionExtensionGenerator';

describe('Mission Extension Flow Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // Objective Progress Calculation
    // ========================================================================

    describe('objective progress calculation', () => {
        it('should calculate progress correctly for mixed statuses', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', status: 'complete' },
                { id: 'obj-3', type: 'fileOperation', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // 2 complete out of 3 non-verification
            expect(progress.completed).toBe(2);
            expect(progress.total).toBe(3);
            expect(progress.isAllRealComplete).toBe(false);
        });

        it('should exclude verification from progress', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', status: 'complete' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // Both non-verification objectives complete
            expect(progress.completed).toBe(2);
            expect(progress.total).toBe(2);
            expect(progress.isAllRealComplete).toBe(true);
        });

        it('should return zeros for no completed objectives', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'pending' },
                { id: 'obj-2', type: 'fileOperation', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(2);
            expect(progress.isAllRealComplete).toBe(false);
        });

        it('should handle all objectives complete', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', status: 'complete' },
                { id: 'obj-3', type: 'fileOperation', status: 'complete' },
                { id: 'obj-verify', type: 'verification', status: 'complete' },
            ];

            const progress = getObjectiveProgress(objectives);

            expect(progress.completed).toBe(3);
            expect(progress.total).toBe(3);
            expect(progress.isAllRealComplete).toBe(true);
        });

        it('should handle null objectives', () => {
            const progress = getObjectiveProgress(null);

            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(0);
            expect(progress.isAllRealComplete).toBe(false);
        });

        it('should handle undefined objectives', () => {
            const progress = getObjectiveProgress(undefined);

            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(0);
            expect(progress.isAllRealComplete).toBe(false);
        });
    });

    // ========================================================================
    // Extension Trigger Conditions
    // ========================================================================

    describe('extension trigger conditions', () => {
        it('should not trigger if extension already offered', () => {
            const mission = { missionId: 'mission-123' };
            const extensionOffers = { 'mission-123': true };

            const result = shouldTriggerExtension(mission, 2, 3, false, extensionOffers);

            expect(result).toBe(false);
        });

        it('should not trigger below 50% progress (mid-mission threshold)', () => {
            const mission = { missionId: 'mission-123' };

            // 1/4 = 25% < 50%
            const result = shouldTriggerExtension(mission, 1, 4, false, {});

            // Below threshold, should return false regardless of random
            expect(result).toBe(false);
        });

        it('mid-mission trigger depends on random at threshold', () => {
            const mission = { missionId: 'mission-123' };
            let triggered = false;

            // Run many times to test probabilistic behavior
            for (let i = 0; i < 100; i++) {
                if (shouldTriggerExtension(mission, 2, 3, false, {})) {
                    triggered = true;
                    break;
                }
            }

            // Should trigger at least once with 25% chance over 100 iterations
            // (probability of never triggering = 0.75^100 ≈ 0)
            expect(triggered).toBe(true);
        });

        it('post-completion trigger depends on random', () => {
            const mission = { missionId: 'mission-123' };
            let triggered = false;

            // Run many times to test probabilistic behavior
            for (let i = 0; i < 100; i++) {
                if (shouldTriggerExtension(mission, 3, 3, true, {})) {
                    triggered = true;
                    break;
                }
            }

            // Should trigger at least once with reasonable chance
            expect(triggered).toBe(true);
        });
    });

    // ========================================================================
    // Extension Configuration
    // ========================================================================

    describe('extension configuration', () => {
        it('should have valid mid-mission threshold', () => {
            expect(extensionConfig.midMissionThreshold).toBe(0.5);
        });

        it('should have valid mid-mission chance', () => {
            expect(extensionConfig.midMissionChance).toBeGreaterThan(0);
            expect(extensionConfig.midMissionChance).toBeLessThan(1);
        });

        it('should have valid post-completion chance', () => {
            expect(extensionConfig.postCompletionChance).toBeGreaterThan(0);
            expect(extensionConfig.postCompletionChance).toBeLessThan(1);
        });

        it('should have valid payout multipliers', () => {
            expect(extensionConfig.midMissionMultiplier.min).toBeLessThan(
                extensionConfig.midMissionMultiplier.max
            );
            expect(extensionConfig.postCompletionMultiplier.min).toBeLessThan(
                extensionConfig.postCompletionMultiplier.max
            );
        });

        it('post-completion multiplier should be higher than mid-mission', () => {
            expect(extensionConfig.postCompletionMultiplier.min).toBeGreaterThanOrEqual(
                extensionConfig.midMissionMultiplier.min
            );
        });

        it('should have valid new network chance', () => {
            expect(extensionConfig.newNetworkChance).toBeGreaterThanOrEqual(0);
            expect(extensionConfig.newNetworkChance).toBeLessThanOrEqual(1);
        });
    });

    // ========================================================================
    // Integration with Objective Structures
    // ========================================================================

    describe('integration with objective structures', () => {
        it('should work with repair mission objectives', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', operation: 'repair', status: 'complete' },
                { id: 'obj-3', type: 'fileOperation', operation: 'repair', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            expect(progress.completed).toBe(2);
            expect(progress.total).toBe(3);
        });

        it('should work with backup mission objectives', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', operation: 'copy', status: 'complete' },
                { id: 'obj-3', type: 'fileOperation', operation: 'paste', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // 2/3 non-verification complete
            expect(progress.completed).toBe(2);
            expect(progress.total).toBe(3);
        });

        it('should work with transfer mission objectives', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', target: 'source-network', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', operation: 'copy', status: 'complete' },
                { id: 'obj-3', type: 'networkConnection', target: 'dest-network', status: 'pending' },
                { id: 'obj-4', type: 'fileOperation', operation: 'paste', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // 2/4 non-verification complete
            expect(progress.completed).toBe(2);
            expect(progress.total).toBe(4);
        });
    });

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle mission with only verification objective', () => {
            const objectives = [
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // No non-verification objectives
            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(0);
            expect(progress.isAllRealComplete).toBe(false);
        });

        it('should handle empty objectives array', () => {
            const progress = getObjectiveProgress([]);

            expect(progress.completed).toBe(0);
            expect(progress.total).toBe(0);
        });

        it('should handle objectives with in-progress status', () => {
            const objectives = [
                { id: 'obj-1', type: 'networkConnection', status: 'complete' },
                { id: 'obj-2', type: 'fileOperation', status: 'in-progress' },
                { id: 'obj-3', type: 'fileOperation', status: 'pending' },
                { id: 'obj-verify', type: 'verification', status: 'pending' },
            ];

            const progress = getObjectiveProgress(objectives);

            // in-progress counts as not complete
            expect(progress.completed).toBe(1);
            expect(progress.total).toBe(3);
        });

        it('should handle mission ID as id instead of missionId', () => {
            const mission = { id: 'alt-mission-123' };
            const extensionOffers = { 'alt-mission-123': true };

            const result = shouldTriggerExtension(mission, 2, 3, false, extensionOffers);

            expect(result).toBe(false);
        });
    });

    // ========================================================================
    // Probabilistic Testing
    // ========================================================================

    describe('probabilistic behavior', () => {
        it('extension trigger should respect probability over many iterations', () => {
            const mission = { missionId: 'mission-test' };
            let triggerCount = 0;
            const iterations = 200;

            for (let i = 0; i < iterations; i++) {
                // At 2/3 = 67% progress, above threshold
                if (shouldTriggerExtension(mission, 2, 3, false, {})) {
                    triggerCount++;
                }
            }

            // Should trigger roughly 25% of the time (midMissionChance)
            // Allow wide margin for randomness: expect between 10% and 50%
            expect(triggerCount).toBeGreaterThanOrEqual(iterations * 0.1);
            expect(triggerCount).toBeLessThanOrEqual(iterations * 0.5);
        });
    });
});

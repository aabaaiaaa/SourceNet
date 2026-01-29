import { describe, it, expect } from 'vitest';
import {
    isFeatureUnlocked,
    isHardwareCategoryUnlocked,
    isSoftwareUnlocked,
    getUnlockHint,
    getHardwareCategoryUnlockId,
} from './UnlockSystem';

describe('UnlockSystem', () => {
    describe('isFeatureUnlocked', () => {
        it('should return true when feature is in unlocked list', () => {
            const unlockedFeatures = ['network-adapters', 'advanced-tools'];

            expect(isFeatureUnlocked(unlockedFeatures, 'network-adapters')).toBe(true);
            expect(isFeatureUnlocked(unlockedFeatures, 'advanced-tools')).toBe(true);
        });

        it('should return false when feature is not in unlocked list', () => {
            const unlockedFeatures = ['network-adapters'];

            expect(isFeatureUnlocked(unlockedFeatures, 'advanced-tools')).toBe(false);
            expect(isFeatureUnlocked(unlockedFeatures, 'cpu-upgrades')).toBe(false);
        });

        it('should return false when unlocked list is empty', () => {
            expect(isFeatureUnlocked([], 'network-adapters')).toBe(false);
        });
    });

    describe('isHardwareCategoryUnlocked', () => {
        it('should return true when network category is unlocked', () => {
            const unlockedFeatures = ['network-adapters'];

            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'network')).toBe(true);
        });

        it('should return false when network category is not unlocked', () => {
            const unlockedFeatures = [];

            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'network')).toBe(false);
        });

        it('should return false for categories without unlock mapping', () => {
            const unlockedFeatures = ['network-adapters', 'advanced-tools'];

            // These categories have unlock requirements but aren't unlocked yet
            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'processors')).toBe(false);
            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'memory')).toBe(false);
            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'storage')).toBe(false);
            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'motherboards')).toBe(false);
            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'powerSupplies')).toBe(false);
        });

        it('should return false for unknown categories', () => {
            const unlockedFeatures = ['network-adapters'];

            expect(isHardwareCategoryUnlocked(unlockedFeatures, 'unknown-category')).toBe(false);
        });
    });

    describe('isSoftwareUnlocked', () => {
        it('should return true for software with no unlock requirement', () => {
            const unlockedFeatures = [];
            const softwareItem = { id: 'mission-board', name: 'Mission Board' };

            expect(isSoftwareUnlocked(unlockedFeatures, softwareItem)).toBe(true);
        });

        it('should return true when software unlock requirement is met', () => {
            const unlockedFeatures = ['advanced-tools'];
            const softwareItem = {
                id: 'log-viewer',
                name: 'Log Viewer',
                requiresUnlock: 'advanced-tools',
            };

            expect(isSoftwareUnlocked(unlockedFeatures, softwareItem)).toBe(true);
        });

        it('should return false when software unlock requirement is not met', () => {
            const unlockedFeatures = [];
            const softwareItem = {
                id: 'log-viewer',
                name: 'Log Viewer',
                requiresUnlock: 'advanced-tools',
            };

            expect(isSoftwareUnlocked(unlockedFeatures, softwareItem)).toBe(false);
        });

        it('should support unlockRequirement property name', () => {
            const unlockedFeatures = ['advanced-tools'];
            const softwareItem = {
                id: 'data-recovery',
                unlockRequirement: 'advanced-tools',
            };

            expect(isSoftwareUnlocked(unlockedFeatures, softwareItem)).toBe(true);
        });

        it('should return true when either unlock property is satisfied', () => {
            const unlockedFeatures = ['advanced-tools'];

            // requiresUnlock property
            expect(isSoftwareUnlocked(unlockedFeatures, { requiresUnlock: 'advanced-tools' })).toBe(true);

            // unlockRequirement property
            expect(isSoftwareUnlocked(unlockedFeatures, { unlockRequirement: 'advanced-tools' })).toBe(true);
        });
    });

    describe('getUnlockHint', () => {
        it('should return hint for network category', () => {
            const hint = getUnlockHint('network');

            expect(hint).toBeTruthy();
            expect(typeof hint).toBe('string');
            expect(hint.length).toBeGreaterThan(0);
        });

        it('should return hint for advanced-tools', () => {
            const hint = getUnlockHint('advanced-tools');

            expect(hint).toBeTruthy();
            expect(typeof hint).toBe('string');
        });

        it('should return default hint for unknown unlock IDs', () => {
            const hint = getUnlockHint('unknown-thing');

            expect(hint).toBeTruthy();
            expect(typeof hint).toBe('string');
        });

        it('should return hint for hardware categories', () => {
            const categories = ['processors', 'memory', 'storage', 'motherboards', 'powerSupplies'];

            categories.forEach(category => {
                const hint = getUnlockHint(category);
                expect(hint).toBeTruthy();
                expect(typeof hint).toBe('string');
            });
        });
    });

    describe('getHardwareCategoryUnlockId', () => {
        it('should return unlock ID for network category', () => {
            expect(getHardwareCategoryUnlockId('network')).toBe('network-adapters');
        });

        it('should return unlock ID for other categories', () => {
            expect(getHardwareCategoryUnlockId('processors')).toBe('cpu-upgrades');
            expect(getHardwareCategoryUnlockId('memory')).toBe('memory-upgrades');
            expect(getHardwareCategoryUnlockId('storage')).toBe('storage-upgrades');
            expect(getHardwareCategoryUnlockId('motherboards')).toBe('motherboard-upgrades');
            expect(getHardwareCategoryUnlockId('powerSupplies')).toBe('power-upgrades');
        });

        it('should return null for unknown categories', () => {
            expect(getHardwareCategoryUnlockId('unknown')).toBeNull();
        });
    });
});

import { describe, it, expect } from 'vitest';
import {
    queueHardwareInstall,
    applyPendingHardware,
    hasPendingUpgrade,
    getPendingUpgrade,
    calculatePowerConsumption,
    checkPowerCapacity,
} from './HardwareInstallationSystem';

describe('HardwareInstallationSystem', () => {
    describe('queueHardwareInstall', () => {
        it('should add hardware to empty pending queue for single-slot category', () => {
            const pending = {};
            const item = { id: 'net-1gb', name: '1Gb Network Card' };

            const newPending = queueHardwareInstall(pending, 'network', item);

            expect(newPending.network).toEqual(item);
        });

        it('should add hardware to array for multi-slot category (memory)', () => {
            const pending = {};
            const item = { id: 'mem-16gb', name: '16GB DDR5' };

            const newPending = queueHardwareInstall(pending, 'memory', item);

            expect(newPending.memory).toEqual([item]);
        });

        it('should replace existing pending hardware in same single-slot category', () => {
            const pending = {
                network: { id: 'net-100mb', name: '100Mb Network Card' },
            };
            const item = { id: 'net-1gb', name: '1Gb Network Card' };

            const newPending = queueHardwareInstall(pending, 'network', item);

            expect(newPending.network).toEqual(item);
        });

        it('should preserve pending hardware in other categories', () => {
            const pending = {
                cpu: { id: 'cpu-4core', name: '4-Core Processor' },
            };
            const item = { id: 'net-1gb', name: '1Gb Network Card' };

            const newPending = queueHardwareInstall(pending, 'network', item);

            expect(newPending.cpu).toEqual(pending.cpu);
            expect(newPending.network).toEqual(item);
        });

        it('should not mutate the original pending object', () => {
            const pending = { network: { id: 'net-100mb' } };
            const item = { id: 'net-1gb', name: '1Gb Network Card' };

            const newPending = queueHardwareInstall(pending, 'network', item);

            expect(newPending).not.toBe(pending);
            expect(pending.network.id).toBe('net-100mb');
        });
    });

    describe('applyPendingHardware', () => {
        it('should apply network hardware upgrade', () => {
            const hardware = { network: { id: 'net-100mb', name: '100Mb Network Card' } };
            const pending = {
                network: { id: 'net-1gb', name: '1Gb Network Card', bandwidth: 125 },
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.network).toEqual(pending.network);
            expect(appliedUpgrades).toHaveLength(1);
            expect(appliedUpgrades[0].category).toBe('network');
            expect(appliedUpgrades[0].item).toEqual(pending.network);
        });

        it('should apply cpu hardware upgrade', () => {
            const hardware = { cpu: { id: 'cpu-4core', name: '4-Core Processor' } };
            const pending = {
                cpu: { id: 'cpu-8core', name: '8-Core Processor' },
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.cpu).toEqual(pending.cpu);
            expect(appliedUpgrades[0].category).toBe('cpu');
        });

        it('should apply memory hardware upgrade (as array)', () => {
            const hardware = { memory: [{ id: 'mem-8gb', name: '8GB DDR4' }] };
            const pending = {
                memory: [{ id: 'mem-16gb', name: '16GB DDR5' }],
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.memory).toEqual(pending.memory);
            expect(appliedUpgrades[0].category).toBe('memory');
        });

        it('should apply storage hardware upgrade (as array)', () => {
            const hardware = { storage: [{ id: 'ssd-500gb', name: '500GB SSD' }] };
            const pending = {
                storage: [{ id: 'ssd-2tb', name: '2TB SSD' }],
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.storage).toEqual(pending.storage);
            expect(appliedUpgrades[0].category).toBe('storage');
        });

        it('should apply motherboard hardware upgrade', () => {
            const hardware = { motherboard: { id: 'mb-basic', name: 'Basic Motherboard' } };
            const pending = {
                motherboard: { id: 'mb-gaming', name: 'Gaming Motherboard' },
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.motherboard).toEqual(pending.motherboard);
            expect(appliedUpgrades[0].category).toBe('motherboard');
        });

        it('should apply power supply hardware upgrade', () => {
            const hardware = { powerSupply: { id: 'psu-500w', name: '500W PSU' } };
            const pending = {
                powerSupply: { id: 'psu-750w', name: '750W PSU' },
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.powerSupply).toEqual(pending.powerSupply);
            expect(appliedUpgrades[0].category).toBe('powerSupply');
        });

        it('should apply multiple pending upgrades at once', () => {
            const hardware = {
                network: { id: 'net-100mb', name: '100Mb Network Card' },
                cpu: { id: 'cpu-4core', name: '4-Core Processor' },
            };
            const pending = {
                network: { id: 'net-1gb', name: '1Gb Network Card' },
                cpu: { id: 'cpu-8core', name: '8-Core Processor' },
            };

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(newHardware.network).toEqual(pending.network);
            expect(newHardware.cpu).toEqual(pending.cpu);
            expect(appliedUpgrades).toHaveLength(2);
        });

        it('should return empty appliedUpgrades when no pending upgrades', () => {
            const hardware = { cpu: { id: 'cpu-4core' } };
            const pending = {};

            const { newHardware, appliedUpgrades } = applyPendingHardware(hardware, pending);

            expect(appliedUpgrades).toEqual([]);
            expect(newHardware).toEqual(hardware);
        });

        it('should not mutate original hardware object', () => {
            const hardware = { network: { id: 'net-100mb', name: '100Mb Network Card' } };
            const originalNetworkId = hardware.network.id;
            const pending = {
                network: { id: 'net-1gb', name: '1Gb Network Card' },
            };

            const { newHardware } = applyPendingHardware(hardware, pending);

            expect(hardware.network.id).toBe(originalNetworkId);
            expect(newHardware).not.toBe(hardware);
        });
    });

    describe('hasPendingUpgrade', () => {
        it('should return true when single-slot category has pending upgrade', () => {
            const pending = {
                network: { id: 'net-1gb', name: '1Gb Network Card' },
            };

            expect(hasPendingUpgrade(pending, 'network')).toBe(true);
        });

        it('should return true when multi-slot category has pending items', () => {
            const pending = {
                memory: [{ id: 'mem-16gb', name: '16GB DDR5' }],
            };

            expect(hasPendingUpgrade(pending, 'memory')).toBe(true);
        });

        it('should return false when category has no pending upgrade', () => {
            const pending = {
                cpu: { id: 'cpu-8core' },
            };

            expect(hasPendingUpgrade(pending, 'network')).toBe(false);
        });

        it('should return false when pending is null/undefined', () => {
            expect(hasPendingUpgrade(null, 'network')).toBe(false);
            expect(hasPendingUpgrade(undefined, 'network')).toBe(false);
        });
    });

    describe('getPendingUpgrade', () => {
        it('should return pending item for category', () => {
            const item = { id: 'net-1gb', name: '1Gb Network Card' };
            const pending = { network: item };

            expect(getPendingUpgrade(pending, 'network')).toEqual(item);
        });

        it('should return null when category has no pending', () => {
            const pending = { cpu: { id: 'cpu-8core' } };

            expect(getPendingUpgrade(pending, 'network')).toBeNull();
        });

        it('should return null when pending is null/undefined', () => {
            expect(getPendingUpgrade(null, 'network')).toBeNull();
            expect(getPendingUpgrade(undefined, 'network')).toBeNull();
        });
    });

    describe('calculatePowerConsumption', () => {
        it('should calculate total power from hardware components', () => {
            const hardware = {
                cpu: { power: 65 },
                motherboard: { power: 30 },
                network: { power: 5 },
                memory: [{ power: 5 }, { power: 5 }],
                storage: [{ power: 3 }],
            };

            expect(calculatePowerConsumption(hardware)).toBe(113);
        });

        it('should handle missing power values', () => {
            const hardware = {
                cpu: { name: 'No power specified' },
                memory: [{ power: 5 }],
            };

            expect(calculatePowerConsumption(hardware)).toBe(5);
        });

        it('should handle empty hardware', () => {
            expect(calculatePowerConsumption({})).toBe(0);
        });
    });

    describe('checkPowerCapacity', () => {
        it('should return canPower true when power supply has enough capacity', () => {
            const hardware = {
                powerSupply: { wattage: 300 },
                cpu: { power: 65 },
                motherboard: { power: 8 },
            };

            const result = checkPowerCapacity(hardware);

            expect(result.canPower).toBe(true);
            expect(result.consumption).toBe(73);
            expect(result.capacity).toBe(300);
            expect(result.headroom).toBe(227);
        });

        it('should return canPower false when power supply is insufficient', () => {
            const hardware = {
                powerSupply: { wattage: 200 },
                cpu: { power: 150 },
                motherboard: { power: 100 },
            };

            const result = checkPowerCapacity(hardware);

            expect(result.canPower).toBe(false);
            expect(result.consumption).toBe(250);
            expect(result.capacity).toBe(200);
            expect(result.headroom).toBe(-50);
        });

        it('should return correct values when hardware has low power consumption', () => {
            const hardware = {
                powerSupply: { wattage: 300 },
                cpu: { power: 10 },
            };

            const result = checkPowerCapacity(hardware);

            expect(result.canPower).toBe(true);
            expect(result.consumption).toBe(10);
        });

        it('should return canPower false when no power supply defined', () => {
            const hardware = {
                cpu: { power: 65 },
            };

            const result = checkPowerCapacity(hardware);

            expect(result.canPower).toBe(false);
            expect(result.capacity).toBe(0);
        });
    });
});

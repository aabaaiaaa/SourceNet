import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry before importing
vi.mock('./NetworkRegistry', () => ({
    default: {
        getNetworkDevices: vi.fn((networkId) => {
            if (networkId === 'test-network-1') {
                return [
                    { ip: '10.1.1.10', hostname: 'fileserver-01', fileSystemId: 'fs-001' },
                    { ip: '10.1.1.20', hostname: 'db-primary-01', fileSystemId: 'fs-002' },
                ];
            }
            if (networkId === 'empty-network') {
                return [];
            }
            return [];
        }),
        getNetwork: vi.fn((networkId) => {
            if (networkId === 'test-network-1') {
                return { id: 'test-network-1', address: '10.1.1.0/24' };
            }
            return null;
        }),
    },
}));

import {
    getRequiredDevices,
    generateRandomDevices,
    generateDevicesForNetwork,
    mapDevicesToFileSystems,
} from './NetworkDeviceGenerator';

import networkRegistry from './NetworkRegistry';

// ============================================================================
// Tests
// ============================================================================

describe('NetworkDeviceGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // getRequiredDevices
    // ========================================================================

    describe('getRequiredDevices', () => {
        it('should return devices from NetworkRegistry', () => {
            const devices = getRequiredDevices('test-network-1');

            expect(devices).toHaveLength(2);
            expect(devices[0].ip).toBe('10.1.1.10');
            expect(devices[1].ip).toBe('10.1.1.20');
        });

        it('should mark devices as required', () => {
            const devices = getRequiredDevices('test-network-1');

            devices.forEach(device => {
                expect(device.required).toBe(true);
            });
        });

        it('should determine device type from hostname', () => {
            const devices = getRequiredDevices('test-network-1');

            expect(devices[0].type).toBe('fileserver');
            expect(devices[1].type).toBe('database');
        });

        it('should return empty array for null/undefined input', () => {
            expect(getRequiredDevices(null)).toEqual([]);
            expect(getRequiredDevices(undefined)).toEqual([]);
        });

        it('should return empty array for network with no devices', () => {
            const devices = getRequiredDevices('empty-network');

            expect(devices).toEqual([]);
        });

        it('should accept network object with networkId property', () => {
            const devices = getRequiredDevices({ networkId: 'test-network-1' });

            expect(devices).toHaveLength(2);
        });

        it('should accept network object with id property', () => {
            const devices = getRequiredDevices({ id: 'test-network-1' });

            expect(devices).toHaveLength(2);
        });

        it('should include file system paths', () => {
            const devices = getRequiredDevices('test-network-1');

            expect(devices[0].fileSystems).toBeDefined();
            expect(Array.isArray(devices[0].fileSystems)).toBe(true);
        });
    });

    // ========================================================================
    // generateRandomDevices
    // ========================================================================

    describe('generateRandomDevices', () => {
        const mockNetwork = { address: '10.1.1.0/24' };

        // Create a deterministic seeded random for testing
        const createMockRandom = () => {
            let counter = 0;
            return () => {
                counter = (counter + 1) % 100;
                return counter / 100;
            };
        };

        it('should generate specified number of devices', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 5, ['workstation', 'printer'], random);

            expect(devices).toHaveLength(5);
        });

        it('should generate devices with valid IPs in network range', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 3, ['workstation'], random);

            devices.forEach(device => {
                expect(device.ip).toMatch(/^10\.1\.1\.\d+$/);
                const lastOctet = parseInt(device.ip.split('.')[3]);
                expect(lastOctet).toBeGreaterThanOrEqual(1);
                expect(lastOctet).toBeLessThanOrEqual(254);
            });
        });

        it('should generate unique IPs', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 10, ['workstation'], random);

            const ips = devices.map(d => d.ip);
            const uniqueIps = new Set(ips);

            expect(uniqueIps.size).toBe(ips.length);
        });

        it('should mark devices as not required', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 3, ['workstation'], random);

            devices.forEach(device => {
                expect(device.required).toBe(false);
            });
        });

        it('should generate hostnames matching device type', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 5, ['workstation'], random);

            devices.forEach(device => {
                expect(device.hostname).toMatch(/^ws-\d+$/);
            });
        });

        it('should pick device types from provided list', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 5, ['workstation', 'printer'], random);

            devices.forEach(device => {
                expect(['workstation', 'printer']).toContain(device.type);
            });
        });

        it('should start IPs from specified startIP', () => {
            const random = createMockRandom();
            const devices = generateRandomDevices(mockNetwork, 3, ['workstation'], random, 100);

            devices.forEach(device => {
                const lastOctet = parseInt(device.ip.split('.')[3]);
                expect(lastOctet).toBeGreaterThanOrEqual(100);
            });
        });
    });

    // ========================================================================
    // generateDevicesForNetwork
    // ========================================================================

    describe('generateDevicesForNetwork', () => {
        it('should return required devices for quick scan', () => {
            const devices = generateDevicesForNetwork('test-network-1', 'quick');

            // Quick scan only returns fileserver and database types
            devices.forEach(device => {
                expect(['fileserver', 'database']).toContain(device.type);
            });
        });

        it('should return required devices plus random for deep scan', () => {
            const devices = generateDevicesForNetwork('test-network-1', 'deep');

            // Deep scan includes required devices + random background devices
            const requiredDevices = devices.filter(d => d.required);
            const randomDevices = devices.filter(d => !d.required);

            expect(requiredDevices.length).toBe(2); // From mock
            expect(randomDevices.length).toBeGreaterThanOrEqual(0); // 0+ random
            expect(devices.length).toBeGreaterThan(requiredDevices.length); // Should have some random
        });

        it('should return empty array for null input', () => {
            expect(generateDevicesForNetwork(null)).toEqual([]);
        });

        it('should return empty array for undefined input', () => {
            expect(generateDevicesForNetwork(undefined)).toEqual([]);
        });

        it('should accept network ID string', () => {
            const devices = generateDevicesForNetwork('test-network-1', 'quick');

            expect(devices.length).toBeGreaterThan(0);
        });

        it('should accept network object', () => {
            const devices = generateDevicesForNetwork({ networkId: 'test-network-1' }, 'quick');

            expect(devices.length).toBeGreaterThan(0);
        });

        it('should default to deep scan', () => {
            const devicesDefault = generateDevicesForNetwork('test-network-1');
            const devicesDeep = generateDevicesForNetwork('test-network-1', 'deep');

            // Both should include random devices (not just required)
            const defaultRandom = devicesDefault.filter(d => !d.required);
            const deepRandom = devicesDeep.filter(d => !d.required);

            expect(defaultRandom.length).toBeGreaterThan(0);
            expect(deepRandom.length).toBeGreaterThan(0);
        });

        it('should generate deterministic random devices (seeded by network ID)', () => {
            const devices1 = generateDevicesForNetwork('test-network-1', 'deep');
            const devices2 = generateDevicesForNetwork('test-network-1', 'deep');

            // Same network ID should produce same random devices (deterministic)
            expect(devices1.length).toBe(devices2.length);

            // Compare non-required (random) devices
            const random1 = devices1.filter(d => !d.required);
            const random2 = devices2.filter(d => !d.required);

            expect(random1.length).toBe(random2.length);
            // Hostnames should match due to seeded random
            for (let i = 0; i < random1.length; i++) {
                expect(random1[i].hostname).toBe(random2[i].hostname);
            }
        });

        it('should include various device types in deep scan', () => {
            // Run multiple times with different networks to ensure coverage
            const allTypes = new Set();

            for (let i = 1; i <= 5; i++) {
                const devices = generateDevicesForNetwork(`test-network-${i}`, 'deep');
                devices.forEach(d => allTypes.add(d.type));
            }

            // Should have fileserver/database from required, plus potentially others
            expect(allTypes.has('fileserver') || allTypes.has('database')).toBe(true);
        });
    });

    // ========================================================================
    // mapDevicesToFileSystems
    // ========================================================================

    describe('mapDevicesToFileSystems', () => {
        it('should map file systems to matching devices by IP', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', fileSystems: [] },
                { ip: '10.1.1.20', hostname: 'server-2', fileSystems: [] },
            ];

            const narEntry = {
                fileSystems: [
                    { ip: '10.1.1.10', name: 'fileserver', files: ['file1.txt'] },
                    { ip: '10.1.1.20', name: 'backup', files: ['backup1.db'] },
                ],
            };

            const mapped = mapDevicesToFileSystems(devices, narEntry);

            expect(mapped[0].fileSystems).toEqual(['/fileserver/']);
            expect(mapped[1].fileSystems).toEqual(['/backup/']);
        });

        it('should preserve device properties', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', type: 'fileserver', required: true },
            ];

            const narEntry = {
                fileSystems: [
                    { ip: '10.1.1.10', name: 'fileserver', files: ['file1.txt'] },
                ],
            };

            const mapped = mapDevicesToFileSystems(devices, narEntry);

            expect(mapped[0].ip).toBe('10.1.1.10');
            expect(mapped[0].hostname).toBe('server-1');
            expect(mapped[0].type).toBe('fileserver');
            expect(mapped[0].required).toBe(true);
        });

        it('should keep original fileSystems if no match', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', fileSystems: ['/original/'] },
            ];

            const narEntry = {
                fileSystems: [
                    { ip: '10.1.1.99', name: 'other', files: [] }, // Different IP
                ],
            };

            const mapped = mapDevicesToFileSystems(devices, narEntry);

            expect(mapped[0].fileSystems).toEqual(['/original/']);
        });

        it('should return devices unchanged if narEntry is null', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', fileSystems: ['/test/'] },
            ];

            const mapped = mapDevicesToFileSystems(devices, null);

            expect(mapped).toEqual(devices);
        });

        it('should return devices unchanged if narEntry has no fileSystems', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', fileSystems: ['/test/'] },
            ];

            const mapped = mapDevicesToFileSystems(devices, {});

            expect(mapped).toEqual(devices);
        });

        it('should handle file systems without files array', () => {
            const devices = [
                { ip: '10.1.1.10', hostname: 'server-1', fileSystems: [] },
            ];

            const narEntry = {
                fileSystems: [
                    { ip: '10.1.1.10', name: 'fileserver' }, // No files array
                ],
            };

            const mapped = mapDevicesToFileSystems(devices, narEntry);

            expect(mapped[0].fileSystems).toEqual([]);
        });
    });

    // ========================================================================
    // Device type detection
    // ========================================================================

    describe('device type detection', () => {
        it('should detect fileserver type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'fileserver-01', fileSystemId: 'fs-1' },
                { ip: '10.1.1.11', hostname: 'file-server-02', fileSystemId: 'fs-2' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('fileserver');
            expect(devices[1].type).toBe('fileserver');
        });

        it('should detect database type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'database-primary', fileSystemId: 'fs-1' },
                { ip: '10.1.1.11', hostname: 'db-backup-01', fileSystemId: 'fs-2' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('database');
            expect(devices[1].type).toBe('database');
        });

        it('should detect backup as fileserver type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'backup-server-01', fileSystemId: 'fs-1' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('fileserver');
        });

        it('should detect workstation type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'ws-123', fileSystemId: 'fs-1' },
                { ip: '10.1.1.11', hostname: 'workstation-45', fileSystemId: 'fs-2' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('workstation');
            expect(devices[1].type).toBe('workstation');
        });

        it('should detect printer type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'printer-floor2', fileSystemId: 'fs-1' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('printer');
        });

        it('should detect IoT type', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'camera-lobby', fileSystemId: 'fs-1' },
                { ip: '10.1.1.11', hostname: 'iot-sensor-01', fileSystemId: 'fs-2' },
                { ip: '10.1.1.12', hostname: 'temp-sensor-floor3', fileSystemId: 'fs-3' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('iot');
            expect(devices[1].type).toBe('iot');
            expect(devices[2].type).toBe('iot');
        });

        it('should default to fileserver for unknown hostnames', () => {
            networkRegistry.getNetworkDevices.mockReturnValue([
                { ip: '10.1.1.10', hostname: 'mystery-device', fileSystemId: 'fs-1' },
            ]);

            const devices = getRequiredDevices('test');

            expect(devices[0].type).toBe('fileserver');
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkRegistry } from './NetworkRegistry';

// Mock the event bus with default export pattern
vi.mock('../core/triggerEventBus', () => ({
    default: {
        emit: vi.fn(),
    },
}));

// Import the mocked module to access the mock function
import triggerEventBus from '../core/triggerEventBus';

describe('NetworkRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new NetworkRegistry();
        vi.clearAllMocks();
    });

    // =========================================================================
    // REGISTRATION TESTS
    // =========================================================================

    describe('registerNetwork', () => {
        it('should register a new network', () => {
            const result = registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            expect(result).toBe(true);
            expect(registry.getNetwork('test-network')).toEqual({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
                accessible: false,
                discovered: false,
                revokedReason: null,
            });
        });

        it('should default accessible to false', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            expect(registry.getNetwork('test-network').accessible).toBe(false);
        });

        it('should update existing network', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Updated Network',
                bandwidth: 100,
            });

            const network = registry.getNetwork('test-network');
            expect(network.networkName).toBe('Updated Network');
            expect(network.bandwidth).toBe(100);
            expect(network.address).toBe('10.1.1.0/24'); // Preserved
        });

        it('should return false without networkId', () => {
            const result = registry.registerNetwork({
                networkName: 'Test Network',
            });

            expect(result).toBe(false);
        });
    });

    describe('registerDevice', () => {
        it('should register a new device', () => {
            const result = registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });

            expect(result).toBe(true);
            expect(registry.getDevice('10.1.1.10')).toEqual({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
                accessible: false,
            });
        });

        it('should update existing device', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });

            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-updated',
            });

            const device = registry.getDevice('10.1.1.10');
            expect(device.hostname).toBe('server-updated');
            expect(device.networkId).toBe('test-network'); // Preserved
        });

        it('should return false without IP', () => {
            const result = registry.registerDevice({
                hostname: 'server-01',
            });

            expect(result).toBe(false);
        });
    });

    describe('registerFileSystem', () => {
        it('should register a new file system', () => {
            const files = [
                { name: 'file1.txt', size: '1 KB' },
                { name: 'file2.txt', size: '2 KB' },
            ];

            const result = registry.registerFileSystem({
                id: 'fs-01',
                files,
            });

            expect(result).toBe(true);
            expect(registry.getFileSystem('fs-01')).toEqual({
                id: 'fs-01',
                files,
            });
        });

        it('should clone files to avoid external mutations', () => {
            const files = [{ name: 'file1.txt', size: '1 KB' }];
            registry.registerFileSystem({ id: 'fs-01', files });

            files.push({ name: 'file2.txt', size: '2 KB' });

            expect(registry.getFileSystem('fs-01').files).toHaveLength(1);
        });

        it('should merge files when registering existing file system', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'file1.txt', size: '1 KB' }],
            });

            registry.registerFileSystem({
                id: 'fs-01',
                files: [
                    { name: 'file1.txt', size: '5 KB' }, // Duplicate - ignored
                    { name: 'file2.txt', size: '2 KB' }, // New - added
                ],
            });

            const fs = registry.getFileSystem('fs-01');
            expect(fs.files).toHaveLength(2);
            expect(fs.files[0].size).toBe('1 KB'); // Original preserved
            expect(fs.files[1].name).toBe('file2.txt');
        });

        it('should return false without id', () => {
            const result = registry.registerFileSystem({
                files: [],
            });

            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // QUERY TESTS
    // =========================================================================

    describe('getNetworkDevices', () => {
        it('should return all devices for a network', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'network-a',
                fileSystemId: 'fs-01',
            });
            registry.registerDevice({
                ip: '10.1.1.20',
                hostname: 'server-02',
                networkId: 'network-a',
                fileSystemId: 'fs-02',
            });
            registry.registerDevice({
                ip: '10.2.2.10',
                hostname: 'server-03',
                networkId: 'network-b',
                fileSystemId: 'fs-03',
            });

            const devices = registry.getNetworkDevices('network-a');
            expect(devices).toHaveLength(2);
            expect(devices.map(d => d.hostname)).toContain('server-01');
            expect(devices.map(d => d.hostname)).toContain('server-02');
        });

        it('should return empty array for unknown network', () => {
            const devices = registry.getNetworkDevices('unknown');
            expect(devices).toEqual([]);
        });
    });

    describe('getNetworkFileSystems', () => {
        it('should return file systems with device info for a network', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'network-a',
                fileSystemId: 'fs-01',
                accessible: true,
            });
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'file1.txt' }],
            });

            const fileSystems = registry.getNetworkFileSystems('network-a');
            expect(fileSystems).toHaveLength(1);
            expect(fileSystems[0]).toEqual({
                id: 'fs-01',
                files: [{ name: 'file1.txt' }],
                ip: '10.1.1.10',
                hostname: 'server-01',
                accessible: true,
            });
        });
    });

    // =========================================================================
    // COLLISION DETECTION TESTS
    // =========================================================================

    describe('isSubnetInUse', () => {
        it('should return true for used subnet', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            expect(registry.isSubnetInUse('10.1.1.0/24')).toBe(true);
        });

        it('should return false for unused subnet', () => {
            expect(registry.isSubnetInUse('10.1.1.0/24')).toBe(false);
        });
    });

    describe('isIpInUse', () => {
        it('should return true for used IP', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });

            expect(registry.isIpInUse('10.1.1.10')).toBe(true);
        });

        it('should return false for unused IP', () => {
            expect(registry.isIpInUse('10.1.1.10')).toBe(false);
        });
    });

    describe('getUsedSubnets', () => {
        it('should return all used subnets', () => {
            registry.registerNetwork({
                networkId: 'network-a',
                networkName: 'A',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerNetwork({
                networkId: 'network-b',
                networkName: 'B',
                address: '10.2.2.0/24',
                bandwidth: 50,
            });

            const subnets = registry.getUsedSubnets();
            expect(subnets.size).toBe(2);
            expect(subnets.has('10.1.1.0/24')).toBe(true);
            expect(subnets.has('10.2.2.0/24')).toBe(true);
        });
    });

    describe('getUsedIps', () => {
        it('should return all used IPs', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });
            registry.registerDevice({
                ip: '10.1.1.20',
                hostname: 'server-02',
                networkId: 'test-network',
                fileSystemId: 'fs-02',
            });

            const ips = registry.getUsedIps();
            expect(ips.size).toBe(2);
            expect(ips.has('10.1.1.10')).toBe(true);
            expect(ips.has('10.1.1.20')).toBe(true);
        });
    });

    // =========================================================================
    // MODIFICATION TESTS
    // =========================================================================

    describe('updateFiles', () => {
        it('should replace all files in file system', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'old.txt' }],
            });

            const newFiles = [{ name: 'new1.txt' }, { name: 'new2.txt' }];
            const result = registry.updateFiles('fs-01', newFiles);

            expect(result).toBe(true);
            expect(registry.getFileSystem('fs-01').files).toEqual(newFiles);
        });

        it('should emit fileSystemChanged event', () => {
            registry.registerFileSystem({ id: 'fs-01', files: [] });

            const newFiles = [{ name: 'file.txt' }];
            registry.updateFiles('fs-01', newFiles);

            expect(triggerEventBus.emit).toHaveBeenCalledWith('fileSystemChanged', {
                fileSystemId: 'fs-01',
                files: newFiles,
            });
        });

        it('should return false for unknown file system', () => {
            const result = registry.updateFiles('unknown', []);
            expect(result).toBe(false);
        });
    });

    describe('addFilesToFileSystem', () => {
        it('should add new files to file system', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'existing.txt' }],
            });

            const result = registry.addFilesToFileSystem('fs-01', [
                { name: 'new.txt' },
            ]);

            expect(result).toBe(true);
            expect(registry.getFileSystem('fs-01').files).toHaveLength(2);
        });

        it('should not add duplicate files', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'file.txt', size: '1 KB' }],
            });

            registry.addFilesToFileSystem('fs-01', [
                { name: 'file.txt', size: '5 KB' }, // Duplicate
                { name: 'new.txt', size: '2 KB' },
            ]);

            const fs = registry.getFileSystem('fs-01');
            expect(fs.files).toHaveLength(2);
            expect(fs.files.find(f => f.name === 'file.txt').size).toBe('1 KB');
        });

        it('should emit fileSystemChanged event', () => {
            registry.registerFileSystem({ id: 'fs-01', files: [] });

            registry.addFilesToFileSystem('fs-01', [{ name: 'file.txt' }]);

            expect(triggerEventBus.emit).toHaveBeenCalledWith('fileSystemChanged', expect.objectContaining({
                fileSystemId: 'fs-01',
            }));
        });
    });

    describe('modifyFileProperties', () => {
        it('should modify properties of specified files', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [
                    { name: 'file1.txt', corrupted: false },
                    { name: 'file2.txt', corrupted: false },
                    { name: 'file3.txt', corrupted: false },
                ],
            });

            const result = registry.modifyFileProperties(
                'fs-01',
                ['file1.txt', 'file3.txt'],
                { corrupted: true }
            );

            expect(result).toBe(true);
            const files = registry.getFileSystem('fs-01').files;
            expect(files.find(f => f.name === 'file1.txt').corrupted).toBe(true);
            expect(files.find(f => f.name === 'file2.txt').corrupted).toBe(false);
            expect(files.find(f => f.name === 'file3.txt').corrupted).toBe(true);
        });

        it('should emit fileSystemChanged event', () => {
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'file.txt', corrupted: false }],
            });

            registry.modifyFileProperties('fs-01', ['file.txt'], { corrupted: true });

            expect(triggerEventBus.emit).toHaveBeenCalledWith('fileSystemChanged', expect.objectContaining({
                fileSystemId: 'fs-01',
            }));
        });

        it('should return false for unknown file system', () => {
            const result = registry.modifyFileProperties('unknown', ['file.txt'], {});
            expect(result).toBe(false);
        });
    });

    describe('setNetworkAccessible', () => {
        it('should set network accessibility', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            registry.setNetworkAccessible('test-network', false, 'Access revoked');

            const network = registry.getNetwork('test-network');
            expect(network.accessible).toBe(false);
            expect(network.revokedReason).toBe('Access revoked');
        });

        it('should update all devices on the network', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });
            registry.registerDevice({
                ip: '10.1.1.20',
                hostname: 'server-02',
                networkId: 'test-network',
                fileSystemId: 'fs-02',
            });

            registry.setNetworkAccessible('test-network', false);

            expect(registry.getDevice('10.1.1.10').accessible).toBe(false);
            expect(registry.getDevice('10.1.1.20').accessible).toBe(false);
        });

        it('should clear revokedReason when setting accessible to true', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            registry.setNetworkAccessible('test-network', false, 'Revoked');
            registry.setNetworkAccessible('test-network', true);

            expect(registry.getNetwork('test-network').revokedReason).toBeUndefined();
        });
    });

    describe('setDeviceAccessible', () => {
        it('should set device accessibility', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });

            registry.setDeviceAccessible('10.1.1.10', false);

            expect(registry.getDevice('10.1.1.10').accessible).toBe(false);
        });

        it('should return false for unknown device', () => {
            const result = registry.setDeviceAccessible('unknown', false);
            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // SERIALIZATION TESTS
    // =========================================================================

    describe('getSnapshot / loadSnapshot', () => {
        it('should serialize and deserialize registry state', () => {
            registry.registerNetwork({
                networkId: 'network-a',
                networkName: 'Network A',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'network-a',
                fileSystemId: 'fs-01',
            });
            registry.registerFileSystem({
                id: 'fs-01',
                files: [{ name: 'file.txt', corrupted: true }],
            });

            const snapshot = registry.getSnapshot();

            // Create new registry and load snapshot
            const newRegistry = new NetworkRegistry();
            newRegistry.loadSnapshot(snapshot);

            expect(newRegistry.getNetwork('network-a')).toEqual(registry.getNetwork('network-a'));
            expect(newRegistry.getDevice('10.1.1.10')).toEqual(registry.getDevice('10.1.1.10'));
            expect(newRegistry.getFileSystem('fs-01')).toEqual(registry.getFileSystem('fs-01'));
        });

        it('should clear existing data before loading snapshot', () => {
            registry.registerNetwork({
                networkId: 'old-network',
                networkName: 'Old',
                address: '10.0.0.0/24',
                bandwidth: 25,
            });

            registry.loadSnapshot({
                networks: [{
                    networkId: 'new-network',
                    networkName: 'New',
                    address: '10.1.1.0/24',
                    bandwidth: 50,
                    accessible: true,
                }],
                devices: [],
                fileSystems: [],
            });

            expect(registry.getNetwork('old-network')).toBeNull();
            expect(registry.getNetwork('new-network')).not.toBeNull();
        });

        it('should handle empty snapshot', () => {
            registry.registerNetwork({
                networkId: 'test',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });

            registry.loadSnapshot({});

            expect(registry.networks.size).toBe(0);
        });
    });

    describe('clear', () => {
        it('should clear all registry data', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });
            registry.registerFileSystem({ id: 'fs-01', files: [] });

            registry.clear();

            expect(registry.networks.size).toBe(0);
            expect(registry.devices.size).toBe(0);
            expect(registry.fileSystems.size).toBe(0);
        });
    });

    // =========================================================================
    // DEBUG TESTS
    // =========================================================================

    describe('getDebugSummary', () => {
        it('should return summary of registry contents', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });
            registry.registerFileSystem({ id: 'fs-01', files: [] });

            const summary = registry.getDebugSummary();

            expect(summary.networkCount).toBe(1);
            expect(summary.deviceCount).toBe(1);
            expect(summary.fileSystemCount).toBe(1);
            expect(summary.networks[0].id).toBe('test-network');
            expect(summary.devices[0].ip).toBe('10.1.1.10');
        });
    });

    // =========================================================================
    // ACCESS CONTROL TESTS
    // =========================================================================

    describe('grantNetworkAccess', () => {
        it('should grant access to network and specified devices', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
            });
            registry.registerDevice({
                ip: '10.1.1.20',
                hostname: 'server-02',
                networkId: 'test-network',
                fileSystemId: 'fs-02',
            });

            const result = registry.grantNetworkAccess('test-network', ['10.1.1.10']);

            expect(result).toBe(true);
            expect(registry.getNetwork('test-network').accessible).toBe(true);
            expect(registry.getNetwork('test-network').discovered).toBe(true);
            expect(registry.getNetwork('test-network').revokedReason).toBeUndefined();
            expect(registry.getDevice('10.1.1.10').accessible).toBe(true);
            expect(registry.getDevice('10.1.1.20').accessible).toBe(false); // Not in deviceIps
        });

        it('should return false for unknown network', () => {
            const result = registry.grantNetworkAccess('unknown-network', []);
            expect(result).toBe(false);
        });
    });

    describe('revokeNetworkAccess', () => {
        it('should revoke access to network and all devices', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test Network',
                address: '10.1.1.0/24',
                bandwidth: 50,
                accessible: true,
                discovered: true,
            });
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'server-01',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
                accessible: true,
            });

            const result = registry.revokeNetworkAccess('test-network', 'Mission access expired');

            expect(result).toBe(true);
            expect(registry.getNetwork('test-network').accessible).toBe(false);
            expect(registry.getNetwork('test-network').discovered).toBe(true); // Still discovered
            expect(registry.getNetwork('test-network').revokedReason).toBe('Mission access expired');
            expect(registry.getDevice('10.1.1.10').accessible).toBe(false);
        });

        it('should return false for unknown network', () => {
            const result = registry.revokeNetworkAccess('unknown-network', 'reason');
            expect(result).toBe(false);
        });
    });

    describe('hasNetworkAccess', () => {
        it('should return true for accessible network', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
                accessible: true,
            });

            expect(registry.hasNetworkAccess('test-network')).toBe(true);
        });

        it('should return false for inaccessible network', () => {
            registry.registerNetwork({
                networkId: 'test-network',
                networkName: 'Test',
                address: '10.1.1.0/24',
                bandwidth: 50,
                accessible: false,
            });

            expect(registry.hasNetworkAccess('test-network')).toBe(false);
        });

        it('should return false for unknown network', () => {
            expect(registry.hasNetworkAccess('unknown-network')).toBe(false);
        });
    });

    describe('getKnownNetworks', () => {
        it('should return only discovered networks', () => {
            registry.registerNetwork({
                networkId: 'discovered-network',
                networkName: 'Discovered',
                address: '10.1.1.0/24',
                bandwidth: 50,
                discovered: true,
            });
            registry.registerNetwork({
                networkId: 'undiscovered-network',
                networkName: 'Undiscovered',
                address: '10.2.2.0/24',
                bandwidth: 50,
                discovered: false,
            });

            const known = registry.getKnownNetworks();

            expect(known).toHaveLength(1);
            expect(known[0].networkId).toBe('discovered-network');
        });
    });

    describe('getAccessibleDevices', () => {
        it('should return only accessible devices for a network', () => {
            registry.registerDevice({
                ip: '10.1.1.10',
                hostname: 'accessible-server',
                networkId: 'test-network',
                fileSystemId: 'fs-01',
                accessible: true,
            });
            registry.registerDevice({
                ip: '10.1.1.20',
                hostname: 'inaccessible-server',
                networkId: 'test-network',
                fileSystemId: 'fs-02',
                accessible: false,
            });

            const devices = registry.getAccessibleDevices('test-network');

            expect(devices).toHaveLength(1);
            expect(devices[0].ip).toBe('10.1.1.10');
        });
    });
});

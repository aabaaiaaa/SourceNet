import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock NetworkRegistry before importing
vi.mock('../systems/NetworkRegistry', () => ({
    default: {
        isSubnetInUse: vi.fn(() => false),
        isIpInUse: vi.fn(() => false),
    },
}));

// Mock missionData to control reserved networks
vi.mock('./missionData.js', () => ({
    allMissions: [
        {
            networks: [
                {
                    networkId: 'reserved-network-1',
                    address: '192.168.100.0/24',
                    fileSystems: [
                        { ip: '192.168.100.10' },
                        { ip: '192.168.100.20' },
                    ],
                },
            ],
        },
        {
            networks: [
                {
                    networkId: 'reserved-network-2',
                    address: '10.50.50.0/24',
                    fileSystems: [
                        { ip: '10.50.50.100' },
                    ],
                },
            ],
        },
    ],
}));

import {
    getReservedNetworkDetails,
    isSubnetReserved,
    isIpReserved,
    randomInt,
    generateSubnet,
    generateIpInSubnet,
    generateNarAttachments,
    resetReservedNetworkDetails,
} from './networkUtils';

import networkRegistry from '../systems/NetworkRegistry';

// ============================================================================
// Tests
// ============================================================================

describe('networkUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetReservedNetworkDetails(); // Reset cache before each test
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // randomInt
    // ========================================================================

    describe('randomInt', () => {
        it('should generate integers within range (inclusive)', () => {
            for (let i = 0; i < 100; i++) {
                const result = randomInt(1, 10);
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(10);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should return exact value when min equals max', () => {
            expect(randomInt(5, 5)).toBe(5);
        });

        it('should work with negative numbers', () => {
            for (let i = 0; i < 20; i++) {
                const result = randomInt(-10, -5);
                expect(result).toBeGreaterThanOrEqual(-10);
                expect(result).toBeLessThanOrEqual(-5);
            }
        });

        it('should work with range crossing zero', () => {
            for (let i = 0; i < 20; i++) {
                const result = randomInt(-5, 5);
                expect(result).toBeGreaterThanOrEqual(-5);
                expect(result).toBeLessThanOrEqual(5);
            }
        });
    });

    // ========================================================================
    // getReservedNetworkDetails
    // ========================================================================

    describe('getReservedNetworkDetails', () => {
        it('should return reserved network IDs', () => {
            const reserved = getReservedNetworkDetails();

            expect(reserved.networkIds.has('reserved-network-1')).toBe(true);
            expect(reserved.networkIds.has('reserved-network-2')).toBe(true);
        });

        it('should return reserved subnets', () => {
            const reserved = getReservedNetworkDetails();

            expect(reserved.subnets.has('192.168.100.0/24')).toBe(true);
            expect(reserved.subnets.has('10.50.50.0/24')).toBe(true);
        });

        it('should return reserved IPs', () => {
            const reserved = getReservedNetworkDetails();

            expect(reserved.ips.has('192.168.100.10')).toBe(true);
            expect(reserved.ips.has('192.168.100.20')).toBe(true);
            expect(reserved.ips.has('10.50.50.100')).toBe(true);
        });

        it('should cache results', () => {
            const first = getReservedNetworkDetails();
            const second = getReservedNetworkDetails();

            expect(first).toBe(second); // Same reference
        });

        it('should reset cache with resetReservedNetworkDetails', () => {
            const first = getReservedNetworkDetails();
            resetReservedNetworkDetails();
            const second = getReservedNetworkDetails();

            expect(first).not.toBe(second); // Different reference after reset
        });
    });

    // ========================================================================
    // isSubnetReserved
    // ========================================================================

    describe('isSubnetReserved', () => {
        it('should return true for reserved subnets', () => {
            expect(isSubnetReserved('192.168.100.0/24')).toBe(true);
            expect(isSubnetReserved('10.50.50.0/24')).toBe(true);
        });

        it('should return false for non-reserved subnets', () => {
            expect(isSubnetReserved('10.1.1.0/24')).toBe(false);
            expect(isSubnetReserved('172.16.0.0/24')).toBe(false);
        });
    });

    // ========================================================================
    // isIpReserved
    // ========================================================================

    describe('isIpReserved', () => {
        it('should return true for reserved IPs', () => {
            expect(isIpReserved('192.168.100.10')).toBe(true);
            expect(isIpReserved('10.50.50.100')).toBe(true);
        });

        it('should return false for non-reserved IPs', () => {
            expect(isIpReserved('10.1.1.50')).toBe(false);
            expect(isIpReserved('192.168.1.1')).toBe(false);
        });
    });

    // ========================================================================
    // generateSubnet
    // ========================================================================

    describe('generateSubnet', () => {
        it('should generate subnet in correct format', () => {
            const subnet = generateSubnet();

            expect(subnet).toMatch(/^10\.\d{1,3}\.\d{1,3}\.0\/24$/);
        });

        it('should generate subnets with valid octets', () => {
            for (let i = 0; i < 20; i++) {
                const subnet = generateSubnet();
                const parts = subnet.replace('/24', '').split('.');

                expect(parseInt(parts[0])).toBe(10);
                expect(parseInt(parts[1])).toBeGreaterThanOrEqual(1);
                expect(parseInt(parts[1])).toBeLessThanOrEqual(254);
                expect(parseInt(parts[2])).toBeGreaterThanOrEqual(1);
                expect(parseInt(parts[2])).toBeLessThanOrEqual(254);
                expect(parseInt(parts[3])).toBe(0);
            }
        });

        it('should avoid subnets in use by NetworkRegistry', () => {
            networkRegistry.isSubnetInUse.mockImplementation((subnet) => {
                return subnet === '10.100.100.0/24';
            });

            // Generate many subnets - none should be the blocked one
            for (let i = 0; i < 30; i++) {
                const subnet = generateSubnet();
                expect(subnet).not.toBe('10.100.100.0/24');
            }
        });

        it('should avoid reserved story mission subnets', () => {
            // Generate many subnets - none should be reserved
            for (let i = 0; i < 30; i++) {
                const subnet = generateSubnet();
                expect(subnet).not.toBe('192.168.100.0/24');
                expect(subnet).not.toBe('10.50.50.0/24');
            }
        });

        it('should fall back after max attempts', () => {
            // Block everything - should still return something
            networkRegistry.isSubnetInUse.mockReturnValue(true);

            const subnet = generateSubnet(5);

            expect(subnet).toMatch(/^10\.\d{1,3}\.\d{1,3}\.0\/24$/);
        });
    });

    // ========================================================================
    // generateIpInSubnet
    // ========================================================================

    describe('generateIpInSubnet', () => {
        it('should generate IP within subnet', () => {
            const ip = generateIpInSubnet('10.100.50.0/24', 10);

            expect(ip).toMatch(/^10\.100\.50\.\d+$/);
        });

        it('should prefer the specified host number', () => {
            const ip = generateIpInSubnet('10.100.50.0/24', 42);

            expect(ip).toBe('10.100.50.42');
        });

        it('should avoid IPs in use by NetworkRegistry', () => {
            networkRegistry.isIpInUse.mockImplementation((ip) => {
                return ip === '10.100.50.10';
            });

            const ip = generateIpInSubnet('10.100.50.0/24', 10);

            expect(ip).not.toBe('10.100.50.10');
        });

        it('should avoid reserved story mission IPs', () => {
            const ip = generateIpInSubnet('192.168.100.0/24', 10);

            // Should not be one of the reserved IPs
            expect(ip).not.toBe('192.168.100.10');
            expect(ip).not.toBe('192.168.100.20');
        });

        it('should generate IPs with valid host numbers', () => {
            for (let i = 0; i < 20; i++) {
                const ip = generateIpInSubnet('10.1.1.0/24', 100);
                const lastOctet = parseInt(ip.split('.')[3]);

                expect(lastOctet).toBeGreaterThanOrEqual(1);
                expect(lastOctet).toBeLessThanOrEqual(254);
            }
        });

        it('should fall back to preferred IP after max attempts', () => {
            // Block everything
            networkRegistry.isIpInUse.mockReturnValue(true);

            const ip = generateIpInSubnet('10.1.1.0/24', 25, 3);

            expect(ip).toBe('10.1.1.25');
        });
    });

    // ========================================================================
    // generateNarAttachments
    // ========================================================================

    describe('generateNarAttachments', () => {
        it('should generate attachments for networks', () => {
            const networks = [
                {
                    networkId: 'net-1',
                    networkName: 'Test Network',
                    address: '10.1.1.0/24',
                    fileSystems: [
                        { ip: '10.1.1.10' },
                        { ip: '10.1.1.20' },
                    ],
                },
            ];

            const attachments = generateNarAttachments(networks);

            expect(attachments).toHaveLength(1);
            expect(attachments[0].type).toBe('networkAddress');
            expect(attachments[0].networkId).toBe('net-1');
            expect(attachments[0].networkName).toBe('Test Network');
            expect(attachments[0].address).toBe('10.1.1.0/24');
        });

        it('should extract device IPs from fileSystems', () => {
            const networks = [
                {
                    networkId: 'net-1',
                    networkName: 'Test',
                    address: '10.1.1.0/24',
                    fileSystems: [
                        { ip: '10.1.1.10' },
                        { ip: '10.1.1.20' },
                        { ip: '10.1.1.30' },
                    ],
                },
            ];

            const attachments = generateNarAttachments(networks);

            expect(attachments[0].deviceIps).toHaveLength(3);
            expect(attachments[0].deviceIps).toContain('10.1.1.10');
            expect(attachments[0].deviceIps).toContain('10.1.1.20');
            expect(attachments[0].deviceIps).toContain('10.1.1.30');
        });

        it('should handle multiple networks', () => {
            const networks = [
                {
                    networkId: 'net-1',
                    networkName: 'Network 1',
                    address: '10.1.1.0/24',
                    fileSystems: [{ ip: '10.1.1.10' }],
                },
                {
                    networkId: 'net-2',
                    networkName: 'Network 2',
                    address: '10.2.2.0/24',
                    fileSystems: [{ ip: '10.2.2.10' }],
                },
            ];

            const attachments = generateNarAttachments(networks);

            expect(attachments).toHaveLength(2);
            expect(attachments[0].networkId).toBe('net-1');
            expect(attachments[1].networkId).toBe('net-2');
        });

        it('should return empty array for null/undefined input', () => {
            expect(generateNarAttachments(null)).toEqual([]);
            expect(generateNarAttachments(undefined)).toEqual([]);
        });

        it('should return empty array for non-array input', () => {
            expect(generateNarAttachments('not an array')).toEqual([]);
            expect(generateNarAttachments({})).toEqual([]);
        });

        it('should handle networks with no fileSystems', () => {
            const networks = [
                {
                    networkId: 'net-1',
                    networkName: 'Test',
                    address: '10.1.1.0/24',
                    fileSystems: null,
                },
            ];

            const attachments = generateNarAttachments(networks);

            expect(attachments).toHaveLength(1);
            expect(attachments[0].deviceIps).toEqual([]);
        });

        it('should filter out undefined IPs', () => {
            const networks = [
                {
                    networkId: 'net-1',
                    networkName: 'Test',
                    address: '10.1.1.0/24',
                    fileSystems: [
                        { ip: '10.1.1.10' },
                        { name: 'no-ip-server' }, // No IP
                        { ip: '10.1.1.20' },
                    ],
                },
            ];

            const attachments = generateNarAttachments(networks);

            expect(attachments[0].deviceIps).toHaveLength(2);
            expect(attachments[0].deviceIps).not.toContain(undefined);
        });
    });
});

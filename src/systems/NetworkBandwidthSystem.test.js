import { describe, it, expect } from 'vitest';
import {
  getNetworkBandwidth,
  getAdapterSpeed,
  calculateAvailableBandwidth,
  calculateTransferSpeed,
  calculateOperationTime,
  getActiveOperations,
} from './NetworkBandwidthSystem';

describe('NetworkBandwidthSystem', () => {
  describe('getNetworkBandwidth', () => {
    it('should return Infinity when no connections (adapter is the only limit)', () => {
      expect(getNetworkBandwidth([])).toBe(Infinity);
      expect(getNetworkBandwidth()).toBe(Infinity);
    });
  });

  describe('getAdapterSpeed', () => {
    it('should return adapter speed from hardware', () => {
      const hardware = {
        network: { speed: 250 },
      };
      expect(getAdapterSpeed(hardware)).toBe(250);
    });

    it('should return default 250 if no adapter', () => {
      expect(getAdapterSpeed({})).toBe(250);
      expect(getAdapterSpeed(null)).toBe(250);
    });
  });

  describe('calculateAvailableBandwidth', () => {
    it('should use minimum of adapter and connection', () => {
      // Adapter 250 Mbps, Connection 50 Mbps = 50 Mbps effective
      const bandwidth = calculateAvailableBandwidth(250, 50, 1);
      expect(bandwidth).toBe(50);
    });

    it('should share bandwidth across operations', () => {
      // 50 Mbps / 2 operations = 25 Mbps each
      const bandwidth = calculateAvailableBandwidth(250, 50, 2);
      expect(bandwidth).toBe(25);
    });

    it('should handle single operation', () => {
      const bandwidth = calculateAvailableBandwidth(250, 50, 1);
      expect(bandwidth).toBe(50);
    });

    it('should handle zero operations', () => {
      const bandwidth = calculateAvailableBandwidth(250, 50, 0);
      expect(bandwidth).toBe(50);
    });
  });

  describe('calculateTransferSpeed', () => {
    it('should convert Mbps to MB/s', () => {
      // 50 Mbps = 6.25 MB/s
      const speed = calculateTransferSpeed(50);
      expect(speed).toBe(6.25);
    });

    it('should handle 250 Mbps', () => {
      // 250 Mbps = 31.25 MB/s
      const speed = calculateTransferSpeed(250);
      expect(speed).toBe(31.25);
    });
  });

  describe('calculateOperationTime', () => {
    it('should calculate time for 500 MB at 31.25 MB/s', () => {
      const time = calculateOperationTime(500, 31.25);
      expect(time).toBe(16); // 16 seconds
    });

    it('should handle zero speed', () => {
      const time = calculateOperationTime(500, 0);
      expect(time).toBe(Infinity);
    });

    it('should round up to nearest second', () => {
      const time = calculateOperationTime(100, 31.25);
      expect(time).toBe(4); // 3.2 seconds rounds to 4
    });
  });

  describe('getActiveOperations', () => {
    it('should count downloading items', () => {
      const queue = [
        { status: 'downloading' },
        { status: 'downloading' },
        { status: 'complete' },
      ];
      expect(getActiveOperations(queue, 0)).toBe(2);
    });

    it('should include file copies', () => {
      const queue = [{ status: 'downloading' }];
      expect(getActiveOperations(queue, 2)).toBe(3); // 1 download + 2 copies
    });

    it('should handle empty queue', () => {
      expect(getActiveOperations([], 0)).toBe(0);
    });
  });
});

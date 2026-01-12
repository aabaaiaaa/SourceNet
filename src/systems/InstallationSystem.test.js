import { describe, it, expect } from 'vitest';
import {
  createQueueItem,
  calculateDownloadProgress,
  calculateBandwidthShare,
  estimateDownloadTime,
  isDownloadComplete,
  updateQueueItemProgress,
} from './InstallationSystem';

describe('InstallationSystem', () => {
  describe('createQueueItem', () => {
    it('should create queue item with all fields', () => {
      const item = createQueueItem('vpn-client', 'VPN Client', 500);

      expect(item.id).toMatch(/^download-/);
      expect(item.softwareId).toBe('vpn-client');
      expect(item.softwareName).toBe('VPN Client');
      expect(item.sizeInMB).toBe(500);
      expect(item.progress).toBe(0);
      expect(item.status).toBe('downloading');
    });
  });

  describe('calculateDownloadProgress', () => {
    it('should calculate progress for 250 Mbps network', () => {
      // 250 Mbps = 31.25 MB/s
      // 500 MB file, 10 seconds elapsed = 312.5 MB downloaded
      const progress = calculateDownloadProgress(10000, 500, 250, 1.0);
      expect(progress).toBeCloseTo(62.5, 1); // 62.5%
    });

    it('should not exceed 100%', () => {
      const progress = calculateDownloadProgress(100000, 500, 250, 1.0);
      expect(progress).toBe(100);
    });

    it('should handle bandwidth sharing', () => {
      // 50% bandwidth (2 downloads)
      const progress = calculateDownloadProgress(10000, 500, 250, 0.5);
      expect(progress).toBeCloseTo(31.25, 1); // Half speed
    });
  });

  describe('calculateBandwidthShare', () => {
    it('should return 1.0 for single download', () => {
      expect(calculateBandwidthShare(1)).toBe(1.0);
    });

    it('should return 0.5 for two downloads', () => {
      expect(calculateBandwidthShare(2)).toBe(0.5);
    });

    it('should return 0.33 for three downloads', () => {
      expect(calculateBandwidthShare(3)).toBeCloseTo(0.333, 2);
    });

    it('should handle zero downloads', () => {
      expect(calculateBandwidthShare(0)).toBe(1.0);
    });
  });

  describe('estimateDownloadTime', () => {
    it('should estimate time for 500MB at 250 Mbps', () => {
      const time = estimateDownloadTime(500, 250, 1.0);
      expect(time).toBe(16); // 500 / 31.25 = 16 seconds
    });

    it('should account for bandwidth sharing', () => {
      const time = estimateDownloadTime(500, 250, 0.5);
      expect(time).toBe(32); // Double time with half bandwidth
    });
  });

  describe('isDownloadComplete', () => {
    it('should return true at 100%', () => {
      expect(isDownloadComplete(100)).toBe(true);
    });

    it('should return false below 100%', () => {
      expect(isDownloadComplete(99.9)).toBe(false);
      expect(isDownloadComplete(50)).toBe(false);
    });
  });

  describe('updateQueueItemProgress', () => {
    it('should update progress', () => {
      const item = createQueueItem('test', 'Test', 100);
      const updated = updateQueueItemProgress(item, 50);

      expect(updated.progress).toBe(50);
      expect(updated.status).toBe('downloading');
    });

    it('should mark as complete at 100%', () => {
      const item = createQueueItem('test', 'Test', 100);
      const updated = updateQueueItemProgress(item, 100);

      expect(updated.progress).toBe(100);
      expect(updated.status).toBe('complete');
    });

    it('should not exceed 100%', () => {
      const item = createQueueItem('test', 'Test', 100);
      const updated = updateQueueItemProgress(item, 150);

      expect(updated.progress).toBe(100);
    });
  });
});

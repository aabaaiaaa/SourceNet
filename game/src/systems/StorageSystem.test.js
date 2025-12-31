import { describe, it, expect } from 'vitest';
import {
  SOFTWARE_SIZES,
  calculateStorageUsed,
  calculateStorageFree,
  canInstallSoftware,
  formatStorage,
} from './StorageSystem';

describe('StorageSystem', () => {
  describe('SOFTWARE_SIZES', () => {
    it('should define OSNet OS size', () => {
      expect(SOFTWARE_SIZES.osnet).toBe(12.0);
    });

    it('should define all Phase 1 app sizes', () => {
      expect(SOFTWARE_SIZES.portal).toBeDefined();
      expect(SOFTWARE_SIZES.mail).toBeDefined();
      expect(SOFTWARE_SIZES.banking).toBeDefined();
    });

    it('should define all app sizes', () => {
      expect(SOFTWARE_SIZES['mission-board']).toBeDefined();
      expect(SOFTWARE_SIZES['vpn-client']).toBeDefined();
      expect(SOFTWARE_SIZES['network-scanner']).toBeDefined();
      expect(SOFTWARE_SIZES['file-manager']).toBeDefined();
    });
  });

  describe('calculateStorageUsed', () => {
    it('should calculate storage for Phase 1 software', () => {
      const software = ['osnet', 'portal', 'mail', 'banking'];
      const used = calculateStorageUsed(software);
      expect(used).toBe(12.0 + 0.5 + 0.3 + 0.2); // 13.0
    });

    it('should calculate storage for all software', () => {
      const software = ['osnet', 'portal', 'mail', 'banking', 'mission-board', 'vpn-client'];
      const used = calculateStorageUsed(software);
      expect(used).toBe(12.0 + 0.5 + 0.3 + 0.2 + 0.2 + 0.5); // 13.7
    });

    it('should handle unknown software with default size', () => {
      const software = ['osnet', 'unknown-app'];
      const used = calculateStorageUsed(software);
      expect(used).toBe(12.0 + 0.1); // Unknown defaults to 0.1
    });

    it('should return 0 for empty software array', () => {
      expect(calculateStorageUsed([])).toBe(0);
    });
  });

  describe('calculateStorageFree', () => {
    it('should calculate free storage', () => {
      const free = calculateStorageFree(90, 14.5);
      expect(free).toBe(75.5);
    });

    it('should not return negative values', () => {
      const free = calculateStorageFree(90, 100);
      expect(free).toBe(0);
    });
  });

  describe('canInstallSoftware', () => {
    it('should allow installation if enough space', () => {
      expect(canInstallSoftware(10, 5)).toBe(true);
      expect(canInstallSoftware(5, 5)).toBe(true);
    });

    it('should block installation if not enough space', () => {
      expect(canInstallSoftware(5, 10)).toBe(false);
      expect(canInstallSoftware(0, 1)).toBe(false);
    });
  });

  describe('formatStorage', () => {
    it('should format storage display string', () => {
      const formatted = formatStorage(14.5, 90);
      expect(formatted).toBe('14.5 GB used / 75.5 GB free');
    });

    it('should handle decimal values', () => {
      const formatted = formatStorage(13.7, 90);
      expect(formatted).toBe('13.7 GB used / 76.3 GB free');
    });
  });
});

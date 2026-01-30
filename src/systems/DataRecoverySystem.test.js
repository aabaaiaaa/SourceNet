import { describe, it, expect } from 'vitest';
import {
  parseFileSizeToMB,
  calculateScanDuration,
  getDiscoveredDeletedFiles,
  calculateOperationDuration,
} from './DataRecoverySystem';

describe('DataRecoverySystem', () => {
  describe('parseFileSizeToMB', () => {
    it('should parse KB to MB', () => {
      expect(parseFileSizeToMB('1024 KB')).toBe(1);
      expect(parseFileSizeToMB('512 KB')).toBe(0.5);
      expect(parseFileSizeToMB('2.5 KB')).toBeCloseTo(0.00244, 4);
    });

    it('should parse MB directly', () => {
      expect(parseFileSizeToMB('1 MB')).toBe(1);
      expect(parseFileSizeToMB('150 MB')).toBe(150);
      expect(parseFileSizeToMB('2.5 MB')).toBe(2.5);
    });

    it('should parse GB to MB', () => {
      expect(parseFileSizeToMB('1 GB')).toBe(1024);
      expect(parseFileSizeToMB('2 GB')).toBe(2048);
      expect(parseFileSizeToMB('0.5 GB')).toBe(512);
    });

    it('should be case insensitive', () => {
      expect(parseFileSizeToMB('100 kb')).toBeCloseTo(0.0977, 3);
      expect(parseFileSizeToMB('100 mb')).toBe(100);
      expect(parseFileSizeToMB('1 gb')).toBe(1024);
    });

    it('should return 1 for unparseable strings', () => {
      expect(parseFileSizeToMB('unknown')).toBe(1);
      expect(parseFileSizeToMB('')).toBe(1);
      expect(parseFileSizeToMB('100 bytes')).toBe(1);
    });
  });

  describe('calculateScanDuration', () => {
    it('should return minimum 3 seconds for empty file systems', () => {
      expect(calculateScanDuration([])).toBe(3000);
    });

    it('should return minimum 3 seconds for small file systems', () => {
      const smallFiles = [
        { name: 'file1.txt', size: '1 KB' },
        { name: 'file2.txt', size: '2 KB' },
      ];
      expect(calculateScanDuration(smallFiles)).toBe(3000);
    });

    it('should scale with file system size (3 seconds per GB)', () => {
      const oneGBFiles = [{ name: 'bigfile.dat', size: '1 GB' }];
      expect(calculateScanDuration(oneGBFiles)).toBe(3000); // 1 GB = 3 seconds = minimum

      const twoGBFiles = [{ name: 'bigfile.dat', size: '2 GB' }];
      expect(calculateScanDuration(twoGBFiles)).toBe(6000); // 2 GB = 6 seconds

      const fiveGBFiles = [{ name: 'bigfile.dat', size: '5 GB' }];
      expect(calculateScanDuration(fiveGBFiles)).toBe(15000); // 5 GB = 15 seconds
    });

    it('should sum sizes of all files', () => {
      const mixedFiles = [
        { name: 'file1.dat', size: '1 GB' },
        { name: 'file2.dat', size: '1 GB' },
        { name: 'file3.dat', size: '1 GB' },
      ];
      expect(calculateScanDuration(mixedFiles)).toBe(9000); // 3 GB = 9 seconds
    });

    it('should handle mixed file sizes correctly', () => {
      const mixedFiles = [
        { name: 'small.txt', size: '100 KB' },
        { name: 'medium.dat', size: '500 MB' },
        { name: 'large.iso', size: '2 GB' },
      ];
      // Total: ~0.0001 GB + 0.488 GB + 2 GB = ~2.488 GB
      // Duration: ~7465 ms
      const duration = calculateScanDuration(mixedFiles);
      expect(duration).toBeGreaterThan(7000);
      expect(duration).toBeLessThan(8000);
    });

    it('should return longer duration for larger file systems', () => {
      const smallFS = [{ name: 'file.txt', size: '100 MB' }];
      const largeFS = [{ name: 'file.dat', size: '10 GB' }];

      const smallDuration = calculateScanDuration(smallFS);
      const largeDuration = calculateScanDuration(largeFS);

      expect(largeDuration).toBeGreaterThan(smallDuration);
    });
  });

  describe('getDiscoveredDeletedFiles', () => {
    const deletedFiles = [
      { name: 'deleted1.txt' },
      { name: 'deleted2.txt' },
      { name: 'deleted3.txt' },
      { name: 'deleted4.txt' },
    ];

    it('should return empty set at 0% progress', () => {
      const discovered = getDiscoveredDeletedFiles(deletedFiles, 0);
      expect(discovered.size).toBe(0);
    });

    it('should discover first file at 25% progress (1/4 files)', () => {
      const discovered = getDiscoveredDeletedFiles(deletedFiles, 25);
      expect(discovered.size).toBe(1);
      expect(discovered.has('deleted1.txt')).toBe(true);
      expect(discovered.has('deleted2.txt')).toBe(false);
    });

    it('should discover first two files at 50% progress (2/4 files)', () => {
      const discovered = getDiscoveredDeletedFiles(deletedFiles, 50);
      expect(discovered.size).toBe(2);
      expect(discovered.has('deleted1.txt')).toBe(true);
      expect(discovered.has('deleted2.txt')).toBe(true);
      expect(discovered.has('deleted3.txt')).toBe(false);
    });

    it('should discover first three files at 75% progress (3/4 files)', () => {
      const discovered = getDiscoveredDeletedFiles(deletedFiles, 75);
      expect(discovered.size).toBe(3);
      expect(discovered.has('deleted1.txt')).toBe(true);
      expect(discovered.has('deleted2.txt')).toBe(true);
      expect(discovered.has('deleted3.txt')).toBe(true);
      expect(discovered.has('deleted4.txt')).toBe(false);
    });

    it('should discover all files at 100% progress', () => {
      const discovered = getDiscoveredDeletedFiles(deletedFiles, 100);
      expect(discovered.size).toBe(4);
      expect(discovered.has('deleted1.txt')).toBe(true);
      expect(discovered.has('deleted2.txt')).toBe(true);
      expect(discovered.has('deleted3.txt')).toBe(true);
      expect(discovered.has('deleted4.txt')).toBe(true);
    });

    it('should handle single deleted file', () => {
      const singleFile = [{ name: 'only.txt' }];

      // At 50%, file should not be discovered (threshold is 100%)
      expect(getDiscoveredDeletedFiles(singleFile, 50).size).toBe(0);

      // At 100%, file should be discovered
      expect(getDiscoveredDeletedFiles(singleFile, 100).has('only.txt')).toBe(true);
    });

    it('should handle empty deleted files array', () => {
      const discovered = getDiscoveredDeletedFiles([], 50);
      expect(discovered.size).toBe(0);
    });

    it('should discover files progressively based on position', () => {
      // This test verifies that earlier files are discovered before later ones
      const files = [
        { name: 'first.txt' },
        { name: 'second.txt' },
        { name: 'third.txt' },
      ];

      // At 33% progress, first file discovered
      const at33 = getDiscoveredDeletedFiles(files, 33.4);
      expect(at33.has('first.txt')).toBe(true);
      expect(at33.has('second.txt')).toBe(false);

      // At 66% progress, first two files discovered
      const at66 = getDiscoveredDeletedFiles(files, 66.7);
      expect(at66.has('first.txt')).toBe(true);
      expect(at66.has('second.txt')).toBe(true);
      expect(at66.has('third.txt')).toBe(false);

      // At 100% progress, all files discovered
      const at100 = getDiscoveredDeletedFiles(files, 100);
      expect(at100.size).toBe(3);
    });

    it('should handle many deleted files', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        name: `file${i}.txt`,
      }));

      // At 10% progress, first 10 files should be discovered
      const at10 = getDiscoveredDeletedFiles(manyFiles, 10);
      expect(at10.size).toBe(10);
      expect(at10.has('file0.txt')).toBe(true);
      expect(at10.has('file9.txt')).toBe(true);
      expect(at10.has('file10.txt')).toBe(false);

      // At 50% progress, first 50 files should be discovered
      const at50 = getDiscoveredDeletedFiles(manyFiles, 50);
      expect(at50.size).toBe(50);
      expect(at50.has('file49.txt')).toBe(true);
      expect(at50.has('file50.txt')).toBe(false);
    });

    it('should discover file at exact threshold', () => {
      // With 4 files: thresholds are 25%, 50%, 75%, 100%
      const files = [
        { name: 'a.txt' },
        { name: 'b.txt' },
        { name: 'c.txt' },
        { name: 'd.txt' },
      ];

      // Exactly at 25%
      const at25 = getDiscoveredDeletedFiles(files, 25);
      expect(at25.has('a.txt')).toBe(true);
      expect(at25.size).toBe(1);

      // Just below 25%
      const below25 = getDiscoveredDeletedFiles(files, 24.9);
      expect(below25.has('a.txt')).toBe(false);
    });
  });

  describe('calculateOperationDuration', () => {
    const file50MB = { name: 'test.dat', size: '50 MB' };
    const file1GB = { name: 'large.dat', size: '1 GB' };
    const bandwidth50Mbps = 50;
    const bandwidth100Mbps = 100;

    describe('restore operation', () => {
      it('should have minimum duration of 2 seconds', () => {
        const tinyFile = { name: 'tiny.txt', size: '1 KB' };
        const duration = calculateOperationDuration(tinyFile, 'restore', bandwidth100Mbps);
        expect(duration).toBe(2000);
      });

      it('should scale with file size (1.5x multiplier)', () => {
        // 50 MB at 50 Mbps = 50 / 6.25 = 8 seconds base
        // With 1.5x multiplier = 12 seconds
        const duration = calculateOperationDuration(file50MB, 'restore', bandwidth50Mbps);
        expect(duration).toBe(12000);
      });

      it('should be faster with higher bandwidth', () => {
        const slowBandwidth = calculateOperationDuration(file50MB, 'restore', 50);
        const fastBandwidth = calculateOperationDuration(file50MB, 'restore', 100);

        expect(fastBandwidth).toBeLessThan(slowBandwidth);
      });
    });

    describe('secure-delete operation', () => {
      it('should have minimum duration of 5 seconds', () => {
        const tinyFile = { name: 'tiny.txt', size: '1 KB' };
        const duration = calculateOperationDuration(tinyFile, 'secure-delete', bandwidth100Mbps);
        expect(duration).toBe(5000);
      });

      it('should scale with file size (5x multiplier)', () => {
        // 50 MB at 50 Mbps = 50 / 6.25 = 8 seconds base
        // With 5x multiplier = 40 seconds
        const duration = calculateOperationDuration(file50MB, 'secure-delete', bandwidth50Mbps);
        expect(duration).toBe(40000);
      });

      it('should be slower than restore for same file', () => {
        const restoreDuration = calculateOperationDuration(file50MB, 'restore', bandwidth50Mbps);
        const secureDeleteDuration = calculateOperationDuration(file50MB, 'secure-delete', bandwidth50Mbps);

        expect(secureDeleteDuration).toBeGreaterThan(restoreDuration);
      });

      it('should be significantly slower (secure delete is thorough)', () => {
        const restoreDuration = calculateOperationDuration(file1GB, 'restore', bandwidth50Mbps);
        const secureDeleteDuration = calculateOperationDuration(file1GB, 'secure-delete', bandwidth50Mbps);

        // Secure delete should be roughly 3.33x slower (5/1.5 ratio)
        const ratio = secureDeleteDuration / restoreDuration;
        expect(ratio).toBeCloseTo(3.33, 1);
      });
    });

    describe('unknown operation', () => {
      it('should return default 2 seconds for unknown operations', () => {
        const duration = calculateOperationDuration(file50MB, 'unknown', bandwidth50Mbps);
        expect(duration).toBe(2000);
      });
    });
  });
});

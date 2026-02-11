import { describe, it, expect } from 'vitest';
import {
  parseCpuSpecs,
  calculateDownloadDuration,
  calculateDecryptionDuration,
  calculateUploadDuration,
  generateGridData,
  hasRequiredAlgorithm,
  getAlgorithmName,
  isEncryptedFile,
  getDecryptedFileName,
  DECRYPTION_ALGORITHMS,
} from './DecryptionSystem';

describe('DecryptionSystem', () => {
  describe('parseCpuSpecs', () => {
    it('parses standard CPU spec string', () => {
      expect(parseCpuSpecs('2GHz, 2 cores')).toEqual({ ghz: 2, cores: 2 });
    });

    it('parses single core spec', () => {
      expect(parseCpuSpecs('1GHz, 1 core')).toEqual({ ghz: 1, cores: 1 });
    });

    it('parses high-end CPU spec', () => {
      expect(parseCpuSpecs('6GHz, 8 cores')).toEqual({ ghz: 6, cores: 8 });
    });

    it('returns defaults for null/empty input', () => {
      expect(parseCpuSpecs(null)).toEqual({ ghz: 1, cores: 1 });
      expect(parseCpuSpecs('')).toEqual({ ghz: 1, cores: 1 });
    });
  });

  describe('calculateDownloadDuration', () => {
    it('calculates duration based on file size and bandwidth', () => {
      // 100 MB file at 100 Mbps = 100 / 12.5 = 8 seconds = 8000ms
      expect(calculateDownloadDuration(100, 100)).toBe(8000);
    });

    it('enforces minimum 3000ms duration', () => {
      // Tiny file on fast connection
      expect(calculateDownloadDuration(0.001, 1000)).toBe(3000);
    });

    it('handles slow connections', () => {
      // 450 MB at 75 Mbps = 450 / 9.375 = 48 seconds = 48000ms
      expect(calculateDownloadDuration(450, 75)).toBe(48000);
    });
  });

  describe('calculateDecryptionDuration', () => {
    it('calculates duration with single core CPU', () => {
      // 100 MB with 1GHz 1 core: rate = 1*1*2 = 2 MB/s, 100/2 = 50s = 50000ms
      expect(calculateDecryptionDuration(100, '1GHz, 1 core')).toBe(50000);
    });

    it('is faster with better CPU', () => {
      // 100 MB with 4GHz 4 cores: rate = 4*4*2 = 32 MB/s, 100/32 = 3.125s
      expect(calculateDecryptionDuration(100, '4GHz, 4 cores')).toBe(5000); // min 5000ms
    });

    it('enforces minimum 5000ms duration', () => {
      expect(calculateDecryptionDuration(1, '6GHz, 8 cores')).toBe(5000);
    });

    it('scales with file size', () => {
      const small = calculateDecryptionDuration(10, '2GHz, 2 cores');
      const large = calculateDecryptionDuration(500, '2GHz, 2 cores');
      expect(large).toBeGreaterThan(small);
    });
  });

  describe('calculateUploadDuration', () => {
    it('calculates duration based on file size and bandwidth', () => {
      // Same formula as download
      expect(calculateUploadDuration(100, 100)).toBe(8000);
    });

    it('enforces minimum 3000ms duration', () => {
      expect(calculateUploadDuration(0.001, 1000)).toBe(3000);
    });
  });

  describe('generateGridData', () => {
    it('returns correct dimensions', () => {
      const grid = generateGridData(15, 20, 50);
      expect(grid.length).toBe(15);
      expect(grid[0].length).toBe(20);
    });

    it('returns all pending at 0% progress', () => {
      const grid = generateGridData(15, 20, 0);
      const allPending = grid.every(row => row.every(cell => cell.filled === false));
      expect(allPending).toBe(true);
    });

    it('returns all filled at 100% progress', () => {
      const grid = generateGridData(15, 20, 100);
      const allFilled = grid.every(row => row.every(cell =>
        cell.filled === true && (cell.value === '0' || cell.value === '1')
      ));
      expect(allFilled).toBe(true);
    });

    it('fills proportionally to progress', () => {
      const grid = generateGridData(10, 10, 50);
      let filledCount = 0;
      grid.forEach(row => row.forEach(cell => {
        if (cell.filled) filledCount++;
      }));
      expect(filledCount).toBe(50);
    });

    it('fills left-to-right, top-to-bottom', () => {
      const grid = generateGridData(5, 5, 20);
      // 25 cells total, 20% = 5 filled cells
      // First row should be fully filled
      expect(grid[0].every(cell => cell.filled === true)).toBe(true);
      // Second row should be pending
      expect(grid[1].every(cell => cell.filled === false)).toBe(true);
    });

    it('all cells have 0 or 1 values', () => {
      const grid = generateGridData(15, 20, 75);
      grid.forEach(row => row.forEach(cell => {
        expect(cell.value === '0' || cell.value === '1').toBe(true);
        expect(typeof cell.filled).toBe('boolean');
      }));
    });
  });

  describe('hasRequiredAlgorithm', () => {
    it('returns true when player has the algorithm', () => {
      expect(hasRequiredAlgorithm('aes-256', ['aes-128', 'aes-256'])).toBe(true);
    });

    it('returns false when player lacks the algorithm', () => {
      expect(hasRequiredAlgorithm('rsa-2048', ['aes-128', 'aes-256'])).toBe(false);
    });

    it('returns false for null inputs', () => {
      expect(hasRequiredAlgorithm(null, ['aes-128'])).toBe(false);
      expect(hasRequiredAlgorithm('aes-128', null)).toBe(false);
    });
  });

  describe('getAlgorithmName', () => {
    it('returns display name for known algorithms', () => {
      expect(getAlgorithmName('aes-256')).toBe('AES-256');
      expect(getAlgorithmName('rsa-2048')).toBe('RSA-2048');
    });

    it('returns the ID for unknown algorithms', () => {
      expect(getAlgorithmName('unknown-algo')).toBe('unknown-algo');
    });
  });

  describe('isEncryptedFile', () => {
    it('detects files with encrypted property', () => {
      expect(isEncryptedFile({ name: 'data.db', encrypted: true })).toBe(true);
    });

    it('detects files with .enc extension', () => {
      expect(isEncryptedFile({ name: 'data.db.enc' })).toBe(true);
    });

    it('returns false for normal files', () => {
      expect(isEncryptedFile({ name: 'readme.txt' })).toBe(false);
    });
  });

  describe('getDecryptedFileName', () => {
    it('strips .enc extension', () => {
      expect(getDecryptedFileName('ticketing-database.db.enc')).toBe('ticketing-database.db');
    });

    it('leaves non-.enc names unchanged', () => {
      expect(getDecryptedFileName('readme.txt')).toBe('readme.txt');
    });
  });

  describe('DECRYPTION_ALGORITHMS', () => {
    it('has base algorithms marked correctly', () => {
      expect(DECRYPTION_ALGORITHMS['aes-128'].base).toBe(true);
      expect(DECRYPTION_ALGORITHMS['aes-256'].base).toBe(true);
    });

    it('has upgrade algorithms marked correctly', () => {
      expect(DECRYPTION_ALGORITHMS['rsa-2048'].base).toBe(false);
      expect(DECRYPTION_ALGORITHMS['blowfish'].base).toBe(false);
    });
  });
});

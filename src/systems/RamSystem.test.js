import { describe, it, expect } from 'vitest';
import { getTotalRamMB, getUsedRamMB, canOpenApp, formatRam, getMemoryCapacityMB } from './RamSystem';

describe('RamSystem', () => {
  describe('getTotalRamMB', () => {
    it('should return fallback 2048 MB when hardware is null', () => {
      expect(getTotalRamMB(null)).toBe(2048);
    });

    it('should return fallback 2048 MB when hardware has no memory', () => {
      expect(getTotalRamMB({})).toBe(2048);
    });

    it('should calculate total from capacityMB field', () => {
      const hardware = {
        memory: [
          { capacityMB: 4096 },
          { capacityMB: 4096 },
        ],
      };
      expect(getTotalRamMB(hardware)).toBe(8192);
    });

    it('should parse capacity string when capacityMB is missing', () => {
      const hardware = {
        memory: [
          { capacity: '8GB' },
        ],
      };
      expect(getTotalRamMB(hardware)).toBe(8192);
    });

    it('should handle mixed capacityMB and capacity string', () => {
      const hardware = {
        memory: [
          { capacityMB: 2048 },
          { capacity: '4GB' },
        ],
      };
      expect(getTotalRamMB(hardware)).toBe(6144);
    });

    it('should return 0 for unparseable capacity strings', () => {
      const hardware = {
        memory: [
          { capacity: 'unknown' },
        ],
      };
      expect(getTotalRamMB(hardware)).toBe(0);
    });

    it('should handle single stick', () => {
      const hardware = {
        memory: [{ capacityMB: 16384 }],
      };
      expect(getTotalRamMB(hardware)).toBe(16384);
    });

    it('should handle empty memory array', () => {
      const hardware = { memory: [] };
      expect(getTotalRamMB(hardware)).toBe(0);
    });
  });

  describe('getUsedRamMB', () => {
    it('should return 0 when no windows or passive software', () => {
      expect(getUsedRamMB([], [])).toBe(0);
    });

    it('should return 0 for null inputs', () => {
      expect(getUsedRamMB(null, null)).toBe(0);
    });

    it('should calculate RAM from open windows', () => {
      const windows = [
        { appId: 'mail' },        // 64 MB
        { appId: 'portal' },      // 128 MB
      ];
      expect(getUsedRamMB(windows, [])).toBe(192);
    });

    it('should calculate RAM from passive software', () => {
      const passive = ['advanced-firewall-av', 'trace-monitor'];  // 256 + 192
      expect(getUsedRamMB([], passive)).toBe(448);
    });

    it('should combine windows and passive software', () => {
      const windows = [{ appId: 'passwordCracker' }];  // 512
      const passive = ['trace-monitor'];  // 192
      expect(getUsedRamMB(windows, passive)).toBe(704);
    });

    it('should use default 64 MB for unknown app IDs', () => {
      const windows = [{ appId: 'unknown-app' }];
      expect(getUsedRamMB(windows, [])).toBe(64);
    });

    it('should handle multiple file manager windows', () => {
      const windows = [
        { appId: 'fileManager' },  // 192
        { appId: 'fileManager' },  // 192
      ];
      expect(getUsedRamMB(windows, [])).toBe(384);
    });
  });

  describe('canOpenApp', () => {
    const hardware4GB = { memory: [{ capacityMB: 4096 }] };

    it('should allow opening a small app with plenty of RAM', () => {
      const result = canOpenApp(hardware4GB, [], [], 'mail');
      expect(result.canOpen).toBe(true);
      expect(result.required).toBe(64);
      expect(result.available).toBe(4096);
      expect(result.total).toBe(4096);
    });

    it('should prevent opening app when RAM is full', () => {
      const hardware2GB = { memory: [{ capacityMB: 2048 }] };
      // Fill up RAM: passwordCracker(512) + decryptionTool(384) + dataRecoveryTool(256) + fileManager(192) + portal(128) + vpnClient(128) + networkScanner(128) + missionBoard(96) + mail(64) + banking(64) + nar(64) = 2016
      const windows = [
        { appId: 'passwordCracker' },
        { appId: 'decryptionTool' },
        { appId: 'dataRecoveryTool' },
        { appId: 'fileManager' },
        { appId: 'portal' },
        { appId: 'vpnClient' },
        { appId: 'networkScanner' },
        { appId: 'missionBoard' },
        { appId: 'mail' },
        { appId: 'banking' },
        { appId: 'networkAddressRegister' },
      ];
      const result = canOpenApp(hardware2GB, windows, [], 'networkSniffer');
      expect(result.canOpen).toBe(false);
      expect(result.required).toBe(384);
    });

    it('should account for passive software RAM usage', () => {
      const hardware2GB = { memory: [{ capacityMB: 2048 }] };
      const windows = [{ appId: 'passwordCracker' }];  // 512
      const passive = ['advanced-firewall-av', 'trace-monitor'];  // 256 + 192 = 448
      // Used: 960, Available: 1088
      const result = canOpenApp(hardware2GB, windows, passive, 'networkSniffer');
      expect(result.canOpen).toBe(true);  // 384 needed, 1088 available
      expect(result.available).toBe(1088);
    });

    it('should handle edge case where available equals required', () => {
      // 2048 total, use 2048 - 512 = 1536 MB of existing usage, then check passwordCracker (512)
      const hardware2GB = { memory: [{ capacityMB: 2048 }] };
      // decryptionTool(384) + dataRecoveryTool(256) + fileManager(192) + portal(128) + vpnClient(128) + networkScanner(128) + missionBoard(96) + mail(64) + banking(64) + nar(64) = 1504
      // Available would be 544, password cracker needs 512 - should work
      const windows = [
        { appId: 'decryptionTool' },
        { appId: 'dataRecoveryTool' },
        { appId: 'fileManager' },
        { appId: 'portal' },
        { appId: 'vpnClient' },
        { appId: 'networkScanner' },
        { appId: 'missionBoard' },
        { appId: 'mail' },
        { appId: 'banking' },
        { appId: 'networkAddressRegister' },
      ];
      const result = canOpenApp(hardware2GB, windows, [], 'passwordCracker');
      expect(result.canOpen).toBe(true);
    });

    it('should use default 64 MB for unknown app IDs', () => {
      const result = canOpenApp(hardware4GB, [], [], 'some-future-app');
      expect(result.required).toBe(64);
      expect(result.canOpen).toBe(true);
    });
  });

  describe('formatRam', () => {
    it('should format RAM usage as GB', () => {
      expect(formatRam(1024, 4096)).toBe('1.0 / 4.0 GB');
    });

    it('should format fractional GB values', () => {
      expect(formatRam(1536, 2048)).toBe('1.5 / 2.0 GB');
    });

    it('should format zero usage', () => {
      expect(formatRam(0, 8192)).toBe('0.0 / 8.0 GB');
    });

    it('should handle small MB values', () => {
      expect(formatRam(64, 2048)).toBe('0.1 / 2.0 GB');
    });
  });

  describe('getMemoryCapacityMB', () => {
    it('should return capacity for valid memory ID', () => {
      expect(getMemoryCapacityMB('ram-2gb')).toBe(2048);
      expect(getMemoryCapacityMB('ram-4gb')).toBe(4096);
      expect(getMemoryCapacityMB('ram-8gb')).toBe(8192);
      expect(getMemoryCapacityMB('ram-16gb')).toBe(16384);
      expect(getMemoryCapacityMB('ram-32gb')).toBe(32768);
    });

    it('should return 0 for unknown memory ID', () => {
      expect(getMemoryCapacityMB('ram-unknown')).toBe(0);
    });
  });
});

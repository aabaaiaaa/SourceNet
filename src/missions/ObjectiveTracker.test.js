import { describe, it, expect } from 'vitest';
import {
  checkNetworkConnectionObjective,
  checkNetworkScanObjective,
  checkFileSystemConnectionObjective,
  checkFileOperationObjective,
  checkNarEntryAddedObjective,
  checkMissionObjectives,
  getFileOperationProgress,
} from './ObjectiveTracker';

describe('ObjectiveTracker', () => {
  describe('checkNetworkConnectionObjective', () => {
    it('should return true when connected to target network', () => {
      const objective = { type: 'networkConnection', target: 'clienta-corporate' };
      const connections = [
        { networkId: 'clienta-corporate', networkName: 'ClientA-Corporate' },
      ];

      expect(checkNetworkConnectionObjective(objective, connections)).toBe(true);
    });

    it('should return false when not connected', () => {
      const objective = { type: 'networkConnection', target: 'clienta-corporate' };
      const connections = [];

      expect(checkNetworkConnectionObjective(objective, connections)).toBe(false);
    });

    it('should match by networkName as well', () => {
      const objective = { type: 'networkConnection', target: 'ClientA-Corporate' };
      const connections = [
        { networkId: 'clienta-corporate', networkName: 'ClientA-Corporate' },
      ];

      expect(checkNetworkConnectionObjective(objective, connections)).toBe(true);
    });
  });

  describe('checkNetworkScanObjective', () => {
    it('should return true when target found in scan results', () => {
      const objective = { type: 'networkScan', expectedResult: 'fileserver-01' };
      const scanResults = {
        machines: [
          { ip: '192.168.50.10', hostname: 'fileserver-01' },
          { ip: '192.168.50.20', hostname: 'backup-server' },
        ],
      };

      expect(checkNetworkScanObjective(objective, scanResults)).toBe(true);
    });

    it('should match by IP address', () => {
      const objective = { type: 'networkScan', expectedResult: '192.168.50.10' };
      const scanResults = {
        machines: [{ ip: '192.168.50.10', hostname: 'fileserver-01' }],
      };

      expect(checkNetworkScanObjective(objective, scanResults)).toBe(true);
    });

    it('should return false when target not found', () => {
      const objective = { type: 'networkScan', expectedResult: 'backup-server' };
      const scanResults = {
        machines: [{ ip: '192.168.50.10', hostname: 'fileserver-01' }],
      };

      expect(checkNetworkScanObjective(objective, scanResults)).toBe(false);
    });

    it('should return false when no scan results', () => {
      const objective = { type: 'networkScan', expectedResult: 'fileserver-01' };
      expect(checkNetworkScanObjective(objective, null)).toBe(false);
    });
  });

  describe('checkFileSystemConnectionObjective', () => {
    it('should return true when connected to target file system', () => {
      const objective = { type: 'fileSystemConnection', target: '192.168.50.10' };
      const connections = [
        { ip: '192.168.50.10', fileSystemId: 'fs-001', path: '/logs/' },
      ];

      expect(checkFileSystemConnectionObjective(objective, connections)).toBe(true);
    });

    it('should match by file system ID', () => {
      const objective = { type: 'fileSystemConnection', target: 'fs-001' };
      const connections = [
        { ip: '192.168.50.10', fileSystemId: 'fs-001', path: '/logs/' },
      ];

      expect(checkFileSystemConnectionObjective(objective, connections)).toBe(true);
    });

    it('should return false when not connected', () => {
      const objective = { type: 'fileSystemConnection', target: '192.168.50.10' };
      const connections = [];

      expect(checkFileSystemConnectionObjective(objective, connections)).toBe(false);
    });
  });

  describe('checkFileOperationObjective', () => {
    it('should return true when operation matches', () => {
      const objective = { type: 'fileOperation', operation: 'repair' };
      const operationData = { operation: 'repair', filesAffected: 8, fileNames: ['file1.txt'] };

      expect(checkFileOperationObjective(objective, operationData)).toBe(true);
    });

    it('should check targetFiles if specified', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'paste',
        targetFiles: ['file1.txt', 'file2.txt']
      };
      const operationData = { operation: 'paste', filesAffected: 2, fileNames: ['file1.txt', 'file2.txt'] };
      const cumulativeOps = { paste: new Set(['file1.txt', 'file2.txt']) };

      expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(true);
    });

    it('should return false if targetFiles not all completed', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'paste',
        targetFiles: ['file1.txt', 'file2.txt', 'file3.txt']
      };
      const operationData = { operation: 'paste', filesAffected: 1, fileNames: ['file1.txt'] };
      const cumulativeOps = { paste: new Set(['file1.txt']) };

      expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(false);
    });

    it('should return false if operation does not match', () => {
      const objective = { type: 'fileOperation', operation: 'repair' };
      const operationData = { operation: 'delete', filesAffected: 8, fileNames: ['file1.txt'] };

      expect(checkFileOperationObjective(objective, operationData)).toBe(false);
    });

    it('should complete copy objective when files are copied individually then another operation occurs', () => {
      // This tests the scenario where user copies files one-by-one, then does another operation (e.g. paste)
      // The cumulative copy Set should still satisfy the objective even when last operation was not 'copy'
      const objective = {
        type: 'fileOperation',
        operation: 'copy',
        targetFiles: ['file1.txt', 'file2.txt', 'file3.txt']
      };
      // Last operation was paste, not copy
      const operationData = { operation: 'paste', filesAffected: 3, fileNames: ['file1.txt', 'file2.txt', 'file3.txt'] };
      // But all files were copied cumulatively
      const cumulativeOps = { copy: new Set(['file1.txt', 'file2.txt', 'file3.txt']) };

      expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(true);
    });

    describe('paste destination validation', () => {
      it('should return true when files are pasted to correct destination', () => {
        const objective = {
          type: 'fileOperation',
          operation: 'paste',
          targetFiles: ['file1.txt', 'file2.txt'],
          destination: '192.168.50.20'
        };
        const operationData = { operation: 'paste', filesAffected: 2, fileNames: ['file1.txt', 'file2.txt'] };
        const cumulativeOps = {
          paste: new Set(['file1.txt', 'file2.txt']),
          pasteDestinations: new Map([['file1.txt', '192.168.50.20'], ['file2.txt', '192.168.50.20']])
        };

        expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(true);
      });

      it('should return false when files are pasted to wrong destination', () => {
        const objective = {
          type: 'fileOperation',
          operation: 'paste',
          targetFiles: ['file1.txt', 'file2.txt'],
          destination: '192.168.50.20'
        };
        const operationData = { operation: 'paste', filesAffected: 2, fileNames: ['file1.txt', 'file2.txt'] };
        const cumulativeOps = {
          paste: new Set(['file1.txt', 'file2.txt']),
          pasteDestinations: new Map([['file1.txt', '192.168.50.99'], ['file2.txt', '192.168.50.99']])
        };

        expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(false);
      });

      it('should return false when only some files are at correct destination', () => {
        const objective = {
          type: 'fileOperation',
          operation: 'paste',
          targetFiles: ['file1.txt', 'file2.txt'],
          destination: '192.168.50.20'
        };
        const operationData = { operation: 'paste', filesAffected: 1, fileNames: ['file2.txt'] };
        const cumulativeOps = {
          paste: new Set(['file1.txt', 'file2.txt']),
          pasteDestinations: new Map([['file1.txt', '192.168.50.99'], ['file2.txt', '192.168.50.20']])
        };

        expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(false);
      });

      it('should work without destination requirement (backward compatibility)', () => {
        const objective = {
          type: 'fileOperation',
          operation: 'paste',
          targetFiles: ['file1.txt', 'file2.txt']
          // No destination specified
        };
        const operationData = { operation: 'paste', filesAffected: 2, fileNames: ['file1.txt', 'file2.txt'] };
        const cumulativeOps = { paste: new Set(['file1.txt', 'file2.txt']) };

        expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(true);
      });

      it('should return false when no pasteDestinations map exists but destination is required', () => {
        const objective = {
          type: 'fileOperation',
          operation: 'paste',
          targetFiles: ['file1.txt'],
          destination: '192.168.50.20'
        };
        const operationData = { operation: 'paste', filesAffected: 1, fileNames: ['file1.txt'] };
        const cumulativeOps = { paste: new Set(['file1.txt']) };

        expect(checkFileOperationObjective(objective, operationData, cumulativeOps)).toBe(false);
      });
    });
  });

  describe('getFileOperationProgress', () => {
    it('should return null if no targetFiles specified', () => {
      const objective = { type: 'fileOperation', operation: 'repair' };
      expect(getFileOperationProgress(objective, {})).toBe(null);
    });

    it('should return progress for standard file operation', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'repair',
        targetFiles: ['file1.txt', 'file2.txt', 'file3.txt']
      };
      const cumulativeOps = { repair: new Set(['file1.txt', 'file2.txt']) };

      const progress = getFileOperationProgress(objective, cumulativeOps);
      expect(progress).toEqual({ current: 2, total: 3 });
    });

    it('should return progress for paste with destination - correct destination', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'paste',
        targetFiles: ['file1.txt', 'file2.txt'],
        destination: '192.168.50.20'
      };
      const cumulativeOps = {
        paste: new Set(['file1.txt', 'file2.txt']),
        pasteDestinations: new Map([['file1.txt', '192.168.50.20'], ['file2.txt', '192.168.50.20']])
      };

      const progress = getFileOperationProgress(objective, cumulativeOps);
      expect(progress).toEqual({ current: 2, total: 2 });
    });

    it('should show zero progress for paste to wrong destination', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'paste',
        targetFiles: ['file1.txt', 'file2.txt'],
        destination: '192.168.50.20'
      };
      const cumulativeOps = {
        paste: new Set(['file1.txt', 'file2.txt']),
        pasteDestinations: new Map([['file1.txt', '192.168.50.99'], ['file2.txt', '192.168.50.99']])
      };

      const progress = getFileOperationProgress(objective, cumulativeOps);
      expect(progress).toEqual({ current: 0, total: 2 });
    });

    it('should show partial progress when some files at correct destination', () => {
      const objective = {
        type: 'fileOperation',
        operation: 'paste',
        targetFiles: ['file1.txt', 'file2.txt'],
        destination: '192.168.50.20'
      };
      const cumulativeOps = {
        paste: new Set(['file1.txt', 'file2.txt']),
        pasteDestinations: new Map([['file1.txt', '192.168.50.99'], ['file2.txt', '192.168.50.20']])
      };

      const progress = getFileOperationProgress(objective, cumulativeOps);
      expect(progress).toEqual({ current: 1, total: 2 });
    });
  });

  describe('checkNarEntryAddedObjective', () => {
    it('should return true when target network is in NAR', () => {
      const objective = { type: 'narEntryAdded', target: 'clienta-corporate' };
      const narEntries = [
        { networkId: 'clienta-corporate', networkName: 'ClientA-Corporate', authorized: true },
      ];

      expect(checkNarEntryAddedObjective(objective, narEntries)).toBe(true);
    });

    it('should return false when NAR is empty', () => {
      const objective = { type: 'narEntryAdded', target: 'clienta-corporate' };

      expect(checkNarEntryAddedObjective(objective, [])).toBe(false);
      expect(checkNarEntryAddedObjective(objective, null)).toBe(false);
    });

    it('should return false when target network not in NAR', () => {
      const objective = { type: 'narEntryAdded', target: 'clienta-corporate' };
      const narEntries = [
        { networkId: 'other-network', networkName: 'Other Network', authorized: true },
      ];

      expect(checkNarEntryAddedObjective(objective, narEntries)).toBe(false);
    });

    it('should return false when NAR entry is revoked (unauthorized)', () => {
      const objective = { type: 'narEntryAdded', target: 'clienta-corporate' };
      const narEntries = [
        { networkId: 'clienta-corporate', networkName: 'ClientA-Corporate', authorized: false },
      ];

      expect(checkNarEntryAddedObjective(objective, narEntries)).toBe(false);
    });

    it('should return true when authorized is undefined (default authorized)', () => {
      const objective = { type: 'narEntryAdded', target: 'clienta-corporate' };
      const narEntries = [
        { networkId: 'clienta-corporate', networkName: 'ClientA-Corporate' },
      ];

      expect(checkNarEntryAddedObjective(objective, narEntries)).toBe(true);
    });
  });

  describe('checkMissionObjectives', () => {
    it('should return empty array if no active mission', () => {
      const result = checkMissionObjectives(null, {});
      expect(result).toEqual([]);
    });

    it('should return empty array if all objectives complete', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', status: 'complete' },
          { id: 'obj-2', status: 'complete' },
        ],
      };

      const result = checkMissionObjectives(mission, {});
      expect(result).toEqual([]);
    });

    it('should return all completable objectives (out-of-order completion)', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'complete' },
          { id: 'obj-2', type: 'networkConnection', target: 'test-network-2', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network-2' }],
      };

      const result = checkMissionObjectives(mission, gameState);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mission.objectives[1]);
    });

    it('should return multiple completable objectives at once', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network-1', status: 'pending' },
          { id: 'obj-2', type: 'networkConnection', target: 'test-network-2', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network-1' }, { networkId: 'test-network-2' }],
      };

      const result = checkMissionObjectives(mission, gameState);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(mission.objectives[0]);
      expect(result).toContainEqual(mission.objectives[1]);
    });

    it('should return empty array if objective not yet complete', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = { activeConnections: [] };

      const result = checkMissionObjectives(mission, gameState);
      expect(result).toEqual([]);
    });

    it('should not include verification objectives in completable list', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'complete' },
          { id: 'obj-verify', type: 'verification', status: 'pending' },
        ],
      };

      const gameState = { activeConnections: [{ networkId: 'test-network' }] };

      const result = checkMissionObjectives(mission, gameState);
      expect(result).toEqual([]);
    });
  });
});

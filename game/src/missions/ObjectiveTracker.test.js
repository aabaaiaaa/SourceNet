import { describe, it, expect } from 'vitest';
import {
  checkNetworkConnectionObjective,
  checkNetworkScanObjective,
  checkFileSystemConnectionObjective,
  checkFileOperationObjective,
  checkNarEntryAddedObjective,
  checkMissionObjectives,
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
      const operationData = { operation: 'repair', filesAffected: 8 };

      expect(checkFileOperationObjective(objective, operationData)).toBe(true);
    });

    it('should check count if specified', () => {
      const objective = { type: 'fileOperation', operation: 'copy', count: 8 };
      const operationData = { operation: 'copy', filesAffected: 8 };

      expect(checkFileOperationObjective(objective, operationData)).toBe(true);
    });

    it('should return false if count not met', () => {
      const objective = { type: 'fileOperation', operation: 'copy', count: 8 };
      const operationData = { operation: 'copy', filesAffected: 5 };

      expect(checkFileOperationObjective(objective, operationData)).toBe(false);
    });

    it('should return false if operation does not match', () => {
      const objective = { type: 'fileOperation', operation: 'repair' };
      const operationData = { operation: 'delete', filesAffected: 8 };

      expect(checkFileOperationObjective(objective, operationData)).toBe(false);
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
    it('should return null if no active mission', () => {
      const result = checkMissionObjectives(null, {});
      expect(result).toBe(null);
    });

    it('should return null if all objectives complete', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', status: 'complete' },
          { id: 'obj-2', status: 'complete' },
        ],
      };

      const result = checkMissionObjectives(mission, {});
      expect(result).toBe(null);
    });

    it('should check first incomplete objective', () => {
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
      expect(result).toEqual(mission.objectives[1]);
    });

    it('should return null if objective not yet complete', () => {
      const mission = {
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = { activeConnections: [] };

      const result = checkMissionObjectives(mission, gameState);
      expect(result).toBe(null);
    });
  });
});

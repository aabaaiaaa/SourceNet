import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useObjectiveAutoTracking } from './useObjectiveAutoTracking';
import triggerEventBus from '../core/triggerEventBus';

describe('useObjectiveAutoTracking', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    triggerEventBus.clear();
  });

  describe('networkConnection objectives', () => {
    it('should complete objective when connected to target network', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        consequences: { success: { reputation: 1 } },
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9, // reputation
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Emit the network connected event
      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'test-network' });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });

    it('should not complete objective when connected to different network', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'target-network', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'other-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'other-network' });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).not.toHaveBeenCalled();
    });
  });

  describe('networkScan objectives', () => {
    it('should complete objective when scan finds expected result', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'complete' },
          { id: 'obj-2', type: 'networkScan', expectedResult: 'fileserver-01', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: {
          machines: [{ hostname: 'fileserver-01', ip: '192.168.1.10' }],
        },
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkScanComplete', {});
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-2', false);
    });
  });

  describe('fileSystemConnection objectives', () => {
    it('should complete objective when connected to target file system', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'fileSystemConnection', target: '192.168.1.10', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [{ ip: '192.168.1.10', fileSystemId: 'fs-001' }],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('fileSystemConnected', { ip: '192.168.1.10' });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });
  });

  describe('fileOperation objectives', () => {
    it('should complete objective when file operation matches', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'fileOperation', operation: 'repair', count: 5, status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: { operation: 'repair', filesAffected: 5 },
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('fileOperationComplete', { operation: 'repair', filesAffected: 5 });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });

    it('should not complete objective when targetFiles not all completed', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'fileOperation', operation: 'paste', targetFiles: ['file1.txt', 'file2.txt', 'file3.txt'], status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: { operation: 'paste', filesAffected: 1, fileNames: ['file1.txt'] },
        missionFileOperations: { paste: new Set(['file1.txt']) },
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          gameState.missionFileOperations,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('fileOperationComplete', { operation: 'paste', filesAffected: 1, fileNames: ['file1.txt'] });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).not.toHaveBeenCalled();
    });
  });

  describe('mission completion', () => {
    it('should complete mission when all objectives are done', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        consequences: { success: { reputation: 2 } },
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9, // reputation tier 9 = 1.5x multiplier
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'test-network' });
        vi.advanceTimersByTime(200); // Allow time for both objective and mission completion
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
      expect(completeMission).toHaveBeenCalledWith('success', 1500, 2); // 1000 * 1.5 = 1500
    });

    it('should calculate payout based on reputation', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        consequences: { success: { reputation: 1 } },
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      // Test with reputation tier 3 (0.85x multiplier)
      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          3,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'test-network' });
        vi.advanceTimersByTime(200);
      });

      expect(completeMission).toHaveBeenCalledWith('success', 850, 1); // 1000 * 0.85 = 850
    });
  });

  describe('enabled flag', () => {
    it('should not track when disabled', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          false // Disabled
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'test-network' });
        vi.advanceTimersByTime(200);
      });

      expect(completeMissionObjective).not.toHaveBeenCalled();
      expect(completeMission).not.toHaveBeenCalled();
    });
  });

  describe('no active mission', () => {
    it('should do nothing when no active mission', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          null, // No active mission
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'test-network' });
        vi.advanceTimersByTime(200);
      });

      expect(completeMissionObjective).not.toHaveBeenCalled();
      expect(completeMission).not.toHaveBeenCalled();
    });
  });

  describe('networkScan objectives with event data', () => {
    it('should use scan results from event when React state is stale', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'complete' },
          { id: 'obj-2', type: 'networkScan', expectedResult: 'target-server', status: 'pending' },
        ],
      };

      // gameState.lastScanResults is null (stale) - but event will have the data
      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,  // Stale - React state hasn't updated yet
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Event carries the scan results directly
      act(() => {
        triggerEventBus.emit('networkScanComplete', {
          results: {
            machines: [{ hostname: 'target-server', ip: '192.168.1.10' }],
          },
        });
        vi.advanceTimersByTime(100);
      });

      // Objective should complete using event data, not stale gameState
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-2', false);
    });
  });

  describe('fileRecovery objectives', () => {
    it('should complete objective when file recovery events accumulate to match targetFiles', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'fileRecovery', targetFiles: ['deleted-file.txt'], status: 'pending' },
        ],
      };

      // NO missionRecoveryOperations in gameState - the hook should accumulate from events
      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Event carries fileName - hook should accumulate it
      act(() => {
        triggerEventBus.emit('fileRecoveryComplete', { fileName: 'deleted-file.txt' });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });

    it('should accumulate multiple file recovery events', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'fileRecovery', targetFiles: ['file1.txt', 'file2.txt'], status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // First file recovery - should not complete yet
      act(() => {
        triggerEventBus.emit('fileRecoveryComplete', { fileName: 'file1.txt' });
        vi.advanceTimersByTime(100);
      });
      expect(completeMissionObjective).not.toHaveBeenCalled();

      // Second file recovery - should complete now
      act(() => {
        triggerEventBus.emit('fileRecoveryComplete', { fileName: 'file2.txt' });
        vi.advanceTimersByTime(100);
      });
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });
  });

  describe('secureDelete objectives', () => {
    it('should complete objective when secure delete events accumulate to match targetFiles', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'secureDelete', targetFiles: ['sensitive-data.txt'], status: 'pending' },
        ],
      };

      // NO missionRecoveryOperations in gameState - the hook should accumulate from events
      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Event carries fileName - hook should accumulate it
      act(() => {
        triggerEventBus.emit('secureDeleteComplete', { fileName: 'sensitive-data.txt' });
        vi.advanceTimersByTime(100);
      });

      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });

    it('should accumulate multiple secure delete events', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'secureDelete', targetFiles: ['malware.exe', 'trojan.dll'], status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // First secure delete - should not complete yet
      act(() => {
        triggerEventBus.emit('secureDeleteComplete', { fileName: 'malware.exe' });
        vi.advanceTimersByTime(100);
      });
      expect(completeMissionObjective).not.toHaveBeenCalled();

      // Second secure delete - should complete now
      act(() => {
        triggerEventBus.emit('secureDeleteComplete', { fileName: 'trojan.dll' });
        vi.advanceTimersByTime(100);
      });
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
    });
  });

  describe('investigation objectives with Log Viewer', () => {
    it('should complete when device logs viewed for correct file system', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'test-network', status: 'complete' },
          { id: 'obj-2', type: 'networkScan', expectedResult: 'fileserver-01', status: 'complete' },
          { id: 'obj-3', type: 'investigation', correctFileSystemId: 'fs-target-vol1', description: 'Use Log Viewer to identify flagged files', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: { machines: [{ hostname: 'fileserver-01', ip: '192.168.1.10' }] },
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Player views device logs in Log Viewer for the correct file system
      act(() => {
        triggerEventBus.emit('deviceLogsViewed', {
          fileSystemId: 'fs-target-vol1',
          deviceIp: '192.168.1.10',
          hostname: 'fileserver-01',
          networkId: 'test-network',
          logsCount: 5,
        });
        vi.advanceTimersByTime(100);
      });

      // Investigation objective should complete when correct device logs are viewed
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-3', false);
    });

    it('should not complete when device logs viewed for wrong file system', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'investigation', correctFileSystemId: 'fs-target-vol1', status: 'pending' },
        ],
      };

      const gameState = {
        activeConnections: [{ networkId: 'test-network' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      // Player views device logs for a DIFFERENT file system
      act(() => {
        triggerEventBus.emit('deviceLogsViewed', {
          fileSystemId: 'fs-wrong-vol2',
          deviceIp: '192.168.1.20',
          hostname: 'other-server',
          networkId: 'test-network',
          logsCount: 3,
        });
        vi.advanceTimersByTime(100);
      });

      // Investigation objective should NOT complete
      expect(completeMissionObjective).not.toHaveBeenCalled();
    });
  });

  describe('objective ordering', () => {
    it('should complete multiple objectives simultaneously when conditions are met (out-of-order completion)', () => {
      const completeMissionObjective = vi.fn();
      const completeMission = vi.fn();

      const mission = {
        missionId: 'test-mission',
        basePayout: 1000,
        objectives: [
          { id: 'obj-1', type: 'networkConnection', target: 'network-a', status: 'pending' },
          { id: 'obj-2', type: 'networkConnection', target: 'network-b', status: 'pending' },
        ],
      };

      // Both networks connected - both objectives should complete
      const gameState = {
        activeConnections: [{ networkId: 'network-a' }, { networkId: 'network-b' }],
        lastScanResults: null,
        fileManagerConnections: [],
        lastFileOperation: null,
      };

      renderHook(() =>
        useObjectiveAutoTracking(
          mission,
          gameState,
          9,
          completeMissionObjective,
          completeMission,
          true
        )
      );

      act(() => {
        triggerEventBus.emit('networkConnected', { networkId: 'network-a' });
        vi.advanceTimersByTime(100);
      });

      // Both objectives should be completed (first one normally, second one pre-completed)
      expect(completeMissionObjective).toHaveBeenCalledTimes(2);
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-1', false);
      expect(completeMissionObjective).toHaveBeenCalledWith('obj-2', true); // Pre-completed
    });
  });
});

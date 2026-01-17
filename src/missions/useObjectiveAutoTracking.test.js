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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBandwidthTracker,
  createBandwidthOperation,
  BANDWIDTH_OPERATION_TYPES,
  OPERATION_SIZES,
} from './useBandwidthTracker';

describe('useBandwidthTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createBandwidthOperation', () => {
    it('should create operation with correct structure', () => {
      const operation = createBandwidthOperation('file_repair', null, 5, { fileSystem: 'fs-001' });

      expect(operation.type).toBe('file_repair');
      expect(operation.sizeInMB).toBe(5);
      expect(operation.progress).toBe(0);
      expect(operation.status).toBe('active');
      expect(operation.metadata.fileSystem).toBe('fs-001');
      expect(operation.id).toMatch(/^file_repair-/);
    });

    it('should use provided id if given', () => {
      const operation = createBandwidthOperation('download', 'custom-id', 10);

      expect(operation.id).toBe('custom-id');
    });
  });

  describe('BANDWIDTH_OPERATION_TYPES', () => {
    it('should define all operation types', () => {
      expect(BANDWIDTH_OPERATION_TYPES.DOWNLOAD).toBe('download');
      expect(BANDWIDTH_OPERATION_TYPES.FILE_COPY).toBe('file_copy');
      expect(BANDWIDTH_OPERATION_TYPES.FILE_REPAIR).toBe('file_repair');
      expect(BANDWIDTH_OPERATION_TYPES.NETWORK_SCAN).toBe('network_scan');
    });
  });

  describe('OPERATION_SIZES', () => {
    it('should define default sizes for operations', () => {
      expect(OPERATION_SIZES[BANDWIDTH_OPERATION_TYPES.FILE_COPY]).toBe(2);
      expect(OPERATION_SIZES[BANDWIDTH_OPERATION_TYPES.FILE_REPAIR]).toBe(1);
      expect(OPERATION_SIZES[BANDWIDTH_OPERATION_TYPES.NETWORK_SCAN]).toBe(5);
    });
  });

  describe('hook initialization', () => {
    it('should initialize with no active operations', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      expect(result.current.operations).toEqual([]);
      expect(result.current.activeOperations).toEqual([]);
      expect(result.current.activeOperationCount).toBe(0);
    });

    it('should calculate max bandwidth from hardware', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      // maxBandwidth is Math.min(adapterSpeed, connectionSpeed)
      // With no active connections, connectionSpeed is Infinity, so max equals adapter speed
      expect(result.current.maxBandwidth).toBe(250);
    });

    it('should have 0% bandwidth usage when no operations', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      expect(result.current.bandwidthUsagePercent).toBe(0);
    });
  });

  describe('registerOperation', () => {
    it('should register a new operation', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      act(() => {
        result.current.registerOperation('file_repair', 5, { fileCount: 5 });
      });

      expect(result.current.operations.length).toBe(1);
      expect(result.current.activeOperations.length).toBe(1);
      expect(result.current.activeOperationCount).toBe(1);
    });

    it('should return operation info with estimated time', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      let operationInfo;
      act(() => {
        operationInfo = result.current.registerOperation('network_scan', 10);
      });

      expect(operationInfo.operationId).toBeDefined();
      expect(operationInfo.estimatedTimeMs).toBeGreaterThan(0);
      expect(operationInfo.bandwidthShare).toBeGreaterThan(0);
      expect(operationInfo.transferSpeedMBps).toBeGreaterThan(0);
    });

    it('should update bandwidth usage when operation registered', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      act(() => {
        result.current.registerOperation('file_repair', 5);
      });

      expect(result.current.bandwidthUsagePercent).toBe(25); // 1 operation = 25%
    });

    it('should share bandwidth across multiple operations', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      act(() => {
        result.current.registerOperation('file_repair', 5);
        result.current.registerOperation('network_scan', 10);
      });

      expect(result.current.activeOperationCount).toBe(2);
      expect(result.current.bandwidthUsagePercent).toBe(50); // 2 operations = 50%
      // maxBandwidth is 250 (adapter speed, no connection limit), so 250 / 2 = 125
      expect(result.current.bandwidthPerOperation).toBe(125);
    });
  });

  describe('completeOperation', () => {
    it('should mark operation as complete', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      let operationInfo;
      act(() => {
        operationInfo = result.current.registerOperation('file_repair', 5);
      });

      act(() => {
        result.current.completeOperation(operationInfo.operationId);
      });

      // Operation should be marked complete
      const operation = result.current.operations.find(
        (op) => op.id === operationInfo.operationId
      );
      expect(operation.status).toBe('complete');
      expect(operation.progress).toBe(100);
    });

    it('should remove operation after delay', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      let operationInfo;
      act(() => {
        operationInfo = result.current.registerOperation('file_repair', 5);
      });

      act(() => {
        result.current.completeOperation(operationInfo.operationId);
      });

      // Advance timers to trigger cleanup
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.operations.length).toBe(0);
    });
  });

  describe('updateOperationProgress', () => {
    it('should update operation progress', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      let operationInfo;
      act(() => {
        operationInfo = result.current.registerOperation('file_repair', 5);
      });

      act(() => {
        result.current.updateOperationProgress(operationInfo.operationId, 50);
      });

      const operation = result.current.operations.find(
        (op) => op.id === operationInfo.operationId
      );
      expect(operation.progress).toBe(50);
    });
  });

  describe('cancelOperation', () => {
    it('should remove operation from list', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      let operationInfo;
      act(() => {
        operationInfo = result.current.registerOperation('file_repair', 5);
      });

      expect(result.current.operations.length).toBe(1);

      act(() => {
        result.current.cancelOperation(operationInfo.operationId);
      });

      expect(result.current.operations.length).toBe(0);
    });
  });

  describe('getEstimatedTime', () => {
    it('should return estimated time for a hypothetical operation', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      const estimatedTime = result.current.getEstimatedTime(10);

      expect(estimatedTime).toBeGreaterThan(0);
    });

    it('should account for existing operations', () => {
      // Use a slower adapter to make timing differences more apparent
      const hardware = { network: { speed: 16 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      // Get time with no other operations (16 Mbps = 2 MB/s, 10 MB = 5s = 5000ms)
      const timeAlone = result.current.getEstimatedTime(10);

      // Add an operation
      act(() => {
        result.current.registerOperation('download', 100);
      });

      // Get time with one other operation (bandwidth halved = time doubled)
      const timeWithOther = result.current.getEstimatedTime(10);

      // Time should be longer when sharing bandwidth
      expect(timeWithOther).toBeGreaterThan(timeAlone);
    });
  });

  describe('bandwidth calculations', () => {
    it('should cap bandwidth usage at 100%', () => {
      const hardware = { network: { speed: 250 } };

      const { result } = renderHook(() => useBandwidthTracker(hardware));

      // Add 5 operations (more than 4 cap)
      act(() => {
        result.current.registerOperation('op1', 10);
        result.current.registerOperation('op2', 10);
        result.current.registerOperation('op3', 10);
        result.current.registerOperation('op4', 10);
        result.current.registerOperation('op5', 10);
      });

      expect(result.current.bandwidthUsagePercent).toBe(100);
    });

    it('should use minimum of adapter and connection speed', () => {
      // With slow adapter
      const slowHardware = { network: { speed: 50 } };

      const { result } = renderHook(() => useBandwidthTracker(slowHardware));

      expect(result.current.maxBandwidth).toBe(50);
    });
  });
});

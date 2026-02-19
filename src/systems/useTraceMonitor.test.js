import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import triggerEventBus from '../core/triggerEventBus';

// Mock useGame values
const mockGameState = {
  traceState: null,
  setTraceState: vi.fn(),
  currentTime: new Date('2020-03-25T09:05:00'),
  activeRelayChain: [],
  relayNodes: [],
  setRelayNodes: vi.fn(),
  setActiveRelayChain: vi.fn(),
  setActiveConnections: vi.fn(),
  activePassiveSoftware: [],
  rebuildCount: 0,
  setRebuildCount: vi.fn(),
};

vi.mock('../contexts/useGame', () => ({
  useGame: vi.fn(() => ({ ...mockGameState })),
}));

// Must import after mock setup
const { useGame } = await import('../contexts/useGame');

describe('useTraceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerEventBus.clear();

    // Reset mock state to defaults
    mockGameState.traceState = null;
    mockGameState.currentTime = new Date('2020-03-25T09:05:00');
    mockGameState.activeRelayChain = [];
    mockGameState.relayNodes = [];
    mockGameState.activePassiveSoftware = [];
    mockGameState.rebuildCount = 0;
  });

  afterEach(() => {
    triggerEventBus.clear();
  });

  // Re-import the hook fresh for each test to reset module state
  const loadHook = async () => {
    const mod = await import('./useTraceMonitor');
    return mod.default;
  };

  it('should return isMonitorActive false when trace-monitor not in activePassiveSoftware', async () => {
    mockGameState.activePassiveSoftware = [];
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.isMonitorActive).toBe(false);
  });

  it('should return isMonitorActive true when trace-monitor is in activePassiveSoftware', async () => {
    mockGameState.activePassiveSoftware = ['trace-monitor'];
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.isMonitorActive).toBe(true);
  });

  it('should return isTraceActive false when traceState is null', async () => {
    mockGameState.traceState = null;
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.isTraceActive).toBe(false);
  });

  it('should return isTraceActive true when traceState.active is true', async () => {
    mockGameState.traceState = {
      active: true,
      startTime: new Date('2020-03-25T09:00:00').getTime(),
      totalETT: 300000, // 5 minutes
    };
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.isTraceActive).toBe(true);
  });

  it('should return null traceProgress when no trace active', async () => {
    mockGameState.traceState = null;
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.traceProgress).toBeNull();
  });

  it('should return traceProgress with remaining time when trace is active', async () => {
    const startTime = new Date('2020-03-25T09:00:00').getTime();
    mockGameState.traceState = {
      active: true,
      startTime,
      totalETT: 300000, // 5 minutes
    };
    mockGameState.currentTime = new Date('2020-03-25T09:03:00'); // 3 minutes in
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.traceProgress).not.toBeNull();
    expect(result.current.traceProgress.remaining).toBe(120000); // 2 minutes remaining
    expect(result.current.traceProgress.progress).toBeCloseTo(0.6, 1);
    expect(result.current.traceProgress.isTraced).toBe(false);
  });

  it('should show isTraced true when time has expired', async () => {
    const startTime = new Date('2020-03-25T09:00:00').getTime();
    mockGameState.traceState = {
      active: true,
      startTime,
      totalETT: 300000,
    };
    mockGameState.currentTime = new Date('2020-03-25T09:06:00'); // 6 minutes in (past 5 min ETT)
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.traceProgress).not.toBeNull();
    expect(result.current.traceProgress.remaining).toBe(0);
    expect(result.current.traceProgress.isTraced).toBe(true);
  });

  it('should return beepActive false when trace-monitor not active', async () => {
    mockGameState.activePassiveSoftware = [];
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.beepActive).toBe(false);
  });

  it('should expose formatETT function', async () => {
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(typeof result.current.formatETT).toBe('function');
    expect(result.current.formatETT(120000)).toBe('2:00');
    expect(result.current.formatETT(90000)).toBe('1:30');
  });

  it('should format remaining time correctly in traceProgress', async () => {
    const startTime = new Date('2020-03-25T09:00:00').getTime();
    mockGameState.traceState = {
      active: true,
      startTime,
      totalETT: 300000,
    };
    mockGameState.currentTime = new Date('2020-03-25T09:02:30'); // 2.5 minutes in
    useGame.mockReturnValue({ ...mockGameState });

    const useTraceMonitor = await loadHook();
    const { result } = renderHook(() => useTraceMonitor());

    expect(result.current.traceProgress.formattedRemaining).toBe('2:30');
  });
});

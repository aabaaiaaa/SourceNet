/**
 * useTraceMonitor - Hook for trace detection and monitoring
 *
 * Reads trace state from game context and provides:
 * - Current trace progress/ETT remaining
 * - Beep rate calculation (faster = closer to traced)
 * - Status messages for TopBar display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../contexts/useGame';
import { formatETT, burnChain } from './RelaySystem';
import { TRACE_CONSEQUENCES } from '../constants/gameConstants';
import triggerEventBus from '../core/triggerEventBus';

const useTraceMonitor = () => {
  const {
    traceState, setTraceState, currentTime,
    activeRelayChain, relayNodes, setRelayNodes,
    setActiveRelayChain, setActiveConnections,
    activePassiveSoftware, rebuildCount, setRebuildCount,
  } = useGame();

  const [beepActive, setBeepActive] = useState(false);
  const beepIntervalRef = useRef(null);
  const isMonitorActive = activePassiveSoftware?.includes('trace-monitor');

  // Calculate remaining ETT based on current time
  const getTraceProgress = useCallback(() => {
    if (!traceState?.active || !currentTime) return null;

    const elapsed = currentTime.getTime() - traceState.startTime;
    const remaining = Math.max(0, traceState.totalETT - elapsed);
    const progress = Math.min(1, elapsed / traceState.totalETT);

    return {
      remaining,
      progress,
      formattedRemaining: formatETT(remaining),
      isTraced: remaining <= 0,
    };
  }, [traceState, currentTime]);

  // Handle being fully traced
  useEffect(() => {
    if (!traceState?.active || !currentTime) return;

    const check = () => {
      const progress = getTraceProgress();
      if (progress?.isTraced) {
        // Player has been traced!
        // Burn all relay nodes in the chain
        if (activeRelayChain.length > 0) {
          const burnedNodes = burnChain(activeRelayChain, relayNodes);
          setRelayNodes(burnedNodes);
        }

        // Force disconnect all connections
        setActiveConnections([]);
        setActiveRelayChain([]);
        setTraceState(null);

        // Increment rebuild count
        const newRebuildCount = rebuildCount + 1;
        setRebuildCount(newRebuildCount);

        // Emit trace event
        triggerEventBus.emit('playerTraced', {
          rebuildCount: newRebuildCount,
          maxRebuilds: TRACE_CONSEQUENCES.maxRebuilds,
          darkWebChance: TRACE_CONSEQUENCES.darkWebTargetChance,
        });

        // Check if player is fired (3rd mark = game over)
        if (newRebuildCount > TRACE_CONSEQUENCES.maxRebuilds) {
          triggerEventBus.emit('playerFired', { reason: 'traced-too-many-times' });
        }
      }
    };

    const intervalId = setInterval(check, 500);
    return () => clearInterval(intervalId);
  }, [traceState, currentTime, activeRelayChain, relayNodes]);

  // Beep logic - only beeps when trace monitor is active as passive software
  useEffect(() => {
    if (!isMonitorActive || !traceState?.active) {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
      setBeepActive(false);
      return;
    }

    const updateBeep = () => {
      const progress = getTraceProgress();
      if (!progress) return;

      // Beep rate increases as trace gets closer
      // From 2s interval (0% progress) to 0.2s (100% progress)
      const beepRate = Math.max(200, 2000 - (progress.progress * 1800));

      setBeepActive(true);

      // Clear and reset interval with new rate
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = setInterval(() => {
        setBeepActive(prev => !prev); // Toggle for visual flash effect
      }, beepRate);
    };

    updateBeep();
    const checkInterval = setInterval(updateBeep, 1000);

    return () => {
      clearInterval(checkInterval);
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    };
  }, [isMonitorActive, traceState, getTraceProgress]);

  return {
    isMonitorActive,
    isTraceActive: traceState?.active || false,
    traceProgress: getTraceProgress(),
    beepActive,
    formatETT,
  };
};

export default useTraceMonitor;

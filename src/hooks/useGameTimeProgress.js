/**
 * useGameTimeProgress - Shared hook for progress tracking with game time.
 *
 * Provides a `startProgress(duration, onProgress, onComplete)` function that
 * tracks progress from 0-100% based on elapsed game time using requestAnimationFrame.
 *
 * Used by: DecryptionTool, DataRecoveryTool, VPNClient, and similar components
 * that need game-time-aware progress animation.
 *
 * @param {Date} currentTime - Current game time from useGame()
 * @returns {{ startProgress, cancelProgress, isRunning }}
 */

import { useRef, useEffect, useCallback } from 'react';

export function useGameTimeProgress(currentTime) {
  const currentTimeRef = useRef(currentTime);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const durationRef = useRef(0);

  // Keep time ref updated
  currentTimeRef.current = currentTime;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const cancelProgress = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    startTimeRef.current = null;
    durationRef.current = 0;
  }, []);

  const startProgress = useCallback((duration, onProgress, onComplete) => {
    // Cancel any existing animation
    cancelProgress();

    if (!currentTimeRef.current) return;

    startTimeRef.current = currentTimeRef.current.getTime();
    durationRef.current = duration;

    const animate = () => {
      const now = currentTimeRef.current.getTime();
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(100, (elapsed / durationRef.current) * 100);

      onProgress(progress);

      if (progress >= 100) {
        animationRef.current = null;
        startTimeRef.current = null;
        onComplete?.();
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [cancelProgress]);

  return {
    startProgress,
    cancelProgress,
    isRunning: animationRef.current !== null,
  };
}

export default useGameTimeProgress;

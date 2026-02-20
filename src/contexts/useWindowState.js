/**
 * useWindowState - Window management state and actions.
 *
 * Extracted from GameContext to reduce file size.
 * Manages window creation, positioning, z-indexing, minimize/restore.
 */

import { useState, useRef, useCallback } from 'react';
import { MULTI_INSTANCE_APPS } from '../constants/gameConstants';

export function useWindowState() {
  const [windows, setWindows] = useState([]);
  const nextZIndexRef = useRef(1000);
  const nextWindowIdRef = useRef(1);

  const openWindow = useCallback((appId) => {
    const newWindowId = nextWindowIdRef.current++;
    const newZIndex = nextZIndexRef.current++;

    setWindows((prev) => {
      const allowsMultipleInstances = MULTI_INSTANCE_APPS.includes(appId);

      if (!allowsMultipleInstances) {
        const existing = prev.find((w) => w.appId === appId);
        if (existing) {
          return prev.map((w) =>
            w.id === existing.id ? { ...w, zIndex: newZIndex, minimized: false } : w
          );
        }
      }

      const CASCADE_OFFSET = 30;
      const BASE_X = 50;
      const BASE_Y = 100;
      const openWindows = prev.filter((w) => !w.minimized);
      const offset = openWindows.length * CASCADE_OFFSET;

      const newWindow = {
        id: `window-${newWindowId}`,
        appId,
        zIndex: newZIndex,
        minimized: false,
        position: {
          x: BASE_X + offset,
          y: BASE_Y + offset,
        },
      };

      return [...prev, newWindow];
    });
  }, []);

  const closeWindow = useCallback((windowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
  }, []);

  const minimizeWindow = useCallback((windowId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, minimized: true } : w
      )
    );
  }, []);

  const restoreWindow = useCallback((windowId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, minimized: false, zIndex: newZ } : w
      )
    );
  }, []);

  const bringToFront = useCallback((windowId) => {
    const newZ = nextZIndexRef.current++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, zIndex: newZ } : w
      )
    );
  }, []);

  const moveWindow = useCallback((windowId, position) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, position } : w
      )
    );
  }, []);

  return {
    windows,
    setWindows,
    nextZIndexRef,
    nextWindowIdRef,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    moveWindow,
  };
}

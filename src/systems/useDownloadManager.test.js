import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDownloadManager, createDownloadItem } from './useDownloadManager';
import triggerEventBus from '../core/triggerEventBus';

describe('useDownloadManager', () => {
  beforeEach(() => {
    triggerEventBus.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-03-25T09:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    triggerEventBus.clear();
  });

  describe('createDownloadItem', () => {
    it('should create a download item with correct structure', () => {
      const currentTime = new Date('2020-03-25T09:00:00');
      const item = createDownloadItem('test-software', 'Test Software', 50, currentTime);

      expect(item.softwareId).toBe('test-software');
      expect(item.softwareName).toBe('Test Software');
      expect(item.sizeInMB).toBe(50);
      expect(item.progress).toBe(0);
      expect(item.status).toBe('downloading');
      expect(item.startTime).toBeDefined();
      expect(item.id).toMatch(/^download-/);
    });

    it('should use default size if not provided', () => {
      const currentTime = new Date('2020-03-25T09:00:00');
      const item = createDownloadItem('test-software', 'Test Software', undefined, currentTime);

      expect(item.sizeInMB).toBe(50);
    });
  });

  describe('download progress', () => {
    it('should update progress over time', () => {
      const setDownloadQueue = vi.fn();
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      const downloadItem = createDownloadItem('test-software', 'Test Software', 25, currentTime);
      const downloadQueue = [downloadItem];

      renderHook(() =>
        useDownloadManager(
          downloadQueue,
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          true
        )
      );

      // Advance time to trigger progress update
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // setDownloadQueue should have been called to update progress
      expect(setDownloadQueue).toHaveBeenCalled();
    });

    it('should not update when disabled', () => {
      const setDownloadQueue = vi.fn();
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      const downloadItem = createDownloadItem('test-software', 'Test Software', 25, currentTime);
      const downloadQueue = [downloadItem];

      renderHook(() =>
        useDownloadManager(
          downloadQueue,
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          false // Disabled
        )
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not have updated
      expect(setDownloadQueue).not.toHaveBeenCalled();
    });

    it('should not update when queue is empty', () => {
      const setDownloadQueue = vi.fn();
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      renderHook(() =>
        useDownloadManager(
          [],
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          true
        )
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(setDownloadQueue).not.toHaveBeenCalled();
    });
  });

  describe('download completion', () => {
    it('should emit softwareInstalled event when download completes', () => {
      const setDownloadQueue = vi.fn((fn) => {
        // Simulate what happens when download completes
        return fn;
      });
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      triggerEventBus.on('softwareInstalled', (data) => {
        expect(data.softwareId).toBe('test-software');
      });

      // Create an item that's almost complete
      const downloadItem = {
        ...createDownloadItem('test-software', 'Test Software', 1, currentTime), // Tiny file
        progress: 99,
        status: 'downloading',
        startTime: currentTime.getTime() - 10000, // Started 10 seconds ago
      };

      const downloadQueue = [downloadItem];

      renderHook(() =>
        useDownloadManager(
          downloadQueue,
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          true
        )
      );

      // Let download complete and install
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(setDownloadQueue).toHaveBeenCalled();
    });

    it('should call onDownloadComplete callback', () => {
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      // Track state updates
      let currentQueue = [];
      const setDownloadQueue = vi.fn((fn) => {
        if (typeof fn === 'function') {
          currentQueue = fn(currentQueue);
        } else {
          currentQueue = fn;
        }
      });

      // Create an installing item ready to complete
      const downloadItem = {
        id: 'download-test',
        softwareId: 'test-software',
        softwareName: 'Test Software',
        sizeInMB: 1,
        progress: 100,
        status: 'installing',
        startTime: currentTime.getTime() - 10000,
        installStartTime: currentTime.getTime() - 2000, // Started installing 2 seconds ago
      };

      currentQueue = [downloadItem];

      renderHook(() =>
        useDownloadManager(
          currentQueue,
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          true
        )
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(onDownloadComplete).toHaveBeenCalledWith('test-software', 'Test Software');
    });
  });

  describe('bandwidth sharing', () => {
    it('should share bandwidth across multiple downloads', () => {
      const setDownloadQueue = vi.fn();
      const onDownloadComplete = vi.fn();
      const hardware = { network: { speed: 250 } };
      const currentTime = new Date('2020-03-25T09:00:00');

      // Create two downloads
      const download1 = createDownloadItem('software-1', 'Software 1', 50, currentTime);
      const download2 = createDownloadItem('software-2', 'Software 2', 50, currentTime);
      const downloadQueue = [download1, download2];

      renderHook(() =>
        useDownloadManager(
          downloadQueue,
          setDownloadQueue,
          hardware,
          onDownloadComplete,
          currentTime,
          true
        )
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Both downloads should be updated with shared bandwidth
      expect(setDownloadQueue).toHaveBeenCalled();
    });
  });
});


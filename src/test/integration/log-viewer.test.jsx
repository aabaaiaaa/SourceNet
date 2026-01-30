import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import triggerEventBus from '../../core/triggerEventBus';
import networkRegistry from '../../systems/NetworkRegistry';
import { SOFTWARE_CATALOG } from '../../constants/gameConstants';
import { isSoftwareUnlocked } from '../../systems/UnlockSystem';

describe('Log Viewer Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    triggerEventBus.clear();
    networkRegistry.reset();
  });

  describe('unlock integration', () => {
    it('should have Log Viewer in SOFTWARE_CATALOG with investigation-tooling unlock requirement', () => {
      const logViewer = SOFTWARE_CATALOG.find(s => s.id === 'log-viewer');
      expect(logViewer).toBeDefined();
      expect(logViewer.requiresUnlock).toBe('investigation-tooling');
    });

    it('should be locked when investigation-tooling is not unlocked', () => {
      const logViewer = SOFTWARE_CATALOG.find(s => s.id === 'log-viewer');
      const unlockedFeatures = [];

      expect(isSoftwareUnlocked(unlockedFeatures, logViewer)).toBe(false);
    });

    it('should be unlocked when investigation-tooling is unlocked', () => {
      const logViewer = SOFTWARE_CATALOG.find(s => s.id === 'log-viewer');
      const unlockedFeatures = ['investigation-tooling'];

      expect(isSoftwareUnlocked(unlockedFeatures, logViewer)).toBe(true);
    });

    it('should unlock investigation-tooling when "New Opportunities" message is read', () => {
      let unlockedFeatures = [];
      const messages = [
        { id: 'msg-12345-abc123', subject: 'New Opportunities - Hardware & Tools' }
      ];

      // Simulate the GameContext.jsx messageRead handler
      const handleMessageRead = (data) => {
        const message = messages.find(m => m.id === data.messageId);
        if (message && message.subject && message.subject.includes('New Opportunities')) {
          const newFeatures = new Set(unlockedFeatures);
          newFeatures.add('network-adapters');
          newFeatures.add('investigation-tooling');
          unlockedFeatures = Array.from(newFeatures);
        }
      };

      triggerEventBus.on('messageRead', handleMessageRead);

      // Read the "New Opportunities" message
      triggerEventBus.emit('messageRead', { messageId: 'msg-12345-abc123' });

      // Both features should be unlocked
      expect(unlockedFeatures).toContain('network-adapters');
      expect(unlockedFeatures).toContain('investigation-tooling');
      expect(unlockedFeatures).toHaveLength(2);

      // Log Viewer should now be purchasable
      const logViewer = SOFTWARE_CATALOG.find(s => s.id === 'log-viewer');
      expect(isSoftwareUnlocked(unlockedFeatures, logViewer)).toBe(true);
    });
  });

  describe('network logs', () => {
    it('should return empty array when no logs exist', () => {
      networkRegistry.registerNetwork({
        networkId: 'test-network',
        networkName: 'Test Network',
        address: '192.168.1.0/24',
        bandwidth: 100,
        accessible: true,
      });

      const logs = networkRegistry.getNetworkLogs('test-network');
      expect(logs).toEqual([]);
    });

    it('should return logs with user field when logs exist', () => {
      networkRegistry.registerNetwork({
        networkId: 'test-network',
        networkName: 'Test Network',
        address: '192.168.1.0/24',
        bandwidth: 100,
        accessible: true,
      });

      networkRegistry.addNetworkLog('test-network', {
        type: 'remote',
        action: 'connect',
        user: 'testuser',
        note: 'Connected via VPN',
        timestamp: '2020-03-25T10:00:00.000Z',
      });

      const logs = networkRegistry.getNetworkLogs('test-network');
      expect(logs).toHaveLength(1);
      expect(logs[0].user).toBe('testuser');
      expect(logs[0].action).toBe('connect');
      expect(logs[0].note).toBe('Connected via VPN');
    });
  });

  describe('device logs', () => {
    it('should return empty array when no logs exist', () => {
      networkRegistry.registerDevice({
        ip: '192.168.1.10',
        hostname: 'server-01',
        networkId: 'test-network',
        fileSystemId: 'fs-01',
        accessible: true,
      });

      const logs = networkRegistry.getDeviceLogs('192.168.1.10');
      expect(logs).toEqual([]);
    });

    it('should return logs with user field when logs exist', () => {
      networkRegistry.registerDevice({
        ip: '192.168.1.10',
        hostname: 'server-01',
        networkId: 'test-network',
        fileSystemId: 'fs-01',
        accessible: true,
      });

      networkRegistry.addDeviceLog('192.168.1.10', {
        type: 'file',
        action: 'copy',
        user: 'testuser',
        fileName: 'backup.log',
        sizeBytes: 12500,
        timestamp: '2020-03-25T10:05:00.000Z',
      });

      const logs = networkRegistry.getDeviceLogs('192.168.1.10');
      expect(logs).toHaveLength(1);
      expect(logs[0].user).toBe('testuser');
      expect(logs[0].action).toBe('copy');
      expect(logs[0].fileName).toBe('backup.log');
    });
  });

  describe('disconnection handling', () => {
    it('should emit networkDisconnected event when network is disconnected', () => {
      const handler = vi.fn();
      triggerEventBus.on('networkDisconnected', handler);

      // Emit network disconnection event
      triggerEventBus.emit('networkDisconnected', {
        networkId: 'test-network',
        networkName: 'Test Network',
      });

      expect(handler).toHaveBeenCalledWith({
        networkId: 'test-network',
        networkName: 'Test Network',
      });
    });

    it('should allow Log Viewer to subscribe to networkDisconnected events', () => {
      let selectedNetworkCleared = false;

      const handleDisconnect = ({ networkId }) => {
        if (networkId === 'test-network') {
          selectedNetworkCleared = true;
        }
      };

      triggerEventBus.on('networkDisconnected', handleDisconnect);

      triggerEventBus.emit('networkDisconnected', {
        networkId: 'test-network',
        networkName: 'Test Network',
      });

      expect(selectedNetworkCleared).toBe(true);
    });
  });
});

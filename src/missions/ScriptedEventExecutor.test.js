import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeForceDisconnectAction,
  executeSetMissionStatusAction,
  executeRevokeNAREntryAction,
  isPlayerControlBlocked,
  initializePlayerControlTracking,
} from './ScriptedEventExecutor';
import triggerEventBus from '../core/triggerEventBus';

describe('ScriptedEventExecutor', () => {
  beforeEach(() => {
    // Re-initialize player control tracking after event bus is cleared by global setup
    initializePlayerControlTracking();
  });

  describe('executeForceDisconnectAction', () => {
    it('should emit forceNetworkDisconnect event', () => {
      let emitted = false;
      triggerEventBus.on('forceNetworkDisconnect', (data) => {
        emitted = true;
        expect(data.networkId).toBe('clienta-corporate');
        expect(data.reason).toContain('administrator');
      });

      const action = {
        type: 'forceDisconnect',
        network: 'clienta-corporate',
        reason: 'Network administrator terminated connection',
      };

      executeForceDisconnectAction(action);
      expect(emitted).toBe(true);
    });

    it('should call onComplete callback', () => {
      const onComplete = vi.fn();
      const action = { type: 'forceDisconnect', network: 'test' };

      executeForceDisconnectAction(action, onComplete);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('executeSetMissionStatusAction', () => {
    it('should emit missionStatusChanged event', () => {
      let emitted = false;
      triggerEventBus.on('missionStatusChanged', (data) => {
        emitted = true;
        expect(data.status).toBe('failed');
        expect(data.failureReason).toBe('Files deleted');
      });

      const action = {
        type: 'setMissionStatus',
        status: 'failed',
        failureReason: 'Files deleted',
      };

      executeSetMissionStatusAction(action);
      expect(emitted).toBe(true);
    });
  });

  describe('executeRevokeNAREntryAction', () => {
    it('should emit revokeNAREntry event with correct data', () => {
      let emitted = false;
      let eventData = null;

      triggerEventBus.on('revokeNAREntry', (data) => {
        emitted = true;
        eventData = data;
      });

      const action = {
        type: 'revokeNAREntry',
        network: 'clienta-corporate',
        reason: 'Access credentials revoked by network administrator',
      };

      executeRevokeNAREntryAction(action);

      expect(emitted).toBe(true);
      expect(eventData.networkId).toBe('clienta-corporate');
      expect(eventData.reason).toBe('Access credentials revoked by network administrator');
    });

    it('should use default reason when not provided', () => {
      let eventData = null;

      triggerEventBus.on('revokeNAREntry', (data) => {
        eventData = data;
      });

      const action = {
        type: 'revokeNAREntry',
        network: 'test-network',
      };

      executeRevokeNAREntryAction(action);

      expect(eventData.networkId).toBe('test-network');
      expect(eventData.reason).toBe('Access credentials revoked by network administrator');
    });

    it('should call onComplete callback', () => {
      const onComplete = vi.fn();
      const action = { type: 'revokeNAREntry', network: 'test' };

      executeRevokeNAREntryAction(action, onComplete);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('Player Control Blocking', () => {
    it('should track player control blocked state', () => {
      expect(isPlayerControlBlocked()).toBe(false);

      triggerEventBus.emit('playerControlBlocked', { blocked: true });
      expect(isPlayerControlBlocked()).toBe(true);

      triggerEventBus.emit('playerControlBlocked', { blocked: false });
      expect(isPlayerControlBlocked()).toBe(false);
    });
  });
});

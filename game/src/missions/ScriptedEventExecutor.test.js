import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeForceDisconnectAction,
  executeSetMissionStatusAction,
  isPlayerControlBlocked,
} from './ScriptedEventExecutor';
import triggerEventBus from '../core/triggerEventBus';

describe('ScriptedEventExecutor', () => {
  beforeEach(() => {
    // Don't clear trigger bus - ScriptedEventExecutor sets up
    // module-level subscriptions that would be removed
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

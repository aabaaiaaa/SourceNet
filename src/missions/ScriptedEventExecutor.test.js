import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeForceDisconnectAction,
  executeSetMissionStatusAction,
  executeRevokeNAREntryAction,
  executeAddExtensionObjectivesAction,
  executeScriptedEvent,
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

  describe('executeAddExtensionObjectivesAction', () => {
    it('should emit addMissionExtension event with objectives and files', () => {
      let eventData = null;
      triggerEventBus.on('addMissionExtension', (data) => {
        eventData = data;
      });

      const action = {
        type: 'addExtensionObjectives',
        objectives: [
          { id: 'obj-beta', type: 'networkConnection', target: 'darknode-beta' },
          { id: 'obj-crack', type: 'passwordCrack', targetFiles: ['notes.db'] },
        ],
        files: [{ name: 'notes.db', fileSystemId: 'fs-beta' }],
      };

      executeAddExtensionObjectivesAction(action);

      expect(eventData).not.toBeNull();
      expect(eventData.objectives).toHaveLength(2);
      expect(eventData.objectives[0].id).toBe('obj-beta');
      expect(eventData.files).toHaveLength(1);
    });

    it('should default to empty arrays when objectives/files not provided', () => {
      let eventData = null;
      triggerEventBus.on('addMissionExtension', (data) => {
        eventData = data;
      });

      executeAddExtensionObjectivesAction({});

      expect(eventData.objectives).toEqual([]);
      expect(eventData.files).toEqual([]);
    });

    it('should call onComplete callback', () => {
      const onComplete = vi.fn();
      executeAddExtensionObjectivesAction({ objectives: [] }, onComplete);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('executeScriptedEvent - new action types via switch', () => {
    it('should emit startTrace for startTrace action', async () => {
      let eventData = null;
      triggerEventBus.on('startTrace', (data) => {
        eventData = data;
      });

      const scriptedEvent = {
        id: 'evt-trace',
        actions: [{ type: 'startTrace', totalETT: 360000 }],
      };

      await executeScriptedEvent(scriptedEvent);

      expect(eventData).not.toBeNull();
      expect(eventData.totalETT).toBe(360000);
    });

    it('should emit generateRelayNodes for generateRelayNodes action', async () => {
      let eventData = null;
      triggerEventBus.on('generateRelayNodes', (data) => {
        eventData = data;
      });

      const scriptedEvent = {
        id: 'evt-relay',
        actions: [{ type: 'generateRelayNodes', count: 6 }],
      };

      await executeScriptedEvent(scriptedEvent);

      expect(eventData).not.toBeNull();
      expect(eventData.count).toBe(6);
    });

    it('should emit unlockFeature for unlockFeature action', async () => {
      let eventData = null;
      triggerEventBus.on('unlockFeature', (data) => {
        eventData = data;
      });

      const scriptedEvent = {
        id: 'evt-unlock',
        actions: [{ type: 'unlockFeature', featureId: 'relay-service' }],
      };

      await executeScriptedEvent(scriptedEvent);

      expect(eventData).not.toBeNull();
      expect(eventData.featureId).toBe('relay-service');
    });

    it('should not emit unlockFeature when featureId is missing', async () => {
      let emitted = false;
      triggerEventBus.on('unlockFeature', () => {
        emitted = true;
      });

      const scriptedEvent = {
        id: 'evt-unlock-no-id',
        actions: [{ type: 'unlockFeature' }],
      };

      await executeScriptedEvent(scriptedEvent);

      expect(emitted).toBe(false);
    });

    it('should emit addMissionExtension for addExtensionObjectives action', async () => {
      let eventData = null;
      triggerEventBus.on('addMissionExtension', (data) => {
        eventData = data;
      });

      const scriptedEvent = {
        id: 'evt-extend',
        actions: [{
          type: 'addExtensionObjectives',
          objectives: [{ id: 'obj-new', type: 'fileOperation' }],
          files: [],
        }],
      };

      await executeScriptedEvent(scriptedEvent);

      expect(eventData).not.toBeNull();
      expect(eventData.objectives).toHaveLength(1);
    });

    it('should call onComplete callback after all actions', async () => {
      const onComplete = vi.fn();

      const scriptedEvent = {
        id: 'evt-multi',
        actions: [
          { type: 'startTrace', totalETT: 120000 },
          { type: 'generateRelayNodes', count: 4 },
        ],
      };

      await executeScriptedEvent(scriptedEvent, { onComplete });

      expect(onComplete).toHaveBeenCalled();
    });
  });
});

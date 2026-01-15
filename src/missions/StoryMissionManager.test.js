import { describe, it, expect, beforeEach } from 'vitest';
import storyMissionManager from './StoryMissionManager';
import triggerEventBus from '../core/triggerEventBus';

describe('StoryMissionManager', () => {
  beforeEach(() => {
    storyMissionManager.clear();
    triggerEventBus.clear();
  });

  describe('Mission Registration', () => {
    it('should register mission', () => {
      const mission = {
        missionId: 'test-mission-1',
        title: 'Test Mission',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
      };

      storyMissionManager.registerMission(mission);

      const registered = storyMissionManager.getMission('test-mission-1');
      expect(registered).toEqual(mission);
    });

    it('should register multiple missions', () => {
      storyMissionManager.registerMission({ missionId: 'mission-1', triggers: {} });
      storyMissionManager.registerMission({ missionId: 'mission-2', triggers: {} });

      const all = storyMissionManager.getAllMissions();
      expect(all.length).toBe(2);
    });

    it('should unregister mission', () => {
      storyMissionManager.registerMission({ missionId: 'test-mission', triggers: {} });
      storyMissionManager.unregisterMission('test-mission');

      const mission = storyMissionManager.getMission('test-mission');
      expect(mission).toBe(null);
    });
  });

  describe('Trigger Subscription', () => {
    it('should subscribe to start trigger event', () => {
      const mission = {
        missionId: 'test-mission',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'missionBoardInstalled',
            delay: 0,
          },
        },
      };

      storyMissionManager.registerMission(mission);

      // Check that subscription exists
      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.missionBoardInstalled).toBe(1);
    });

    it('should activate mission when trigger fires', (done) => {
      const mission = {
        missionId: 'test-mission',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'testEvent',
            delay: 10,
          },
        },
      };

      storyMissionManager.registerMission(mission);

      // Subscribe to missionAvailable event
      triggerEventBus.once('missionAvailable', (data) => {
        expect(data.missionId).toBe('test-mission');
        done();
      });

      // Fire trigger event
      triggerEventBus.emit('testEvent');
    });
  });

  describe('Scripted Event Triggers', () => {
    it('should subscribe to scripted event triggers', () => {
      const mission = {
        missionId: 'test-mission',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        scriptedEvents: [
          {
            id: 'sabotage',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-4',
              delay: 5000,
            },
            actions: [],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.objectiveComplete).toBe(1);
    });

    it('should trigger scripted event when objective completes', (done) => {
      const mission = {
        missionId: 'tutorial-1',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        scriptedEvents: [
          {
            id: 'sabotage',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-4',
              delay: 10,
            },
            actions: [{ type: 'forceFileOperation', operation: 'delete' }],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      triggerEventBus.once('scriptedEventStart', (data) => {
        expect(data.missionId).toBe('tutorial-1');
        expect(data.eventId).toBe('sabotage');
        done();
      });

      // Fire objective complete event
      triggerEventBus.emit('objectiveComplete', {
        missionId: 'tutorial-1',
        objectiveId: 'obj-4',
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe when unregistering mission', () => {
      const mission = {
        missionId: 'test-mission',
        triggers: {
          start: { type: 'timeSinceEvent', event: 'testEvent', delay: 0 },
        },
      };

      storyMissionManager.registerMission(mission);
      expect(triggerEventBus.getSubscriptions().testEvent).toBe(1);

      storyMissionManager.unregisterMission('test-mission');
      expect(triggerEventBus.getSubscriptions().testEvent).toBeUndefined();
    });

    it('should clear all missions and subscriptions', () => {
      storyMissionManager.registerMission({
        missionId: 'mission-1',
        triggers: { start: { type: 'timeSinceEvent', event: 'event1', delay: 0 } },
      });
      storyMissionManager.registerMission({
        missionId: 'mission-2',
        triggers: { start: { type: 'timeSinceEvent', event: 'event2', delay: 0 } },
      });

      storyMissionManager.clear();

      expect(storyMissionManager.getAllMissions().length).toBe(0);
      expect(Object.keys(triggerEventBus.getSubscriptions()).length).toBe(0);
    });
  });

  describe('Multi-Condition Triggers', () => {
    beforeEach(() => {
      // Set up game state getter for condition checking
      storyMissionManager.setGameStateGetter(() => ({
        messages: [
          { id: 'msg-1', read: true },
          { id: 'msg-2', read: false },
        ],
        software: ['app-1', 'app-2'],
      }));
    });

    it('should evaluate messageRead condition correctly', () => {
      const result1 = storyMissionManager.evaluateCondition(
        { type: 'messageRead', messageId: 'msg-1' },
        {},
        { messages: [{ id: 'msg-1', read: true }] }
      );
      expect(result1).toBe(true);

      const result2 = storyMissionManager.evaluateCondition(
        { type: 'messageRead', messageId: 'msg-2' },
        {},
        { messages: [{ id: 'msg-2', read: false }] }
      );
      expect(result2).toBe(false);
    });

    it('should evaluate softwareInstalled condition correctly', () => {
      const result1 = storyMissionManager.evaluateCondition(
        { type: 'softwareInstalled', softwareId: 'app-1' },
        {},
        { software: ['app-1', 'app-2'] }
      );
      expect(result1).toBe(true);

      const result2 = storyMissionManager.evaluateCondition(
        { type: 'softwareInstalled', softwareId: 'app-3' },
        {},
        { software: ['app-1', 'app-2'] }
      );
      expect(result2).toBe(false);
    });

    it('should evaluate eventData condition correctly', () => {
      const result1 = storyMissionManager.evaluateCondition(
        { type: 'eventData', match: { missionId: 'test-mission' } },
        { missionId: 'test-mission' },
        {}
      );
      expect(result1).toBe(true);

      const result2 = storyMissionManager.evaluateCondition(
        { type: 'eventData', match: { missionId: 'other-mission' } },
        { missionId: 'test-mission' },
        {}
      );
      expect(result2).toBe(false);
    });

    it('should check all conditions with AND logic', () => {
      const conditions = [
        { type: 'messageRead', messageId: 'msg-1' },
        { type: 'softwareInstalled', softwareId: 'app-1' },
      ];

      // Both conditions met
      const result1 = storyMissionManager.checkAllConditions(conditions, {});
      expect(result1).toBe(true);

      // Change game state so one condition fails
      storyMissionManager.setGameStateGetter(() => ({
        messages: [{ id: 'msg-1', read: false }],
        software: ['app-1'],
      }));

      const result2 = storyMissionManager.checkAllConditions(conditions, {});
      expect(result2).toBe(false);
    });

    it('should auto-detect events from conditions', () => {
      const conditions = [
        { type: 'messageRead', messageId: 'msg-1' },
        { type: 'softwareInstalled', softwareId: 'app-1' },
      ];

      const events = storyMissionManager.getEventsFromConditions(conditions, null);
      expect(events).toContain('messageRead');
      expect(events).toContain('softwareInstalled');
      expect(events.length).toBe(2);
    });

    it('should use explicit event when provided', () => {
      const conditions = [
        { type: 'eventData', match: { missionId: 'test' } },
      ];

      const events = storyMissionManager.getEventsFromConditions(conditions, 'missionAccepted');
      expect(events).toEqual(['missionAccepted']);
    });

    it('should subscribe to multiple events for multi-condition triggers', () => {
      const storyEvent = {
        missionId: 'test-story',
        events: [
          {
            id: 'multi-condition-event',
            trigger: {
              type: 'timeSinceEvent',
              conditions: [
                { type: 'messageRead', messageId: 'msg-1' },
                { type: 'softwareInstalled', softwareId: 'app-1' },
              ],
              delay: 0,
            },
            message: { subject: 'Test' },
          },
        ],
      };

      storyMissionManager.registerMission(storyEvent);

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.messageRead).toBe(1);
      expect(subscriptions.softwareInstalled).toBe(1);
    });

    it('should fire event when all conditions are met', async () => {
      const storyEvent = {
        missionId: 'test-story',
        events: [
          {
            id: 'multi-condition-event',
            trigger: {
              type: 'timeSinceEvent',
              conditions: [
                { type: 'messageRead', messageId: 'msg-1' },
                { type: 'softwareInstalled', softwareId: 'app-1' },
              ],
              delay: 10,
            },
            message: { subject: 'Multi-Condition Test' },
          },
        ],
      };

      storyMissionManager.registerMission(storyEvent);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('storyEventTriggered', (data) => {
          resolve(data);
        });
      });

      // Trigger one of the subscribed events - conditions are already met via gameStateGetter
      triggerEventBus.emit('messageRead', { messageId: 'msg-1' });

      const data = await eventPromise;
      expect(data.eventId).toBe('multi-condition-event');
    });

    it('should not fire event when not all conditions are met', async () => {
      // Set up game state where software is NOT installed
      storyMissionManager.setGameStateGetter(() => ({
        messages: [{ id: 'msg-1', read: true }],
        software: [], // app-1 NOT installed
      }));

      const storyEvent = {
        missionId: 'test-story',
        events: [
          {
            id: 'multi-condition-event',
            trigger: {
              type: 'timeSinceEvent',
              conditions: [
                { type: 'messageRead', messageId: 'msg-1' },
                { type: 'softwareInstalled', softwareId: 'app-1' },
              ],
              delay: 10,
            },
            message: { subject: 'Multi-Condition Test' },
          },
        ],
      };

      storyMissionManager.registerMission(storyEvent);

      let eventFired = false;
      triggerEventBus.once('storyEventTriggered', () => {
        eventFired = true;
      });

      // Trigger the event - but conditions not met
      triggerEventBus.emit('messageRead', { messageId: 'msg-1' });

      // Wait a bit and verify event didn't fire
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(eventFired).toBe(false);
    });
  });

  describe('File Name Resolution in Scripted Events', () => {
    it('should resolve "all-corrupted" to actual file names from mission networks', async () => {
      const mission = {
        missionId: 'tutorial-part-1',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        networks: [
          {
            networkId: 'clienta-corporate',
            fileSystems: [
              {
                id: 'fs-clienta-01',
                files: [
                  { name: 'log_2024_01.txt', corrupted: true },
                  { name: 'log_2024_02.txt', corrupted: true },
                  { name: 'log_2024_03.txt', corrupted: true },
                  { name: 'system.log', corrupted: false },
                ],
              },
            ],
          },
        ],
        scriptedEvents: [
          {
            id: 'sabotage-deletion',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-4',
              delay: 10,
            },
            actions: [
              {
                type: 'forceFileOperation',
                operation: 'delete',
                files: 'all-corrupted',
              },
            ],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('scriptedEventStart', (data) => {
          resolve(data.actions);
        });
      });

      // Trigger the scripted event
      triggerEventBus.emit('objectiveComplete', {
        missionId: 'tutorial-part-1',
        objectiveId: 'obj-4',
      });

      const capturedActions = await eventPromise;
      expect(capturedActions).toBeTruthy();
      expect(capturedActions.length).toBe(1);
      expect(capturedActions[0].resolvedFileNames).toEqual([
        'log_2024_01.txt',
        'log_2024_02.txt',
        'log_2024_03.txt',
      ]);
    });

    it('should resolve "all-repaired" to actual file names from mission networks', async () => {
      const mission = {
        missionId: 'tutorial-part-1',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        networks: [
          {
            networkId: 'clienta-corporate',
            fileSystems: [
              {
                id: 'fs-clienta-01',
                files: [
                  { name: 'log_2024_01.txt', corrupted: true },
                  { name: 'log_2024_02.txt', corrupted: true },
                  { name: 'system.log', corrupted: false },
                ],
              },
            ],
          },
        ],
        scriptedEvents: [
          {
            id: 'sabotage-deletion',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-4',
              delay: 10,
            },
            actions: [
              {
                type: 'forceFileOperation',
                operation: 'delete',
                files: 'all-repaired',
              },
            ],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('scriptedEventStart', (data) => {
          resolve(data.actions);
        });
      });

      // Trigger the scripted event
      triggerEventBus.emit('objectiveComplete', {
        missionId: 'tutorial-part-1',
        objectiveId: 'obj-4',
      });

      const capturedActions = await eventPromise;
      expect(capturedActions).toBeTruthy();
      expect(capturedActions.length).toBe(1);
      // Should resolve to corrupted files (files that would be repaired)
      expect(capturedActions[0].resolvedFileNames).toEqual([
        'log_2024_01.txt',
        'log_2024_02.txt',
      ]);
    });

    it('should handle multiple file systems when resolving file names', async () => {
      const mission = {
        missionId: 'test-mission',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        networks: [
          {
            networkId: 'network-1',
            fileSystems: [
              {
                id: 'fs-1',
                files: [
                  { name: 'file1.txt', corrupted: true },
                  { name: 'file2.txt', corrupted: true },
                ],
              },
              {
                id: 'fs-2',
                files: [
                  { name: 'file3.txt', corrupted: true },
                  { name: 'file4.txt', corrupted: false },
                ],
              },
            ],
          },
        ],
        scriptedEvents: [
          {
            id: 'delete-all',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-1',
              delay: 10,
            },
            actions: [
              {
                type: 'forceFileOperation',
                operation: 'delete',
                files: 'all-corrupted',
              },
            ],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('scriptedEventStart', (data) => {
          resolve(data.actions);
        });
      });

      triggerEventBus.emit('objectiveComplete', {
        missionId: 'test-mission',
        objectiveId: 'obj-1',
      });

      const capturedActions = await eventPromise;
      expect(capturedActions[0].resolvedFileNames).toEqual([
        'file1.txt',
        'file2.txt',
        'file3.txt',
      ]);
    });

    it('should not modify actions without file indicators', async () => {
      const mission = {
        missionId: 'test-mission',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        scriptedEvents: [
          {
            id: 'disconnect',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-1',
              delay: 10,
            },
            actions: [
              {
                type: 'forceDisconnect',
                network: 'test-network',
              },
            ],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('scriptedEventStart', (data) => {
          resolve(data.actions);
        });
      });

      triggerEventBus.emit('objectiveComplete', {
        missionId: 'test-mission',
        objectiveId: 'obj-1',
      });

      const capturedActions = await eventPromise;
      expect(capturedActions[0].resolvedFileNames).toBeUndefined();
      expect(capturedActions[0].type).toBe('forceDisconnect');
    });

    it('should return empty array when no corrupted files exist', async () => {
      const mission = {
        missionId: 'test-mission',
        triggers: { start: { type: 'timeSinceEvent', event: 'gameStart', delay: 0 } },
        networks: [
          {
            networkId: 'network-1',
            fileSystems: [
              {
                id: 'fs-1',
                files: [
                  { name: 'file1.txt', corrupted: false },
                  { name: 'file2.txt', corrupted: false },
                ],
              },
            ],
          },
        ],
        scriptedEvents: [
          {
            id: 'delete-all',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-1',
              delay: 10,
            },
            actions: [
              {
                type: 'forceFileOperation',
                operation: 'delete',
                files: 'all-corrupted',
              },
            ],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      const eventPromise = new Promise((resolve) => {
        triggerEventBus.once('scriptedEventStart', (data) => {
          resolve(data.actions);
        });
      });

      triggerEventBus.emit('objectiveComplete', {
        missionId: 'test-mission',
        objectiveId: 'obj-1',
      });

      const capturedActions = await eventPromise;
      expect(capturedActions[0].resolvedFileNames).toEqual([]);
    });
  });
});

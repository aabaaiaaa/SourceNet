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
});

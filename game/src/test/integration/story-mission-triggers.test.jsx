import { describe, it, expect, beforeEach } from 'vitest';
import storyMissionManager from '../../missions/StoryMissionManager';
import triggerEventBus from '../../core/triggerEventBus';

describe('Story Mission Trigger System Integration', () => {
  beforeEach(() => {
    storyMissionManager.clear();
    triggerEventBus.clear();
  });

  describe('timeSinceEvent Trigger', () => {
    it('should activate mission when event fires', (done) => {
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

      triggerEventBus.once('missionAvailable', (data) => {
        expect(data.missionId).toBe('test-mission');
        done();
      });

      triggerEventBus.emit('testEvent');
    });

    it('should support condition filtering', (done) => {
      const mission = {
        missionId: 'conditional-mission',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'softwareInstalled',
            condition: {
              softwareId: 'mission-board',
            },
            delay: 0,
          },
        },
      };

      storyMissionManager.registerMission(mission);

      let missionTriggered = false;

      triggerEventBus.on('missionAvailable', (data) => {
        if (data.missionId === 'conditional-mission') {
          missionTriggered = true;
        }
      });

      // Emit with wrong softwareId - should NOT trigger
      triggerEventBus.emit('softwareInstalled', { softwareId: 'other-software' });

      setTimeout(() => {
        expect(missionTriggered).toBe(false);

        // Emit with correct softwareId - should trigger
        triggerEventBus.emit('softwareInstalled', { softwareId: 'mission-board' });

        setTimeout(() => {
          expect(missionTriggered).toBe(true);
          done();
        }, 50);
      }, 50);
    });

    it('should support messageId filtering for message read events', (done) => {
      const mission = {
        missionId: 'message-triggered-mission',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'messageRead',
            condition: {
              messageId: 'msg-welcome-manager',
            },
            delay: 10,
          },
        },
      };

      storyMissionManager.registerMission(mission);

      triggerEventBus.once('missionAvailable', (data) => {
        expect(data.missionId).toBe('message-triggered-mission');
        done();
      });

      // Emit messageRead with correct messageId
      triggerEventBus.emit('messageRead', { messageId: 'msg-welcome-manager' });
    });

    it('should respect delay parameter', (done) => {
      const mission = {
        missionId: 'delayed-mission',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'testEvent',
            delay: 100,
          },
        },
      };

      storyMissionManager.registerMission(mission);

      let triggered = false;

      triggerEventBus.on('missionAvailable', () => {
        triggered = true;
      });

      triggerEventBus.emit('testEvent');

      // Should not be triggered immediately
      setTimeout(() => {
        expect(triggered).toBe(false);

        // Should be triggered after delay
        setTimeout(() => {
          expect(triggered).toBe(true);
          done();
        }, 60);
      }, 50);
    });
  });

  describe('afterObjectiveComplete Trigger', () => {
    it('should activate scripted events when objective completes', (done) => {
      const mission = {
        missionId: 'mission-with-events',
        triggers: {
          start: {
            type: 'timeSinceEvent',
            event: 'gameStart',
            delay: 0,
          },
        },
        scriptedEvents: [
          {
            id: 'test-event',
            trigger: {
              type: 'afterObjectiveComplete',
              objectiveId: 'obj-1',
              delay: 10,
            },
            actions: [],
          },
        ],
      };

      storyMissionManager.registerMission(mission);

      triggerEventBus.once('scriptedEventStart', (data) => {
        expect(data.eventId).toBe('test-event');
        done();
      });

      // Emit objective complete
      triggerEventBus.emit('objectiveComplete', {
        missionId: 'mission-with-events',
        objectiveId: 'obj-1',
      });
    });
  });
});

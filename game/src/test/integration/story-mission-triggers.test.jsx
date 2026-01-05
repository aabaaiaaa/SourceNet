import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import storyMissionManager from '../../missions/StoryMissionManager';
import triggerEventBus from '../../core/triggerEventBus';

describe('Story Mission Trigger System Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storyMissionManager.clear();
    triggerEventBus.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('timeSinceEvent Trigger', () => {
    it('should activate mission when event fires', () => {
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

      const handler = vi.fn();
      triggerEventBus.once('missionAvailable', handler);

      triggerEventBus.emit('testEvent');

      vi.advanceTimersByTime(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ missionId: 'test-mission' })
      );
    });

    it('should support condition filtering', () => {
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

      const handler = vi.fn();
      triggerEventBus.on('missionAvailable', handler);

      // Emit with wrong softwareId - should NOT trigger
      triggerEventBus.emit('softwareInstalled', { softwareId: 'other-software' });
      vi.advanceTimersByTime(10);

      expect(handler).not.toHaveBeenCalled();

      // Emit with correct softwareId - should trigger
      triggerEventBus.emit('softwareInstalled', { softwareId: 'mission-board' });
      vi.advanceTimersByTime(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ missionId: 'conditional-mission' })
      );
    });

    it('should support messageId filtering for message read events', () => {
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

      const handler = vi.fn();
      triggerEventBus.once('missionAvailable', handler);

      // Emit messageRead with correct messageId
      triggerEventBus.emit('messageRead', { messageId: 'msg-welcome-manager' });
      vi.advanceTimersByTime(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ missionId: 'message-triggered-mission' })
      );
    });

    it('should respect delay parameter', () => {
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

      const handler = vi.fn();
      triggerEventBus.on('missionAvailable', handler);

      triggerEventBus.emit('testEvent');

      // Should not be triggered before delay
      vi.advanceTimersByTime(50);
      expect(handler).not.toHaveBeenCalled();

      // Should be triggered after delay
      vi.advanceTimersByTime(50);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ missionId: 'delayed-mission' })
      );
    });
  });

  describe('afterObjectiveComplete Trigger', () => {
    it('should activate scripted events when objective completes', () => {
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

      const handler = vi.fn();
      triggerEventBus.once('scriptedEventStart', handler);

      // Emit objective complete
      triggerEventBus.emit('objectiveComplete', {
        missionId: 'mission-with-events',
        objectiveId: 'obj-1',
      });

      vi.advanceTimersByTime(10);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'test-event' })
      );
    });
  });
});

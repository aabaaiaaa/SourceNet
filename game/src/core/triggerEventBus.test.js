import { describe, it, expect, beforeEach } from 'vitest';
import triggerEventBus from './triggerEventBus';

describe('TriggerEventBus', () => {
  beforeEach(() => {
    // Clear all subscriptions before each test
    triggerEventBus.clear();
  });

  describe('Event Subscription', () => {
    it('should subscribe to events', () => {
      const callback = () => {};
      triggerEventBus.on('testEvent', callback);

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBe(1);
    });

    it('should support multiple subscribers to same event', () => {
      triggerEventBus.on('testEvent', () => {});
      triggerEventBus.on('testEvent', () => {});
      triggerEventBus.on('testEvent', () => {});

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBe(3);
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = triggerEventBus.on('testEvent', () => {});
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Event Emission', () => {
    it('should emit events to subscribers', () => {
      let called = false;
      triggerEventBus.on('testEvent', () => {
        called = true;
      });

      triggerEventBus.emit('testEvent');
      expect(called).toBe(true);
    });

    it('should pass event data to subscribers', () => {
      let receivedData = null;
      triggerEventBus.on('testEvent', (data) => {
        receivedData = data;
      });

      const testData = { missionId: 'tutorial-1', credits: 1000 };
      triggerEventBus.emit('testEvent', testData);

      expect(receivedData).toEqual(testData);
    });

    it('should call all subscribers for an event', () => {
      let count = 0;
      triggerEventBus.on('testEvent', () => count++);
      triggerEventBus.on('testEvent', () => count++);
      triggerEventBus.on('testEvent', () => count++);

      triggerEventBus.emit('testEvent');
      expect(count).toBe(3);
    });

    it('should not affect other events', () => {
      let event1Called = false;
      let event2Called = false;

      triggerEventBus.on('event1', () => { event1Called = true; });
      triggerEventBus.on('event2', () => { event2Called = true; });

      triggerEventBus.emit('event1');

      expect(event1Called).toBe(true);
      expect(event2Called).toBe(false);
    });

    it('should handle errors in event handlers gracefully', () => {
      let secondCallbackCalled = false;

      triggerEventBus.on('testEvent', () => {
        throw new Error('Test error');
      });
      triggerEventBus.on('testEvent', () => {
        secondCallbackCalled = true;
      });

      // Should not throw, second callback should still run
      expect(() => triggerEventBus.emit('testEvent')).not.toThrow();
      expect(secondCallbackCalled).toBe(true);
    });
  });

  describe('Unsubscription', () => {
    it('should unsubscribe via returned function', () => {
      const callback = () => {};
      const unsubscribe = triggerEventBus.on('testEvent', callback);

      unsubscribe();

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBeUndefined();
    });

    it('should unsubscribe via off method', () => {
      const callback = () => {};
      triggerEventBus.on('testEvent', callback);
      triggerEventBus.off('testEvent', callback);

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBeUndefined();
    });

    it('should only remove specified callback', () => {
      const callback1 = () => {};
      const callback2 = () => {};

      triggerEventBus.on('testEvent', callback1);
      triggerEventBus.on('testEvent', callback2);
      triggerEventBus.off('testEvent', callback1);

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBe(1);
    });
  });

  describe('Once Subscription', () => {
    it('should call callback only once', () => {
      let callCount = 0;
      triggerEventBus.once('testEvent', () => {
        callCount++;
      });

      triggerEventBus.emit('testEvent');
      triggerEventBus.emit('testEvent');
      triggerEventBus.emit('testEvent');

      expect(callCount).toBe(1);
    });

    it('should auto-unsubscribe after first call', () => {
      triggerEventBus.once('testEvent', () => {});
      triggerEventBus.emit('testEvent');

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(subscriptions.testEvent).toBeUndefined();
    });
  });

  describe('Event History', () => {
    it('should track event history', () => {
      triggerEventBus.emit('event1', { data: 'test1' });
      triggerEventBus.emit('event2', { data: 'test2' });

      const history = triggerEventBus.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('event1');
      expect(history[1].type).toBe('event2');
    });

    it('should limit history to maxHistorySize', () => {
      // Emit more than max (100)
      for (let i = 0; i < 150; i++) {
        triggerEventBus.emit('testEvent', { index: i });
      }

      const history = triggerEventBus.getHistory(150); // Get all history
      expect(history.length).toBe(100); // Should be limited to maxHistorySize
      // Should keep most recent
      expect(history[99].data.index).toBe(149);
    });

    it('should include timestamp in history', () => {
      triggerEventBus.emit('testEvent');
      const history = triggerEventBus.getHistory();

      expect(history[0].timestamp).toBeDefined();
      expect(typeof history[0].timestamp).toBe('string');
    });
  });

  describe('Clear', () => {
    it('should clear all subscriptions', () => {
      triggerEventBus.on('event1', () => {});
      triggerEventBus.on('event2', () => {});
      triggerEventBus.on('event3', () => {});

      triggerEventBus.clear();

      const subscriptions = triggerEventBus.getSubscriptions();
      expect(Object.keys(subscriptions).length).toBe(0);
    });

    it('should clear event history', () => {
      triggerEventBus.emit('testEvent');
      triggerEventBus.emit('testEvent');

      triggerEventBus.clear();

      const history = triggerEventBus.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support mission acceptance flow', () => {
      let missionAccepted = false;
      let objectiveCompleted = false;

      triggerEventBus.on('missionAccepted', (data) => {
        missionAccepted = true;
        expect(data.missionId).toBe('tutorial-1');
      });

      triggerEventBus.on('objectiveComplete', (data) => {
        objectiveCompleted = true;
        expect(data.objectiveId).toBe('obj-1');
      });

      triggerEventBus.emit('missionAccepted', { missionId: 'tutorial-1' });
      triggerEventBus.emit('objectiveComplete', { objectiveId: 'obj-1' });

      expect(missionAccepted).toBe(true);
      expect(objectiveCompleted).toBe(true);
    });
  });
});

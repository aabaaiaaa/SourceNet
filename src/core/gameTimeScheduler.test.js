import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleGameTimeCallback, clearGameTimeCallback, rescheduleAllTimers } from './gameTimeScheduler';

describe('gameTimeScheduler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('scheduleGameTimeCallback', () => {
        it('should schedule callback with correct real-time delay at 1x speed', () => {
            const callback = vi.fn();
            const gameTimeDelay = 2000; // 2 seconds game time
            const timeSpeed = 1;

            scheduleGameTimeCallback(callback, gameTimeDelay, timeSpeed);

            // Should not be called yet
            expect(callback).not.toHaveBeenCalled();

            // Advance by 2000ms real time (same as game time at 1x)
            vi.advanceTimersByTime(2000);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should schedule callback with correct real-time delay at 10x speed', () => {
            const callback = vi.fn();
            const gameTimeDelay = 20000; // 20 seconds game time
            const timeSpeed = 10;

            scheduleGameTimeCallback(callback, gameTimeDelay, timeSpeed);

            // Should not be called yet
            expect(callback).not.toHaveBeenCalled();

            // At 10x speed, 20 seconds game time = 2 seconds real time
            vi.advanceTimersByTime(2000);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle 0 delay', () => {
            const callback = vi.fn();
            scheduleGameTimeCallback(callback, 0, 1);

            vi.advanceTimersByTime(0);

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('clearGameTimeCallback', () => {
        it('should cancel scheduled callback', () => {
            const callback = vi.fn();
            const timerId = scheduleGameTimeCallback(callback, 1000, 1);

            clearGameTimeCallback(timerId);

            vi.advanceTimersByTime(1000);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('rescheduleAllTimers', () => {
        it('should speed up pending timer when speed increases', () => {
            const callback = vi.fn();

            // Schedule a 20-second game time delay at 1x speed (20s real time)
            scheduleGameTimeCallback(callback, 20000, 1);

            // Advance 10 seconds real time (10s game time elapsed, 10s remaining)
            vi.advanceTimersByTime(10000);
            expect(callback).not.toHaveBeenCalled();

            // Switch to 10x speed
            rescheduleAllTimers(10);

            // Remaining 10 seconds game time at 10x = 1 second real time
            vi.advanceTimersByTime(1000);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should slow down pending timer when speed decreases', () => {
            const callback = vi.fn();

            // Schedule a 10-second game time delay at 10x speed (1s real time)
            scheduleGameTimeCallback(callback, 10000, 10);

            // Advance 0.5 seconds real time (5s game time elapsed, 5s remaining)
            vi.advanceTimersByTime(500);
            expect(callback).not.toHaveBeenCalled();

            // Switch to 1x speed
            rescheduleAllTimers(1);

            // Remaining 5 seconds game time at 1x = 5 seconds real time
            vi.advanceTimersByTime(5000);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple timers with different remaining times', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            // Schedule 3 timers at 1x speed
            scheduleGameTimeCallback(callback1, 10000, 1); // 10s
            scheduleGameTimeCallback(callback2, 20000, 1); // 20s
            scheduleGameTimeCallback(callback3, 30000, 1); // 30s

            // Advance 5 seconds
            vi.advanceTimersByTime(5000);

            // Switch to 10x speed
            // Remaining: 5s, 15s, 25s game time
            // At 10x: 0.5s, 1.5s, 2.5s real time
            rescheduleAllTimers(10);

            vi.advanceTimersByTime(500);
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
            expect(callback3).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback3).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1000);
            expect(callback3).toHaveBeenCalledTimes(1);
        });

        it('should fire immediately if remaining time is zero or negative', () => {
            const callback = vi.fn();

            // Schedule a 5-second game time delay at 1x speed
            scheduleGameTimeCallback(callback, 5000, 1);

            // Advance 6 seconds (more than the delay)
            vi.advanceTimersByTime(6000);

            // Callback should have already fired
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});

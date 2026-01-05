import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleGameTimeCallback, clearGameTimeCallback } from './gameTimeScheduler';

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
});

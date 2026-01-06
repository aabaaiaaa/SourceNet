/**
 * Game Time Scheduler - Schedule callbacks based on in-game time
 *
 * This module provides a way to schedule callbacks that respect the game's
 * time speed multiplier. When the game runs at 10x speed, scheduled callbacks
 * will trigger 10x faster in real time.
 *
 * IMPORTANT: Timers can be dynamically rescheduled when time speed changes.
 * Call rescheduleAllTimers(newSpeed) to update all pending timers.
 *
 * Usage:
 *   const timerId = scheduleGameTimeCallback(() => {
 *     console.log('1000 game ms passed');
 *   }, 1000, timeSpeed);
 *
 *   // To cancel:
 *   clearGameTimeCallback(timerId);
 *
 *   // To reschedule all pending timers with new speed:
 *   rescheduleAllTimers(newSpeed);
 */

// Registry of active timers
let nextTimerId = 1;
const activeTimers = new Map(); // timerId -> { callback, startTime, originalDelayMs, currentSpeed, realTimerId }

/**
 * Schedule a callback to run after a game-time delay
 * @param {Function} callback - Function to call after delay
 * @param {number} gameTimeDelayMs - Delay in game-time milliseconds
 * @param {number} timeSpeed - Current time speed multiplier (1, 10, or 100)
 * @returns {number} Timer ID that can be used to cancel
 */
export const scheduleGameTimeCallback = (callback, gameTimeDelayMs, timeSpeed) => {
    const timerId = nextTimerId++;
    const startTime = Date.now();

    // Convert game-time delay to real-time delay
    const realTimeDelayMs = gameTimeDelayMs / timeSpeed;

    const wrappedCallback = () => {
        // Remove from active timers when it fires
        activeTimers.delete(timerId);
        callback();
    };

    const realTimerId = setTimeout(wrappedCallback, realTimeDelayMs);

    // Track this timer
    activeTimers.set(timerId, {
        callback,
        startTime,
        originalDelayMs: gameTimeDelayMs,
        currentSpeed: timeSpeed,
        realTimerId
    });

    return timerId;
};

/**
 * Clear a scheduled game-time callback
 * @param {number} timerId - Timer ID returned from scheduleGameTimeCallback
 */
export const clearGameTimeCallback = (timerId) => {
    const timer = activeTimers.get(timerId);
    if (timer) {
        clearTimeout(timer.realTimerId);
        activeTimers.delete(timerId);
    }
};

/**
 * Reschedule all active timers with a new time speed
 * This allows timers to speed up or slow down mid-delay
 * @param {number} newSpeed - New time speed multiplier
 */
export const rescheduleAllTimers = (newSpeed) => {
    console.log(`🔄 Rescheduling ${activeTimers.size} active timers with new speed: ${newSpeed}`);

    const now = Date.now();
    const timersToReschedule = Array.from(activeTimers.entries());

    timersToReschedule.forEach(([timerId, timer]) => {
        // Calculate elapsed game time
        const elapsedRealTime = now - timer.startTime;
        const elapsedGameTime = elapsedRealTime * timer.currentSpeed;

        // Calculate remaining game time
        const remainingGameTime = Math.max(0, timer.originalDelayMs - elapsedGameTime);

        console.log(`  Timer ${timerId}: elapsed=${elapsedGameTime}ms, remaining=${remainingGameTime}ms, oldSpeed=${timer.currentSpeed}, newSpeed=${newSpeed}`);

        // Cancel the old timer
        clearTimeout(timer.realTimerId);

        // Schedule with new speed
        const newRealDelay = remainingGameTime / newSpeed;

        const wrappedCallback = () => {
            activeTimers.delete(timerId);
            timer.callback();
        };

        const newRealTimerId = setTimeout(wrappedCallback, newRealDelay);

        // Update the timer record
        activeTimers.set(timerId, {
            ...timer,
            startTime: now,
            originalDelayMs: remainingGameTime, // Remaining becomes the new "original"
            currentSpeed: newSpeed,
            realTimerId: newRealTimerId
        });
    });
};

/**
 * Get current time speed from GameContext
 * This is a helper to be used when the component has access to GameContext
 */
let currentTimeSpeed = 1;

export const setCurrentTimeSpeed = (speed) => {
    currentTimeSpeed = speed;
};

export const getCurrentTimeSpeed = () => {
    return currentTimeSpeed;
};

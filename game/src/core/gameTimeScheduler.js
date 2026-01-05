/**
 * Game Time Scheduler - Schedule callbacks based on in-game time
 *
 * This module provides a way to schedule callbacks that respect the game's
 * time speed multiplier. When the game runs at 10x speed, scheduled callbacks
 * will trigger 10x faster in real time.
 *
 * Usage:
 *   const timerId = scheduleGameTimeCallback(() => {
 *     console.log('1000 game ms passed');
 *   }, 1000, timeSpeed);
 *
 *   // To cancel:
 *   clearGameTimeCallback(timerId);
 */

/**
 * Schedule a callback to run after a game-time delay
 * @param {Function} callback - Function to call after delay
 * @param {number} gameTimeDelayMs - Delay in game-time milliseconds
 * @param {number} timeSpeed - Current time speed multiplier (1 or 10)
 * @returns {number} Timer ID that can be used to cancel
 */
export const scheduleGameTimeCallback = (callback, gameTimeDelayMs, timeSpeed) => {
    // Convert game-time delay to real-time delay
    const realTimeDelayMs = gameTimeDelayMs / timeSpeed;

    return setTimeout(callback, realTimeDelayMs);
};

/**
 * Clear a scheduled game-time callback
 * @param {number} timerId - Timer ID returned from scheduleGameTimeCallback
 */
export const clearGameTimeCallback = (timerId) => {
    clearTimeout(timerId);
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

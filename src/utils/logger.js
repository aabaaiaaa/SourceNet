/**
 * Logging utility with level-based filtering.
 *
 * Debug logs only show in development (import.meta.env.DEV).
 * Info and above always show.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('detailed info');
 *   logger.info('notable event');
 *   logger.warn('something unexpected');
 *   logger.error('failure', error);
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const minLevel = isDev ? LOG_LEVELS.debug : LOG_LEVELS.info;

export const logger = {
  debug: (...args) => { if (minLevel <= LOG_LEVELS.debug) console.log(...args); },
  info: (...args) => { if (minLevel <= LOG_LEVELS.info) console.log(...args); },
  warn: (...args) => { if (minLevel <= LOG_LEVELS.warn) console.warn(...args); },
  error: (...args) => { if (minLevel <= LOG_LEVELS.error) console.error(...args); },
};

export default logger;

/**
 * Banking System - Overdraft, interest, and bankruptcy mechanics
 *
 * Extends Phase 1 banking with:
 * - Overdraft allowed (negative balances)
 * - Interest: 1% per minute when overdrawn (affected by time speed)
 * - Bankruptcy: >10k overdrawn for 5 consecutive minutes = game over
 * - System messages: Overdraft notices, bankruptcy warnings
 *
 * Interest calculation:
 * - At -9,000 credits, 1x speed: -90 credits/min
 * - At -9,000 credits, 10x speed: -900 credits/min (time flows 10x faster)
 */

/**
 * Calculate interest for overdrawn account
 * @param {number} balance - Current balance (should be negative)
 * @returns {number} Interest amount (negative)
 */
export const calculateInterest = (balance) => {
  if (balance >= 0) return 0;

  // 1% of negative balance (1% interest per minute)
  const interest = Math.floor(balance * 0.01);
  return interest; // Returns negative value (e.g., -90 for -9000 balance)
};

/**
 * Check if bankruptcy threshold triggered
 * @param {number} balance - Current balance
 * @returns {boolean} Should start bankruptcy countdown
 */
export const shouldTriggerBankruptcy = (balance) => {
  return balance < -10000; // More than 10k overdrawn (e.g., -10,001)
};

/**
 * Start bankruptcy countdown (5 minutes)
 * @param {Date} currentTime - Current in-game time
 * @returns {object} Countdown object
 */
export const startBankruptcyCountdown = (currentTime) => {
  const startTime = new Date(currentTime);
  const endTime = new Date(currentTime);
  endTime.setMinutes(endTime.getMinutes() + 5); // 5 minutes

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    remaining: 5 * 60, // seconds
  };
};

/**
 * Update bankruptcy countdown based on current time
 * @param {object} countdown - Countdown object
 * @param {Date} currentTime - Current in-game time
 * @returns {object|null} Updated countdown or null if expired/cancelled
 */
export const updateBankruptcyCountdown = (countdown, currentTime, balance) => {
  if (!countdown) return null;

  // If balance improved above -10k, cancel countdown
  if (balance >= -10000) {
    return null; // Countdown cancelled
  }

  const endTime = new Date(countdown.endTime);
  const now = new Date(currentTime);
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000)); // seconds

  if (remaining <= 0) {
    return null; // Countdown expired - bankruptcy triggered
  }

  return {
    ...countdown,
    remaining,
  };
};

/**
 * Check if should play audio warning based on countdown
 * @param {number} remaining - Remaining seconds
 * @param {number} previousRemaining - Previous remaining seconds
 * @returns {string|null} Audio type: 'minute', 'second', or null
 */
export const getBankruptcyAudioWarning = (remaining, previousRemaining) => {
  if (!remaining || !previousRemaining) return null;

  // Every second when at 10 seconds or less
  if (remaining <= 10 && Math.floor(previousRemaining) !== Math.floor(remaining)) {
    return 'second';
  }

  // Every minute
  const currentMinute = Math.floor(remaining / 60);
  const previousMinute = Math.floor(previousRemaining / 60);
  if (currentMinute !== previousMinute) {
    return 'minute';
  }

  return null;
};

/**
 * Get appropriate banking message type based on balance
 * @param {number} newBalance - New balance
 * @param {number} oldBalance - Previous balance
 * @param {object} bankruptcyCountdown - Current bankruptcy countdown
 * @returns {string|null} Message type to send
 */
export const getBankingMessageType = (newBalance, oldBalance, bankruptcyCountdown) => {
  // First overdraft
  if (newBalance < 0 && oldBalance >= 0) {
    return 'firstOverdraft';
  }

  // Approaching bankruptcy (-8k to -9,999)
  if (newBalance < -8000 && newBalance > -10000 && !bankruptcyCountdown) {
    // Only send once when crossing -8k threshold
    if (oldBalance >= -8000) {
      return 'approachingBankruptcy';
    }
  }

  // Bankruptcy countdown started
  if (newBalance <= -10000 && !bankruptcyCountdown) {
    return 'bankruptcyCountdownStart';
  }

  // Bankruptcy countdown cancelled (improved above -10k)
  if (newBalance > -10000 && bankruptcyCountdown) {
    return 'bankruptcyCancelled';
  }

  return null;
};

/**
 * Create transaction record
 * @param {string} type - 'income' or 'expense'
 * @param {number} amount - Transaction amount (positive for income, negative for expense)
 * @param {string} description - Transaction description
 * @param {number} balanceAfter - Balance after transaction
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createTransaction = (type, amount, description, balanceAfter, timestamp) => {
  return {
    id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: timestamp.toISOString(),
    type, // 'income' or 'expense'
    amount, // Positive for income, negative for expense
    description,
    balanceAfter,
  };
};

/**
 * Calculate total credits across all bank accounts
 * @param {array} bankAccounts - Array of bank account objects
 * @returns {number} Total credits
 */
export const getTotalCredits = (bankAccounts) => {
  return bankAccounts.reduce((sum, account) => sum + account.balance, 0);
};

/**
 * Transaction Helper Utilities
 *
 * Helper functions for creating and managing transaction records
 */

/**
 * Create a transaction record
 * @param {string} type - 'income' or 'expense'
 * @param {number} amount - Amount (positive for income, negative for expense)
 * @param {string} description - Transaction description
 * @param {number} balanceAfter - Balance after transaction
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createTransaction = (type, amount, description, balanceAfter, timestamp) => {
  return {
    id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: timestamp.toISOString(),
    type,
    amount,
    description,
    balanceAfter,
  };
};

/**
 * Create mission payout transaction
 * @param {string} missionTitle - Mission title
 * @param {number} payout - Payout amount
 * @param {number} balanceAfter - Balance after payout
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createMissionPayoutTransaction = (missionTitle, payout, balanceAfter, timestamp) => {
  return createTransaction(
    'income',
    payout,
    `Mission Payout: ${missionTitle}`,
    balanceAfter,
    timestamp
  );
};

/**
 * Create mission failure penalty transaction
 * @param {string} missionTitle - Mission title
 * @param {number} penalty - Penalty amount (negative)
 * @param {number} balanceAfter - Balance after penalty
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createMissionPenaltyTransaction = (missionTitle, penalty, balanceAfter, timestamp) => {
  return createTransaction(
    'expense',
    penalty,
    `Mission Failure Penalty: ${missionTitle}`,
    balanceAfter,
    timestamp
  );
};

/**
 * Create software purchase transaction
 * @param {string} softwareName - Software name
 * @param {number} price - Purchase price (negative)
 * @param {number} balanceAfter - Balance after purchase
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createSoftwarePurchaseTransaction = (softwareName, price, balanceAfter, timestamp) => {
  return createTransaction(
    'expense',
    -price,
    `Software Purchase: ${softwareName}`,
    balanceAfter,
    timestamp
  );
};

/**
 * Create interest charge transaction
 * @param {number} interest - Interest amount (negative)
 * @param {number} balanceAfter - Balance after interest
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createInterestTransaction = (interest, balanceAfter, timestamp) => {
  return createTransaction(
    'expense',
    interest,
    'Overdraft Interest',
    balanceAfter,
    timestamp
  );
};

/**
 * Create cheque deposit transaction
 * @param {number} amount - Cheque amount
 * @param {number} balanceAfter - Balance after deposit
 * @param {Date} timestamp - Transaction time
 * @returns {object} Transaction object
 */
export const createChequeDepositTransaction = (amount, balanceAfter, timestamp) => {
  return createTransaction(
    'income',
    amount,
    'Cheque Deposit',
    balanceAfter,
    timestamp
  );
};

/**
 * useBankingState - Banking state and core actions.
 *
 * Extracted from GameContext to reduce file size.
 * Manages bank accounts, transactions, bankruptcy, and interest tracking.
 *
 * Banking effects (interest, bankruptcy countdown, banking messages) remain
 * in GameContext because they reference cross-domain state (currentTime, gamePhase, etc.).
 */

import { useState, useRef, useCallback } from 'react';
import { STARTING_BANK_ACCOUNT } from '../constants/gameConstants';
import triggerEventBus from '../core/triggerEventBus';

export function useBankingState() {
  // State
  const [bankAccounts, setBankAccounts] = useState([STARTING_BANK_ACCOUNT]);
  const [transactions, setTransactions] = useState([]);
  const [bankruptcyCountdown, setBankruptcyCountdown] = useState(null);
  const [lastInterestTime, setLastInterestTime] = useState(null);
  const [bankingMessagesSent, setBankingMessagesSent] = useState({
    firstOverdraft: false,
    approachingBankruptcy: false,
    bankruptcyCountdownStart: false,
    bankruptcyCancelled: false,
  });

  // Refs
  const prevBalanceRef = useRef(null);
  const bankingMessageQueueRef = useRef([]);
  const bankingMessageTimerRef = useRef(null);
  const processBankingMessageQueueRef = useRef(null);

  // Update bank balance and emit creditsChanged event
  const updateBankBalance = useCallback((accountId, amount, reason) => {
    setBankAccounts(prev => {
      const newAccounts = prev.map(acc =>
        acc.id === accountId
          ? { ...acc, balance: acc.balance + amount }
          : acc
      );

      const newTotal = newAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      queueMicrotask(() => {
        triggerEventBus.emit('creditsChanged', {
          newBalance: newTotal,
          change: amount,
          reason: reason,
          accountId: accountId,
        });
      });

      return newAccounts;
    });
  }, []);

  // Get total credits across all accounts
  const getTotalCredits = useCallback(() => {
    return bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [bankAccounts]);

  return {
    bankAccounts,
    setBankAccounts,
    transactions,
    setTransactions,
    bankruptcyCountdown,
    setBankruptcyCountdown,
    lastInterestTime,
    setLastInterestTime,
    bankingMessagesSent,
    setBankingMessagesSent,
    prevBalanceRef,
    bankingMessageQueueRef,
    bankingMessageTimerRef,
    processBankingMessageQueueRef,
    updateBankBalance,
    getTotalCredits,
  };
}

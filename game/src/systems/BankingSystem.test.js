import { describe, it, expect } from 'vitest';
import {
  calculateInterest,
  shouldTriggerBankruptcy,
  startBankruptcyCountdown,
  updateBankruptcyCountdown,
  getBankruptcyAudioWarning,
  getBankingMessageType,
  createTransaction,
  getTotalCredits,
} from './BankingSystem';

describe('BankingSystem', () => {
  describe('calculateInterest', () => {
    it('should return 0 for positive balance', () => {
      expect(calculateInterest(1000)).toBe(0);
      expect(calculateInterest(0)).toBe(0);
    });

    it('should calculate 1% interest for negative balance', () => {
      expect(calculateInterest(-9000)).toBe(-90);
      expect(calculateInterest(-8000)).toBe(-80);
      expect(calculateInterest(-10000)).toBe(-100);
    });

    it('should floor decimal results', () => {
      expect(calculateInterest(-8500)).toBe(-85); // 1% of 8500 = 85
      expect(calculateInterest(-155)).toBe(-2); // 1% of 155 = 1.55, floor(-1.55) = -2
    });
  });

  describe('shouldTriggerBankruptcy', () => {
    it('should not trigger at -10,000 exactly', () => {
      expect(shouldTriggerBankruptcy(-10000)).toBe(false);
    });

    it('should trigger below -10,000', () => {
      expect(shouldTriggerBankruptcy(-10001)).toBe(true);
      expect(shouldTriggerBankruptcy(-15000)).toBe(true);
    });

    it('should not trigger above -10,000', () => {
      expect(shouldTriggerBankruptcy(-9999)).toBe(false);
      expect(shouldTriggerBankruptcy(-5000)).toBe(false);
      expect(shouldTriggerBankruptcy(0)).toBe(false);
    });
  });

  describe('startBankruptcyCountdown', () => {
    it('should create countdown with 5 minute duration', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const countdown = startBankruptcyCountdown(currentTime);

      expect(countdown).toHaveProperty('startTime');
      expect(countdown).toHaveProperty('endTime');
      expect(countdown.remaining).toBe(300); // 5 minutes = 300 seconds
    });

    it('should set endTime 5 minutes after startTime', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const countdown = startBankruptcyCountdown(currentTime);

      const start = new Date(countdown.startTime);
      const end = new Date(countdown.endTime);
      const diff = (end - start) / 1000 / 60; // minutes

      expect(diff).toBe(5);
    });
  });

  describe('updateBankruptcyCountdown', () => {
    it('should update remaining time', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startBankruptcyCountdown(startTime);

      // 2 minutes later, still overdrawn
      const currentTime = new Date('2020-03-25T10:02:00');
      const updated = updateBankruptcyCountdown(countdown, currentTime, -11000);

      expect(updated.remaining).toBe(180); // 3 minutes = 180 seconds
    });

    it('should cancel countdown if balance improves', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startBankruptcyCountdown(startTime);

      // 2 minutes later, balance improved above -10k
      const currentTime = new Date('2020-03-25T10:02:00');
      const updated = updateBankruptcyCountdown(countdown, currentTime, -9000);

      expect(updated).toBe(null); // Cancelled
    });

    it('should return null when countdown expired', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startBankruptcyCountdown(startTime);

      // 6 minutes later (expired)
      const currentTime = new Date('2020-03-25T10:06:00');
      const updated = updateBankruptcyCountdown(countdown, currentTime, -11000);

      expect(updated).toBe(null);
    });

    it('should return null if countdown is null', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const updated = updateBankruptcyCountdown(null, currentTime, -11000);

      expect(updated).toBe(null);
    });
  });

  describe('getBankruptcyAudioWarning', () => {
    it('should return second when at 10 seconds or less', () => {
      expect(getBankruptcyAudioWarning(10, 11)).toBe('second');
      expect(getBankruptcyAudioWarning(5, 6)).toBe('second');
      expect(getBankruptcyAudioWarning(1, 2)).toBe('second');
    });

    it('should return minute when crossing minute boundary', () => {
      expect(getBankruptcyAudioWarning(119, 120)).toBe('minute'); // Minute 1 -> Minute 2
      expect(getBankruptcyAudioWarning(179, 180)).toBe('minute'); // Minute 2 -> Minute 3
      expect(getBankruptcyAudioWarning(59, 60)).toBe('minute'); // Minute 0 -> Minute 1
    });

    it('should return null when no boundary crossed', () => {
      expect(getBankruptcyAudioWarning(150, 150)).toBe(null);
      expect(getBankruptcyAudioWarning(95, 96)).toBe(null);
    });

    it('should return null for invalid inputs', () => {
      expect(getBankruptcyAudioWarning(null, 100)).toBe(null);
      expect(getBankruptcyAudioWarning(100, null)).toBe(null);
    });
  });

  describe('getBankingMessageType', () => {
    it('should return firstOverdraft when going negative', () => {
      const messageType = getBankingMessageType(-100, 500, null);
      expect(messageType).toBe('firstOverdraft');
    });

    it('should not return firstOverdraft if already negative', () => {
      const messageType = getBankingMessageType(-200, -100, null);
      expect(messageType).toBe(null);
    });

    it('should return approachingBankruptcy when crossing -8k', () => {
      const messageType = getBankingMessageType(-8500, -7500, null);
      expect(messageType).toBe('approachingBankruptcy');
    });

    it('should not return approachingBankruptcy if already past threshold', () => {
      const messageType = getBankingMessageType(-8500, -8600, null);
      expect(messageType).toBe(null);
    });

    it('should return bankruptcyCountdownStart when crossing -10k', () => {
      const messageType = getBankingMessageType(-10500, -9500, null);
      expect(messageType).toBe('bankruptcyCountdownStart');
    });

    it('should not trigger countdown if already active', () => {
      const countdown = { remaining: 200 };
      const messageType = getBankingMessageType(-11000, -10500, countdown);
      expect(messageType).toBe(null);
    });

    it('should return bankruptcyCancelled when recovering', () => {
      const countdown = { remaining: 200 };
      const messageType = getBankingMessageType(-9000, -11000, countdown);
      expect(messageType).toBe('bankruptcyCancelled');
    });
  });

  describe('createTransaction', () => {
    it('should create income transaction', () => {
      const timestamp = new Date('2020-03-25T10:00:00');
      const txn = createTransaction('income', 1000, 'Mission Payout', 2000, timestamp);

      expect(txn).toHaveProperty('id');
      expect(txn.type).toBe('income');
      expect(txn.amount).toBe(1000);
      expect(txn.description).toBe('Mission Payout');
      expect(txn.balanceAfter).toBe(2000);
      expect(txn.date).toBe('2020-03-25T10:00:00.000Z');
    });

    it('should create expense transaction', () => {
      const timestamp = new Date('2020-03-25T10:00:00');
      const txn = createTransaction('expense', -500, 'Software Purchase', 500, timestamp);

      expect(txn.type).toBe('expense');
      expect(txn.amount).toBe(-500);
      expect(txn.balanceAfter).toBe(500);
    });

    it('should generate unique IDs', () => {
      const timestamp = new Date();
      const txn1 = createTransaction('income', 100, 'Test', 100, timestamp);
      const txn2 = createTransaction('income', 100, 'Test', 100, timestamp);

      expect(txn1.id).not.toBe(txn2.id);
    });
  });

  describe('getTotalCredits', () => {
    it('should sum credits across all accounts', () => {
      const accounts = [
        { id: 'acc-1', balance: 1000 },
        { id: 'acc-2', balance: 2000 },
        { id: 'acc-3', balance: -500 },
      ];

      const total = getTotalCredits(accounts);
      expect(total).toBe(2500);
    });

    it('should return 0 for empty accounts', () => {
      expect(getTotalCredits([])).toBe(0);
    });

    it('should handle single account', () => {
      const accounts = [{ id: 'acc-1', balance: 1000 }];
      expect(getTotalCredits(accounts)).toBe(1000);
    });

    it('should handle negative total', () => {
      const accounts = [
        { id: 'acc-1', balance: -8000 },
        { id: 'acc-2', balance: 500 },
      ];

      expect(getTotalCredits(accounts)).toBe(-7500);
    });
  });

  describe('Interest Calculation Scenarios', () => {
    it('should match tutorial scenario (-9k balance)', () => {
      const interest = calculateInterest(-9000);
      expect(interest).toBe(-90); // Loses 90 credits/min at 1x speed
    });

    it('should match post-tutorial scenario (-8k balance)', () => {
      const interest = calculateInterest(-8000);
      expect(interest).toBe(-80); // Loses 80 credits/min at 1x speed
    });
  });

  describe('Bankruptcy Threshold Scenarios', () => {
    it('should match tutorial Part 1 aftermath (-9k is safe)', () => {
      expect(shouldTriggerBankruptcy(-9000)).toBe(false);
    });

    it('should trigger if interest pushes below -10k', () => {
      expect(shouldTriggerBankruptcy(-10001)).toBe(true);
    });
  });
});

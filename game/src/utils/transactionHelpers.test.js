import { describe, it, expect } from 'vitest';
import {
  createTransaction,
  createMissionPayoutTransaction,
  createMissionPenaltyTransaction,
  createSoftwarePurchaseTransaction,
  createInterestTransaction,
  createChequeDepositTransaction,
} from './transactionHelpers';

describe('transactionHelpers', () => {
  const mockTimestamp = new Date('2020-03-25T10:00:00');

  describe('createTransaction', () => {
    it('should create transaction with all fields', () => {
      const txn = createTransaction('income', 1000, 'Test Income', 2000, mockTimestamp);

      expect(txn).toHaveProperty('id');
      expect(txn.date).toBe('2020-03-25T10:00:00.000Z');
      expect(txn.type).toBe('income');
      expect(txn.amount).toBe(1000);
      expect(txn.description).toBe('Test Income');
      expect(txn.balanceAfter).toBe(2000);
    });

    it('should generate unique IDs', () => {
      const txn1 = createTransaction('income', 100, 'Test', 100, mockTimestamp);
      const txn2 = createTransaction('income', 100, 'Test', 100, mockTimestamp);

      expect(txn1.id).not.toBe(txn2.id);
    });
  });

  describe('createMissionPayoutTransaction', () => {
    it('should create income transaction for mission payout', () => {
      const txn = createMissionPayoutTransaction('Tutorial Mission', 1000, 2000, mockTimestamp);

      expect(txn.type).toBe('income');
      expect(txn.amount).toBe(1000);
      expect(txn.description).toContain('Mission Payout');
      expect(txn.description).toContain('Tutorial Mission');
    });
  });

  describe('createMissionPenaltyTransaction', () => {
    it('should create expense transaction for mission failure', () => {
      const txn = createMissionPenaltyTransaction('Failed Mission', -10000, -9000, mockTimestamp);

      expect(txn.type).toBe('expense');
      expect(txn.amount).toBe(-10000);
      expect(txn.description).toContain('Mission Failure Penalty');
    });
  });

  describe('createSoftwarePurchaseTransaction', () => {
    it('should create expense transaction for software purchase', () => {
      const txn = createSoftwarePurchaseTransaction('VPN Client', 500, 500, mockTimestamp);

      expect(txn.type).toBe('expense');
      expect(txn.amount).toBe(-500);
      expect(txn.description).toContain('Software Purchase');
      expect(txn.description).toContain('VPN Client');
    });
  });

  describe('createInterestTransaction', () => {
    it('should create expense transaction for interest', () => {
      const txn = createInterestTransaction(-90, -9090, mockTimestamp);

      expect(txn.type).toBe('expense');
      expect(txn.amount).toBe(-90);
      expect(txn.description).toBe('Overdraft Interest');
    });
  });

  describe('createChequeDepositTransaction', () => {
    it('should create income transaction for cheque deposit', () => {
      const txn = createChequeDepositTransaction(1000, 1000, mockTimestamp);

      expect(txn.type).toBe('income');
      expect(txn.amount).toBe(1000);
      expect(txn.description).toBe('Cheque Deposit');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  REPUTATION_TIERS,
  getReputationTier,
  calculatePayoutWithReputation,
  canAccessMission,
  calculateReputationChange,
  getReputationWarning,
  startReputationCountdown,
  updateReputationCountdown,
} from './ReputationSystem';

describe('ReputationSystem', () => {
  describe('REPUTATION_TIERS', () => {
    it('should have 11 tiers', () => {
      const tierCount = Object.keys(REPUTATION_TIERS).length;
      expect(tierCount).toBe(11);
    });

    it('should have all required properties for each tier', () => {
      for (let tier = 1; tier <= 11; tier++) {
        const tierData = REPUTATION_TIERS[tier];
        expect(tierData).toHaveProperty('name');
        expect(tierData).toHaveProperty('color');
        expect(tierData).toHaveProperty('description');
        expect(tierData).toHaveProperty('payoutMultiplier');
        expect(tierData).toHaveProperty('clientTypes');
      }
    });

    it('should have correct starting tier (Tier 9 - Superb)', () => {
      expect(REPUTATION_TIERS[9].name).toBe('Superb');
    });
  });

  describe('getReputationTier', () => {
    it('should return tier information for valid tier', () => {
      const tier = getReputationTier(9);
      expect(tier.name).toBe('Superb');
      expect(tier.payoutMultiplier).toBe(1.5);
    });

    it('should throw error for invalid tier (too low)', () => {
      expect(() => getReputationTier(0)).toThrow('Invalid reputation tier');
    });

    it('should throw error for invalid tier (too high)', () => {
      expect(() => getReputationTier(12)).toThrow('Invalid reputation tier');
    });
  });

  describe('calculatePayoutWithReputation', () => {
    it('should apply 0.5x multiplier at Tier 1', () => {
      const payout = calculatePayoutWithReputation(1000, 1);
      expect(payout).toBe(500);
    });

    it('should apply 1.0x multiplier at Tier 4-5', () => {
      expect(calculatePayoutWithReputation(1000, 4)).toBe(1000);
      expect(calculatePayoutWithReputation(1000, 5)).toBe(1000);
    });

    it('should apply 1.5x multiplier at Tier 9 (Superb)', () => {
      const payout = calculatePayoutWithReputation(1000, 9);
      expect(payout).toBe(1500);
    });

    it('should apply 2.0x multiplier at Tier 11 (Star employee)', () => {
      const payout = calculatePayoutWithReputation(1000, 11);
      expect(payout).toBe(2000);
    });

    it('should floor decimal results', () => {
      const payout = calculatePayoutWithReputation(1000, 3); // 0.85x = 850
      expect(payout).toBe(850);
    });
  });

  describe('canAccessMission', () => {
    it('should allow access to library missions at Tier 1', () => {
      expect(canAccessMission('library', 1)).toBe(true);
    });

    it('should not allow access to bank missions at Tier 1', () => {
      expect(canAccessMission('bank', 1)).toBe(false);
    });

    it('should allow access to bank missions at Tier 9', () => {
      expect(canAccessMission('bank', 9)).toBe(true);
    });

    it('should allow access to all missions at Tier 10-11', () => {
      expect(canAccessMission('bank', 10)).toBe(true);
      expect(canAccessMission('government', 10)).toBe(true);
      expect(canAccessMission('library', 11)).toBe(true);
    });
  });

  describe('calculateReputationChange', () => {
    it('should increase by 1 on success', () => {
      expect(calculateReputationChange(true, 3)).toBe(4);
      expect(calculateReputationChange(true, 9)).toBe(10);
    });

    it('should not exceed Tier 11 on success', () => {
      expect(calculateReputationChange(true, 11)).toBe(11);
    });

    it('should decrease by 1 on failure', () => {
      expect(calculateReputationChange(false, 9)).toBe(8);
      expect(calculateReputationChange(false, 5)).toBe(4);
    });

    it('should not go below Tier 1 on failure', () => {
      expect(calculateReputationChange(false, 1)).toBe(1);
    });
  });

  describe('getReputationWarning', () => {
    it('should return performance-plan warning when dropping to Tier 2', () => {
      expect(getReputationWarning(3, 2)).toBe('performance-plan');
      expect(getReputationWarning(9, 2)).toBe('performance-plan');
    });

    it('should not warn when already at Tier 2', () => {
      expect(getReputationWarning(2, 2)).toBe(null);
    });

    it('should return final-termination warning when dropping to Tier 1', () => {
      expect(getReputationWarning(2, 1)).toBe('final-termination');
      expect(getReputationWarning(5, 1)).toBe('final-termination');
    });

    it('should return performance-improved when recovering from Tier 1', () => {
      expect(getReputationWarning(1, 2)).toBe('performance-improved');
      expect(getReputationWarning(1, 3)).toBe('performance-improved');
    });

    it('should return null for normal tier changes', () => {
      expect(getReputationWarning(5, 6)).toBe(null);
      expect(getReputationWarning(9, 8)).toBe(null);
    });
  });

  describe('startReputationCountdown', () => {
    it('should create countdown object with 10 minute duration', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const countdown = startReputationCountdown(currentTime);

      expect(countdown).toHaveProperty('startTime');
      expect(countdown).toHaveProperty('endTime');
      expect(countdown.remaining).toBe(600); // 10 minutes = 600 seconds
    });

    it('should set endTime 10 minutes after startTime', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const countdown = startReputationCountdown(currentTime);

      const start = new Date(countdown.startTime);
      const end = new Date(countdown.endTime);
      const diff = (end - start) / 1000 / 60; // minutes

      expect(diff).toBe(10);
    });
  });

  describe('updateReputationCountdown', () => {
    it('should update remaining time based on current time', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startReputationCountdown(startTime);

      // 5 minutes later
      const currentTime = new Date('2020-03-25T10:05:00');
      const updated = updateReputationCountdown(countdown, currentTime);

      expect(updated.remaining).toBe(300); // 5 minutes = 300 seconds
    });

    it('should return null when countdown expired', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startReputationCountdown(startTime);

      // 11 minutes later (expired)
      const currentTime = new Date('2020-03-25T10:11:00');
      const updated = updateReputationCountdown(countdown, currentTime);

      expect(updated).toBe(null);
    });

    it('should return null if countdown is null', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const updated = updateReputationCountdown(null, currentTime);

      expect(updated).toBe(null);
    });

    it('should handle countdown at exactly 0 remaining', () => {
      const startTime = new Date('2020-03-25T10:00:00');
      const countdown = startReputationCountdown(startTime);

      // Exactly 10 minutes later
      const currentTime = new Date('2020-03-25T10:10:00');
      const updated = updateReputationCountdown(countdown, currentTime);

      expect(updated).toBe(null);
    });
  });

  describe('Reputation Tier Properties', () => {
    it('should have increasing payout multipliers', () => {
      expect(REPUTATION_TIERS[1].payoutMultiplier).toBe(0.5);
      expect(REPUTATION_TIERS[5].payoutMultiplier).toBe(1.0);
      expect(REPUTATION_TIERS[9].payoutMultiplier).toBe(1.5);
      expect(REPUTATION_TIERS[11].payoutMultiplier).toBe(2.0);
    });

    it('should have appropriate client types per tier', () => {
      // Tier 1: Only non-critical
      expect(REPUTATION_TIERS[1].clientTypes).toContain('library');
      expect(REPUTATION_TIERS[1].clientTypes).toContain('museum');

      // Tier 9: Banks and government
      expect(REPUTATION_TIERS[9].clientTypes).toContain('bank');
      expect(REPUTATION_TIERS[9].clientTypes).toContain('government');

      // Tier 10-11: All
      expect(REPUTATION_TIERS[10].clientTypes).toContain('all');
      expect(REPUTATION_TIERS[11].clientTypes).toContain('all');
    });
  });
});

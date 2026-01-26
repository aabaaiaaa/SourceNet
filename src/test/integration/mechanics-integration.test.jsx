import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GameProvider } from '../../contexts/GameContext';
import { useGame } from '../../contexts/useGame';
import { calculateInterest, shouldTriggerBankruptcy } from '../../systems/BankingSystem';
import { calculateReputationChange, getReputationWarning } from '../../systems/ReputationSystem';

const TestComponent = ({ onRender }) => {
  const game = useGame();
  if (onRender) onRender(game);
  return null;
};

const renderWithProvider = (onRender) => {
  return render(
    <GameProvider>
      <TestComponent onRender={onRender} />
    </GameProvider>
  );
};

describe('Mechanics Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Interest Accumulation', () => {
    it('should calculate correct interest for negative balance', () => {
      const interest = calculateInterest(-9000);
      expect(interest).toBe(-90); // 1% of 9000
    });

    it('should trigger bankruptcy at correct threshold', () => {
      expect(shouldTriggerBankruptcy(-10001)).toBe(true);
      expect(shouldTriggerBankruptcy(-10000)).toBe(false);
      expect(shouldTriggerBankruptcy(-9999)).toBe(false);
    });
  });

  describe('Reputation Changes', () => {
    it('should increase reputation on mission success', () => {
      const newRep = calculateReputationChange(true, 5);
      expect(newRep).toBe(6);
    });

    it('should decrease reputation on mission failure', () => {
      const newRep = calculateReputationChange(false, 5);
      expect(newRep).toBe(4);
    });

    it('should trigger warning when dropping to Tier 2', () => {
      const warning = getReputationWarning(3, 2);
      expect(warning).toBe('performance-plan');
    });

    it('should trigger final warning when dropping to Tier 1', () => {
      const warning = getReputationWarning(2, 1);
      expect(warning).toBe('final-termination');
    });
  });

  describe('Mission System Integration', () => {
    it('should have mission action functions available', () => {
      let gameContext;
      renderWithProvider((game) => {
        gameContext = game;
      });

      expect(typeof gameContext.acceptMission).toBe('function');
      expect(typeof gameContext.completeMission).toBe('function');
      expect(typeof gameContext.completeMissionObjective).toBe('function');
    });

    it('should have mission state available', () => {
      let gameContext;
      renderWithProvider((game) => {
        gameContext = game;
      });

      expect(gameContext.activeMission).toBeDefined();
      expect(Array.isArray(gameContext.completedMissions)).toBe(true);
      expect(Array.isArray(gameContext.availableMissions)).toBe(true);
    });
  });

  describe('Extended State Availability', () => {
    it('should have all game state available', () => {
      let gameContext;
      renderWithProvider((game) => {
        gameContext = game;
      });

      // Reputation state
      expect(gameContext.reputation).toBeDefined();
      expect(gameContext.reputationCountdown).toBeDefined();

      // Mission state
      expect(gameContext.activeMission).toBeDefined();
      expect(gameContext.completedMissions).toBeDefined();

      // Network state (activeConnections only - narEntries removed, use NetworkRegistry)
      expect(gameContext.activeConnections).toBeDefined();

      // Transaction state
      expect(gameContext.transactions).toBeDefined();
      expect(gameContext.bankruptcyCountdown).toBeDefined();
    });
  });
});

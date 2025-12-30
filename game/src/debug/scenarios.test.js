import { describe, it, expect } from 'vitest';
import { DEBUG_SCENARIOS, loadScenario } from './scenarios';

describe('scenarios', () => {
  describe('DEBUG_SCENARIOS', () => {
    it('should have 9 scenarios', () => {
      const scenarioCount = Object.keys(DEBUG_SCENARIOS).length;
      expect(scenarioCount).toBe(9);
    });

    it('should have freshStart scenario', () => {
      expect(DEBUG_SCENARIOS.freshStart).toBeDefined();
      expect(DEBUG_SCENARIOS.freshStart.state.credits).toBe(1000);
      expect(DEBUG_SCENARIOS.freshStart.state.reputation).toBe(9);
    });

    it('should have tutorialPart1Failed scenario', () => {
      expect(DEBUG_SCENARIOS.tutorialPart1Failed).toBeDefined();
      expect(DEBUG_SCENARIOS.tutorialPart1Failed.state.credits).toBe(-9000);
      expect(DEBUG_SCENARIOS.tutorialPart1Failed.state.reputation).toBe(3);
    });

    it('should have postTutorial scenario', () => {
      expect(DEBUG_SCENARIOS.postTutorial).toBeDefined();
      expect(DEBUG_SCENARIOS.postTutorial.state.credits).toBe(-8000);
    });

    it('should have nearBankruptcy scenario', () => {
      expect(DEBUG_SCENARIOS.nearBankruptcy).toBeDefined();
      expect(DEBUG_SCENARIOS.nearBankruptcy.state.credits).toBe(-10500);
      expect(DEBUG_SCENARIOS.nearBankruptcy.state.bankruptcyCountdown).toBeDefined();
    });

    it('should have nearTermination scenario', () => {
      expect(DEBUG_SCENARIOS.nearTermination).toBeDefined();
      expect(DEBUG_SCENARIOS.nearTermination.state.reputation).toBe(1);
      expect(DEBUG_SCENARIOS.nearTermination.state.reputationCountdown).toBeDefined();
    });

    it('should have highPerformer scenario', () => {
      expect(DEBUG_SCENARIOS.highPerformer).toBeDefined();
      expect(DEBUG_SCENARIOS.highPerformer.state.credits).toBe(50000);
      expect(DEBUG_SCENARIOS.highPerformer.state.reputation).toBe(10);
    });

    it('all scenarios should have name and description', () => {
      Object.keys(DEBUG_SCENARIOS).forEach(key => {
        expect(DEBUG_SCENARIOS[key].name).toBeDefined();
        expect(DEBUG_SCENARIOS[key].description).toBeDefined();
        expect(DEBUG_SCENARIOS[key].state).toBeDefined();
      });
    });
  });

  describe('loadScenario', () => {
    it('should be a function', () => {
      expect(typeof loadScenario).toBe('function');
    });

    it('should accept scenario ID and game context', () => {
      const mockContext = {
        bankAccounts: [{ id: 'acc-1', balance: 0 }],
        setBankAccounts: () => {},
        setReputation: () => {},
        setSoftware: () => {},
        setActiveMission: () => {},
        setCompletedMissions: () => {},
        setTransactions: () => {},
        setBankruptcyCountdown: () => {},
        setReputationCountdown: () => {},
        setCurrentTime: () => {},
      };

      expect(() => loadScenario('freshStart', mockContext)).not.toThrow();
    });
  });
});

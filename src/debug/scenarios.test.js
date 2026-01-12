import { describe, it, expect, vi } from 'vitest';
import { getDebugScenarios, loadScenario } from './scenarios';
import { getScenarioFixture, getAvailableScenarios } from './fixtures';

describe('scenarios', () => {
  describe('getDebugScenarios', () => {
    it('should return an object', () => {
      const scenarios = getDebugScenarios();
      expect(typeof scenarios).toBe('object');
    });

    it('should have name and description for each scenario', () => {
      const scenarios = getDebugScenarios();
      Object.keys(scenarios).forEach(key => {
        expect(scenarios[key].name).toBeDefined();
        expect(typeof scenarios[key].name).toBe('string');
        expect(scenarios[key].description).toBeDefined();
        expect(typeof scenarios[key].description).toBe('string');
      });
    });

    it('should return scenarios from available fixtures', () => {
      const scenarios = getDebugScenarios();
      const available = getAvailableScenarios();

      // Each available fixture should have a corresponding scenario
      available.forEach(name => {
        expect(scenarios[name]).toBeDefined();
      });
    });
  });

  describe('fixtures', () => {
    it('getAvailableScenarios should return an array', () => {
      const available = getAvailableScenarios();
      expect(Array.isArray(available)).toBe(true);
    });

    it('getScenarioFixture should return null for unknown scenarios', () => {
      const fixture = getScenarioFixture('nonexistent-scenario');
      expect(fixture).toBeNull();
    });

    it('each available fixture should have required fields', () => {
      const available = getAvailableScenarios();

      available.forEach(name => {
        const fixture = getScenarioFixture(name);
        expect(fixture).not.toBeNull();

        // Required fields for a valid save
        expect(fixture.username).toBeDefined();
        expect(fixture.playerMailId).toBeDefined();
        expect(fixture.currentTime).toBeDefined();
        expect(fixture.bankAccounts).toBeDefined();
        expect(Array.isArray(fixture.bankAccounts)).toBe(true);
        expect(fixture.messages).toBeDefined();
        expect(Array.isArray(fixture.messages)).toBe(true);
      });
    });
  });

  describe('loadScenario', () => {
    it('should be a function', () => {
      expect(typeof loadScenario).toBe('function');
    });

    it('should return false for unknown scenario', () => {
      const mockContext = createMockContext();
      const result = loadScenario('nonexistent-scenario', mockContext);
      expect(result).toBe(false);
    });

    it('should return true when loading an available scenario', () => {
      const available = getAvailableScenarios();
      if (available.length === 0) {
        // Skip if no fixtures generated yet
        return;
      }

      const mockContext = createMockContext();
      const result = loadScenario(available[0], mockContext);
      expect(result).toBe(true);
    });
  });
});

/**
 * Create a mock game context for testing
 */
function createMockContext() {
  return {
    bankAccounts: [{ id: 'acc-1', balance: 0 }],
    setUsername: vi.fn(),
    setPlayerMailId: vi.fn(),
    setCurrentTime: vi.fn(),
    setHardware: vi.fn(),
    setSoftware: vi.fn(),
    setBankAccounts: vi.fn(),
    setMessages: vi.fn(),
    setManagerName: vi.fn(),
    setReputation: vi.fn(),
    setReputationCountdown: vi.fn(),
    setActiveMission: vi.fn(),
    setCompletedMissions: vi.fn(),
    setAvailableMissions: vi.fn(),
    setMissionCooldowns: vi.fn(),
    setNarEntries: vi.fn(),
    setActiveConnections: vi.fn(),
    setLastScanResults: vi.fn(),
    setFileManagerConnections: vi.fn(),
    setLastFileOperation: vi.fn(),
    setDownloadQueue: vi.fn(),
    setTransactions: vi.fn(),
    setLicensedSoftware: vi.fn(),
    setBankruptcyCountdown: vi.fn(),
    setLastInterestTime: vi.fn(),
    setWindows: vi.fn(),
    setTimeSpeed: vi.fn(),
  };
}

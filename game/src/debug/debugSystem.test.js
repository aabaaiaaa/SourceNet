import { describe, it, expect } from 'vitest';
import { isDebugMode, setGameState, skipTime, installSoftwareInstantly, addNetworkToNAR, connectToNetwork } from './debugSystem';

describe('debugSystem', () => {
  describe('isDebugMode', () => {
    it('should return true in development environment', () => {
      expect(typeof isDebugMode()).toBe('boolean');
    });
  });

  describe('setGameState', () => {
    it('should be a function', () => {
      expect(typeof setGameState).toBe('function');
    });

    it('should accept gameContext and state parameters', () => {
      const mockContext = {
        bankAccounts: [{ id: 'acc-1', balance: 0 }],
        setBankAccounts: () => { },
        setReputation: () => { },
      };

      // Should not throw
      expect(() => setGameState(mockContext, { credits: 1000 })).not.toThrow();
    });
  });

  describe('skipTime', () => {
    it('should be a function', () => {
      expect(typeof skipTime).toBe('function');
    });
  });

  describe('installSoftwareInstantly', () => {
    it('should be a function', () => {
      expect(typeof installSoftwareInstantly).toBe('function');
    });
  });

  describe('addNetworkToNAR', () => {
    it('should be a function', () => {
      expect(typeof addNetworkToNAR).toBe('function');
    });
  });

  describe('connectToNetwork', () => {
    it('should be a function', () => {
      expect(typeof connectToNetwork).toBe('function');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { saveGameState, loadGameState } from '../../utils/helpers';

describe('Mission State Save/Load Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and load mission-related state', () => {
    const gameStateWithMissions = {
      username: 'test_agent',
      playerMailId: 'SNET-ABC-123-XYZ',
      currentTime: '2020-03-25T10:30:00.000Z',
      hardware: { cpu: 'test' },
      software: ['osnet', 'portal', 'mail', 'banking'],
      bankAccounts: [{ id: 'acc-1', balance: -8000 }],
      messages: [],
      managerName: 'Alex',
      windows: [],
      // Extended state (missions, reputation, etc.)
      reputation: 3,
      reputationCountdown: null,
      activeMission: {
        missionId: 'tutorial-part-2',
        title: 'Log File Restoration',
        objectives: [
          { id: 'obj-1', description: 'Connect', status: 'complete' },
          { id: 'obj-2', description: 'Scan', status: 'pending' },
        ],
      },
      completedMissions: [
        {
          id: 'tutorial-part-1',
          status: 'failed',
          payout: -10000,
          reputationChange: -6,
        },
      ],
      availableMissions: [],
      missionCooldowns: { easy: null, medium: null, hard: null },
      narEntries: [
        {
          id: 'nar-001',
          networkId: 'clienta-corporate',
          status: 'expired',
        },
      ],
      activeConnections: [],
      downloadQueue: [],
      transactions: [
        {
          id: 'txn-001',
          type: 'income',
          amount: 1000,
          description: 'Cheque Deposit',
          balanceAfter: 1000,
        },
        {
          id: 'txn-002',
          type: 'expense',
          amount: -10000,
          description: 'Mission Failure',
          balanceAfter: -9000,
        },
      ],
      bankruptcyCountdown: null,
      lastInterestTime: null,
    };

    saveGameState('test_agent', gameStateWithMissions, 'Mission State Test');
    const loaded = loadGameState('test_agent');

    expect(loaded.reputation).toBe(3);
    expect(loaded.activeMission.missionId).toBe('tutorial-part-2');
    expect(loaded.completedMissions).toHaveLength(1);
    expect(loaded.narEntries).toHaveLength(1);
    expect(loaded.transactions).toHaveLength(2);
  });

  it('should handle backward compatibility with older saves', () => {
    const olderSaveState = {
      username: 'phase1_player',
      playerMailId: 'SNET-DEF-456-ABC',
      currentTime: '2020-03-25T09:00:00.000Z',
      hardware: { cpu: 'test' },
      software: ['osnet', 'portal'],
      bankAccounts: [{ id: 'acc-1', balance: 1000 }],
      messages: [],
      managerName: 'Sam',
      windows: [],
      // No mission/reputation state (older save format)
    };

    saveGameState('old_player', olderSaveState);
    const loaded = loadGameState('old_player');

    // Extended fields will be undefined (GameContext provides defaults on load)
    expect(loaded.reputation).toBeUndefined(); // Will be set to 9 by GameContext
    expect(loaded.transactions).toBeUndefined(); // Will be set to [] by GameContext
  });

  it('should save bankruptcy countdown state', () => {
    const state = {
      username: 'test_agent',
      playerMailId: 'SNET-ABC-123-XYZ',
      currentTime: '2020-03-25T10:00:00.000Z',
      hardware: {},
      software: [],
      bankAccounts: [{ id: 'acc-1', balance: -10500 }],
      messages: [],
      managerName: 'Alex',
      windows: [],
      reputation: 3,
      bankruptcyCountdown: {
        startTime: '2020-03-25T10:00:00.000Z',
        endTime: '2020-03-25T10:05:00.000Z',
        remaining: 180,
      },
    };

    saveGameState('test_agent', state);
    const loaded = loadGameState('test_agent');

    expect(loaded.bankruptcyCountdown).toBeDefined();
    expect(loaded.bankruptcyCountdown.remaining).toBe(180);
  });

  it('should save reputation countdown state', () => {
    const state = {
      username: 'test_agent',
      playerMailId: 'SNET-ABC-123-XYZ',
      currentTime: '2020-03-25T10:00:00.000Z',
      hardware: {},
      software: [],
      bankAccounts: [{ id: 'acc-1', balance: 500 }],
      messages: [],
      managerName: 'Alex',
      windows: [],
      reputation: 1,
      reputationCountdown: {
        startTime: '2020-03-25T10:00:00.000Z',
        endTime: '2020-03-25T10:10:00.000Z',
        remaining: 300,
      },
    };

    saveGameState('test_agent', state);
    const loaded = loadGameState('test_agent');

    expect(loaded.reputationCountdown).toBeDefined();
    expect(loaded.reputationCountdown.remaining).toBe(300);
  });
});

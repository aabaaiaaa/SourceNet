import { describe, it, expect, beforeEach } from 'vitest';
import { saveGameState, loadGameState } from '../../utils/helpers';
import { STARTING_HARDWARE, STARTING_SOFTWARE } from '../../constants/gameConstants';

describe('Save State Persistence Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist complete game state through save/load cycle', () => {
    const completeGameState = {
      username: 'test_agent',
      playerMailId: 'SNET-ABC-123-XYZ',
      currentTime: '2020-03-25T10:30:45.000Z',
      hardware: STARTING_HARDWARE,
      software: STARTING_SOFTWARE,
      bankAccounts: [
        { id: 'account-1', bankName: 'First Bank Ltd', balance: 1500 },
        { id: 'account-2', bankName: 'Second Bank', balance: 500 },
      ],
      messages: [
        {
          id: 'msg-1',
          from: 'HR',
          subject: 'Welcome',
          read: true,
          archived: false,
        },
        {
          id: 'msg-2',
          from: 'Manager',
          subject: 'Hello',
          read: true,
          archived: true,
          attachment: { type: 'cheque', amount: 1000, deposited: true },
        },
      ],
      managerName: 'Alex',
      windows: [
        { appId: 'mail', zIndex: 1000, minimized: false, position: { x: 50, y: 100 } },
        { appId: 'banking', zIndex: 1001, minimized: true, position: { x: 80, y: 130 } },
      ],
    };

    // Save game state
    const saveResult = saveGameState('test_agent', completeGameState, 'TestSave');

    // Verify save was created
    expect(saveResult).toBeDefined();
    expect(saveResult.saveName).toBe('TestSave');
    expect(saveResult.savedAt).toBeDefined();

    // Load game state
    const loadedState = loadGameState('test_agent');

    // Verify all state persisted correctly
    expect(loadedState.username).toBe('test_agent');
    expect(loadedState.playerMailId).toBe('SNET-ABC-123-XYZ');
    expect(loadedState.currentTime).toBe('2020-03-25T10:30:45.000Z');
    expect(loadedState.bankAccounts).toHaveLength(2);
    expect(loadedState.bankAccounts[0].balance).toBe(1500);
    expect(loadedState.messages).toHaveLength(2);
    expect(loadedState.messages[1].archived).toBe(true);
    expect(loadedState.messages[1].attachment.deposited).toBe(true);
    expect(loadedState.windows).toHaveLength(2);
    expect(loadedState.windows[1].minimized).toBe(true);
  });

  it('should maintain independent state for multiple saves', () => {
    const save1 = {
      username: 'agent_1',
      currentTime: '2020-03-25T09:00:00.000Z',
      bankAccounts: [{ id: 'acc-1', bankName: 'Bank1', balance: 1000 }],
    };

    const save2 = {
      username: 'agent_2',
      currentTime: '2020-03-25T12:00:00.000Z',
      bankAccounts: [{ id: 'acc-1', bankName: 'Bank1', balance: 5000 }],
    };

    saveGameState('agent_1', save1);
    saveGameState('agent_2', save2);

    const loaded1 = loadGameState('agent_1');
    const loaded2 = loadGameState('agent_2');

    // Verify saves are independent
    expect(loaded1.bankAccounts[0].balance).toBe(1000);
    expect(loaded2.bankAccounts[0].balance).toBe(5000);
    expect(loaded1.currentTime).not.toBe(loaded2.currentTime);
  });
});

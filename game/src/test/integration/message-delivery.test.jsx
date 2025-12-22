import { describe, it, expect } from 'vitest';
import { INITIAL_MESSAGES, MANAGER_NAMES, MESSAGE_TIMING } from '../../constants/gameConstants';

describe('Message Delivery Integration', () => {
  it('should have correct initial message configuration', () => {
    expect(INITIAL_MESSAGES).toHaveLength(1);

    const hrMessage = INITIAL_MESSAGES[0];
    expect(hrMessage.id).toBe('msg-welcome-hr');
    expect(hrMessage.from).toBe('SourceNet Human Resources');
    expect(hrMessage.fromId).toBe('SNET-HQ0-000-001');
    expect(hrMessage.subject).toBe('Welcome to SourceNet!');
    expect(hrMessage.body).toContain('securing the global internet space');
    expect(hrMessage.read).toBe(false);
    expect(hrMessage.archived).toBe(false);
  });

  it('should have manager names available for random selection', () => {
    expect(MANAGER_NAMES).toBeInstanceOf(Array);
    expect(MANAGER_NAMES.length).toBeGreaterThan(0);
    expect(MANAGER_NAMES).toContain('Alex');
    expect(MANAGER_NAMES).toContain('Jordan');
  });

  it('should have correct message timing configuration', () => {
    expect(MESSAGE_TIMING.FIRST_MESSAGE_DELAY).toBe(2000);
    expect(MESSAGE_TIMING.SECOND_MESSAGE_DELAY).toBe(2000);
  });
});

import { describe, it, expect } from 'vitest';
import { BANKING_MESSAGES, HR_MESSAGES, createSystemMessage } from './systemMessages';

describe('systemMessages', () => {
  describe('BANKING_MESSAGES', () => {
    it('should have all required banking message templates', () => {
      expect(BANKING_MESSAGES.firstOverdraft).toBeDefined();
      expect(BANKING_MESSAGES.approachingBankruptcy).toBeDefined();
      expect(BANKING_MESSAGES.bankruptcyCountdownStart).toBeDefined();
      expect(BANKING_MESSAGES.bankruptcyCancelled).toBeDefined();
    });

    it('should have valid template structure', () => {
      const template = BANKING_MESSAGES.firstOverdraft;
      expect(template.from).toBe('bank');
      expect(template.fromId).toBe('SNET-FBL-000-001');
      expect(template.fromName).toBe('First Bank Ltd');
      expect(template.subject).toBeDefined();
      expect(typeof template.bodyTemplate).toBe('function');
    });
  });

  describe('HR_MESSAGES', () => {
    it('should have all required HR message templates', () => {
      expect(HR_MESSAGES.performancePlanWarning).toBeDefined();
      expect(HR_MESSAGES.finalTerminationWarning).toBeDefined();
      expect(HR_MESSAGES.performanceImproved).toBeDefined();
    });

    it('should have valid template structure', () => {
      const template = HR_MESSAGES.finalTerminationWarning;
      expect(template.from).toBe('hr');
      expect(template.fromId).toBe('SNET-HQ0-000-001');
      expect(template.fromName).toBe('SourceNet Human Resources');
      expect(typeof template.bodyTemplate).toBe('function');
    });
  });

  describe('createSystemMessage', () => {
    it('should create message from banking template', () => {
      const template = BANKING_MESSAGES.firstOverdraft;
      const message = createSystemMessage(template, 'test_user', { balance: -5000 });

      expect(message.id).toMatch(/^sys-bank-/);
      expect(message.from).toBe('bank');
      expect(message.fromId).toBe('SNET-FBL-000-001');
      expect(message.body).toContain('test_user');
      expect(message.body).toContain('-5,000');
      expect(message.read).toBe(false);
    });

    it('should create message from HR template', () => {
      const template = HR_MESSAGES.performancePlanWarning;
      const message = createSystemMessage(template, 'test_agent', { tier: 2, tierName: 'On performance plan' });

      expect(message.id).toMatch(/^sys-hr-/);
      expect(message.from).toBe('hr');
      expect(message.body).toContain('test_agent');
      expect(message.body).toContain('On performance plan');
    });

    it('should replace username placeholder in body', () => {
      const template = HR_MESSAGES.finalTerminationWarning;
      const message = createSystemMessage(template, 'agent_test', { tier: 1, tierName: 'Should be let go' });

      expect(message.body).toContain('agent_test');
      expect(message.body).not.toContain('{username}');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { createMessageFromTemplate, MESSAGE_TEMPLATES } from './messageTemplates';

describe('messageTemplates', () => {
  describe('MESSAGE_TEMPLATES', () => {
    it('should have tutorial failure template', () => {
      expect(MESSAGE_TEMPLATES['tutorial-1-failure']).toBeDefined();
    });

    it('should have tutorial intro template', () => {
      expect(MESSAGE_TEMPLATES['tutorial-2-intro']).toBeDefined();
    });

    it('should have tutorial success template', () => {
      expect(MESSAGE_TEMPLATES['tutorial-2-success']).toBeDefined();
    });

    it('should have back in black template', () => {
      expect(MESSAGE_TEMPLATES['back-in-black']).toBeDefined();
    });
  });

  describe('createMessageFromTemplate', () => {
    it('should create message from template', () => {
      const message = createMessageFromTemplate('tutorial-1-failure', {
        username: 'test_agent',
        managerName: 'Alex',
      });

      expect(message).toBeDefined();
      expect(message.id).toMatch(/^msg-/);
      expect(message.from).toBe('SourceNet Manager');
      expect(message.body).toContain('test_agent');
      expect(message.body).toContain('Alex');
      expect(message.read).toBe(false);
    });

    it('should replace username placeholder', () => {
      const message = createMessageFromTemplate('tutorial-2-success', {
        username: 'agent_5678',
        managerName: 'Sam',
      });

      expect(message.body).toContain('agent_5678');
      expect(message.body).not.toContain('{username}');
    });

    it('should replace manager name placeholder', () => {
      const message = createMessageFromTemplate('back-in-black', {
        username: 'test',
        managerName: 'Jordan',
      });

      expect(message.body).toContain('Jordan');
      expect(message.body).not.toContain('{managerName}');
    });

    it('should return null for unknown template', () => {
      const message = createMessageFromTemplate('unknown-template', {
        username: 'test',
        managerName: 'Test',
      });

      expect(message).toBe(null);
    });
  });
});

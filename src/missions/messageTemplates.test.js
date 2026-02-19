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

    it('should have tutorial NAR info template', () => {
      expect(MESSAGE_TEMPLATES['tutorial-2-nar-info']).toBeDefined();
    });

    it('should have back in black template', () => {
      expect(MESSAGE_TEMPLATES['back-in-black']).toBeDefined();
    });

    it('should have client payment template', () => {
      expect(MESSAGE_TEMPLATES['client-payment']).toBeDefined();
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

    it('should create client payment message with dynamic cheque', () => {
      const message = createMessageFromTemplate('client-payment', {
        username: 'test_agent',
        clientName: 'TechCorp',
        missionTitle: 'Log File Restoration',
        payoutAmount: '1,000',
        chequeAmount: 1000,
      });

      expect(message).toBeDefined();
      expect(message.from).toBe('TechCorp');
      expect(message.fromName).toBe('TechCorp');
      expect(message.subject).toBe('Payment for Log File Restoration');
      expect(message.body).toContain('test_agent');
      expect(message.body).toContain('Log File Restoration');
      expect(message.body).toContain('1,000 credits');
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].type).toBe('cheque');
      expect(message.attachments[0].amount).toBe(1000);
      expect(message.attachments[0].description).toBe('Payment for Log File Restoration');
    });

    it('should replace placeholders in from/fromName/subject fields', () => {
      const message = createMessageFromTemplate('client-payment', {
        username: 'agent_123',
        clientName: 'MegaCorp Industries',
        missionTitle: 'Data Recovery',
        payoutAmount: '5,000',
        chequeAmount: 5000,
      });

      expect(message.from).toBe('MegaCorp Industries');
      expect(message.fromName).toBe('MegaCorp Industries');
      expect(message.subject).toBe('Payment for Data Recovery');
      expect(message.from).not.toContain('{clientName}');
      expect(message.subject).not.toContain('{missionTitle}');
    });
  });

  describe('New story arc templates - existence and fields', () => {
    it('should have lockdown-complete template with required fields', () => {
      const template = MESSAGE_TEMPLATES['lockdown-complete'];
      expect(template).toBeDefined();
      expect(template.from).toBeDefined();
      expect(template.subject).toBeDefined();
      expect(template.body).toBeDefined();
      expect(template.fromId).toBeDefined();
      expect(template.subject).toBe('Data Recovered - Pacific Freight');
    });

    it('should have manhunt-success template with required fields', () => {
      const template = MESSAGE_TEMPLATES['manhunt-success'];
      expect(template).toBeDefined();
      expect(template.from).toBeDefined();
      expect(template.subject).toBeDefined();
      expect(template.body).toBeDefined();
      expect(template.fromId).toBeDefined();
    });

    it('should have manhunt-beta-discovered template with required fields', () => {
      const template = MESSAGE_TEMPLATES['manhunt-beta-discovered'];
      expect(template).toBeDefined();
      expect(template.from).toBeDefined();
      expect(template.subject).toBeDefined();
      expect(template.body).toBeDefined();
      expect(template.subject).toBe('Next Hop Found - DarkNode-Beta');
    });

    it('should have manhunt-origin-discovered template with required fields', () => {
      const template = MESSAGE_TEMPLATES['manhunt-origin-discovered'];
      expect(template).toBeDefined();
      expect(template.from).toBeDefined();
      expect(template.subject).toBeDefined();
      expect(template.body).toBeDefined();
      expect(template.subject).toBe('Origin Located - DarkNode-Origin');
    });

    it('should have sniffer-intro template', () => {
      const template = MESSAGE_TEMPLATES['sniffer-intro'];
      expect(template).toBeDefined();
      expect(template.subject).toBe('New Tool Available - Network Sniffer');
    });

    it('should have relay-system-unlock template with trace warning', () => {
      const template = MESSAGE_TEMPLATES['relay-system-unlock'];
      expect(template).toBeDefined();
      expect(template.body).toContain('TWO rebuilds');
    });

    it('should have cracking-intro template', () => {
      const template = MESSAGE_TEMPLATES['cracking-intro'];
      expect(template).toBeDefined();
      expect(template.subject).toBe('Password Cracking Tools - Ready');
    });

    it('should have cracking-intrusion-alert template', () => {
      const template = MESSAGE_TEMPLATES['cracking-intrusion-alert'];
      expect(template).toBeDefined();
      expect(template.subject).toBe('ALERT: They Found You');
    });

    it('should have relay-practice-intro template', () => {
      const template = MESSAGE_TEMPLATES['relay-practice-intro'];
      expect(template).toBeDefined();
      expect(template.subject).toBe('Behind Enemy Lines - New Mission');
    });
  });

  describe('createMessageFromTemplate - new templates', () => {
    it('should create lockdown-complete message with placeholders replaced', () => {
      const message = createMessageFromTemplate('lockdown-complete', {
        username: 'agent_x',
        managerName: 'Sam',
      });

      expect(message).toBeDefined();
      expect(message.body).toContain('agent_x');
      expect(message.body).toContain('Sam');
      expect(message.body).not.toContain('{username}');
      expect(message.body).not.toContain('{managerName}');
    });

    it('should create manhunt-success message', () => {
      const message = createMessageFromTemplate('manhunt-success', {
        username: 'test_user',
        managerName: 'Jordan',
      });

      expect(message).toBeDefined();
      expect(message.from).toBe('SourceNet Manager');
      expect(message.body).toContain('test_user');
      expect(message.body).toContain('Jordan');
    });

    it('should create sniffer-intro message', () => {
      const message = createMessageFromTemplate('sniffer-intro', {
        username: 'operative',
        managerName: 'Alex',
      });

      expect(message).toBeDefined();
      expect(message.subject).toBe('New Tool Available - Network Sniffer');
      expect(message.body).toContain('operative');
      expect(message.body).toContain('50,000 credits');
    });
  });
});

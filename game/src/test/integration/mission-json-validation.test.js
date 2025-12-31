import { describe, it, expect } from 'vitest';
import { storyEvents, tutorialMissions, postTutorialMissions, allMissions } from '../../missions/missionData';

/**
 * JSON Validation Tests
 * Validates all mission and story event JSON files have correct structure and valid references
 */

describe('Mission JSON Validation', () => {
  describe('All Missions - Required Fields', () => {
    it('should have missionId', () => {
      [...storyEvents, ...allMissions].forEach((mission) => {
        expect(mission.missionId).toBeDefined();
        expect(typeof mission.missionId).toBe('string');
      });
    });

    it('should have category', () => {
      [...storyEvents, ...allMissions].forEach((mission) => {
        expect(mission.category).toBeDefined();
      });
    });
  });

  describe('Story Events - Structure Validation', () => {
    it('should have events array', () => {
      storyEvents.forEach((storyEvent) => {
        expect(Array.isArray(storyEvent.events)).toBe(true);
        expect(storyEvent.events.length).toBeGreaterThan(0);
      });
    });

    it('should have valid trigger types', () => {
      storyEvents.forEach((storyEvent) => {
        storyEvent.events.forEach((event) => {
          expect(event.trigger).toBeDefined();
          expect(event.trigger.type).toBeDefined();
          expect(['timeSinceEvent', 'afterObjectiveComplete']).toContain(event.trigger.type);
        });
      });
    });

    it('should have valid event names', () => {
      storyEvents.forEach((storyEvent) => {
        storyEvent.events.forEach((event) => {
          expect(event.trigger.event).toBeDefined();
          expect(typeof event.trigger.event).toBe('string');
        });
      });
    });

    it('should have message data', () => {
      storyEvents.forEach((storyEvent) => {
        storyEvent.events.forEach((event) => {
          expect(event.message).toBeDefined();
          expect(event.message.from).toBeDefined();
          expect(event.message.subject).toBeDefined();
          expect(event.message.body).toBeDefined();
        });
      });
    });
  });

  describe('Tutorial Missions - Structure Validation', () => {
    it('should have triggers', () => {
      tutorialMissions.forEach((mission) => {
        expect(mission.triggers).toBeDefined();
        expect(mission.triggers.start).toBeDefined();
      });
    });

    it('should have objectives', () => {
      tutorialMissions.forEach((mission) => {
        expect(Array.isArray(mission.objectives)).toBe(true);
        expect(mission.objectives.length).toBeGreaterThan(0);
      });
    });

    it('should have valid objective types', () => {
      const validTypes = ['networkConnection', 'networkScan', 'fileSystemConnection', 'fileOperation'];
      tutorialMissions.forEach((mission) => {
        mission.objectives.forEach((obj) => {
          expect(obj.type).toBeDefined();
          expect(validTypes).toContain(obj.type);
        });
      });
    });

    it('should have basePayout', () => {
      tutorialMissions.forEach((mission) => {
        expect(mission.basePayout).toBeDefined();
        expect(typeof mission.basePayout).toBe('number');
      });
    });
  });

  describe('Post-Tutorial Missions - Structure Validation', () => {
    it('should have requirements', () => {
      postTutorialMissions.forEach((mission) => {
        expect(mission.requirements).toBeDefined();
        expect(mission.requirements.software).toBeDefined();
        expect(Array.isArray(mission.requirements.software)).toBe(true);
      });
    });

    it('should have consequences', () => {
      postTutorialMissions.forEach((mission) => {
        expect(mission.consequences).toBeDefined();
        expect(mission.consequences.success).toBeDefined();
        expect(mission.consequences.failure).toBeDefined();
      });
    });
  });

  describe('Cross-Reference Validation', () => {
    it('should have unique mission IDs', () => {
      const allIds = [...storyEvents, ...allMissions].map((m) => m.missionId);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('story event message IDs should be valid if referenced', () => {
      // Check if any triggers reference specific message IDs
      storyEvents.forEach((storyEvent) => {
        storyEvent.events.forEach((event) => {
          if (event.trigger.condition && event.trigger.condition.messageId) {
            const messageId = event.trigger.condition.messageId;
            // Should be a string starting with 'msg-'
            expect(messageId).toMatch(/^msg-/);
          }
        });
      });
    });

    it('software IDs in requirements should exist', () => {
      const validSoftwareIds = [
        'vpn-client',
        'network-scanner',
        'file-manager',
        'network-address-register',
        'mission-board',
      ];

      allMissions.forEach((mission) => {
        if (mission.requirements && mission.requirements.software) {
          mission.requirements.software.forEach((softwareId) => {
            expect(validSoftwareIds).toContain(softwareId);
          });
        }
      });
    });
  });
});

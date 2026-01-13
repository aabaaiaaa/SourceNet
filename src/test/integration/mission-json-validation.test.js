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

    it('should have valid event or conditions', () => {
      storyEvents.forEach((storyEvent) => {
        storyEvent.events.forEach((event) => {
          // Must have either explicit event OR conditions array
          const hasExplicitEvent = event.trigger.event !== undefined;
          const hasConditions = Array.isArray(event.trigger.conditions);
          expect(hasExplicitEvent || hasConditions).toBe(true);

          // If has explicit event, it must be a string
          if (hasExplicitEvent) {
            expect(typeof event.trigger.event).toBe('string');
          }

          // If has conditions, each must have a type
          if (hasConditions) {
            event.trigger.conditions.forEach(condition => {
              expect(condition.type).toBeDefined();
              expect(['messageRead', 'softwareInstalled', 'eventData']).toContain(condition.type);
            });
          }
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
      const validTypes = ['networkConnection', 'networkScan', 'fileSystemConnection', 'fileOperation', 'narEntryAdded', 'verification'];
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

  describe('Trigger Condition Validation', () => {
    it('should have valid condition fields', () => {
      [...storyEvents, ...allMissions].forEach((item) => {
        // Check story events
        if (item.events) {
          item.events.forEach((event) => {
            if (event.trigger.condition) {
              // Condition should be an object
              expect(typeof event.trigger.condition).toBe('object');
              // If has messageId, should start with msg-
              if (event.trigger.condition.messageId) {
                expect(event.trigger.condition.messageId).toMatch(/^msg-/);
              }
              // If has softwareId, should be kebab-case
              if (event.trigger.condition.softwareId) {
                expect(event.trigger.condition.softwareId).toMatch(/^[a-z-]+$/);
              }
            }
          });
        }
        // Check missions
        if (item.triggers && item.triggers.start && item.triggers.start.condition) {
          const condition = item.triggers.start.condition;
          expect(typeof condition).toBe('object');
        }
      });
    });

    it('should have valid delay values', () => {
      [...storyEvents, ...allMissions].forEach((item) => {
        if (item.events) {
          item.events.forEach((event) => {
            if (event.trigger.delay !== undefined) {
              expect(typeof event.trigger.delay).toBe('number');
              expect(event.trigger.delay).toBeGreaterThanOrEqual(0);
            }
          });
        }
        if (item.triggers && item.triggers.start && item.triggers.start.delay !== undefined) {
          expect(typeof item.triggers.start.delay).toBe('number');
        }
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

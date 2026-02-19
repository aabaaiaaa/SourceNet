import { describe, it, expect } from 'vitest';
import { storyEvents, tutorialMissions, allMissions } from '../../missions/missionData';
import lockedOut from '../../missions/data/locked-out.json';
import behindEnemyLines from '../../missions/data/behind-enemy-lines.json';
import lockdown from '../../missions/data/lockdown.json';
import digitalManhunt from '../../missions/data/digital-manhunt.json';

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
      const validTypes = [
        'networkConnection', 'networkScan', 'fileSystemConnection', 'fileOperation',
        'narEntryAdded', 'credentialExtraction', 'verification',
        'passwordCrack', 'investigation', 'fileRecovery', 'fileDecryption', 'fileUpload',
        'dataRecoveryScan', 'secureDelete',
      ];
      allMissions.forEach((mission) => {
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
        'log-viewer',
        'data-recovery-tool',
        'decryption-tool',
        'password-cracker',
        'network-sniffer',
        'vpn-relay-upgrade',
        'trace-monitor',
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

  describe('Locked Out - Mission-Specific Validation', () => {
    it('should have networkConnection and passwordCrack objectives', () => {
      const types = lockedOut.objectives.map(o => o.type);
      expect(types).toContain('networkConnection');
      expect(types).toContain('passwordCrack');
    });

    it('should have at least 2 passwordCrack objectives', () => {
      const cracks = lockedOut.objectives.filter(o => o.type === 'passwordCrack');
      expect(cracks.length).toBeGreaterThanOrEqual(2);
    });

    it('should have scripted events including unlockFeature and generateRelayNodes', () => {
      const actionTypes = lockedOut.scriptedEvents.flatMap(se => se.actions.map(a => a.type));
      expect(actionTypes).toContain('unlockFeature');
      expect(actionTypes).toContain('generateRelayNodes');
    });

    it('should revoke meridian-internal on completion', () => {
      const meridian = lockedOut.networks.find(n => n.networkId === 'meridian-internal');
      expect(meridian).toBeDefined();
      expect(meridian.revokeOnComplete).toBe(true);
    });
  });

  describe('Behind Enemy Lines - Mission-Specific Validation', () => {
    it('should have revokeOnComplete on coastal-ops', () => {
      const coastal = behindEnemyLines.networks.find(n => n.networkId === 'coastal-ops');
      expect(coastal).toBeDefined();
      expect(coastal.revokeOnComplete).toBe(true);
    });

    it('should have hostile flag on coastal-ops', () => {
      const coastal = behindEnemyLines.networks.find(n => n.networkId === 'coastal-ops');
      expect(coastal.hostile).toBe(true);
    });

    it('should have startTrace scripted event', () => {
      const traceEvent = behindEnemyLines.scriptedEvents.find(
        se => se.actions.some(a => a.type === 'startTrace')
      );
      expect(traceEvent).toBeDefined();
    });

    it('should have investigation and fileRecovery objectives', () => {
      const types = behindEnemyLines.objectives.map(o => o.type);
      expect(types).toContain('investigation');
      expect(types).toContain('fileRecovery');
    });
  });

  describe('Lockdown - Mission-Specific Validation', () => {
    it('should have pfs-backup-safe network', () => {
      const backup = lockdown.networks.find(n => n.networkId === 'pfs-backup-safe');
      expect(backup).toBeDefined();
    });

    it('should have obj-backup-data paste objective with destination 10.200.50.5', () => {
      const backup = lockdown.objectives.find(o => o.id === 'obj-backup-data');
      expect(backup).toBeDefined();
      expect(backup.type).toBe('fileOperation');
      expect(backup.operation).toBe('paste');
      expect(backup.destination).toBe('10.200.50.5');
    });

    it('should revoke both pacific-freight and pfs-backup-safe on complete', () => {
      const pacific = lockdown.networks.find(n => n.networkId === 'pacific-freight');
      const backup = lockdown.networks.find(n => n.networkId === 'pfs-backup-safe');
      expect(pacific.revokeOnComplete).toBe(true);
      expect(backup.revokeOnComplete).toBe(true);
    });

    it('should have credentialExtraction objective', () => {
      const types = lockdown.objectives.map(o => o.type);
      expect(types).toContain('credentialExtraction');
    });
  });

  describe('Digital Manhunt - Mission-Specific Validation', () => {
    it('should have exactly 3 initial objectives', () => {
      expect(digitalManhunt.objectives).toHaveLength(3);
      const ids = digitalManhunt.objectives.map(o => o.id);
      expect(ids).toContain('obj-connect-alpha');
      expect(ids).toContain('obj-crack-alpha-logs');
      expect(ids).toContain('obj-decrypt-next-hop');
    });

    it('should have addExtensionObjectives in scripted events', () => {
      const extensionActions = digitalManhunt.scriptedEvents.flatMap(
        se => se.actions.filter(a => a.type === 'addExtensionObjectives')
      );
      expect(extensionActions.length).toBeGreaterThanOrEqual(2);
    });

    it('should have introMessage in triggers.start', () => {
      expect(digitalManhunt.triggers.start.introMessage).toBeDefined();
      expect(digitalManhunt.triggers.start.introMessage.from).toBeDefined();
      expect(digitalManhunt.triggers.start.introMessage.subject).toBeDefined();
    });

    it('should have all 3 networks with revokeOnComplete', () => {
      expect(digitalManhunt.networks).toHaveLength(3);
      digitalManhunt.networks.forEach(network => {
        expect(network.revokeOnComplete).toBe(true);
      });
    });

    it('should have obj-copy-evidence with destination local in extension objectives', () => {
      // obj-copy-evidence is added via scripted event, find it there
      const allExtensionObjectives = digitalManhunt.scriptedEvents
        .flatMap(se => se.actions)
        .filter(a => a.type === 'addExtensionObjectives')
        .flatMap(a => a.objectives);

      const copyEvidence = allExtensionObjectives.find(o => o.id === 'obj-copy-evidence');
      expect(copyEvidence).toBeDefined();
      expect(copyEvidence.destination).toBe('local');
    });

    it('should have all 3 darknode networks as hostile', () => {
      digitalManhunt.networks.forEach(network => {
        expect(network.hostile).toBe(true);
        expect(network.networkId).toMatch(/^darknode-/);
      });
    });
  });
});

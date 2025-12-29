import { describe, it, expect } from 'vitest';
import {
  canAcceptMission,
  initializeMissionObjectives,
  areAllObjectivesComplete,
  hasFailedObjective,
  updateObjectiveStatus,
  calculateCooldownEndTime,
  isCooldownExpired,
  calculateMissionPayout,
  calculateMissionDuration,
  createCompletedMission,
} from './MissionSystem';

describe('MissionSystem', () => {
  describe('canAcceptMission', () => {
    const mockMission = {
      id: 'mission-1',
      title: 'Test Mission',
      requirements: {
        software: ['vpn-client', 'network-scanner'],
      },
      minReputation: 5,
    };

    it('should allow mission if all requirements met', () => {
      const result = canAcceptMission(
        mockMission,
        ['vpn-client', 'network-scanner', 'file-manager'],
        6,
        null
      );

      expect(result.canAccept).toBe(true);
      expect(result.reason).toBe(null);
    });

    it('should block if active mission exists', () => {
      const result = canAcceptMission(
        mockMission,
        ['vpn-client', 'network-scanner'],
        6,
        { id: 'active-mission' }
      );

      expect(result.canAccept).toBe(false);
      expect(result.reason).toContain('already have an active mission');
    });

    it('should block if missing software', () => {
      const result = canAcceptMission(
        mockMission,
        ['vpn-client'], // Missing network-scanner
        6,
        null
      );

      expect(result.canAccept).toBe(false);
      expect(result.reason).toContain('Missing required software');
      expect(result.reason).toContain('network-scanner');
    });

    it('should block if reputation too low', () => {
      const result = canAcceptMission(
        mockMission,
        ['vpn-client', 'network-scanner'],
        3, // Below minimum of 5
        null
      );

      expect(result.canAccept).toBe(false);
      expect(result.reason).toContain('Requires reputation tier 5');
    });
  });

  describe('initializeMissionObjectives', () => {
    it('should initialize objectives with pending status', () => {
      const objectiveDefs = [
        { id: 'obj-1', description: 'Connect to VPN' },
        { id: 'obj-2', description: 'Scan network' },
      ];

      const objectives = initializeMissionObjectives(objectiveDefs);

      expect(objectives).toHaveLength(2);
      expect(objectives[0].status).toBe('pending');
      expect(objectives[1].status).toBe('pending');
    });

    it('should preserve objective properties', () => {
      const objectiveDefs = [
        { id: 'obj-1', description: 'Connect', type: 'network', target: 'test' },
      ];

      const objectives = initializeMissionObjectives(objectiveDefs);

      expect(objectives[0].id).toBe('obj-1');
      expect(objectives[0].description).toBe('Connect');
      expect(objectives[0].type).toBe('network');
      expect(objectives[0].target).toBe('test');
    });
  });

  describe('areAllObjectivesComplete', () => {
    it('should return true when all complete', () => {
      const objectives = [
        { id: 'obj-1', status: 'complete' },
        { id: 'obj-2', status: 'complete' },
      ];

      expect(areAllObjectivesComplete(objectives)).toBe(true);
    });

    it('should return false when any pending', () => {
      const objectives = [
        { id: 'obj-1', status: 'complete' },
        { id: 'obj-2', status: 'pending' },
      ];

      expect(areAllObjectivesComplete(objectives)).toBe(false);
    });

    it('should return true for empty objectives', () => {
      expect(areAllObjectivesComplete([])).toBe(true);
    });
  });

  describe('hasFailedObjective', () => {
    it('should return true if any failed', () => {
      const objectives = [
        { id: 'obj-1', status: 'complete' },
        { id: 'obj-2', status: 'failed' },
      ];

      expect(hasFailedObjective(objectives)).toBe(true);
    });

    it('should return false if none failed', () => {
      const objectives = [
        { id: 'obj-1', status: 'complete' },
        { id: 'obj-2', status: 'pending' },
      ];

      expect(hasFailedObjective(objectives)).toBe(false);
    });
  });

  describe('updateObjectiveStatus', () => {
    it('should update specified objective', () => {
      const objectives = [
        { id: 'obj-1', status: 'pending' },
        { id: 'obj-2', status: 'pending' },
      ];

      const updated = updateObjectiveStatus(objectives, 'obj-1', 'complete');

      expect(updated[0].status).toBe('complete');
      expect(updated[1].status).toBe('pending');
    });

    it('should not mutate original array', () => {
      const objectives = [{ id: 'obj-1', status: 'pending' }];
      const updated = updateObjectiveStatus(objectives, 'obj-1', 'complete');

      expect(objectives[0].status).toBe('pending'); // Original unchanged
      expect(updated[0].status).toBe('complete'); // New array updated
    });
  });

  describe('calculateCooldownEndTime', () => {
    it('should return null for Easy missions', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const endTime = calculateCooldownEndTime('Easy', currentTime);

      expect(endTime).toBe(null);
    });

    it('should return 12 minutes for Medium missions', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const endTime = calculateCooldownEndTime('Medium', currentTime);

      const end = new Date(endTime);
      const diff = (end - currentTime) / 1000 / 60; // minutes

      expect(diff).toBe(12);
    });

    it('should return 37 minutes for Hard missions', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      const endTime = calculateCooldownEndTime('Hard', currentTime);

      const end = new Date(endTime);
      const diff = (end - currentTime) / 1000 / 60; // minutes

      expect(diff).toBe(37);
    });
  });

  describe('isCooldownExpired', () => {
    it('should return true if no cooldown', () => {
      const currentTime = new Date('2020-03-25T10:00:00');
      expect(isCooldownExpired(null, currentTime)).toBe(true);
    });

    it('should return true if cooldown time passed', () => {
      const cooldownEnd = new Date('2020-03-25T10:00:00').toISOString();
      const currentTime = new Date('2020-03-25T10:05:00');

      expect(isCooldownExpired(cooldownEnd, currentTime)).toBe(true);
    });

    it('should return false if cooldown still active', () => {
      const cooldownEnd = new Date('2020-03-25T10:15:00').toISOString();
      const currentTime = new Date('2020-03-25T10:05:00');

      expect(isCooldownExpired(cooldownEnd, currentTime)).toBe(false);
    });

    it('should return true at exact cooldown end time', () => {
      const cooldownEnd = new Date('2020-03-25T10:15:00').toISOString();
      const currentTime = new Date('2020-03-25T10:15:00');

      expect(isCooldownExpired(cooldownEnd, currentTime)).toBe(true);
    });
  });

  describe('calculateMissionPayout', () => {
    it('should apply reputation multipliers correctly', () => {
      expect(calculateMissionPayout(1000, 1)).toBe(500); // 0.5x
      expect(calculateMissionPayout(1000, 3)).toBe(850); // 0.85x
      expect(calculateMissionPayout(1000, 5)).toBe(1000); // 1.0x
      expect(calculateMissionPayout(1000, 9)).toBe(1500); // 1.5x
      expect(calculateMissionPayout(1000, 11)).toBe(2000); // 2.0x
    });

    it('should floor decimal results', () => {
      expect(calculateMissionPayout(1000, 3)).toBe(850); // 0.85 * 1000 = 850
    });

    it('should handle invalid reputation gracefully', () => {
      // Should default to 1.0x
      expect(calculateMissionPayout(1000, 99)).toBe(1000);
    });
  });

  describe('calculateMissionDuration', () => {
    it('should calculate duration in minutes', () => {
      const startTime = '2020-03-25T10:00:00.000Z';
      const endTime = '2020-03-25T10:15:00.000Z';

      const duration = calculateMissionDuration(startTime, endTime);
      expect(duration).toBe(15);
    });

    it('should floor partial minutes', () => {
      const startTime = '2020-03-25T10:00:00.000Z';
      const endTime = '2020-03-25T10:05:30.000Z'; // 5.5 minutes

      const duration = calculateMissionDuration(startTime, endTime);
      expect(duration).toBe(5);
    });
  });

  describe('createCompletedMission', () => {
    it('should create success mission record', () => {
      const mission = {
        id: 'tutorial-1',
        title: 'Log File Repair',
        client: 'Client A',
        difficulty: 'Easy',
        basePayout: 2000,
      };

      const completionTime = new Date('2020-03-25T10:30:00');
      const record = createCompletedMission(mission, 'success', 2000, 0, completionTime, 15);

      expect(record.id).toBe('tutorial-1');
      expect(record.status).toBe('success');
      expect(record.payout).toBe(2000);
      expect(record.reputationChange).toBe(0);
      expect(record.duration).toBe(15);
    });

    it('should create failed mission record', () => {
      const mission = {
        id: 'tutorial-1',
        title: 'Log File Repair',
        client: 'Client A',
        difficulty: 'Easy',
        basePayout: 2000,
      };

      const completionTime = new Date('2020-03-25T10:30:00');
      const record = createCompletedMission(mission, 'failed', -10000, -6, completionTime, 10);

      expect(record.status).toBe('failed');
      expect(record.payout).toBe(-10000);
      expect(record.reputationChange).toBe(-6);
    });
  });
});

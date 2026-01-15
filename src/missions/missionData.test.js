import { describe, it, expect } from 'vitest';
import {
  storyEvents,
  tutorialMissions,
  postTutorialMissions,
  allMissions,
  getMissionById,
  getMissionsByCategory,
} from './missionData';

describe('missionData', () => {
  describe('Story Events', () => {
    it('should have welcome-messages event', () => {
      expect(storyEvents.length).toBeGreaterThan(0);
      const welcomeMsg = storyEvents.find(e => e.missionId === 'welcome-messages');
      expect(welcomeMsg).toBeDefined();
    });

    it('should have mission-board-intro event', () => {
      const intro = storyEvents.find(e => e.missionId === 'mission-board-intro');
      expect(intro).toBeDefined();
    });
  });

  describe('Tutorial Missions', () => {
    it('should have tutorial-part-1', () => {
      const tutorial1 = tutorialMissions.find(m => m.missionId === 'tutorial-part-1');
      expect(tutorial1).toBeDefined();
      expect(tutorial1.title).toBe('Log File Repair');
    });

    it('should have tutorial-part-2', () => {
      const tutorial2 = tutorialMissions.find(m => m.missionId === 'tutorial-part-2');
      expect(tutorial2).toBeDefined();
      expect(tutorial2.title).toBe('Log File Restoration');
    });
  });

  describe('getMissionById', () => {
    it('should find mission by ID', () => {
      const mission = getMissionById('tutorial-part-1');
      expect(mission).toBeDefined();
      expect(mission.missionId).toBe('tutorial-part-1');
    });

    it('should return null for unknown ID', () => {
      const mission = getMissionById('unknown-mission');
      expect(mission).toBe(null);
    });
  });

  describe('getMissionsByCategory', () => {
    it('should filter by category', () => {
      const tutorials = getMissionsByCategory('story-tutorial');
      expect(tutorials.length).toBeGreaterThan(0);
      expect(tutorials.every(m => m.category === 'story-tutorial')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const unknown = getMissionsByCategory('unknown-category');
      expect(Array.isArray(unknown)).toBe(true);
      expect(unknown.length).toBe(0);
    });
  });

  describe('All Missions', () => {
    it('should combine tutorial and post-tutorial missions', () => {
      expect(allMissions.length).toBe(tutorialMissions.length + postTutorialMissions.length);
    });

    it('should have no duplicate mission IDs', () => {
      const ids = allMissions.map(m => m.missionId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

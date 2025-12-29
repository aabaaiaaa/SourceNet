/**
 * Mission Data Loader - Import and provide all mission JSON definitions
 *
 * This module imports all story mission JSON files and provides them
 * to the Story Mission Manager for registration.
 */

import phase1Welcome from './data/phase1-welcome.json';
import missionBoardIntro from './data/mission-board-intro.json';
import tutorialPart1 from './data/tutorial-part-1.json';
import tutorialPart2 from './data/tutorial-part-2.json';
import fileBackup01 from './data/post-tutorial/file-backup-01.json';
import fileBackup02 from './data/post-tutorial/file-backup-02.json';
import fileRepair01 from './data/post-tutorial/file-repair-01.json';
import fileRepair02 from './data/post-tutorial/file-repair-02.json';
import fileRestoration01 from './data/post-tutorial/file-restoration-01.json';
import fileRestoration02 from './data/post-tutorial/file-restoration-02.json';
import combinedTasks01 from './data/post-tutorial/combined-tasks-01.json';

/**
 * All story event definitions (Phase 1 messages)
 */
export const storyEvents = [
  phase1Welcome,
  missionBoardIntro,
];

/**
 * All tutorial missions
 */
export const tutorialMissions = [
  tutorialPart1,
  tutorialPart2,
];

/**
 * All post-tutorial missions
 */
export const postTutorialMissions = [
  fileBackup01,
  fileBackup02,
  fileRepair01,
  fileRepair02,
  fileRestoration01,
  fileRestoration02,
  combinedTasks01,
];

/**
 * All missions combined
 */
export const allMissions = [
  ...tutorialMissions,
  ...postTutorialMissions,
];

/**
 * Get mission by ID
 * @param {string} missionId - Mission ID
 * @returns {object|null} Mission definition or null
 */
export const getMissionById = (missionId) => {
  return allMissions.find((m) => m.missionId === missionId) || null;
};

/**
 * Get missions by category
 * @param {string} category - Mission category
 * @returns {array} Missions in category
 */
export const getMissionsByCategory = (category) => {
  return allMissions.filter((m) => m.category === category);
};

/**
 * Initialize all story missions
 * Call this on game start to register all missions with Story Mission Manager
 *
 * @param {object} storyMissionManager - Story Mission Manager instance
 */
export const initializeAllMissions = (storyMissionManager) => {
  // Register all missions
  allMissions.forEach((mission) => {
    storyMissionManager.registerMission(mission);
  });

  console.log(`✅ Loaded ${allMissions.length} story missions`);
};

export default {
  storyEvents,
  tutorialMissions,
  postTutorialMissions,
  allMissions,
  getMissionById,
  getMissionsByCategory,
  initializeAllMissions,
};

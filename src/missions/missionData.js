/**
 * Mission Data Loader - Import and provide all mission JSON definitions
 *
 * This module imports all story mission JSON files and provides them
 * to the Story Mission Manager for registration.
 * 
 * NOTE: Post-tutorial missions are now generated procedurally by
 * MissionGenerator.js and MissionPoolManager.js. The story missions
 * below handle the tutorial flow and initial game setup only.
 */

import welcomeMessages from './data/welcome-messages.json';
import missionBoardIntro from './data/mission-board-intro.json';
import tutorialPart1 from './data/tutorial-part-1.json';
import tutorialPart2 from './data/tutorial-part-2.json';
import investigationIntro from './data/investigation-intro.json';
import dataDetective from './data/data-detective.json';
import ransomwareRecovery from './data/ransomware-recovery.json';

/**
 * All story event definitions (initial welcome messages)
 */
export const storyEvents = [
  welcomeMessages,
  missionBoardIntro,
  investigationIntro,
];

/**
 * All tutorial missions
 */
export const tutorialMissions = [
  tutorialPart1,
  tutorialPart2,
];

/**
 * Story missions (post-tutorial, non-procedural)
 */
export const storyMissions = [
  dataDetective,
  ransomwareRecovery,
];

/**
 * All missions combined (tutorial + story missions)
 */
export const allMissions = [
  ...tutorialMissions,
  ...storyMissions,
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
  // Register story events (welcome messages, tutorial intro)
  storyEvents.forEach((event) => {
    storyMissionManager.registerMission(event);
  });

  // Register tutorial missions only (post-tutorial is procedural)
  allMissions.forEach((mission) => {
    storyMissionManager.registerMission(mission);
  });

  console.log(`✅ Loaded ${storyEvents.length} story events and ${allMissions.length} tutorial missions`);
  console.log(`ℹ️ Post-tutorial missions are procedurally generated`);
};

export default {
  storyEvents,
  tutorialMissions,
  storyMissions,
  allMissions,
  getMissionById,
  getMissionsByCategory,
  initializeAllMissions,
};

// Utility helper functions

/**
 * Generate a random SNet Mail ID (SNET-XXX-XXX-XXX format)
 */
export const generateMailId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  return `SNET-${segment()}-${segment()}-${segment()}`;
};

/**
 * Generate a random username in agent_XXXX format
 */
export const generateUsername = () => {
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `agent_${num}`;
};

/**
 * Format date/time as dd/mm/yyyy hh:mm:ss
 * Handles both Date objects and date strings
 */
export const formatDateTime = (date) => {
  // Convert to Date object if it's a string
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const pad = (num) => num.toString().padStart(2, '0');

  const day = pad(dateObj.getDate());
  const month = pad(dateObj.getMonth() + 1);
  const year = dateObj.getFullYear();
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Calculate total power consumption
 */
export const calculatePowerConsumption = (hardware) => {
  let total = 0;

  if (hardware.cpu) total += hardware.cpu.power || 0;
  if (hardware.memory) {
    hardware.memory.forEach((mem) => (total += mem.power || 0));
  }
  if (hardware.storage) {
    hardware.storage.forEach((stor) => (total += stor.power || 0));
  }
  if (hardware.motherboard) total += hardware.motherboard.power || 0;
  if (hardware.network) total += hardware.network.power || 0;

  return total;
};

/**
 * Check if hardware is installed
 */
export const isHardwareInstalled = (hardwareItem, installedHardware) => {
  const { cpu, memory, storage, motherboard, powerSupply, network } = installedHardware;

  if (cpu && cpu.id === hardwareItem.id) return true;
  if (motherboard && motherboard.id === hardwareItem.id) return true;
  if (powerSupply && powerSupply.id === hardwareItem.id) return true;
  if (network && network.id === hardwareItem.id) return true;

  if (memory && memory.some((m) => m.id === hardwareItem.id)) return true;
  if (storage && storage.some((s) => s.id === hardwareItem.id)) return true;

  return false;
};

/**
 * Calculate cascade position for new window
 */
export const calculateCascadePosition = (existingWindows) => {
  const CASCADE_OFFSET = 30;
  const BASE_X = 50;
  const BASE_Y = 100;

  const openWindows = existingWindows.filter((w) => !w.minimized);
  const offset = openWindows.length * CASCADE_OFFSET;

  return {
    x: BASE_X + offset,
    y: BASE_Y + offset,
  };
};

/**
 * Generate a random first name from list
 */
export const getRandomManagerName = (namesList) => {
  return namesList[Math.floor(Math.random() * namesList.length)];
};

/**
 * Calculate checksum (simple implementation for display purposes)
 */
export const calculateChecksum = (str) => {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  return sum.toString(16).toUpperCase().padStart(8, '0');
};

/**
 * Save game state to localStorage
 */
export const saveGameState = (username, gameState, saveName = null) => {
  const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');

  if (!saves[username]) {
    saves[username] = [];
  }

  const saveData = {
    ...gameState,
    savedAt: new Date().toISOString(),
    saveName: saveName || formatDateTime(new Date(gameState.currentTime)),
  };

  saves[username].push(saveData);
  localStorage.setItem('sourcenet_saves', JSON.stringify(saves));

  return saveData;
};

/**
 * Load latest game state for username from localStorage
 */
export const loadGameState = (username) => {
  const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');

  if (!saves[username] || saves[username].length === 0) {
    return null;
  }

  // Sort by savedAt (real-time) and return latest
  const sortedSaves = saves[username].sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );

  return sortedSaves[0];
};

/**
 * Get all saved games
 */
export const getAllSaves = () => {
  const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
  return saves;
};

/**
 * Delete a save
 */
export const deleteSave = (username) => {
  const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
  delete saves[username];
  localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
};

/**
 * Check if any saves exist
 */
export const hasSaves = () => {
  const saves = getAllSaves();
  return Object.keys(saves).length > 0;
};

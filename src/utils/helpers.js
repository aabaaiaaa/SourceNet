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
 * Safely parse saves from localStorage, returning empty object on error
 */
const safeParseSaves = () => {
  try {
    const raw = localStorage.getItem('sourcenet_saves');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Validate it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('Invalid saves format in localStorage, resetting');
      return {};
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse saves from localStorage:', e);
    return {};
  }
};

/**
 * Save game state to localStorage
 */
export const saveGameState = (username, gameState, saveName = null) => {
  const saves = safeParseSaves();

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
export const loadGameState = (username, saveIndex = null) => {
  const saves = safeParseSaves();

  if (!saves[username] || saves[username].length === 0) {
    return null;
  }

  // Sort by savedAt (real-time), newest first
  const sortedSaves = [...saves[username]].sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );

  // If saveIndex provided, return that specific save
  if (saveIndex !== null && saveIndex >= 0 && saveIndex < sortedSaves.length) {
    return sortedSaves[saveIndex];
  }

  // Default to latest
  return sortedSaves[0];
};

/**
 * Get all saves for a specific username, sorted by savedAt (newest first)
 */
export const getSavesForUser = (username) => {
  const saves = safeParseSaves();

  if (!saves[username] || saves[username].length === 0) {
    return [];
  }

  return [...saves[username]].sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );
};

/**
 * Get all saves flattened into a single array with username attached, sorted by savedAt (newest first)
 */
export const getAllSavesFlat = () => {
  const saves = safeParseSaves();
  const flatSaves = [];

  Object.entries(saves).forEach(([username, userSaves]) => {
    // userSaves should be an array; if not, skip this entry
    if (!Array.isArray(userSaves)) {
      console.warn(`Invalid saves format for user ${username}, expected array`);
      return;
    }
    userSaves.forEach((save, index) => {
      flatSaves.push({
        ...save,
        username,
        _originalIndex: index,
      });
    });
  });

  // Sort by savedAt, newest first
  return flatSaves.sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );
};

/**
 * Get all saved games (raw structure)
 */
export const getAllSaves = () => {
  return safeParseSaves();
};

/**
 * Delete a save - if saveIndex provided, delete specific save; otherwise delete all saves for username
 */
export const deleteSave = (username, saveIndex = null) => {
  const saves = safeParseSaves();

  if (saveIndex !== null && saves[username]) {
    // Sort to match the order used elsewhere
    const sortedSaves = [...saves[username]].sort(
      (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
    );
    // Remove the specific save
    sortedSaves.splice(saveIndex, 1);

    if (sortedSaves.length === 0) {
      delete saves[username];
    } else {
      saves[username] = sortedSaves;
    }
  } else {
    delete saves[username];
  }

  localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
};

/**
 * Check if any saves exist
 */
export const hasSaves = () => {
  const saves = getAllSaves();
  return Object.keys(saves).length > 0;
};

/**
 * Get a sanitized name prefix from a client/organization name.
 * Strips special characters, takes enough words to reach at least minLength characters.
 * 
 * @param {string} name - The full name (e.g., "St. Mary's Regional Hospital")
 * @param {Object} options - Configuration options
 * @param {boolean} options.lowercase - If true, returns lowercase (for hostnames). Default false (PascalCase).
 * @param {number} options.minLength - Minimum character length before stopping. Default 4.
 * @returns {string} Sanitized prefix (e.g., "StMarys" or "stmarys")
 * 
 * @example
 * getSanitizedNamePrefix("St. Mary's Regional Hospital") // "StMarys"
 * getSanitizedNamePrefix("St. Mary's Regional Hospital", { lowercase: true }) // "stmarys"
 * getSanitizedNamePrefix("Bob's Auto Parts") // "Bobs"
 * getSanitizedNamePrefix("First Community Credit Union") // "First"
 */
export const getSanitizedNamePrefix = (name, options = {}) => {
  const { lowercase = false, minLength = 4 } = options;

  // Split into words and sanitize each word (remove non-alphanumeric)
  const words = name.split(' ').map(word => word.replace(/[^a-zA-Z0-9]/g, ''));

  // Accumulate words until we have at least minLength characters
  let result = '';
  for (const word of words) {
    if (!word) continue; // Skip empty words

    // Capitalize first letter for PascalCase
    const formattedWord = word.charAt(0).toUpperCase() + word.slice(1);
    result += formattedWord;

    if (result.length >= minLength) break;
  }

  // Ensure we have at least one word even if it's short
  if (!result && words.length > 0) {
    result = words.find(w => w) || 'Unknown';
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return lowercase ? result.toLowerCase() : result;
};

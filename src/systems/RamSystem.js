/**
 * RAM Resource Management System
 *
 * Calculates total RAM from hardware, tracks usage across open apps
 * and passive software, and determines if an app can be launched.
 */

import { APP_RAM_COSTS, HARDWARE_CATALOG } from '../constants/gameConstants';

/**
 * Get the total installed RAM in MB from hardware config
 * @param {object} hardware - Current hardware state
 * @returns {number} Total RAM in MB
 */
export const getTotalRamMB = (hardware) => {
  if (!hardware?.memory) return 2048; // fallback to 2GB
  return hardware.memory.reduce((total, stick) => {
    // Use capacityMB if available, otherwise parse from capacity string
    if (stick.capacityMB) return total + stick.capacityMB;
    const match = stick.capacity?.match(/(\d+)GB/i);
    return total + (match ? parseInt(match[1], 10) * 1024 : 0);
  }, 0);
};

/**
 * Calculate RAM used by open windows and active passive software
 * @param {Array} windows - Currently open windows [{appId, ...}]
 * @param {Array} activePassiveSoftware - Active passive software IDs
 * @returns {number} RAM used in MB
 */
export const getUsedRamMB = (windows, activePassiveSoftware) => {
  let used = 0;

  // RAM from open windows
  if (windows) {
    for (const win of windows) {
      used += APP_RAM_COSTS[win.appId] || 64;
    }
  }

  // RAM from passive software
  if (activePassiveSoftware) {
    for (const softwareId of activePassiveSoftware) {
      used += APP_RAM_COSTS[softwareId] || 64;
    }
  }

  return used;
};

/**
 * Check if there's enough RAM to open a new app
 * @param {object} hardware - Current hardware state
 * @param {Array} windows - Currently open windows
 * @param {Array} activePassiveSoftware - Active passive software IDs
 * @param {string} appId - App to check (window appId or passive software ID)
 * @returns {{ canOpen: boolean, required: number, available: number, total: number }}
 */
export const canOpenApp = (hardware, windows, activePassiveSoftware, appId) => {
  const total = getTotalRamMB(hardware);
  const used = getUsedRamMB(windows, activePassiveSoftware);
  const required = APP_RAM_COSTS[appId] || 64;
  const available = total - used;

  return {
    canOpen: available >= required,
    required,
    available,
    total,
  };
};

/**
 * Format RAM display string
 * @param {number} usedMB - RAM used in MB
 * @param {number} totalMB - Total RAM in MB
 * @returns {string} Formatted string like "1.2 / 2.0 GB"
 */
export const formatRam = (usedMB, totalMB) => {
  const usedGB = (usedMB / 1024).toFixed(1);
  const totalGB = (totalMB / 1024).toFixed(1);
  return `${usedGB} / ${totalGB} GB`;
};

/**
 * Get RAM capacity for a specific memory module ID
 * @param {string} memoryId - Memory module ID from HARDWARE_CATALOG
 * @returns {number} Capacity in MB
 */
export const getMemoryCapacityMB = (memoryId) => {
  for (const mem of HARDWARE_CATALOG.memory) {
    if (mem.id === memoryId) return mem.capacityMB || 0;
  }
  return 0;
};

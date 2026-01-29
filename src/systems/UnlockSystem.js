/**
 * Feature Unlock System
 * 
 * Manages which hardware and software items are available for purchase.
 * Features are unlocked through story progression (reading specific messages).
 * 
 * Unlock IDs:
 * - 'network-adapters': Network adapter hardware (unlocked with hardware-unlock message)
 * - 'advanced-tools': Log Viewer and Data Recovery Tool apps (unlocked with hardware-unlock message)
 * 
 * Future unlocks (planned):
 * - 'cpu-upgrades': CPU hardware
 * - 'memory-upgrades': Memory hardware
 * - 'storage-upgrades': Storage hardware
 * - 'power-upgrades': PSU hardware
 * - 'motherboard-upgrades': Motherboard hardware
 */

/**
 * Check if a feature is unlocked
 * @param {string[]} unlockedFeatures - Array of unlocked feature IDs
 * @param {string} featureId - Feature ID to check
 * @returns {boolean} True if feature is unlocked
 */
export const isFeatureUnlocked = (unlockedFeatures, featureId) => {
    return unlockedFeatures.includes(featureId);
};

/**
 * Check if a hardware category is unlocked for purchase
 * @param {string[]} unlockedFeatures - Array of unlocked feature IDs
 * @param {string} category - Hardware category (cpu, memory, storage, etc.)
 * @returns {boolean} True if category is unlocked
 */
export const isHardwareCategoryUnlocked = (unlockedFeatures, category) => {
    // Map hardware categories to their unlock feature ID
    const categoryUnlockMap = {
        processors: 'cpu-upgrades',
        memory: 'memory-upgrades',
        storage: 'storage-upgrades',
        motherboards: 'motherboard-upgrades',
        powerSupplies: 'power-upgrades',
        network: 'network-adapters',
    };

    const requiredUnlock = categoryUnlockMap[category];

    // If no unlock requirement defined, it's always locked (not yet implemented)
    if (!requiredUnlock) return false;

    return unlockedFeatures.includes(requiredUnlock);
};

/**
 * Check if a software item is unlocked for purchase
 * @param {string[]} unlockedFeatures - Array of unlocked feature IDs
 * @param {object} softwareItem - Software item from catalog
 * @returns {boolean} True if software is unlocked (or has no unlock requirement)
 */
export const isSoftwareUnlocked = (unlockedFeatures, softwareItem) => {
    // Check both property names for unlock requirement
    const unlockRequirement = softwareItem.requiresUnlock || softwareItem.unlockRequirement;

    // If no unlock requirement, it's always available
    if (!unlockRequirement) return true;

    return unlockedFeatures.includes(unlockRequirement);
};

/**
 * Get the unlock hint text for a locked item
 * @param {string} unlockId - The unlock ID required
 * @returns {string} Hint text to show user
 */
export const getUnlockHint = (unlockId) => {
    const hintMap = {
        'network-adapters': 'Complete more missions to unlock hardware upgrades',
        'advanced-tools': 'Complete more missions to unlock advanced tools',
        'cpu-upgrades': 'Hardware upgrades not yet available',
        'memory-upgrades': 'Hardware upgrades not yet available',
        'storage-upgrades': 'Hardware upgrades not yet available',
        'motherboard-upgrades': 'Hardware upgrades not yet available',
        'power-upgrades': 'Hardware upgrades not yet available',
    };

    return hintMap[unlockId] || 'Not yet available';
};

/**
 * Get which unlock ID is required for a hardware category
 * @param {string} category - Hardware category
 * @returns {string|null} Required unlock ID or null if always locked
 */
export const getHardwareCategoryUnlockId = (category) => {
    const categoryUnlockMap = {
        processors: 'cpu-upgrades',
        memory: 'memory-upgrades',
        storage: 'storage-upgrades',
        motherboards: 'motherboard-upgrades',
        powerSupplies: 'power-upgrades',
        network: 'network-adapters',
    };

    return categoryUnlockMap[category] || null;
};

export default {
    isFeatureUnlocked,
    isHardwareCategoryUnlocked,
    isSoftwareUnlocked,
    getUnlockHint,
    getHardwareCategoryUnlockId,
};

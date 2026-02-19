/**
 * Feature Unlock System
 *
 * Manages which hardware and software items are available for purchase.
 * Features are unlocked through story progression (reading specific messages).
 *
 * Unlock IDs:
 * - 'network-adapters': Network adapter hardware (unlocked with hardware-unlock message)
 * - 'cpu-upgrades': CPU hardware
 * - 'memory-upgrades': Memory hardware (also unlocked by cracking-tooling)
 * - 'storage-upgrades': Storage hardware
 * - 'power-upgrades': PSU hardware
 * - 'motherboard-upgrades': Motherboard hardware
 * - 'investigation-tooling': Log Viewer & Data Recovery Tool
 * - 'decryption-tooling': Decryption Tool
 * - 'decryption-algorithms': Blowfish & RSA algorithm packs
 * - 'security-tooling': Advanced Firewall & Antivirus
 * - 'cracking-tooling': Password Cracker, dictionaries, rainbow tables, RAM hardware
 * - 'relay-service': Portal Services tab, VPN Relay Module, Trace Monitor
 * - 'sniffer-tooling': Network Sniffer
 * - 'cracking-missions': Procedural password-crack missions
 * - 'sniffer-missions': Procedural sniffer missions
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
    // Map hardware categories to their unlock feature ID(s)
    // Some categories can be unlocked by multiple features
    const categoryUnlockMap = {
        processors: ['cpu-upgrades'],
        memory: ['memory-upgrades', 'cracking-tooling'],
        storage: ['storage-upgrades'],
        motherboards: ['motherboard-upgrades'],
        powerSupplies: ['power-upgrades'],
        network: ['network-adapters'],
    };

    const requiredUnlocks = categoryUnlockMap[category];

    // If no unlock requirement defined, it's always locked (not yet implemented)
    if (!requiredUnlocks) return false;

    // Unlocked if ANY of the feature IDs is present
    return requiredUnlocks.some(unlock => unlockedFeatures.includes(unlock));
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
        'cpu-upgrades': 'Hardware upgrades not yet available',
        'memory-upgrades': 'Hardware upgrades not yet available',
        'storage-upgrades': 'Hardware upgrades not yet available',
        'motherboard-upgrades': 'Hardware upgrades not yet available',
        'power-upgrades': 'Hardware upgrades not yet available',
        'investigation-tooling': 'Complete more missions to unlock investigation tools',
        'decryption-tooling': 'Complete more missions to unlock decryption tools',
        'decryption-algorithms': 'Complete more missions to unlock algorithm packs',
        'security-tooling': 'Complete more missions to unlock security tools',
        'cracking-tooling': 'Progress further in the story to unlock cracking tools',
        'relay-service': 'Progress further in the story to unlock relay services',
        'sniffer-tooling': 'Progress further in the story to unlock network analysis tools',
    };

    return hintMap[unlockId] || 'Not yet available';
};

/**
 * Get which unlock ID is required for a hardware category
 * @param {string} category - Hardware category
 * @returns {string|null} Required unlock ID or null if always locked
 */
export const getHardwareCategoryUnlockId = (category) => {
    // Returns the primary unlock ID for display purposes
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

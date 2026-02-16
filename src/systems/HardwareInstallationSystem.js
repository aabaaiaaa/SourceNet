/**
 * Hardware Installation System
 *
 * Manages hardware purchases, installation queue, and reboot-based activation.
 * Hardware requires a system reboot (via Power menu) before changes take effect.
 *
 * Flow:
 * 1. Player purchases hardware from Portal
 * 2. Hardware is added to pendingHardwareUpgrades queue
 * 3. Player reboots via Power menu
 * 4. Boot sequence detects new hardware
 * 5. Hardware is moved from pending to installed
 *
 * Hardware Categories:
 * - cpu: Single slot, replaces existing
 * - memory: Multiple slots, can upgrade individual sticks
 * - storage: Multiple slots, can add/upgrade drives
 * - motherboard: Single slot, replaces existing (affects slot counts)
 * - powerSupply: Single slot, replaces existing (affects power capacity)
 * - network: Single slot, replaces existing (affects bandwidth)
 */

import { HARDWARE_CATALOG } from '../constants/gameConstants';

// Portal uses catalog keys (e.g. 'processors') but the hardware state uses internal keys (e.g. 'cpu')
const CATALOG_TO_HARDWARE_KEY = {
    processors: 'cpu',
    motherboards: 'motherboard',
    powerSupplies: 'powerSupply',
};
const normalizeCategory = (category) => CATALOG_TO_HARDWARE_KEY[category] || category;

// Single-slot categories always replace existing
const SINGLE_SLOT_CATEGORIES = ['cpu', 'motherboard', 'powerSupply', 'network'];

/**
 * Queue a hardware item for installation on next reboot
 * @param {object} currentPending - Current pending hardware upgrades
 * @param {string} category - Hardware category (cpu, memory, storage, etc.)
 * @param {object} hardwareItem - Hardware item from catalog
 * @returns {object} Updated pending hardware upgrades
 */
export const queueHardwareInstall = (currentPending, category, hardwareItem) => {
    category = normalizeCategory(category);
    const newPending = { ...currentPending };

    // For single-slot categories, replace any pending item
    if (SINGLE_SLOT_CATEGORIES.includes(category)) {
        newPending[category] = hardwareItem;
    } else if (category === 'memory' || category === 'storage') {
        // For multi-slot categories, add to array
        if (!newPending[category]) {
            newPending[category] = [];
        }
        newPending[category] = [...newPending[category], hardwareItem];
    }

    console.log(`🔧 Queued ${hardwareItem.name} for installation (requires reboot)`);
    return newPending;
};

/**
 * Get the effective motherboard for slot calculations.
 * Returns the pending motherboard if one is queued, otherwise the installed one.
 */
export const getEffectiveMotherboard = (hardware, pendingUpgrades) => {
    if (pendingUpgrades?.motherboard) {
        return pendingUpgrades.motherboard;
    }
    return hardware.motherboard;
};

/**
 * Get slot usage counts from the effective motherboard
 * @returns {{ cpu: {used, total}, memory: {used, total}, storage: {used, total}, network: {used, total} }}
 */
export const getSlotUsage = (hardware, pendingUpgrades) => {
    const mb = getEffectiveMotherboard(hardware, pendingUpgrades) || {};
    const pendingMemory = pendingUpgrades?.memory || [];
    const pendingStorage = pendingUpgrades?.storage || [];

    return {
        cpu: { used: 1, total: mb.cpuSlots || 1 },
        memory: {
            used: (hardware.memory?.length || 0) + pendingMemory.length,
            total: mb.memorySlots || 2,
        },
        storage: {
            used: (hardware.storage?.length || 0) + pendingStorage.length,
            total: mb.storageSlots || 2,
        },
        network: { used: 1, total: mb.networkSlots || 1 },
    };
};

/**
 * Get available (empty) slots for a category using the effective motherboard
 */
export const getAvailableSlots = (hardware, pendingUpgrades, category) => {
    category = normalizeCategory(category);

    // Single-slot categories: always 0 available (purchase replaces existing)
    if (category === 'cpu' || category === 'network') {
        return 0; // Replacement, not additive
    }

    const slots = getSlotUsage(hardware, pendingUpgrades);
    if (category === 'memory') {
        return Math.max(0, slots.memory.total - slots.memory.used);
    }
    if (category === 'storage') {
        return Math.max(0, slots.storage.total - slots.storage.used);
    }

    // Motherboard, PSU: single slot, replacement
    return 0;
};

/**
 * Check if a hardware purchase is allowed
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export const canPurchaseHardware = (hardware, pendingUpgrades, category, item) => {
    category = normalizeCategory(category);

    // Multi-slot: check available slots
    if (category === 'memory') {
        const available = getAvailableSlots(hardware, pendingUpgrades, 'memory');
        if (available <= 0) {
            return { allowed: false, reason: 'No empty memory slots' };
        }
    }

    if (category === 'storage') {
        const available = getAvailableSlots(hardware, pendingUpgrades, 'storage');
        if (available <= 0) {
            return { allowed: false, reason: 'No empty storage slots' };
        }
    }

    // Power check: simulate post-reboot state
    const projectedHardware = getProjectedHardware(hardware, pendingUpgrades, category, item);
    const consumption = calculatePowerConsumption(projectedHardware);
    const psuWattage = projectedHardware.powerSupply?.wattage || 0;

    if (consumption > psuWattage) {
        const needed = consumption;
        const available = psuWattage - calculatePowerConsumption(
            getProjectedHardware(hardware, pendingUpgrades, null, null)
        );
        return {
            allowed: false,
            reason: `Insufficient power (need ${item.power || 0}W, ${Math.max(0, available)}W available)`,
        };
    }

    return { allowed: true, reason: null };
};

/**
 * Build a projected post-reboot hardware state for power validation.
 * Optionally includes a new item being considered for purchase.
 */
const getProjectedHardware = (hardware, pendingUpgrades, newCategory, newItem) => {
    const pending = { ...pendingUpgrades };

    // Add the hypothetical new item
    if (newCategory && newItem) {
        const cat = normalizeCategory(newCategory);
        if (SINGLE_SLOT_CATEGORIES.includes(cat)) {
            pending[cat] = newItem;
        } else if (cat === 'memory' || cat === 'storage') {
            pending[cat] = [...(pending[cat] || []), newItem];
        }
    }

    // Simulate applyPendingHardware without removedHardware tracking
    const projected = { ...hardware };
    const mb = pending.motherboard || hardware.motherboard;

    if (pending.cpu) projected.cpu = pending.cpu;
    if (pending.motherboard) projected.motherboard = pending.motherboard;
    if (pending.powerSupply) projected.powerSupply = pending.powerSupply;
    if (pending.network) projected.network = pending.network;

    // Memory: merge + trim
    const currentMemory = hardware.memory || [];
    if (pending.memory && pending.memory.length > 0) {
        projected.memory = [...currentMemory, ...pending.memory].slice(0, mb?.memorySlots || currentMemory.length + pending.memory.length);
    } else {
        projected.memory = currentMemory.slice(0, mb?.memorySlots || currentMemory.length);
    }

    // Storage: merge + trim
    const currentStorage = hardware.storage || [];
    if (pending.storage && pending.storage.length > 0) {
        projected.storage = [...currentStorage, ...pending.storage].slice(0, mb?.storageSlots || currentStorage.length + pending.storage.length);
    } else {
        projected.storage = currentStorage.slice(0, mb?.storageSlots || currentStorage.length);
    }

    return projected;
};

/**
 * Get warning text if a motherboard downgrade would trim installed items
 * @returns {string|null}
 */
export const getMotherboardDowngradeWarning = (hardware, pendingUpgrades, newMotherboard) => {
    const currentMemoryCount = hardware.memory.length + (pendingUpgrades?.memory?.length || 0);
    const currentStorageCount = hardware.storage.length + (pendingUpgrades?.storage?.length || 0);

    const warnings = [];
    if (currentMemoryCount > newMotherboard.memorySlots) {
        const excess = currentMemoryCount - newMotherboard.memorySlots;
        warnings.push(`${excess} memory module(s) will be removed`);
    }
    if (currentStorageCount > newMotherboard.storageSlots) {
        const excess = currentStorageCount - newMotherboard.storageSlots;
        warnings.push(`${excess} storage drive(s) will be removed`);
    }

    if (warnings.length === 0) return null;
    return `Downgrade warning: ${warnings.join(' and ')}. Removed items will go to spare hardware.`;
};

/**
 * Apply pending hardware upgrades to current hardware configuration
 * Called during reboot sequence
 * @param {object} currentHardware - Current installed hardware
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @returns {object} { newHardware, appliedUpgrades, removedHardware }
 */
export const applyPendingHardware = (currentHardware, pendingUpgrades) => {
    if (!pendingUpgrades || Object.keys(pendingUpgrades).length === 0) {
        return { newHardware: currentHardware, appliedUpgrades: [], removedHardware: [] };
    }

    const newHardware = { ...currentHardware };
    const appliedUpgrades = [];
    const removedHardware = [];

    // Apply motherboard FIRST (affects slot counts for everything else)
    if (pendingUpgrades.motherboard) {
        const oldBoard = newHardware.motherboard;
        newHardware.motherboard = { ...pendingUpgrades.motherboard };
        appliedUpgrades.push({ category: 'motherboard', item: pendingUpgrades.motherboard, replaced: oldBoard.name });
        if (oldBoard.id !== pendingUpgrades.motherboard.id) {
            removedHardware.push(oldBoard);
        }
        console.log(`💻 Installed Motherboard: ${pendingUpgrades.motherboard.name}`);
    }

    // Apply single-slot upgrades (replace existing, old goes to spares)
    if (pendingUpgrades.cpu) {
        const oldCpu = newHardware.cpu;
        newHardware.cpu = { ...pendingUpgrades.cpu };
        appliedUpgrades.push({ category: 'cpu', item: pendingUpgrades.cpu, replaced: oldCpu.name });
        if (oldCpu.id !== pendingUpgrades.cpu.id) {
            removedHardware.push(oldCpu);
        }
        console.log(`💻 Installed CPU: ${pendingUpgrades.cpu.name}`);
    }

    if (pendingUpgrades.powerSupply) {
        const oldPsu = newHardware.powerSupply;
        newHardware.powerSupply = { ...pendingUpgrades.powerSupply };
        appliedUpgrades.push({ category: 'powerSupply', item: pendingUpgrades.powerSupply, replaced: oldPsu.name });
        if (oldPsu.id !== pendingUpgrades.powerSupply.id) {
            removedHardware.push(oldPsu);
        }
        console.log(`💻 Installed PSU: ${pendingUpgrades.powerSupply.name}`);
    }

    if (pendingUpgrades.network) {
        const oldNetwork = newHardware.network;
        newHardware.network = { ...pendingUpgrades.network };
        appliedUpgrades.push({ category: 'network', item: pendingUpgrades.network, replaced: oldNetwork.name });
        if (oldNetwork.id !== pendingUpgrades.network.id) {
            removedHardware.push(oldNetwork);
        }
        console.log(`💻 Installed Network Adapter: ${pendingUpgrades.network.name}`);
    }

    // Apply multi-slot upgrades: MERGE existing + pending, then trim to motherboard limits
    const mb = newHardware.motherboard;

    // Memory (only if hardware has memory array)
    const pendingMemory = pendingUpgrades.memory || [];
    const currentMemory = currentHardware.memory || [];
    if (pendingMemory.length > 0 || currentMemory.length > 0) {
        const mergedMemory = [...currentMemory, ...pendingMemory];
        const memoryLimit = mb?.memorySlots || mergedMemory.length;
        if (mergedMemory.length > memoryLimit) {
            const trimmed = mergedMemory.slice(memoryLimit);
            trimmed.forEach(item => removedHardware.push(item));
            newHardware.memory = mergedMemory.slice(0, memoryLimit);
        } else {
            newHardware.memory = mergedMemory;
        }
        if (pendingMemory.length > 0) {
            appliedUpgrades.push({ category: 'memory', items: pendingMemory, totalCapacity: `${pendingMemory.reduce((sum, m) => sum + parseInt(m.capacity), 0)}GB` });
            console.log(`💻 Installed Memory: ${pendingMemory.map(m => m.name).join(', ')}`);
        } else if (mergedMemory.length > memoryLimit) {
            console.log(`💻 Trimmed memory to ${memoryLimit} slots`);
        }
    }

    // Storage (only if hardware has storage array)
    const pendingStorage = pendingUpgrades.storage || [];
    const currentStorage = currentHardware.storage || [];
    if (pendingStorage.length > 0 || currentStorage.length > 0) {
        const mergedStorage = [...currentStorage, ...pendingStorage];
        const storageLimit = mb?.storageSlots || mergedStorage.length;
        if (mergedStorage.length > storageLimit) {
            const trimmed = mergedStorage.slice(storageLimit);
            trimmed.forEach(item => removedHardware.push(item));
            newHardware.storage = mergedStorage.slice(0, storageLimit);
        } else {
            newHardware.storage = mergedStorage;
        }
        if (pendingStorage.length > 0) {
            appliedUpgrades.push({ category: 'storage', items: pendingStorage });
            console.log(`💻 Installed Storage: ${pendingStorage.map(s => s.name).join(', ')}`);
        } else if (mergedStorage.length > storageLimit) {
            console.log(`💻 Trimmed storage to ${storageLimit} slots`);
        }
    }

    return { newHardware, appliedUpgrades, removedHardware };
};

/**
 * Check if hardware upgrade is pending for a category
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @param {string} category - Hardware category
 * @returns {boolean} True if upgrade is pending
 */
export const hasPendingUpgrade = (pendingUpgrades, category) => {
    category = normalizeCategory(category);
    if (!pendingUpgrades) return false;

    if (category === 'memory' || category === 'storage') {
        return pendingUpgrades[category] && pendingUpgrades[category].length > 0;
    }

    return !!pendingUpgrades[category];
};

/**
 * Check if a specific hardware item is pending installation
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @param {string} category - Hardware category
 * @param {string} itemId - Hardware item ID
 * @returns {boolean} True if this specific item is pending
 */
export const isItemPending = (pendingUpgrades, category, itemId) => {
    category = normalizeCategory(category);
    if (!pendingUpgrades) return false;

    if (category === 'memory' || category === 'storage') {
        return (pendingUpgrades[category] || []).some(p => p.id === itemId);
    }

    return pendingUpgrades[category]?.id === itemId;
};

/**
 * Get the pending upgrade for a specific hardware slot
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @param {string} category - Hardware category
 * @returns {object|array|null} Pending hardware item(s) or null
 */
export const getPendingUpgrade = (pendingUpgrades, category) => {
    category = normalizeCategory(category);
    if (!pendingUpgrades) return null;
    return pendingUpgrades[category] || null;
};

/**
 * Get hardware catalog item by ID
 * @param {string} category - Hardware category key in catalog
 * @param {string} itemId - Hardware item ID
 * @returns {object|null} Hardware item or null if not found
 */
export const getHardwareById = (category, itemId) => {
    const categoryItems = HARDWARE_CATALOG[category];
    if (!categoryItems) return null;

    return categoryItems.find(item => item.id === itemId) || null;
};

/**
 * Calculate total power consumption of hardware configuration
 * @param {object} hardware - Hardware configuration
 * @returns {number} Total power in watts
 */
export const calculatePowerConsumption = (hardware) => {
    let totalPower = 0;

    if (hardware.cpu?.power) totalPower += hardware.cpu.power;
    if (hardware.motherboard?.power) totalPower += hardware.motherboard.power;
    if (hardware.network?.power) totalPower += hardware.network.power;

    // Memory array
    if (hardware.memory && Array.isArray(hardware.memory)) {
        totalPower += hardware.memory.reduce((sum, m) => sum + (m.power || 0), 0);
    }

    // Storage array
    if (hardware.storage && Array.isArray(hardware.storage)) {
        totalPower += hardware.storage.reduce((sum, s) => sum + (s.power || 0), 0);
    }

    return totalPower;
};

/**
 * Check if power supply can handle hardware configuration
 * @param {object} hardware - Hardware configuration
 * @returns {object} { canPower, consumption, capacity, headroom }
 */
export const checkPowerCapacity = (hardware) => {
    const consumption = calculatePowerConsumption(hardware);
    const capacity = hardware.powerSupply?.wattage || 0;
    const headroom = capacity - consumption;

    return {
        canPower: consumption <= capacity,
        consumption,
        capacity,
        headroom,
    };
};

/**
 * Get the projected power state after reboot (including pending upgrades)
 */
export const getProjectedPowerState = (hardware, pendingUpgrades) => {
    const projected = getProjectedHardware(hardware, pendingUpgrades, null, null);
    return checkPowerCapacity(projected);
};

export default {
    queueHardwareInstall,
    applyPendingHardware,
    hasPendingUpgrade,
    isItemPending,
    getPendingUpgrade,
    getHardwareById,
    calculatePowerConsumption,
    checkPowerCapacity,
    getSlotUsage,
    getEffectiveMotherboard,
    getAvailableSlots,
    canPurchaseHardware,
    getMotherboardDowngradeWarning,
    getProjectedPowerState,
};

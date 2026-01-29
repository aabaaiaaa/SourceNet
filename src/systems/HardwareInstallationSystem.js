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

/**
 * Queue a hardware item for installation on next reboot
 * @param {object} currentPending - Current pending hardware upgrades
 * @param {string} category - Hardware category (cpu, memory, storage, etc.)
 * @param {object} hardwareItem - Hardware item from catalog
 * @returns {object} Updated pending hardware upgrades
 */
export const queueHardwareInstall = (currentPending, category, hardwareItem) => {
    const newPending = { ...currentPending };

    // For single-slot categories, replace any pending item
    if (category === 'cpu' || category === 'motherboard' || category === 'powerSupply' || category === 'network') {
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
 * Apply pending hardware upgrades to current hardware configuration
 * Called during reboot sequence
 * @param {object} currentHardware - Current installed hardware
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @returns {object} { newHardware, appliedUpgrades } - Updated hardware and list of applied changes
 */
export const applyPendingHardware = (currentHardware, pendingUpgrades) => {
    if (!pendingUpgrades || Object.keys(pendingUpgrades).length === 0) {
        return { newHardware: currentHardware, appliedUpgrades: [] };
    }

    const newHardware = { ...currentHardware };
    const appliedUpgrades = [];

    // Apply single-slot upgrades (replace existing)
    if (pendingUpgrades.cpu) {
        const oldCpu = newHardware.cpu?.name || 'None';
        newHardware.cpu = { ...pendingUpgrades.cpu };
        appliedUpgrades.push({ category: 'cpu', item: pendingUpgrades.cpu, replaced: oldCpu });
        console.log(`💻 Installed CPU: ${pendingUpgrades.cpu.name}`);
    }

    if (pendingUpgrades.motherboard) {
        const oldBoard = newHardware.motherboard?.name || 'None';
        newHardware.motherboard = { ...pendingUpgrades.motherboard };
        appliedUpgrades.push({ category: 'motherboard', item: pendingUpgrades.motherboard, replaced: oldBoard });
        console.log(`💻 Installed Motherboard: ${pendingUpgrades.motherboard.name}`);
    }

    if (pendingUpgrades.powerSupply) {
        const oldPsu = newHardware.powerSupply?.name || 'None';
        newHardware.powerSupply = { ...pendingUpgrades.powerSupply };
        appliedUpgrades.push({ category: 'powerSupply', item: pendingUpgrades.powerSupply, replaced: oldPsu });
        console.log(`💻 Installed PSU: ${pendingUpgrades.powerSupply.name}`);
    }

    if (pendingUpgrades.network) {
        const oldNetwork = newHardware.network?.name || 'None';
        newHardware.network = { ...pendingUpgrades.network };
        appliedUpgrades.push({ category: 'network', item: pendingUpgrades.network, replaced: oldNetwork });
        console.log(`💻 Installed Network Adapter: ${pendingUpgrades.network.name}`);
    }

    // Apply multi-slot upgrades
    // For now, we replace all memory/storage - more sophisticated slot management can come later
    if (pendingUpgrades.memory && pendingUpgrades.memory.length > 0) {
        const totalNewMemory = pendingUpgrades.memory.reduce((sum, m) => sum + parseInt(m.capacity), 0);
        newHardware.memory = [...pendingUpgrades.memory];
        appliedUpgrades.push({ category: 'memory', items: pendingUpgrades.memory, totalCapacity: `${totalNewMemory}GB` });
        console.log(`💻 Installed Memory: ${pendingUpgrades.memory.map(m => m.name).join(', ')}`);
    }

    if (pendingUpgrades.storage && pendingUpgrades.storage.length > 0) {
        newHardware.storage = [...pendingUpgrades.storage];
        appliedUpgrades.push({ category: 'storage', items: pendingUpgrades.storage });
        console.log(`💻 Installed Storage: ${pendingUpgrades.storage.map(s => s.name).join(', ')}`);
    }

    return { newHardware, appliedUpgrades };
};

/**
 * Check if hardware upgrade is pending for a category
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @param {string} category - Hardware category
 * @returns {boolean} True if upgrade is pending
 */
export const hasPendingUpgrade = (pendingUpgrades, category) => {
    if (!pendingUpgrades) return false;

    if (category === 'memory' || category === 'storage') {
        return pendingUpgrades[category] && pendingUpgrades[category].length > 0;
    }

    return !!pendingUpgrades[category];
};

/**
 * Get the pending upgrade for a specific hardware slot
 * @param {object} pendingUpgrades - Pending hardware upgrades
 * @param {string} category - Hardware category
 * @returns {object|array|null} Pending hardware item(s) or null
 */
export const getPendingUpgrade = (pendingUpgrades, category) => {
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

export default {
    queueHardwareInstall,
    applyPendingHardware,
    hasPendingUpgrade,
    getPendingUpgrade,
    getHardwareById,
    calculatePowerConsumption,
    checkPowerCapacity,
};

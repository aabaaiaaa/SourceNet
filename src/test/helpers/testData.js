/**
 * Test data helpers for integration tests
 * Functions to create save states and test data for localStorage initialization
 */

import networkRegistry from '../../systems/NetworkRegistry';

// ============================================================================
// STARTING GAME DATA
// ============================================================================

export const STARTING_SOFTWARE = [
    { id: 'osnet', type: 'os' },
    { id: 'portal', type: 'system' },
    { id: 'mail', type: 'system' },
    { id: 'banking', type: 'system' },
];

export const STARTING_HARDWARE = [
    { id: 'cpu-1', type: 'cpu', name: 'Standard CPU', specs: '2.4 GHz' },
    { id: 'ram-1', type: 'ram', name: 'Standard RAM', specs: '4 GB' },
    { id: 'storage-1', type: 'storage', name: 'Standard HDD', specs: '500 GB' },
];

// ============================================================================
// MESSAGE BUILDERS
// ============================================================================

/**
 * Create a message with optional cheque attachment
 * @param {Object} options - Message configuration
 * @param {string} options.id - Message ID
 * @param {string} options.from - Sender
 * @param {string} options.subject - Subject line
 * @param {string} options.body - Message body
 * @param {boolean} options.read - Whether message is read
 * @param {number|null} options.chequeAmount - Amount for cheque attachment (null for no cheque)
 * @param {boolean} options.chequeDeposited - Whether cheque is deposited
 * @returns {Object} Message object
 */
export function createMessage({
    id = 'msg-test-1',
    from = 'Test Sender <sender@test.local>',
    subject = 'Test Message',
    body = 'This is a test message.',
    read = false,
    chequeAmount = null,
    chequeDeposited = false,
} = {}) {
    const message = {
        id,
        from,
        to: 'test_user@sourcenet.local',
        subject,
        body,
        timestamp: '2020-03-25T09:00:00.000Z',
        read,
        archived: false,
        attachments: [],
    };

    if (chequeAmount !== null) {
        message.attachments.push({
            type: 'cheque',
            amount: chequeAmount,
            deposited: chequeDeposited,
        });
    }

    return message;
}

/**
 * Create a message with software license attachment
 * @param {Object} options - Message configuration
 * @param {string} options.id - Message ID
 * @param {string} options.from - Sender
 * @param {string} options.subject - Subject line
 * @param {string} options.body - Message body
 * @param {boolean} options.read - Whether message is read
 * @param {string} options.softwareId - ID of the software to license
 * @param {string} options.softwareName - Display name of the software
 * @param {number} options.price - Original price of the software
 * @param {number} options.size - Size in MB
 * @param {boolean} options.activated - Whether license has been activated
 * @returns {Object} Message object with software license attachment
 */
export function createMessageWithLicense({
    id = 'msg-license-1',
    from = 'Software Vendor <vendor@test.local>',
    subject = 'Software License',
    body = 'Please find your software license attached.',
    read = false,
    softwareId = 'mission-board',
    softwareName = 'SourceNet Mission Board',
    price = 250,
    size = 200,
    activated = false,
} = {}) {
    return {
        id,
        from,
        to: 'test_user@sourcenet.local',
        subject,
        body,
        timestamp: '2020-03-25T09:00:00.000Z',
        read,
        archived: false,
        attachments: [
            {
                type: 'softwareLicense',
                softwareId,
                softwareName,
                price,
                size,
                activated,
            },
        ],
    };
}

/**
 * Create a message with network address attachment
 * @param {Object} options - Message configuration
 * @param {string} options.id - Message ID
 * @param {string} options.from - Sender
 * @param {string} options.subject - Subject line
 * @param {string} options.body - Message body
 * @param {boolean} options.read - Whether message is read
 * @param {string} options.networkId - ID of the network
 * @param {string} options.networkName - Display name of the network
 * @param {string} options.address - Network address (CIDR format)
 * @param {boolean} options.activated - Whether attachment has been used (default: false)
 * @param {Array} options.fileSystems - Array of file system/device objects for the network
 * @returns {Object} Message object with network address attachment
 */
export function createMessageWithNetworkAddress({
    id = 'msg-network-1',
    from = 'Network Admin <admin@corp.local>',
    subject = 'Network Access',
    body = 'Please find your network credentials attached.',
    read = false,
    networkId = 'corp-network-1',
    networkName = 'Corporate Network',
    address = '10.0.0.0/16',
    activated = false,
    fileSystems = [],
} = {}) {
    const attachment = {
        type: 'networkAddress',
        networkId,
        networkName,
        address,
    };

    if (activated) {
        attachment.activated = true;
    }

    if (fileSystems.length > 0) {
        attachment.fileSystems = fileSystems.map(fs => ({
            id: fs.id,
            ip: fs.ip,
            name: fs.name,
            files: fs.files || [],
            accessible: fs.accessible !== undefined ? fs.accessible : true,
        }));
    }

    return {
        id,
        from,
        to: 'test_user@sourcenet.local',
        subject,
        body,
        timestamp: '2020-03-25T09:00:00.000Z',
        read,
        archived: false,
        attachments: [attachment],
    };
}

// ============================================================================
// NETWORK & FILE SYSTEM BUILDERS
// ============================================================================

/**
 * Create a network entry with file systems
 * @param {Object} options - Network configuration
 * @param {string} options.networkId - Network ID
 * @param {string} options.networkName - Network display name
 * @param {string} options.address - Network address (CIDR format)
 * @param {Array} options.fileSystems - Array of file system objects (converted to deviceAccess)
 * @returns {Object} NAR entry object with deviceAccess
 */
export function createNetworkWithFileSystem({
    networkId = 'corp-net-1',
    networkName = 'Corporate Network',
    address = '192.168.50.0/24',
    bandwidth = 50,
    authorized = true,
    fileSystems = [],
} = {}) {
    // Extract just the IPs for deviceAccess - file system data should be in NetworkRegistry
    const deviceAccess = fileSystems.map(fs => fs.ip || '192.168.50.10');

    return {
        id: `nar-${networkId}`,
        networkId,
        networkName,
        address,
        bandwidth,
        authorized,
        addedAt: '2020-03-25T09:00:00.000Z',
        status: 'active',
        deviceAccess,
    };
}

/**
 * Populate NetworkRegistry with file systems for a network.
 * Call this before loadGame when testing file system behavior.
 * @param {Object} options - Network and file system configuration
 * @param {string} options.networkId - Network ID
 * @param {string} options.networkName - Network display name
 * @param {string} [options.address] - Network address (CIDR format), defaults to '192.168.50.0/24'
 * @param {boolean} [options.accessible] - Network accessibility (defaults to true unless any fileSystem has accessible: false)
 * @param {Array} options.fileSystems - Array of file system objects
 */
export function populateNetworkRegistry({
    networkId,
    networkName,
    address = '192.168.50.0/24',
    accessible,
    discovered = true,  // Tests typically want networks to be discovered/visible
    revokedReason = null,  // Reason for revocation (implies accessible: false)
    fileSystems = [],
} = {}) {
    // Determine network accessibility: explicit value, or infer from fileSystems
    // If any fileSystem has accessible: false, default network to inaccessible
    // If revokedReason is set, network must be inaccessible
    const hasInaccessibleDevice = fileSystems.some(fs => fs.accessible === false);
    const networkAccessible = revokedReason ? false : (accessible !== undefined ? accessible : !hasInaccessibleDevice);

    networkRegistry.registerNetwork({
        networkId,
        networkName,
        address,
        bandwidth: 50,
        accessible: networkAccessible,
        discovered,
        revokedReason,
    });

    for (const fs of fileSystems) {
        const ip = fs.ip || '192.168.50.10';
        const fileSystemId = fs.id || ip; // Use provided id or fallback to IP

        // Register device with the proper fileSystemId
        networkRegistry.registerDevice({
            ip,
            hostname: fs.name || 'device',
            networkId,
            fileSystemId,
            accessible: fs.accessible !== undefined ? fs.accessible : true,
        });

        // Register file system with the proper id and files
        networkRegistry.registerFileSystem({
            id: fileSystemId,
            files: fs.files || [],
        });
    }

    // Return snapshot for inclusion in save state
    return networkRegistry.getSnapshot();
}

/**
 * Create a network entry with multiple devices for scanner testing
 * @param {Object} options - Network configuration
 * @param {string} options.networkId - Network ID
 * @param {string} options.networkName - Network display name
 * @param {string} options.address - Network address (CIDR format)
 * @param {Array} options.devices - Array of device objects (fileservers, databases, etc.)
 * @returns {Object} NAR entry object with deviceAccess
 */
export function createNetworkWithDevices({
    networkId = 'corp-net-1',
    networkName = 'Corporate Network',
    address = '192.168.50.0/24',
    authorized = true,
    devices = [],
} = {}) {
    // Convert devices to fileSystems format for createNetworkWithFileSystem
    const fileSystems = devices.map((device, index) => ({
        id: device.id || `fs-${String(index + 1).padStart(3, '0')}`,
        ip: device.ip || `192.168.50.${10 + index}`,
        name: device.name || device.hostname || `device-${index + 1}`,
        files: device.files || [],
        accessible: device.accessible !== undefined ? device.accessible : true,
    }));

    return createNetworkWithFileSystem({
        networkId,
        networkName,
        address,
        authorized,
        fileSystems,
    });
}

// ============================================================================
// BANK ACCOUNT BUILDERS
// ============================================================================

/**
 * Create a bank account
 * @param {Object} options - Account configuration
 * @param {string} options.id - Account ID
 * @param {string} options.bankName - Bank name
 * @param {number} options.balance - Account balance
 * @param {string} options.type - Account type
 * @returns {Object} Bank account object
 */
export function createBankAccount({
    id = 'acc-1',
    bankName = 'Test Bank',
    balance = 1000,
    type = 'checking',
} = {}) {
    return {
        id,
        bankName,
        balance,
        type,
    };
}

// ============================================================================
// SAVE STATE BUILDERS
// ============================================================================

/**
 * Create a complete save state for localStorage
 * @param {Object} options - Save state configuration
 * @param {string} options.username - Username
 * @param {Array} options.messages - Array of message objects
 * @param {Array} options.bankAccounts - Array of bank account objects
 * @param {Array} options.transactions - Array of transaction objects
 * @param {Array} options.narEntries - Array of NAR entries
 * @param {number} options.reputation - Reputation score
 * @param {Object} options.overrides - Any other state properties to override
 * @returns {Object} Complete save state object
 */
export function createCompleteSaveState({
    username = 'test_user',
    messages = [],
    bankAccounts = [createBankAccount()],
    transactions = [],
    narEntries = [],
    reputation = 9,
    software = STARTING_SOFTWARE,
    overrides = {},
} = {}) {
    // Use narEntries from overrides if provided, otherwise use parameter
    const finalNarEntries = overrides.narEntries || narEntries;

    // Auto-populate discoveredDevices from narEntries unless explicitly overridden
    let discoveredDevices = {};
    if (!overrides.discoveredDevices) {
        // Extract all filesystem IPs from NAR entries and mark them as discovered
        finalNarEntries.forEach(nar => {
            if (nar.fileSystems && nar.fileSystems.length > 0) {
                discoveredDevices[nar.networkId] = nar.fileSystems.map(fs => fs.ip);
            }
        });
    }

    return {
        username,
        playerMailId: `${username}@sourcenet.local`,
        currentTime: '2020-03-25T09:00:00.000Z',
        timeSpeed: 1,
        hardware: STARTING_HARDWARE,
        software,
        bankAccounts,
        messages,
        narEntries,
        managerName: 'Emily Carter',
        windows: [],
        reputation,
        activeMission: null,
        completedMissions: [],
        transactions,
        ...overrides,
        // Apply discoveredDevices after overrides, but only if not already in overrides
        discoveredDevices: overrides.discoveredDevices || discoveredDevices,
    };
}

/**
 * Set save state in localStorage
 * @param {string} username - Username for the save
 * @param {Object} saveState - Complete save state object
 */
export function setSaveInLocalStorage(username, saveState) {
    const saveWithTimestamp = {
        ...saveState,
        savedAt: new Date().toISOString(),
    };
    const saves = { [username]: [saveWithTimestamp] };
    localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
}

/**
 * Common test data and save state builders
 * Extracted constants and data generators to reduce duplication
 */

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

export const STARTING_BANK_ACCOUNT = {
    id: 'acc-1',
    name: 'Current Account',
    balance: 1000,
    type: 'checking',
};

// ============================================================================
// SAVE STATE BUILDERS
// ============================================================================

/**
 * Create a basic save state with standard starting conditions
 * @param {string} username - Username for the save
 * @param {Object} overrides - Optional overrides for any save properties
 * @returns {Object} Complete save state object
 */
export function createBasicSave(username = 'test_user', overrides = {}) {
    return {
        username,
        playerMailId: `${username}@sourcenet.local`,
        currentTime: '2020-03-25T09:00:00.000Z',
        timeSpeed: 1,
        hardware: STARTING_HARDWARE,
        software: STARTING_SOFTWARE,
        bankAccounts: [STARTING_BANK_ACCOUNT],
        messages: [],
        managerName: 'Emily Carter',
        windows: [],
        reputation: 9,
        activeMission: null,
        completedMissions: [],
        transactions: [],
        ...overrides,
    };
}

/**
 * Create a save state with an open window
 * @param {string} username - Username for the save
 * @param {string} windowId - Window ID to open (e.g., 'mail', 'banking')
 * @param {Object} overrides - Optional overrides
 * @returns {Object} Save state with open window
 */
export function createSaveWithWindow(username, windowId, overrides = {}) {
    return createBasicSave(username, {
        windows: [
            {
                id: windowId,
                isOpen: true,
                isMinimized: false,
                position: { x: 100, y: 100 },
                size: { width: 600, height: 400 },
                zIndex: 1000,
            },
        ],
        ...overrides,
    });
}

/**
 * Create a save state with a message containing a cheque
 * @param {string} username - Username for the save
 * @param {number} chequeAmount - Amount of the cheque
 * @param {Object} overrides - Optional overrides
 * @returns {Object} Save state with cheque message
 */
export function createSaveWithCheque(username, chequeAmount = 500, overrides = {}) {
    return createBasicSave(username, {
        messages: [
            {
                id: 'msg-cheque-1',
                from: 'HR Department <hr@sourcenet.local>',
                to: `${username}@sourcenet.local`,
                subject: 'Welcome Bonus',
                body: 'Please find attached your welcome bonus.',
                timestamp: '2020-03-25T09:00:00.000Z',
                read: false,
                archived: false,
                attachments: [
                    {
                        type: 'cheque',
                        amount: chequeAmount,
                        deposited: false,
                    },
                ],
            },
        ],
        ...overrides,
    });
}

/**
 * Create multiple save states for testing save selection
 * @param {number} count - Number of saves to create
 * @param {string} prefix - Username prefix (e.g., 'user' creates 'user1', 'user2', etc.)
 * @returns {Array} Array of save state objects
 */
export function createMultipleSaves(count = 3, prefix = 'user') {
    const saves = [];
    for (let i = 1; i <= count; i++) {
        saves.push(createBasicSave(`${prefix}${i}`));
    }
    return saves;
}

/**
 * Create a save with custom credits
 * @param {string} username - Username for the save
 * @param {number} credits - Credits amount
 * @param {Object} overrides - Optional overrides
 * @returns {Object} Save state with specified credits
 */
export function createSaveWithCredits(username, credits, overrides = {}) {
    return createBasicSave(username, {
        bankAccounts: [
            {
                ...STARTING_BANK_ACCOUNT,
                balance: credits,
            },
        ],
        ...overrides,
    });
}

/**
 * Create a save with purchased software
 * @param {string} username - Username for the save
 * @param {Array<string>} additionalSoftware - Array of software IDs to add
 * @param {Object} overrides - Optional overrides
 * @returns {Object} Save state with additional software
 */
export function createSaveWithSoftware(username, additionalSoftware = [], overrides = {}) {
    return createBasicSave(username, {
        software: [...STARTING_SOFTWARE, ...additionalSoftware.map(id => ({ id, type: 'system' }))],
        ...overrides,
    });
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

/**
 * Create a basic message
 * @param {string} subject - Message subject
 * @param {string} body - Message body
 * @param {string} from - Sender email
 * @returns {Object} Message object
 */
export function createMessage(subject, body, from = 'admin@sourcenet.local') {
    return {
        id: `msg-${Date.now()}`,
        from,
        subject,
        body,
        timestamp: new Date().toISOString(),
        read: false,
        archived: false,
    };
}

/**
 * Create a message with a cheque attachment
 * @param {number} amount - Cheque amount
 * @returns {Object} Message object with cheque attachment
 */
export function createMessageWithCheque(amount = 500) {
    return {
        ...createMessage('Payment Received', `Please find your payment of ${amount} credits attached.`, 'payroll@sourcenet.local'),
        attachments: [
            {
                type: 'cheque',
                amount,
                deposited: false,
            },
        ],
    };
}

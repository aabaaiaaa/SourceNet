/**
 * Test data helpers for integration tests
 * Functions to create save states and test data for localStorage initialization
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
 * @param {number} options.reputation - Reputation score
 * @param {Object} options.overrides - Any other state properties to override
 * @returns {Object} Complete save state object
 */
export function createCompleteSaveState({
    username = 'test_user',
    messages = [],
    bankAccounts = [createBankAccount()],
    transactions = [],
    reputation = 9,
    overrides = {},
} = {}) {
    return {
        username,
        playerMailId: `${username}@sourcenet.local`,
        currentTime: '2020-03-25T09:00:00.000Z',
        timeSpeed: 1,
        hardware: STARTING_HARDWARE,
        software: STARTING_SOFTWARE,
        bankAccounts,
        messages,
        managerName: 'Emily Carter',
        windows: [],
        reputation,
        activeMission: null,
        completedMissions: [],
        transactions,
        ...overrides,
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

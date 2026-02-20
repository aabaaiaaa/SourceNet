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

/**
 * Default hardware in the real save format (object with slots, not array)
 */
export const DEFAULT_HARDWARE = {
    cpu: { id: 'cpu-1ghz-single', name: '1GHz Single Core', power: 65 },
    memory: [{ id: 'ram-2gb', name: '2GB RAM', power: 3 }],
    storage: [{ id: 'ssd-90gb', name: '90GB SSD', power: 2 }],
    motherboard: { id: 'board-basic', name: 'Basic Board', power: 5 },
    powerSupply: { id: 'psu-300w', name: '300W PSU', wattage: 300 },
    network: { id: 'net-250mb', name: '250Mb Network Card', power: 5 },
};

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

// ============================================================================
// E2E SAVE BUILDERS (realistic save format for browser localStorage)
// ============================================================================

/**
 * Create a realistic save state matching the actual game save format.
 * Uses DEFAULT_HARDWARE and imports STARTING_SOFTWARE from gameConstants at runtime.
 * @param {string} username - Username for the save
 * @param {number} balance - Bank account balance
 * @param {Object} overrides - Optional overrides for any save properties
 * @returns {Object} Complete save state object in the real save format
 */
export function createRealisticSave(username, balance = 1000, overrides = {}) {
    return {
        username,
        playerMailId: `SNET-TST-${username.slice(-3)}-XXX`,
        currentTime: '2020-03-25T10:30:00.000Z',
        hardware: { ...DEFAULT_HARDWARE },
        software: [...STARTING_SOFTWARE],
        bankAccounts: [
            { id: 'account-first-bank', bankName: 'First Bank Ltd', balance },
        ],
        messages: [],
        managerName: 'TestManager',
        windows: [],
        savedAt: new Date().toISOString(),
        saveName: username,
        ...overrides,
    };
}

/**
 * Store a save in the browser's localStorage via page.evaluate.
 * @param {Page} page - Playwright page object
 * @param {string} username - Username key for the save slot
 * @param {Object} saveData - Save data object (from createRealisticSave or similar)
 */
export async function storeSaveInBrowser(page, username, saveData) {
    await page.evaluate(({ username, saveData }) => {
        const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
        saves[username] = [saveData];
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    }, { username, saveData });
}

/**
 * Store multiple saves in the browser's localStorage via page.evaluate.
 * @param {Page} page - Playwright page object
 * @param {Object} savesMap - Map of username → saveData (e.g., { user1: saveData1, user2: saveData2 })
 */
export async function storeMultipleSavesInBrowser(page, savesMap) {
    await page.evaluate((savesMap) => {
        const saves = {};
        for (const [username, saveData] of Object.entries(savesMap)) {
            saves[username] = [saveData];
        }
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    }, savesMap);
}

import { expect } from '@playwright/test';

/**
 * Common E2E test helper functions
 * Extracted utilities to reduce duplication across test files
 */

// ============================================================================
// SETUP & BOOT OPERATIONS
// ============================================================================

/**
 * Complete the boot sequence and login with a username
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to login with
 */
export async function completeBoot(page, username = 'test_user') {
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', username);
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
}

/**
 * Clear localStorage and reload the page
 * @param {Page} page - Playwright page object
 */
export async function clearAndReload(page) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
}

// ============================================================================
// APP OPERATIONS
// ============================================================================

/**
 * Open an app from the launcher
 * @param {Page} page - Playwright page object
 * @param {string} appName - Display name of the app (e.g., 'SNet Mail')
 */
export async function openApp(page, appName) {
    await page.hover('text=☰');
    await page.click(`.app-launcher-menu button:has-text("${appName}")`);
    await expect(page.locator(`.window:has-text("${appName}")`)).toBeVisible();
}

/**
 * Close an app window
 * @param {Page} page - Playwright page object
 * @param {string} windowTitle - Title of the window to close
 */
export async function closeWindow(page, windowTitle) {
    const window = page.locator(`.window:has-text("${windowTitle}")`);
    await window.locator('.window-control-btn[title="Close"]').click();
    await expect(window).not.toBeVisible();
}

/**
 * Open the app launcher menu
 * @param {Page} page - Playwright page object
 */
export async function openAppLauncher(page) {
    await page.hover('text=☰');
    await expect(page.locator('.app-launcher-menu')).toBeVisible();
}

// ============================================================================
// MAIL OPERATIONS
// ============================================================================

/**
 * Open the SNet Mail app
 * @param {Page} page - Playwright page object
 */
export async function openMail(page) {
    await openApp(page, 'SNet Mail');
}

/**
 * Wait for a message with specific subject to arrive
 * @param {Page} page - Playwright page object
 * @param {string} subject - Message subject to wait for
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForMessage(page, subject, timeout = 10000) {
    await expect(page.locator(`.message-item:has-text("${subject}")`)).toBeVisible({ timeout });
}

/**
 * Click on a message to read it
 * @param {Page} page - Playwright page object
 * @param {string} subject - Message subject to click
 */
export async function readMessage(page, subject) {
    await page.click(`.message-item:has-text("${subject}")`);
    await expect(page.locator('.message-view')).toBeVisible();
}

/**
 * Deposit a cheque from the current message
 * @param {Page} page - Playwright page object
 * @param {string} accountName - Account name to deposit into (e.g., 'Current Account')
 */
export async function depositCheque(page) {
    // Click on cheque attachment (scroll into view first since it may be below fold)
    const chequeItem = page.locator('.attachment-item:has-text("Click to deposit")');
    await chequeItem.scrollIntoViewIfNeeded();
    await chequeItem.click();

    // Banking window should open and show deposit prompt
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible({ timeout: 5000 });

    // Click the first account button to deposit
    await page.locator('.account-select-btn').first().click();

    // Wait for deposit prompt to close
    await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();
}

/**
 * Activate a NAR (Network Address Register) attachment from a mission briefing message.
 * Opens SNet Mail, reads the most recent unread message, clicks the NAR attachment,
 * then closes mail. Must be called after accepting a mission.
 * @param {Page} page - Playwright page object
 */
export async function activateMissionNar(page) {
    await openMail(page);

    // Click the first unread message (the briefing message)
    const unreadMessage = page.locator('.message-item.unread').first();
    await expect(unreadMessage).toBeVisible({ timeout: 5000 });
    await unreadMessage.click();
    await expect(page.locator('.message-view')).toBeVisible();

    // Click the NAR attachment
    const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
    await narAttachment.scrollIntoViewIfNeeded();
    await narAttachment.click();

    // Wait for NAR activation (attachment text changes to "Network credentials used")
    await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });

    await closeWindow(page, 'SNet Mail');
}

// ============================================================================
// WINDOW OPERATIONS
// ============================================================================

/**
 * Minimize a window
 * @param {Page} page - Playwright page object
 * @param {string} windowTitle - Title of the window to minimize
 */
export async function minimizeWindow(page, windowTitle) {
    const window = page.locator(`.window:has-text("${windowTitle}")`);
    await window.locator('.minimize-btn').click();
    await expect(window).not.toBeVisible();
    await expect(page.locator(`.minimized-window:has-text("${windowTitle}")`)).toBeVisible();
}

/**
 * Restore a minimized window
 * @param {Page} page - Playwright page object
 * @param {string} windowTitle - Title of the window to restore
 */
export async function restoreWindow(page, windowTitle) {
    await page.click(`.minimized-window:has-text("${windowTitle}")`);
    await expect(page.locator(`.window:has-text("${windowTitle}")`)).toBeVisible();
    await expect(page.locator(`.minimized-window:has-text("${windowTitle}")`)).not.toBeVisible();
}

/**
 * Drag a window to a new position
 * @param {Page} page - Playwright page object
 * @param {string} windowTitle - Title of the window to drag
 * @param {number} x - X coordinate to drag to
 * @param {number} y - Y coordinate to drag to
 */
export async function dragWindow(page, windowTitle, x, y) {
    const window = page.locator(`.window:has-text("${windowTitle}")`);
    const titleBar = window.locator('.title-bar');
    const box = await titleBar.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, y);
    await page.mouse.up();
}

// ============================================================================
// SAVE/LOAD OPERATIONS
// ============================================================================

/**
 * Save the game
 * @param {Page} page - Playwright page object
 */
export async function saveGame(page) {
    await page.click('text=⚙');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Game Saved')).toBeVisible();
    await page.keyboard.press('Escape');
}

/**
 * Load a game from the login screen
 * @param {Page} page - Playwright page object
 * @param {string} username - Username of the save to load
 */
export async function loadGameFromLogin(page, username) {
    await page.goto('/?skipBoot=true');
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.click(`button:has-text("${username}")`);
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
}

/**
 * Load a game from the power menu
 * @param {Page} page - Playwright page object
 * @param {string} username - Username of the save to load
 */
export async function loadGameFromPowerMenu(page, username) {
    await page.click('text=⚙');
    await page.click('button:has-text("Load")');
    await expect(page.locator('.modal-content')).toBeVisible();

    const modal = page.locator('.modal-content');
    await modal.locator(`button:has-text("${username}")`).click();

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

/**
 * Verify a window is open
 * @param {Page} page - Playwright page object
 * @param {string} windowTitle - Title of the window to verify
 */
export async function verifyWindowOpen(page, windowTitle) {
    await expect(page.locator(`.window:has-text("${windowTitle}")`)).toBeVisible();
}

/**
 * Verify credits amount in TopBar
 * @param {Page} page - Playwright page object
 * @param {number} amount - Expected credits amount
 */
export async function verifyCredits(page, amount) {
    const creditsText = await page.locator('.topbar-credits').textContent();
    expect(creditsText).toContain(amount.toString());
}

/**
 * Verify time display in TopBar
 * @param {Page} page - Playwright page object
 * @param {string} expectedTime - Expected time string (partial match)
 */
export async function verifyTime(page, expectedTime) {
    const timeText = await page.locator('.topbar-time').textContent();
    expect(timeText).toContain(expectedTime);
}

/**
 * Verify app is in the launcher
 * @param {Page} page - Playwright page object
 * @param {string} appName - Display name of the app
 */
export async function verifyAppInLauncher(page, appName) {
    await openAppLauncher(page);
    await expect(page.locator(`.app-launcher-menu button:has-text("${appName}")`)).toBeVisible();
    await page.keyboard.press('Escape'); // Close launcher
}

// ============================================================================
// TIME CONTROL HELPERS
// ============================================================================

/**
 * Toggle game time speed between 1x and 10x
 * @param {Page} page - Playwright page object
 */
export async function toggleTimeSpeed(page) {
    await page.click('button.time-speed');
}

/**
 * Set game time speed to 10x (fast mode)
 * @param {Page} page - Playwright page object
 */
export async function setTimeTo10x(page) {
    const currentSpeed = await page.locator('button.time-speed').textContent();
    if (currentSpeed.includes('1x')) {
        await toggleTimeSpeed(page);
        await expect(page.locator('button.time-speed:has-text("10x")')).toBeVisible();
    }
}

/**
 * Set game time speed to 1x (normal mode)
 * @param {Page} page - Playwright page object
 */
export async function setTimeTo1x(page) {
    const currentSpeed = await page.locator('button.time-speed').textContent();
    if (currentSpeed.includes('10x')) {
        await toggleTimeSpeed(page);
        await expect(page.locator('button.time-speed:has-text("1x")')).toBeVisible();
    }
}

/**
 * Wait for game-time delay (uses 10x speed to make tests faster)
 * This is much faster than page.waitForTimeout for in-game time-based events
 * @param {Page} page - Playwright page object
 * @param {number} gameTimeMs - Game time to wait in milliseconds
 */
export async function waitForGameTime(page, gameTimeMs) {
    // Speed up to 10x
    await setTimeTo10x(page);

    // Wait for gameTimeMs / 10 in real time
    const realTimeMs = gameTimeMs / 10;
    await page.waitForTimeout(realTimeMs);

    // Set back to 1x
    await setTimeTo1x(page);
}

// ============================================================================
// OVERLAY OPERATIONS
// ============================================================================

/**
 * Dismiss the forced disconnection overlay if visible
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout to wait for overlay (default 5000ms)
 */
export async function dismissForcedDisconnectionOverlay(page, timeout = 5000) {
    const overlay = page.locator('.forced-disconnect-overlay');
    const isVisible = await overlay.isVisible({ timeout }).catch(() => false);

    if (isVisible) {
        await page.click('.acknowledge-btn');
        await expect(overlay).not.toBeVisible({ timeout: 2000 });
    }
}

/**
 * Wait for and dismiss the forced disconnection overlay
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout to wait for overlay (default 10000ms)
 */
export async function waitForAndDismissForcedDisconnection(page, timeout = 10000) {
    await expect(page.locator('.forced-disconnect-overlay')).toBeVisible({ timeout });
    await page.click('.acknowledge-btn');
    await expect(page.locator('.forced-disconnect-overlay')).not.toBeVisible({ timeout: 2000 });
}

/**
 * Dismiss the TopBar disconnection notice (from revokeOnComplete) if visible
 * @param {Page} page - Playwright page object
 */
export async function dismissDisconnectionNotice(page) {
    const dismissBtn = page.locator('.disconnection-notice .dismiss-btn');
    const isVisible = await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
        await dismissBtn.click({ force: true });
        await page.waitForTimeout(300);
    }
}

// ============================================================================
// OBJECTIVE VERIFICATION HELPERS
// ============================================================================

/**
 * Wait for an objective to be marked as complete
 * @param {Page} page - Playwright page object
 * @param {string} objectiveText - Partial text to match in the objective description
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForObjectiveComplete(page, objectiveText, timeout = 5000) {
    const objective = page.locator(`.objective-item:has-text("${objectiveText}")`).first();
    await expect(objective).toHaveClass(/objective-complete/, { timeout });
}

/**
 * Verify an objective is still pending (not complete)
 * @param {Page} page - Playwright page object
 * @param {string} objectiveText - Partial text to match in the objective description
 */
export async function verifyObjectivePending(page, objectiveText) {
    const objective = page.locator(`.objective-item:has-text("${objectiveText}")`).first();
    await expect(objective).not.toHaveClass(/objective-complete/);
}

/**
 * Get the status of an objective by its ID
 * @param {Page} page - Playwright page object
 * @param {string} objectiveId - The objective ID
 * @returns {Promise<string>} The objective status or 'not-found'
 */
export async function getObjectiveStatus(page, objectiveId) {
    return page.evaluate((id) => {
        const mission = window.gameContext?.activeMission;
        const obj = mission?.objectives?.find(o => o.id === id);
        return obj?.status || 'not-found';
    }, objectiveId);
}

// ============================================================================
// NETWORK OPERATIONS
// ============================================================================

/**
 * Connect to a network via VPN Client
 * @param {Page} page - Playwright page object
 * @param {string} networkName - The display name of the network to connect to
 */
export async function connectToNetwork(page, networkName) {
    await openApp(page, 'VPN Client');
    const vpn = page.locator('.window:has-text("VPN Client")');
    await vpn.locator('select').selectOption({ label: networkName });
    await vpn.locator('button:has-text("Connect")').click();
    await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });
    await closeWindow(page, 'VPN Client');
}

/**
 * Scan a network using the Network Scanner
 * @param {Page} page - Playwright page object
 * @param {string} networkName - The display name of the network to scan
 * @param {string} expectedHost - Optional hostname to wait for in results
 */
export async function scanNetwork(page, networkName, expectedHost = null) {
    await openApp(page, 'Network Scanner');
    const scanner = page.locator('.window:has-text("Network Scanner")');
    await scanner.locator('select').selectOption({ label: networkName });
    await scanner.locator('button:has-text("Start Scan")').click();

    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));
    if (expectedHost) {
        await expect(scanner.locator(`text=${expectedHost}`).first()).toBeVisible({ timeout: 10000 });
    } else {
        await expect(scanner.locator('.machine-item').first()).toBeVisible({ timeout: 10000 });
    }
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));
    await closeWindow(page, 'Network Scanner');
}

// ============================================================================
// FILE MANAGER OPERATIONS
// ============================================================================

/**
 * Connect File Manager to a file system by its ID
 * @param {Page} page - Playwright page object
 * @param {string} fileSystemId - The file system ID to connect to
 */
export async function connectFileManager(page, fileSystemId) {
    await openApp(page, 'File Manager');
    const fm = page.locator('.window:has-text("File Manager")').first();
    await fm.locator('select').first().selectOption(fileSystemId);
    await page.waitForTimeout(200);
}

/**
 * Select all corrupted files in File Manager
 * @param {Page} page - Playwright page object
 * @returns {Promise<number>} The number of corrupted files selected
 */
export async function selectCorruptedFiles(page) {
    const fm = page.locator('.window:has-text("File Manager")').first();
    const corrupted = fm.locator('.file-corrupted');
    const count = await corrupted.count();
    for (let i = 0; i < count; i++) {
        await corrupted.nth(i).click({ modifiers: ['Control'] });
    }
    return count;
}

/**
 * Repair selected files in File Manager
 * @param {Page} page - Playwright page object
 */
export async function repairSelectedFiles(page) {
    const fm = page.locator('.window:has-text("File Manager")').first();
    await fm.locator('button:has-text("Repair")').click();
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));
    await expect(fm.locator('.file-operating')).toHaveCount(0, { timeout: 30000 });
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));
}

/**
 * Set game time speed to a specific value (for tests)
 * @param {Page} page - Playwright page object
 * @param {number} speed - The time speed to set (e.g., 100 for fast tests)
 */
export async function setSpecificTimeSpeed(page, speed) {
    await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
}

// ============================================================================
// SCENARIO & SETUP HELPERS
// ============================================================================

/**
 * Load a scenario fixture and wait for the desktop and game context to be ready
 * @param {Page} page - Playwright page object
 * @param {string} scenarioName - Scenario name (e.g., 'post-ransomware-recovery')
 */
export async function loadScenario(page, scenarioName) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/?scenario=${scenarioName}`);
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
}

/**
 * Inject credits into the first bank account
 * @param {Page} page - Playwright page object
 * @param {number} amount - Amount to add
 */
export async function addCredits(page, amount) {
    await page.evaluate((amt) => {
        const accounts = window.gameContext.bankAccounts;
        if (accounts && accounts.length > 0) {
            accounts[0].balance += amt;
        }
    }, amount);
}

/**
 * Purchase an item from the Portal (software, hardware, or services).
 * Opens Portal, navigates to the section, purchases, waits for install, closes Portal.
 * @param {Page} page - Playwright page object
 * @param {string} itemName - Display name of the item (e.g., 'Password Cracker')
 * @param {Object} [options] - Options
 * @param {string} [options.section='Software'] - Portal section: 'Software', 'Hardware', or 'Services'
 * @param {boolean} [options.keepOpen=false] - If true, don't close the Portal window
 */
export async function purchaseFromPortal(page, itemName, { section = 'Software', keepOpen = false } = {}) {
    await openApp(page, 'Portal');
    const portal = page.locator('.window:has-text("Portal")');
    const modal = portal.locator('.modal-content');

    await portal.locator(`.section-btn:has-text("${section}")`).click();
    await page.waitForTimeout(300);

    const item = portal.locator('.portal-item').filter({
        has: page.locator('.item-name', { hasText: itemName })
    });
    await expect(item).toBeVisible({ timeout: 5000 });
    await item.locator('.purchase-btn').click();

    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modal.locator('button:has-text("Confirm")').click();
        await page.waitForTimeout(200);
    }

    // For services, there's no install badge — just wait briefly
    if (section === 'Services') {
        await page.waitForTimeout(1000);
    } else {
        await expect(item.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
    }

    if (!keepOpen) {
        await closeWindow(page, 'Portal');
    }
}

// ============================================================================
// MISSION HELPERS
// ============================================================================

/**
 * Wait for a mission to become available on the Mission Board or as the active mission
 * @param {Page} page - Playwright page object
 * @param {string} missionId - Mission ID (e.g., 'locked-out')
 * @param {number} timeout - Timeout in ms
 */
export async function waitForMission(page, missionId, timeout = 60000) {
    await page.waitForFunction(
        (id) => {
            const board = window.gameContext.availableMissions || [];
            const active = window.gameContext.activeMission;
            return board.some(m => m.missionId === id) || active?.missionId === id;
        },
        missionId,
        { timeout }
    );
}

/**
 * Accept a mission from the Mission Board by its display title
 * @param {Page} page - Playwright page object
 * @param {string} missionTitle - Display title (e.g., 'Locked Out')
 */
export async function acceptMission(page, missionTitle) {
    await openApp(page, 'Mission Board');
    const board = page.locator('.window:has-text("Mission Board")');
    const card = board.locator(`.mission-card:has-text("${missionTitle}")`);
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.locator('.accept-mission-btn').click();
    await page.waitForTimeout(500);
    await closeWindow(page, 'Mission Board');
}

/**
 * Navigate to the SNet Mail inbox. Opens mail if not open, navigates back from message view if needed.
 * @param {Page} page - Playwright page object
 */
export async function goToMailInbox(page) {
    // Check if mail is already open
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    const isOpen = await mailWindow.isVisible().catch(() => false);

    if (!isOpen) {
        await openMail(page);
    }

    const backBtn = mailWindow.locator('button:has-text("Back")');
    if (await backBtn.isVisible().catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(200);
    }
}

/**
 * Read a message and activate its NAR attachment (Click to add → credentials used).
 * Opens mail, finds the message, reads it, clicks NAR attachment, closes mail.
 * @param {Page} page - Playwright page object
 * @param {string} messageSubject - Message subject to read
 */
export async function activateNarFromMessage(page, messageSubject) {
    await goToMailInbox(page);
    await waitForMessage(page, messageSubject, 30000);
    await readMessage(page, messageSubject);
    await page.waitForTimeout(300);

    const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
    await expect(narAttachment).toBeVisible({ timeout: 5000 });
    await narAttachment.click();
    await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
    await closeWindow(page, 'SNet Mail');
}

/**
 * Wait for an objective to complete by its ID (via gameContext)
 * @param {Page} page - Playwright page object
 * @param {string} objectiveId - The objective ID
 * @param {number} timeout - Timeout in ms
 */
export async function waitForObjectiveById(page, objectiveId, timeout = 60000) {
    await page.waitForFunction(
        (id) => {
            const mission = window.gameContext.activeMission;
            const obj = mission?.objectives?.find(o => o.id === id);
            return obj?.status === 'complete';
        },
        objectiveId,
        { timeout }
    );
}

/**
 * Wait for a mission to complete (activeMission becomes null or missionId in completedMissions)
 * @param {Page} page - Playwright page object
 * @param {string} missionId - Mission ID
 * @param {number} timeout - Timeout in ms
 */
export async function waitForMissionComplete(page, missionId, timeout = 30000) {
    await page.waitForFunction(
        (id) => {
            const mission = window.gameContext.activeMission;
            const completed = window.gameContext.completedMissions;
            return mission === null || completed?.some(m => m.missionId === id);
        },
        missionId,
        { timeout }
    );
}

// ============================================================================
// APP GAMEPLAY HELPERS
// ============================================================================

/**
 * Connect to a network through relay nodes via VPN Client.
 * Opens VPN Client, selects network, expands relay panel, selects N nodes, connects, closes.
 * @param {Page} page - Playwright page object
 * @param {string} networkName - Display name of the network
 * @param {number} relayCount - Number of relay nodes to select (default 2)
 */
export async function connectThroughRelays(page, networkName, relayCount = 2) {
    await openApp(page, 'VPN Client');
    const vpn = page.locator('.window:has-text("VPN Client")');

    await vpn.locator('select').selectOption({ label: networkName });
    await page.waitForTimeout(300);

    // Expand relay panel if collapsed
    const relayPanel = vpn.locator('.relay-panel-content');
    if (!await relayPanel.isVisible().catch(() => false)) {
        await vpn.locator('.relay-panel-header').click();
        await page.waitForTimeout(300);
    }

    // Clear previous selection
    const clearBtn = vpn.locator('.relay-clear-btn');
    if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
        await page.waitForTimeout(200);
    }

    // Select relay nodes
    const nodes = vpn.locator('.relay-node');
    const nodeCount = await nodes.count();
    const toSelect = Math.min(relayCount, nodeCount);
    for (let i = 0; i < toSelect; i++) {
        await nodes.nth(i).click();
        await page.waitForTimeout(200);
    }

    await vpn.locator('button:has-text("Connect")').click();
    await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
    await closeWindow(page, 'VPN Client');
}

/**
 * Crack a password-protected file using the Password Cracker app.
 * Opens the cracker, selects the file system and file, picks method, starts crack,
 * and waits for the objective to complete.
 * @param {Page} page - Playwright page object
 * @param {string} fileSystemId - File system ID (e.g., 'fs-meridian-hr')
 * @param {string} fileName - File name to crack (e.g., 'personnel-records.db')
 * @param {string} objectiveId - Objective ID to wait for completion
 * @param {Object} [options] - Options
 * @param {string} [options.method='Brute Force'] - Attack method button text
 * @param {boolean} [options.keepOpen=false] - If true, don't close the cracker window
 */
export async function crackPassword(page, fileSystemId, fileName, objectiveId, { method = 'Brute Force', keepOpen = false } = {}) {
    // Open Password Cracker if not already open
    const pcWindow = page.locator('.window:has-text("Password Cracker")');
    if (!await pcWindow.isVisible().catch(() => false)) {
        await openApp(page, 'Password Cracker');
    }

    await pcWindow.locator('.pc-dropdown').selectOption(fileSystemId);
    await page.waitForTimeout(500);

    const file = pcWindow.locator(`.pc-file-item:has-text("${fileName}")`);
    await expect(file).toBeVisible({ timeout: 5000 });
    await file.click();
    await page.waitForTimeout(300);

    await pcWindow.locator(`.pc-method-btn:has-text("${method}")`).click();
    await page.waitForTimeout(200);

    await pcWindow.locator('.pc-start-btn').click();

    await waitForObjectiveById(page, objectiveId, 120000);

    if (!keepOpen) {
        // Wait for success auto-clear before closing (avoids stale state)
        await page.waitForTimeout(2500);
        await closeWindow(page, 'Password Cracker');
    }
}

/**
 * Use the Network Sniffer to extract credentials from a network.
 * Opens the sniffer, selects network, starts monitoring, waits for reconstruction,
 * extracts credentials, and waits for the objective to complete.
 * @param {Page} page - Playwright page object
 * @param {string} networkId - Network ID for the sniffer dropdown
 * @param {string} objectiveId - Objective ID to wait for completion
 */
export async function snifferExtractCredentials(page, networkId, objectiveId) {
    await openApp(page, 'Network Sniffer');
    const sniffer = page.locator('.window:has-text("Network Sniffer")');

    await sniffer.locator('select').first().selectOption(networkId);
    await page.waitForTimeout(500);

    // Ensure Extract Credentials mode
    const credModeBtn = sniffer.locator('.ns-mode-btn:has-text("Extract Credentials")');
    if (await credModeBtn.isVisible().catch(() => false)) {
        await credModeBtn.click();
        await page.waitForTimeout(200);
    }

    await sniffer.locator('button:has-text("Start Monitoring")').click();

    // Wait for hash reconstruction to complete
    await page.waitForFunction(
        () => document.querySelector('.window:has(.network-sniffer) .ns-extract-btn') !== null,
        { timeout: 120000 }
    );

    await sniffer.locator('.ns-extract-btn').click();
    await waitForObjectiveById(page, objectiveId, 30000);

    await closeWindow(page, 'Network Sniffer');
}

/**
 * Activate a passive software app from the app launcher (e.g., Trace Monitor, Advanced Firewall).
 * @param {Page} page - Playwright page object
 * @param {string} appName - App name in the launcher (e.g., 'Trace Monitor')
 */
export async function activatePassiveApp(page, softwareId) {
    await page.evaluate((id) => {
        if (window.gameContext?.startPassiveSoftware) {
            window.gameContext.startPassiveSoftware(id);
        }
    }, softwareId);
    await page.waitForTimeout(500);
}

/**
 * Reboot the game via sleep menu → load. Useful for testing post-reboot events.
 * @param {Page} page - Playwright page object
 */
export async function rebootGame(page) {
    page.once('dialog', async (dialog) => dialog.accept());
    await page.hover('text=\u23FB');
    await page.click('.dropdown-menu button:has-text("Sleep")');
    await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

    const loadBtn = page.locator('button:has-text("Load Latest")');
    await expect(loadBtn.first()).toBeVisible({ timeout: 10000 });
    await loadBtn.first().click();

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

    // Dismiss pause overlay if visible (game pauses on load)
    const pauseOverlay = page.locator('text=Click anywhere or press ESC to resume');
    if (await pauseOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.click('.desktop');
        await page.waitForTimeout(500);
    }
}

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
    await window.locator('.close-btn').click();
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
export async function depositCheque(page, accountName = 'Current Account') {
    // Click on cheque attachment
    await page.click('.cheque-attachment');

    // Banking window should open and show deposit prompt
    await expect(page.locator('.banking-window')).toBeVisible();
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

    // Select account and deposit
    await page.selectOption('.account-select', accountName);
    await page.click('button:has-text("Deposit")');

    // Wait for confirmation
    await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();
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

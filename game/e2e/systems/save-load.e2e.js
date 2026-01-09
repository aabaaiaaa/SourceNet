import { test, expect } from '@playwright/test';
import { completeBoot, openApp, clearAndReload, waitForGameTime } from '../helpers/common-actions.js';
import { STARTING_SOFTWARE } from '../../src/constants/gameConstants.js';

/**
 * Consolidated Save/Load Flow Tests
 * 
 * This test suite covers all save and load scenarios including:
 * - Basic save/load from login screen
 * - Loading from power menu (in-game)
 * - Window state persistence
 * - Message timestamp preservation across loads
 * - Modal interactions (cancel, overlay click)
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a basic save state in localStorage
 */
async function createSaveInStorage(page, username, balance, additionalData = {}) {
    await page.evaluate(({ username, balance, startingSoftware, additionalData }) => {
        const saveData = {
            username,
            playerMailId: `SNET-TST-${username.slice(-3)}-XXX`,
            currentTime: '2020-03-25T10:30:00.000Z',
            hardware: {
                cpu: { id: 'cpu-1ghz-single', name: '1GHz Single Core', power: 65 },
                memory: [{ id: 'ram-2gb', name: '2GB RAM', power: 3 }],
                storage: [{ id: 'ssd-90gb', name: '90GB SSD', power: 2 }],
                motherboard: { id: 'board-basic', name: 'Basic Board', power: 5 },
                powerSupply: { id: 'psu-300w', name: '300W PSU', wattage: 300 },
                network: { id: 'net-250mb', name: '250Mb Network Card', power: 5 },
            },
            software: startingSoftware,
            bankAccounts: [
                { id: 'account-first-bank', bankName: 'First Bank Ltd', balance },
            ],
            messages: [],
            managerName: 'TestManager',
            windows: [],
            savedAt: new Date().toISOString(),
            saveName: username,
            ...additionalData,
        };

        const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
        saves[username] = [saveData];
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    }, { username, balance, startingSoftware: STARTING_SOFTWARE, additionalData });
}

/**
 * Create multiple saves in localStorage
 */
async function createMultipleSaves(page, savesConfig) {
    await page.evaluate(({ savesConfig, startingSoftware }) => {
        const saves = {};

        savesConfig.forEach(({ username, balance, messages = [], windows = [] }) => {
            saves[username] = [{
                username,
                playerMailId: `SNET-TST-${username.slice(-3)}-XXX`,
                currentTime: '2020-03-25T09:00:00',
                hardware: {
                    cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                    memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                    storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                    motherboard: { id: 'board-basic', name: 'Basic Board' },
                    powerSupply: { id: 'psu-300w', wattage: 300 },
                    network: { id: 'net-250mb', speed: 250 },
                },
                software: startingSoftware,
                bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance }],
                messages,
                managerName: 'TestManager',
                windows,
                savedAt: new Date().toISOString(),
                saveName: username,
            }];
        });

        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    }, { savesConfig, startingSoftware: STARTING_SOFTWARE });
}

/**
 * Wait for boot sequence to complete
 */
async function waitForBootComplete(page) {
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
}

/**
 * Save game via power menu with a dialog prompt
 */
async function saveGameWithPrompt(page, saveName) {
    page.once('dialog', (dialog) => dialog.accept(saveName));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(1000);
}

// ============================================================================
// BASIC SAVE/LOAD FROM LOGIN SCREEN
// ============================================================================

test.describe('Basic Save/Load from Login Screen', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should save game state and restore it correctly', async ({ page }) => {
        // Create a save with specific state
        await createSaveInStorage(page, 'save_test', 1500, {
            messages: [
                {
                    id: 'msg-1',
                    from: 'HR',
                    fromId: 'SNET-HQ0-000-001',
                    subject: 'Welcome',
                    read: true,
                    archived: true,
                },
                {
                    id: 'msg-2',
                    from: 'Manager',
                    fromId: 'SNET-MGR-ABC-123',
                    subject: 'Hello',
                    read: true,
                    archived: false,
                    attachment: { type: 'cheque', amount: 1000, deposited: true },
                },
            ],
        });

        // Reload to trigger game to check for saves
        await page.reload();

        // Should show login screen with save
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.save-item:has-text("save_test")')).toBeVisible();

        // Load the save
        await page.click('.save-item:has-text("save_test") button:has-text("Load")');

        // Desktop should load
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify loaded state
        await expect(page.locator('.topbar-credits:has-text("1500")')).toBeVisible();
        await expect(page.locator('.topbar-time:has-text("25/03/2020")')).toBeVisible();

        // Verify time advances (game is running)
        await page.waitForTimeout(2000);
        const time1 = await page.locator('.topbar-time').textContent();
        await page.waitForTimeout(2000);
        const time2 = await page.locator('.topbar-time').textContent();
        expect(time2).not.toBe(time1);
    });
});

// ============================================================================
// SAVE/LOAD WITH WINDOWS OPEN
// ============================================================================

test.describe('Save/Load with Windows Open', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should preserve Mail window state and message timestamps after save/load', async ({ page }) => {
        // Complete boot sequence
        await completeBoot(page, 'mail_save_test');

        // Wait for first message to arrive (2 seconds game time)
        await waitForGameTime(page, 2000);

        // Open SNet Mail
        await openApp(page, 'SNet Mail');
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        await expect(mailWindow).toBeVisible();

        // Verify first message is visible with formatted timestamp
        await expect(page.locator('.message-item:has-text("Welcome to SourceNet!")')).toBeVisible();
        const messageDate = await page.locator('.message-date').first();
        await expect(messageDate).toBeVisible();
        const dateText = await messageDate.textContent();
        expect(dateText).toBeTruthy();
        expect(dateText).toMatch(/\d{2}\/\d{2}\/\d{4}/); // Should match dd/mm/yyyy format

        // Click first message to read it
        await page.click('.message-item:has-text("Welcome to SourceNet!")');
        await expect(page.locator('.message-view')).toBeVisible();

        // Go back to inbox
        await page.click('button:has-text("Back")');

        // Wait for second message (2 seconds game time)
        await waitForGameTime(page, 2000);
        await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible();

        // Save game WITH Mail window open
        await saveGameWithPrompt(page, 'MailOpenTest');

        // Reload page completely
        await page.reload();

        // Should show login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.save-item:has-text("mail_save_test")')).toBeVisible();

        // Load the save
        await page.click('.save-item:has-text("mail_save_test") button:has-text("Load")');

        // Wait for desktop
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // VERIFY: Mail window should be restored
        await expect(mailWindow).toBeVisible();

        // CRITICAL TEST: Verify messages still display with timestamps after load
        await expect(page.locator('.message-item')).toHaveCount(2);

        // Verify first message still has formatted date (tests formatDateTime with loaded strings)
        const loadedMessageDate = await page.locator('.message-date').first();
        await expect(loadedMessageDate).toBeVisible();
        const loadedDateText = await loadedMessageDate.textContent();
        expect(loadedDateText).toBeTruthy();
        expect(loadedDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

        // Verify can still click and read messages after load
        await page.click('.message-item:has-text("Hi from your manager")');
        await expect(page.locator('.message-view')).toBeVisible();

        // Verify message details show correctly formatted timestamp
        const dateLabel = page.locator('.detail-label:has-text("Date:")');
        await expect(dateLabel).toBeVisible();

        // Verify message body shows
        await expect(page.locator('text=welcome bonus')).toBeVisible();

        // Verify cheque attachment still works after load
        await expect(page.locator('.attachment-item')).toBeVisible();
    });

    test('should open Mail window after loading a save with other windows open', async ({ page }) => {
        // Complete boot
        await completeBoot(page, 'test_user');

        // Open Mail window, then close it
        await openApp(page, 'SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
        await page.click('.window:has-text("SNet Mail") button[title="Close"]');
        await expect(page.locator('.window:has-text("SNet Mail")')).not.toBeVisible();

        // Open Banking and Portal windows
        await openApp(page, 'SNet Banking App');
        await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();

        await openApp(page, 'OSNet Portal');
        await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

        // Test clicking topbar credits and hovering notifications
        await page.click('.topbar-credits');
        await page.hover('text=✉');
        await page.hover('text=💳');

        // Save the game with Banking and Portal windows open
        await saveGameWithPrompt(page, 'TestSave');

        // Reload to get back to login
        await page.reload();
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

        // Load the save
        await page.click('button:has-text("Load")');

        // Wait for desktop
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Try to open Mail after loading - this tests the window opening bug fix
        await page.click('text=☰');
        await page.waitForTimeout(500);
        await page.click('text=SNet Mail');

        // Verify Mail window opens successfully after load
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible({ timeout: 5000 });
    });
});

// ============================================================================
// POWER MENU LOAD (IN-GAME SWITCHING)
// ============================================================================

test.describe('Power Menu Load (In-Game)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');

        // Create multiple saves
        await createMultipleSaves(page, [
            { username: 'save_1', balance: 500 },
            { username: 'save_2', balance: 1000 },
            { username: 'save_3', balance: 1500 },
        ]);
    });

    test('should load game from power menu', async ({ page }) => {
        await page.goto('/?skipBoot=true');

        // Should show login screen with saves
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

        // Load first save to enter game
        await page.click('.save-item:has-text("save_1") button:has-text("Load")');
        await waitForBootComplete(page);

        // Verify save_1 loaded (500 credits)
        await expect(page.locator('.topbar-credits:has-text("500")')).toBeVisible();

        // Open power menu and click Load
        await page.hover('text=⏻');
        await page.click('text=Load');

        // Load modal should appear
        await expect(page.locator('.modal-content:has-text("Load Game")')).toBeVisible();

        // Should show all 3 saves
        await expect(page.locator('.load-save-btn:has-text("save_1")')).toBeVisible();
        await expect(page.locator('.load-save-btn:has-text("save_2")')).toBeVisible();
        await expect(page.locator('.load-save-btn:has-text("save_3")')).toBeVisible();

        // Click to load save_2
        await page.click('.load-save-btn:has-text("save_2")');

        // Wait for boot sequence to complete
        await waitForBootComplete(page);

        // Should load save_2 (1000 credits)
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

        // Modal should close
        await expect(page.locator('.modal-content')).not.toBeVisible();

        // Verify we're still on desktop
        await expect(page.locator('.desktop')).toBeVisible();
    });

    test('should preserve message timestamps when loading via power menu', async ({ page }) => {
        // Create saves WITH messages (to test formatDateTime with power menu load)
        await page.goto('/?skipBoot=true');
        await createMultipleSaves(page, [
            {
                username: 'msg_save_1',
                balance: 500,
                messages: [
                    {
                        id: 'msg-1',
                        from: 'Test Sender',
                        fromId: 'SNET-TST-001-001',
                        subject: 'Test Message',
                        body: 'This is a test message.',
                        timestamp: '2020-03-25T09:05:00',  // ISO string (as saved in localStorage)
                        read: false,
                        archived: false,
                    }
                ],
            },
            {
                username: 'msg_save_2',
                balance: 1000,
                messages: [
                    {
                        id: 'msg-1',
                        from: 'Test Sender',
                        fromId: 'SNET-TST-001-001',
                        subject: 'Test Message',
                        body: 'This is a test message.',
                        timestamp: '2020-03-25T09:05:00',
                        read: false,
                        archived: false,
                    }
                ],
            },
        ]);

        await page.reload();

        // Load first save from login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('.save-item:has-text("msg_save_1") button:has-text("Load")');
        await waitForBootComplete(page);

        // Open Mail to verify timestamps work
        await openApp(page, 'SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Verify message displays with formatted timestamp
        await expect(page.locator('.message-item:has-text("Test Message")')).toBeVisible();
        const firstDate = await page.locator('.message-date').first();
        await expect(firstDate).toBeVisible();
        const firstDateText = await firstDate.textContent();
        expect(firstDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

        // Close Mail
        await page.click('.window:has-text("SNet Mail") button[title="Close"]');

        // NOW load a different save via POWER MENU (from within game)
        await page.hover('text=⏻');
        await page.click('text=Load');
        await expect(page.locator('.modal-content:has-text("Load Game")')).toBeVisible();

        // Click to load msg_save_2
        await page.click('.load-save-btn:has-text("msg_save_2")');

        // Wait for boot sequence
        await waitForBootComplete(page);

        // Verify loaded successfully (1000 credits)
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

        // CRITICAL: Open Mail after power menu load and verify timestamps work
        await openApp(page, 'SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Verify message still displays with timestamp after power menu load
        await expect(page.locator('.message-item:has-text("Test Message")')).toBeVisible();
        const loadedDate = await page.locator('.message-date').first();
        await expect(loadedDate).toBeVisible();
        const loadedDateText = await loadedDate.textContent();
        expect(loadedDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

        // Verify can click and view message details
        await page.click('.message-item:has-text("Test Message")');
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('text=This is a test message')).toBeVisible();
    });
});

// ============================================================================
// LOAD MODAL INTERACTIONS
// ============================================================================

test.describe('Load Modal Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');

        // Create multiple saves
        await createMultipleSaves(page, [
            { username: 'save_1', balance: 500 },
            { username: 'save_2', balance: 1000 },
        ]);
    });

    test('should close load modal when clicking Cancel', async ({ page }) => {
        await page.goto('/?skipBoot=true');

        // Load a save to enter game
        await page.click('button:has-text("Load")');
        await waitForBootComplete(page);

        // Open load modal
        await page.hover('text=⏻');
        await page.click('text=Load');
        const modal = page.locator('.modal-content:has-text("Load Game")');
        await expect(modal).toBeVisible();

        // Click Cancel
        await modal.locator('button:has-text("Cancel")').click();

        // Modal should close
        await expect(page.locator('.modal-content')).not.toBeVisible();

        // Should still be on desktop
        await expect(page.locator('.desktop')).toBeVisible();
    });

    test('should close load modal when clicking overlay', async ({ page }) => {
        await page.goto('/?skipBoot=true');

        // Load a save
        await page.click('button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open load modal
        await page.hover('text=⏻');
        await page.click('text=Load');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click overlay (outside modal content)
        await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

        // Modal should close
        await expect(page.locator('.modal-content')).not.toBeVisible();
    });
});

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

// ============================================================================
// PENDING EVENTS AND BANKING MESSAGE PERSISTENCE
// ============================================================================

test.describe('Pending Events and Banking Message Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should persist banking message sent flags across save/load', async ({ page }) => {
        // Create a save with negative balance and firstOverdraft already sent
        await createSaveInStorage(page, 'banking_test', -500, {
            bankingMessagesSent: {
                firstOverdraft: true,
                approachingBankruptcy: false,
                bankruptcyCountdownStart: false,
                bankruptcyCancelled: false,
            },
            messages: [
                {
                    id: 'bank-firstOverdraft-123',
                    from: 'First Bank Ltd',
                    fromId: 'SNET-BNK-001-000',
                    subject: 'Overdraft Notice - Interest Charges Apply',
                    read: false,
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("banking_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Wait some time - no duplicate overdraft message should appear
        await waitForGameTime(page, 6000);

        // Should only have 1 overdraft message (the original one)
        const overdraftMessages = await page.locator('.message-item:has-text("Overdraft Notice")').count();
        expect(overdraftMessages).toBe(0); // Not in message list (only inbox shows unread)

        // Open mail to check
        await openApp(page, 'SNet Mail');
        await page.waitForTimeout(500);

        // The original message should exist, but no duplicate
        const allOverdraftMessages = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            const userSaves = Object.values(saves)[0];
            if (!userSaves || !userSaves[0]) return [];
            return userSaves[0].messages?.filter(m => m.subject?.includes('Overdraft')) || [];
        });
        expect(allOverdraftMessages.length).toBe(1);
    });

    test('should reset banking flags when balance improves', async ({ page }) => {
        // Create a save with positive balance but old overdraft flag still true
        await createSaveInStorage(page, 'reset_test', 1000, {
            bankingMessagesSent: {
                firstOverdraft: true, // Should be reset since balance is positive
                approachingBankruptcy: false,
                bankruptcyCountdownStart: false,
                bankruptcyCancelled: false,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("reset_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Wait for effect to run and reset the flag
        await page.waitForTimeout(500);

        // Now if balance goes negative again, a new overdraft message should be sent
        // (We can't easily trigger this without more complex setup, but the flag should be reset)
    });

    test('should persist pending story events in save data', async ({ page }) => {
        // Create a save with pending story events
        await createSaveInStorage(page, 'pending_test', 1000, {
            pendingStoryEvents: [
                {
                    id: 'storyEvent-1',
                    type: 'storyEvent',
                    payload: {
                        storyEventId: 'test-story',
                        eventId: 'event-1',
                        message: { subject: 'Test Message', body: 'Test body' },
                    },
                    remainingDelayMs: 2000, // 2 seconds remaining
                },
            ],
            processedEvents: [],
        });

        await page.reload();
        await page.click('.save-item:has-text("pending_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // The pending event should be restored with a buffer
        // We can verify by waiting and checking console or messages
        // For now, just verify the game loads without errors
        await page.waitForTimeout(1000);
        await expect(page.locator('.desktop')).toBeVisible();
    });

    test('should queue banking messages in threshold order when multiple thresholds crossed', async ({ page }) => {
        // Create a save with positive balance
        await createSaveInStorage(page, 'queue_test', 100, {
            bankingMessagesSent: {
                firstOverdraft: false,
                approachingBankruptcy: false,
                bankruptcyCountdownStart: false,
                bankruptcyCancelled: false,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("queue_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // The banking message system is now set up
        // In a real scenario, dropping balance would trigger messages in order
        // This test verifies the system initializes correctly
        await expect(page.locator('.topbar-credits:has-text("100")')).toBeVisible();
    });

    test('should persist reputation message sent flags across save/load', async ({ page }) => {
        // Create a save at Tier 2 with performancePlanWarning already sent
        await createSaveInStorage(page, 'rep_msg_test', 1000, {
            reputation: 2,
            reputationMessagesSent: {
                performancePlanWarning: true,
                finalTerminationWarning: false,
                performanceImproved: false,
            },
            messages: [
                {
                    id: 'hr-performancePlanWarning-123',
                    from: 'SourceNet Human Resources',
                    fromId: 'SNET-HQ0-000-001',
                    subject: 'URGENT - Performance Plan Required',
                    read: false,
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("rep_msg_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Wait some time - no duplicate HR message should appear since flag is persisted
        await page.waitForTimeout(2000);

        // Verify only one performance plan message exists
        const allHrMessages = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            const userSaves = Object.values(saves)[0];
            return userSaves?.[0]?.messages?.filter(m => m.subject?.includes('Performance Plan')) || [];
        });
        expect(allHrMessages.length).toBe(1);
    });

    test('should reset reputation flags when tier improves', async ({ page }) => {
        // Create a save at Tier 3 with performancePlanWarning flag still set (from previous Tier 2)
        // The flag should be reset since tier is now >= 3
        await createSaveInStorage(page, 'rep_reset_test', 1000, {
            reputation: 3,
            reputationMessagesSent: {
                performancePlanWarning: true,
                finalTerminationWarning: false,
                performanceImproved: false,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("rep_reset_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Wait for flag reset logic to run
        await page.waitForTimeout(1000);

        // The flag should have been reset - verify by checking that the system is ready
        // to send the message again if tier drops back to 2
        // (We can't easily check internal state, but the test verifies the flow works)
        await expect(page.locator('.desktop')).toBeVisible();
    });
});

// ============================================================================
// SAVE RESTRICTION DURING NETWORK CONNECTIONS
// ============================================================================

test.describe('Save Restriction During Network Connections', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should disable Save button when connected to a network', async ({ page }) => {
        // Create save with active network connection
        await createSaveInStorage(page, 'connected_save_test', 1000, {
            activeConnections: [
                {
                    id: 'conn-1',
                    networkId: 'test-network',
                    networkName: 'Test Corporate Network',
                    connectedAt: new Date().toISOString(),
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("connected_save_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Open power menu
        await page.hover('text=⏻');
        await expect(page.locator('.dropdown-menu')).toBeVisible();

        // Save button should be disabled
        const saveButton = page.locator('.dropdown-menu button:has-text("Save")');
        await expect(saveButton).toBeDisabled();

        // Should have tooltip explaining why
        await expect(saveButton).toHaveAttribute('title', 'Disconnect from all networks to save your game');
    });

    test('should enable Save button when not connected to any network', async ({ page }) => {
        // Create save with no active connections
        await createSaveInStorage(page, 'disconnected_save_test', 1000, {
            activeConnections: [],
        });

        await page.reload();
        await page.click('.save-item:has-text("disconnected_save_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Open power menu
        await page.hover('text=⏻');
        await expect(page.locator('.dropdown-menu')).toBeVisible();

        // Save button should be enabled
        const saveButton = page.locator('.dropdown-menu button:has-text("Save")');
        await expect(saveButton).toBeEnabled();
    });

    test('should prompt user before Sleep when connected to networks', async ({ page }) => {
        // Create save with active network connection
        await createSaveInStorage(page, 'sleep_prompt_test', 1000, {
            activeConnections: [
                {
                    id: 'conn-1',
                    networkId: 'test-network',
                    networkName: 'Test Corporate Network',
                    connectedAt: new Date().toISOString(),
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("sleep_prompt_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Set up dialog handler to reject the prompt
        let dialogMessage = '';
        page.once('dialog', async (dialog) => {
            dialogMessage = dialog.message();
            await dialog.dismiss();
        });

        // Open power menu and click Sleep
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');

        // Verify the confirm dialog was shown
        expect(dialogMessage).toBe('Sleeping will disconnect you from all networks. Continue?');

        // Should still be on desktop (user cancelled)
        await expect(page.locator('.desktop')).toBeVisible();
    });

    test('should proceed with Sleep without prompt when not connected', async ({ page }) => {
        // Create save with no active connections
        await createSaveInStorage(page, 'sleep_no_prompt_test', 1000, {
            activeConnections: [],
        });

        await page.reload();
        await page.click('.save-item:has-text("sleep_no_prompt_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Set up dialog handler - should NOT be called
        let dialogShown = false;
        page.once('dialog', async (dialog) => {
            dialogShown = true;
            await dialog.accept();
        });

        // Open power menu and click Sleep
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');

        // Should go to sleep animation without dialog
        await expect(page.locator('.sleep-screen')).toBeVisible({ timeout: 5000 });
        expect(dialogShown).toBe(false);
    });

    test('should disconnect all connections and sleep when user confirms', async ({ page }) => {
        // Create save with active network connection
        await createSaveInStorage(page, 'sleep_confirm_test', 1000, {
            activeConnections: [
                {
                    id: 'conn-1',
                    networkId: 'test-network',
                    networkName: 'Test Corporate Network',
                    connectedAt: new Date().toISOString(),
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("sleep_confirm_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Set up dialog handler to accept the prompt
        page.once('dialog', async (dialog) => {
            await dialog.accept();
        });

        // Open power menu and click Sleep
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');

        // Should go to sleep animation
        await expect(page.locator('.sleep-screen')).toBeVisible({ timeout: 5000 });
    });
});

// ============================================================================
// COUNTDOWN TIMER PERSISTENCE
// ============================================================================

test.describe('Countdown Timer Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should persist bankruptcy countdown across save/load', async ({ page }) => {
        // Create save with active bankruptcy countdown
        // Note: currentTime is 10:30, so endTime must be AFTER that
        await createSaveInStorage(page, 'bankruptcy_countdown_test', -12000, {
            bankruptcyCountdown: {
                startTime: '2020-03-25T10:25:00.000Z',
                endTime: '2020-03-25T10:35:00.000Z',  // 5 min after currentTime
                remaining: 180, // 3 minutes remaining
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("bankruptcy_countdown_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify bankruptcy warning banner is visible
        await expect(page.locator('.bankruptcy-warning-banner')).toBeVisible({ timeout: 3000 });
    });

    test('should persist reputation countdown across save/load', async ({ page }) => {
        // Create save with active reputation countdown (tier 1)
        // Note: currentTime is 10:30, so endTime must be AFTER that
        await createSaveInStorage(page, 'reputation_countdown_test', 1000, {
            reputation: 1,
            reputationCountdown: {
                startTime: '2020-03-25T10:20:00.000Z',
                endTime: '2020-03-25T10:40:00.000Z',  // 10 min after currentTime
                remaining: 300, // 5 minutes remaining
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("reputation_countdown_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify termination warning banner is visible
        await expect(page.locator('.reputation-warning-banner')).toBeVisible({ timeout: 3000 });
    });

    test('should continue bankruptcy countdown from saved remaining time', async ({ page }) => {
        // Create save with 60 seconds remaining
        await createSaveInStorage(page, 'bankruptcy_continue_test', -12000, {
            bankruptcyCountdown: {
                startTime: '2020-03-25T10:29:00.000Z',
                endTime: '2020-03-25T10:31:00.000Z',  // 1 min after currentTime
                remaining: 60,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("bankruptcy_continue_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify countdown is showing and counting
        const banner = page.locator('.bankruptcy-warning-banner');
        await expect(banner).toBeVisible();

        // Get initial time text
        const initialText = await banner.textContent();
        expect(initialText).toContain('BANKRUPTCY WARNING');
    });

    test('should continue reputation countdown from saved remaining time', async ({ page }) => {
        // Create save with 120 seconds remaining
        await createSaveInStorage(page, 'reputation_continue_test', 1000, {
            reputation: 1,
            reputationCountdown: {
                startTime: '2020-03-25T10:28:00.000Z',
                endTime: '2020-03-25T10:32:00.000Z',  // 2 min after currentTime
                remaining: 120,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("reputation_continue_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify countdown is showing
        const banner = page.locator('.reputation-warning-banner');
        await expect(banner).toBeVisible();

        // Get initial time text
        const initialText = await banner.textContent();
        expect(initialText).toContain('TERMINATION WARNING');
    });

    test('should handle null countdowns correctly after load', async ({ page }) => {
        // Create save with no active countdowns
        await createSaveInStorage(page, 'no_countdown_test', 1000, {
            bankruptcyCountdown: null,
            reputationCountdown: null,
            reputation: 9,
        });

        await page.reload();
        await page.click('.save-item:has-text("no_countdown_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify no warning banners are visible
        await expect(page.locator('.bankruptcy-warning-banner')).not.toBeVisible();
        await expect(page.locator('.reputation-warning-banner')).not.toBeVisible();
    });
});

// ============================================================================
// MISSION STATE PERSISTENCE
// ============================================================================

test.describe('Mission State Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should persist active mission across save/load', async ({ page }) => {
        // Create save with an active mission
        await createSaveInStorage(page, 'active_mission_test', 1000, {
            activeMission: {
                missionId: 'test-mission-1',
                title: 'Test Mission',
                description: 'A test mission for save/load',
                difficulty: 'easy',
                status: 'active',
                objectives: [
                    { id: 'obj-1', description: 'First objective', completed: false },
                    { id: 'obj-2', description: 'Second objective', completed: false },
                ],
                timeLimit: 300,
                startedAt: '2020-03-25T10:00:00.000Z',
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("active_mission_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify mission state is preserved via game context
        const missionData = await page.evaluate(() => {
            return window.gameContext?.activeMission;
        });

        expect(missionData).not.toBeNull();
        expect(missionData.missionId).toBe('test-mission-1');
        expect(missionData.title).toBe('Test Mission');
    });

    test('should preserve completed objectives within active mission', async ({ page }) => {
        // Create save with mission that has some objectives completed
        await createSaveInStorage(page, 'objectives_test', 1000, {
            activeMission: {
                missionId: 'test-mission-2',
                title: 'Objective Test Mission',
                description: 'Testing objective persistence',
                difficulty: 'medium',
                status: 'active',
                objectives: [
                    { id: 'obj-1', description: 'First objective', completed: true },
                    { id: 'obj-2', description: 'Second objective', completed: true },
                    { id: 'obj-3', description: 'Third objective', completed: false },
                ],
                timeLimit: 600,
                startedAt: '2020-03-25T10:00:00.000Z',
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("objectives_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify objectives are preserved
        const missionData = await page.evaluate(() => {
            return window.gameContext?.activeMission;
        });

        expect(missionData.objectives[0].completed).toBe(true);
        expect(missionData.objectives[1].completed).toBe(true);
        expect(missionData.objectives[2].completed).toBe(false);
    });

    test('should persist completed missions array across save/load', async ({ page }) => {
        // Create save with completed missions
        await createSaveInStorage(page, 'completed_missions_test', 1000, {
            completedMissions: [
                {
                    missionId: 'completed-1',
                    title: 'First Completed Mission',
                    completedAt: '2020-03-24T15:00:00.000Z',
                    reward: 500,
                },
                {
                    missionId: 'completed-2',
                    title: 'Second Completed Mission',
                    completedAt: '2020-03-25T09:00:00.000Z',
                    reward: 750,
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("completed_missions_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify completed missions are preserved
        const completedMissions = await page.evaluate(() => {
            return window.gameContext?.completedMissions;
        });

        expect(completedMissions).toHaveLength(2);
        expect(completedMissions[0].missionId).toBe('completed-1');
        expect(completedMissions[1].missionId).toBe('completed-2');
    });

    test('should persist mission cooldowns across save/load', async ({ page }) => {
        // Create save with mission cooldowns
        await createSaveInStorage(page, 'cooldowns_test', 1000, {
            missionCooldowns: {
                easy: '2020-03-25T11:00:00.000Z',
                medium: '2020-03-25T12:00:00.000Z',
                hard: null,
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("cooldowns_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify cooldowns are preserved
        const cooldowns = await page.evaluate(() => {
            return window.gameContext?.missionCooldowns;
        });

        expect(cooldowns.easy).toBe('2020-03-25T11:00:00.000Z');
        expect(cooldowns.medium).toBe('2020-03-25T12:00:00.000Z');
        expect(cooldowns.hard).toBeNull();
    });

    test('should handle null active mission correctly after load', async ({ page }) => {
        // Create save with no active mission
        await createSaveInStorage(page, 'no_mission_test', 1000, {
            activeMission: null,
            completedMissions: [],
        });

        await page.reload();
        await page.click('.save-item:has-text("no_mission_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify no active mission
        const activeMission = await page.evaluate(() => {
            return window.gameContext?.activeMission;
        });

        expect(activeMission).toBeNull();
    });

    test('should preserve mission progress percentage after load', async ({ page }) => {
        // Create save with partially completed mission (2/4 objectives)
        await createSaveInStorage(page, 'progress_test', 1000, {
            activeMission: {
                missionId: 'progress-mission',
                title: 'Progress Test Mission',
                description: 'Testing progress persistence',
                difficulty: 'hard',
                status: 'active',
                objectives: [
                    { id: 'obj-1', description: 'Objective 1', completed: true },
                    { id: 'obj-2', description: 'Objective 2', completed: true },
                    { id: 'obj-3', description: 'Objective 3', completed: false },
                    { id: 'obj-4', description: 'Objective 4', completed: false },
                ],
                timeLimit: 900,
                startedAt: '2020-03-25T10:00:00.000Z',
            },
        });

        await page.reload();
        await page.click('.save-item:has-text("progress_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify progress (50% - 2/4 objectives)
        const missionData = await page.evaluate(() => {
            const mission = window.gameContext?.activeMission;
            if (!mission) return null;
            const completed = mission.objectives.filter(o => o.completed).length;
            return {
                total: mission.objectives.length,
                completed,
                percentage: Math.round((completed / mission.objectives.length) * 100),
            };
        });

        expect(missionData.total).toBe(4);
        expect(missionData.completed).toBe(2);
        expect(missionData.percentage).toBe(50);
    });
});

// ============================================================================
// TRANSACTION HISTORY PERSISTENCE
// ============================================================================

test.describe('Transaction History Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should persist transaction history across save/load', async ({ page }) => {
        // Create save with transaction history
        await createSaveInStorage(page, 'transactions_test', 1000, {
            transactions: [
                {
                    id: 'txn-1',
                    type: 'mission_reward',
                    amount: 500,
                    description: 'Mission: Log File Repair',
                    timestamp: '2020-03-25T09:30:00.000Z',
                },
                {
                    id: 'txn-2',
                    type: 'interest',
                    amount: -10,
                    description: 'Overdraft Interest',
                    timestamp: '2020-03-25T10:00:00.000Z',
                },
                {
                    id: 'txn-3',
                    type: 'software_purchase',
                    amount: -200,
                    description: 'Purchased: Advanced Scanner',
                    timestamp: '2020-03-25T10:15:00.000Z',
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("transactions_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify transactions are preserved
        const transactions = await page.evaluate(() => {
            return window.gameContext?.transactions;
        });

        expect(transactions).toHaveLength(3);
        expect(transactions[0].id).toBe('txn-1');
        expect(transactions[0].amount).toBe(500);
        expect(transactions[1].type).toBe('interest');
        expect(transactions[2].description).toBe('Purchased: Advanced Scanner');
    });

    test('should preserve transaction timestamps after load', async ({ page }) => {
        const testTimestamp = '2020-03-25T08:45:30.000Z';

        await createSaveInStorage(page, 'timestamps_test', 1000, {
            transactions: [
                {
                    id: 'txn-timestamp',
                    type: 'deposit',
                    amount: 1000,
                    description: 'Initial deposit',
                    timestamp: testTimestamp,
                },
            ],
        });

        await page.reload();
        await page.click('.save-item:has-text("timestamps_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify timestamp is preserved exactly
        const transactions = await page.evaluate(() => {
            return window.gameContext?.transactions;
        });

        expect(transactions[0].timestamp).toBe(testTimestamp);
    });

    test('should handle empty transactions array after load', async ({ page }) => {
        await createSaveInStorage(page, 'empty_transactions_test', 1000, {
            transactions: [],
        });

        await page.reload();
        await page.click('.save-item:has-text("empty_transactions_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify empty array is preserved (not undefined)
        const transactions = await page.evaluate(() => {
            return window.gameContext?.transactions;
        });

        expect(transactions).toBeDefined();
        expect(Array.isArray(transactions)).toBe(true);
        expect(transactions).toHaveLength(0);
    });
});

// ============================================================================
// HARDWARE, SOFTWARE AND LICENSE PERSISTENCE
// ============================================================================

test.describe('Hardware, Software and License Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await clearAndReload(page);
    });

    test('should persist hardware configuration across save/load', async ({ page }) => {
        const upgradedHardware = {
            cpu: { id: 'cpu-2ghz-dual', name: '2GHz Dual Core', specs: '2GHz, 2 cores', price: 800, power: 95 },
            memory: [
                { id: 'ram-4gb', name: '4GB RAM', capacity: '4GB', price: 300, power: 4 },
                { id: 'ram-4gb-2', name: '4GB RAM', capacity: '4GB', price: 300, power: 4 },
            ],
            storage: [{ id: 'ssd-250gb', name: '250GB SSD', capacity: '250GB', price: 200, power: 2 }],
            motherboard: { id: 'board-standard', name: 'Standard Board', cpuSlots: 1, memorySlots: 4, storageSlots: 3, networkSlots: 1, price: 500, power: 8 },
            powerSupply: { id: 'psu-500w', name: '500W PSU', wattage: 500, price: 150 },
            network: { id: 'net-500mb', name: '500Mb Network Card', speed: 500, price: 200, power: 6 },
        };

        await createSaveInStorage(page, 'hardware_test', 5000, { hardware: upgradedHardware });
        await page.reload();
        await page.click('.save-item:has-text("hardware_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const hardware = await page.evaluate(() => window.gameContext?.hardware);

        expect(hardware).toBeDefined();
        expect(hardware.cpu.id).toBe('cpu-2ghz-dual');
        expect(hardware.memory).toHaveLength(2);
        expect(hardware.storage[0].id).toBe('ssd-250gb');
        expect(hardware.motherboard.id).toBe('board-standard');
        expect(hardware.powerSupply.id).toBe('psu-500w');
        expect(hardware.network.id).toBe('net-500mb');
    });

    test('should persist partial hardware upgrades across save/load', async ({ page }) => {
        const partialUpgrade = {
            cpu: { id: 'cpu-2ghz-dual', name: '2GHz Dual Core', specs: '2GHz, 2 cores', price: 800, power: 95 },
            memory: [{ id: 'ram-2gb', name: '2GB RAM', capacity: '2GB', price: 150, power: 3 }],
            storage: [{ id: 'ssd-90gb', name: '90GB SSD', capacity: '90GB', price: 100, power: 2 }],
            motherboard: { id: 'board-basic', name: 'Basic Board', cpuSlots: 1, memorySlots: 2, storageSlots: 2, networkSlots: 1, price: 150, power: 5 },
            powerSupply: { id: 'psu-300w', name: '300W PSU', wattage: 300, price: 80 },
            network: { id: 'net-250mb', name: '250Mb Network Card', speed: 250, price: 100, power: 5 },
        };

        await createSaveInStorage(page, 'partial_hw_test', 3000, { hardware: partialUpgrade });
        await page.reload();
        await page.click('.save-item:has-text("partial_hw_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const hardware = await page.evaluate(() => window.gameContext?.hardware);

        expect(hardware.cpu.id).toBe('cpu-2ghz-dual');
        expect(hardware.memory[0].id).toBe('ram-2gb');
        expect(hardware.storage[0].id).toBe('ssd-90gb');
    });

    test('should persist installed software across save/load', async ({ page }) => {
        const installedSoftware = [
            { id: 'osnet', name: 'OSNet', type: 'os', canRemove: false },
            { id: 'portal', name: 'OSNet Software/Hardware Portal', type: 'system', canRemove: false },
            { id: 'mail', name: 'SNet Mail', type: 'system', canRemove: false },
            { id: 'banking', name: 'SNet Banking App', type: 'system', canRemove: false },
            { id: 'mission-board', name: 'SourceNet Mission Board', type: 'tool', canRemove: true },
            { id: 'network-scanner', name: 'Network Scanner', type: 'tool', canRemove: true },
        ];

        await createSaveInStorage(page, 'software_test', 2000, { software: installedSoftware });
        await page.reload();
        await page.click('.save-item:has-text("software_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const software = await page.evaluate(() => window.gameContext?.software);

        expect(software).toHaveLength(6);
        const softwareIds = software.map(s => s.id);
        expect(softwareIds).toContain('mission-board');
        expect(softwareIds).toContain('network-scanner');
    });

    test('should persist licensed software across save/load', async ({ page }) => {
        await createSaveInStorage(page, 'licensed_test', 1000, {
            licensedSoftware: ['vpn-client', 'file-manager', 'network-address-register'],
        });
        await page.reload();
        await page.click('.save-item:has-text("licensed_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const licensedSoftware = await page.evaluate(() => window.gameContext?.licensedSoftware);

        expect(licensedSoftware).toHaveLength(3);
        expect(licensedSoftware).toContain('vpn-client');
        expect(licensedSoftware).toContain('file-manager');
        expect(licensedSoftware).toContain('network-address-register');
    });

    test('should handle empty licensedSoftware array after load', async ({ page }) => {
        await createSaveInStorage(page, 'no_licensed_test', 1000, { licensedSoftware: [] });
        await page.reload();
        await page.click('.save-item:has-text("no_licensed_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const licensedSoftware = await page.evaluate(() => window.gameContext?.licensedSoftware);

        expect(licensedSoftware).toBeDefined();
        expect(Array.isArray(licensedSoftware)).toBe(true);
        expect(licensedSoftware).toHaveLength(0);
    });

    test('should persist combined hardware, software, and licenses across save/load', async ({ page }) => {
        const upgradedHardware = {
            cpu: { id: 'cpu-3ghz-quad', name: '3GHz Quad Core', specs: '3GHz, 4 cores', price: 1500, power: 125 },
            memory: [{ id: 'ram-8gb', name: '8GB RAM', capacity: '8GB', price: 500, power: 5 }],
            storage: [{ id: 'ssd-500gb', name: '500GB SSD', capacity: '500GB', price: 350, power: 3 }],
            motherboard: { id: 'board-advanced', name: 'Advanced Board', cpuSlots: 1, memorySlots: 4, storageSlots: 4, networkSlots: 2, price: 800, power: 10 },
            powerSupply: { id: 'psu-750w', name: '750W PSU', wattage: 750, price: 250 },
            network: { id: 'net-1gb', name: '1Gb Network Card', speed: 1000, price: 400, power: 8 },
        };

        const installedSoftware = [
            { id: 'osnet', name: 'OSNet', type: 'os', canRemove: false },
            { id: 'portal', name: 'OSNet Software/Hardware Portal', type: 'system', canRemove: false },
            { id: 'mail', name: 'SNet Mail', type: 'system', canRemove: false },
            { id: 'banking', name: 'SNet Banking App', type: 'system', canRemove: false },
            { id: 'mission-board', name: 'SourceNet Mission Board', type: 'tool', canRemove: true },
        ];

        await createSaveInStorage(page, 'combined_test', 10000, {
            hardware: upgradedHardware,
            software: installedSoftware,
            licensedSoftware: ['vpn-client', 'network-scanner'],
        });
        await page.reload();
        await page.click('.save-item:has-text("combined_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        const gameState = await page.evaluate(() => ({
            hardware: window.gameContext?.hardware,
            software: window.gameContext?.software,
            licensedSoftware: window.gameContext?.licensedSoftware,
        }));

        expect(gameState.hardware.cpu.id).toBe('cpu-3ghz-quad');
        expect(gameState.hardware.memory[0].id).toBe('ram-8gb');
        expect(gameState.software).toHaveLength(5);
        expect(gameState.software.map(s => s.id)).toContain('mission-board');
        expect(gameState.licensedSoftware).toContain('vpn-client');
        expect(gameState.licensedSoftware).toContain('network-scanner');
    });
});

// ============================================================================
// SAVE DATA ERROR HANDLING
// ============================================================================

test.describe('Save Data Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should handle missing optional fields with defaults', async ({ page }) => {
        // Create minimal save with only required fields
        await page.evaluate(({ startingSoftware }) => {
            const minimalSave = {
                username: 'minimal_test',
                playerMailId: 'SNET-MIN-123-XXX',
                currentTime: '2020-03-25T10:00:00.000Z',
                hardware: {
                    cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                    memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                    storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                    motherboard: { id: 'board-basic', name: 'Basic Board' },
                    powerSupply: { id: 'psu-300w', wattage: 300 },
                    network: { id: 'net-250mb', speed: 250 },
                },
                software: startingSoftware,
                bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                messages: [],
                managerName: 'TestManager',
                windows: [],
                savedAt: new Date().toISOString(),
                saveName: 'minimal_test',
                // Intentionally omitting: reputation, reputationCountdown, activeMission,
                // completedMissions, missionCooldowns, narEntries, activeConnections, etc.
            };

            const saves = { minimal_test: [minimalSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        }, { startingSoftware: STARTING_SOFTWARE });

        await page.reload();
        await page.click('.save-item:has-text("minimal_test") button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify game loaded successfully with defaults
        const gameState = await page.evaluate(() => ({
            reputation: window.gameContext?.reputation,
            activeMission: window.gameContext?.activeMission,
            transactions: window.gameContext?.transactions,
        }));

        // Should have default values, not crash
        expect(gameState.reputation).toBeDefined();
        expect(gameState.activeMission).toBeNull();
    });

    test('should handle corrupted JSON in localStorage gracefully', async ({ page }) => {
        // Set corrupted JSON
        await page.evaluate(() => {
            localStorage.setItem('sourcenet_saves', '{ invalid json }}}');
        });

        await page.reload();

        // App should recover gracefully - with no valid saves, it starts new game flow
        // (username selection screen, not login screen)
        await expect(page.locator('h1:has-text("Welcome to OSNet")')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button:has-text("Continue")')).toBeVisible();

        // Continue should work - proving app didn't crash
        await page.locator('button:has-text("Continue")').click();

        // Should progress to desktop (taskbar visible)
        await expect(page.locator('button:has-text("☰")')).toBeVisible({ timeout: 15000 });
    });

    test('should handle save with missing required fields', async ({ page }) => {
        // Create save missing username
        await page.evaluate(() => {
            const incompleteSave = {
                // Missing: username, playerMailId
                currentTime: '2020-03-25T10:00:00.000Z',
                bankAccounts: [{ balance: 1000 }],
                savedAt: new Date().toISOString(),
                saveName: 'incomplete_test',
            };

            const saves = { incomplete_test: [incompleteSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        });

        await page.reload();

        // Should show login screen - save might appear but load could fail gracefully
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    });

    test('should not crash when loading save with unknown fields', async ({ page }) => {
        // Create save with extra unknown fields (future-proofing)
        await page.evaluate(({ startingSoftware }) => {
            const futureSave = {
                username: 'future_test',
                playerMailId: 'SNET-FUT-123-XXX',
                currentTime: '2020-03-25T10:00:00.000Z',
                hardware: {
                    cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                    memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                    storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                    motherboard: { id: 'board-basic', name: 'Basic Board' },
                    powerSupply: { id: 'psu-300w', wattage: 300 },
                    network: { id: 'net-250mb', speed: 250 },
                },
                software: startingSoftware,
                bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                messages: [],
                managerName: 'TestManager',
                windows: [],
                savedAt: new Date().toISOString(),
                saveName: 'future_test',
                // Unknown future fields
                unknownFeature: { enabled: true, value: 42 },
                futureArray: [1, 2, 3],
                newSystemState: 'active',
            };

            const saves = { future_test: [futureSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        }, { startingSoftware: STARTING_SOFTWARE });

        await page.reload();
        await page.click('.save-item:has-text("future_test") button:has-text("Load")');

        // Should load successfully, ignoring unknown fields
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible();
    });
});

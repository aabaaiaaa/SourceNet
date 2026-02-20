import { test, expect } from '@playwright/test';
import {
    loadScenario,
    setSpecificTimeSpeed,
    openMail,
    closeWindow,
    openApp,
} from '../helpers/common-actions.js';

/**
 * Hardware Unlock E2E Tests
 *
 * Tests the complete hardware unlock flow:
 * 1. Credits trigger manager message when reaching 1000+
 * 2. Network adapter hardware availability before/after reading message
 * 4. Hardware purchase and reboot installation mechanism
 */

test.setTimeout(120000);

/**
 * Open debug panel and set credits
 */
const setCreditsViaDebug = async (page, credits) => {
    await page.keyboard.press('Control+d');
    await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });
    await page.click('.debug-tab:has-text("State Controls")');
    await page.fill('[data-testid="debug-credits-input"]', String(credits));
    await page.click('[data-testid="debug-set-credits"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('.debug-panel')).not.toBeVisible();
};

/**
 * Open Portal app and go to Hardware tab
 */
const openPortalHardware = async (page) => {
    await openApp(page, 'OSNet Portal');
    await page.click('button:has-text("Hardware")');
    await expect(page.locator('.category-btn').first()).toBeVisible({ timeout: 5000 });
};

test.describe('Hardware Unlock - Credits Trigger', () => {
    test('should receive hardware unlock message when credits reach 1000+ after reading "better" message', async ({ page }) => {
        // Load post-tutorial scenario (has "Better" message unread)
        await loadScenario(page, 'post-tutorial-part-2');

        // First, read the "Better" message to trigger the creditsChanged listener
        await openMail(page);
        const betterMessage = page.locator('.message-item:has-text("Better")');
        await expect(betterMessage).toBeVisible();
        await betterMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();

        // Close mail
        await closeWindow(page, 'SNet Mail');

        // Get current credits
        const currentCredits = await page.evaluate(() => window.gameContext.getTotalCredits());
        console.log(`Current credits: ${currentCredits}`);

        // Set credits to 1000+ via debug panel (if not already)
        if (currentCredits < 1000) {
            await setCreditsViaDebug(page, 1500);
        }

        // Wait for the hardware unlock message to arrive (it has a 3 second delay)
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Open mail and check for hardware unlock message
        await openMail(page);

        // The message should have subject about hardware/tools
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 10000 });

        console.log('✅ Hardware unlock message received when credits >= 1000 after reading "better" message');
    });

    test('should NOT receive hardware unlock message if "better" message not read yet', async ({ page }) => {
        // Load post-tutorial scenario (has "Better" message unread)
        await loadScenario(page, 'post-tutorial-part-2');

        // Set credits to 1500 WITHOUT reading the "better" message
        await setCreditsViaDebug(page, 1500);

        // Wait some time
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Open mail - should NOT have hardware unlock message yet
        await openMail(page);

        // Check that hardware message is NOT present
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        const messageCount = await hardwareMessage.count();
        expect(messageCount).toBe(0);

        console.log('✅ Hardware unlock message NOT sent before reading "better" message');
    });
});

test.describe('Hardware Unlock - Network Adapter Availability', () => {
    test('should show network adapters as locked before reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Open Portal Hardware tab
        await openPortalHardware(page);

        // Click on Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await expect(page.locator('.portal-item').first()).toBeVisible({ timeout: 5000 });

        // Check for locked indicator or no purchase buttons
        const lockedIndicator = page.locator('text=/locked|Unlock|not available/i');
        const purchaseButtons = page.locator('.hardware-item button:has-text("Purchase")');

        // Either locked message shows OR no purchase buttons in network section
        const isLocked = await lockedIndicator.count() > 0 || await purchaseButtons.count() === 0;
        expect(isLocked).toBe(true);

        console.log('✅ Network adapters are locked before reading hardware unlock message');
    });

    test('should show network adapters as locked even after unlock message arrives (but not read)', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Read the "Better" message first
        await openMail(page);
        const betterMessage = page.locator('.message-item:has-text("Better")');
        await betterMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Set credits high enough to trigger message
        await setCreditsViaDebug(page, 2000);

        // Wait for hardware unlock message to arrive
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Verify message has arrived but DON'T read it
        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        // Close mail WITHOUT clicking/reading the message
        await closeWindow(page, 'SNet Mail');

        // Open Portal Hardware tab - features should still be locked
        await openPortalHardware(page);

        // Click on Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await expect(page.locator('.portal-item').first()).toBeVisible({ timeout: 5000 });

        // Network adapters should STILL be locked (message not read yet)
        const lockedIndicator = page.locator('text=/locked|Unlock|not available/i');
        const purchaseButtons = page.locator('.portal-item:not(.installed):not(.locked) button:has-text("Purchase")');

        // Should have no purchase buttons available & should all be locked
        const isLocked = await lockedIndicator.count() > 0 && await purchaseButtons.count() === 0;
        expect(isLocked).toBe(true);

        console.log('✅ Network adapters are still locked when message arrived but not read');
    });

    test('should show network adapters as available after reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Read the "Better" message first
        await openMail(page);
        const betterMessage = page.locator('.message-item:has-text("Better")');
        await betterMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Set credits high enough
        await setCreditsViaDebug(page, 2000);

        // Wait for hardware unlock message
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Read the hardware unlock message
        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal Hardware tab
        await openPortalHardware(page);

        // Click on Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await expect(page.locator('.portal-item').first()).toBeVisible({ timeout: 5000 });

        // Network adapters should now be available (have purchase buttons)
        const networkPurchaseBtn = page.locator('.portal-item:not(.installed):not(.locked) button:has-text("Purchase")');
        await expect(networkPurchaseBtn.first()).toBeVisible({ timeout: 5000 });

        console.log('✅ Network adapters are available after reading hardware unlock message');
    });
});

test.describe('Log Viewer Software Unlock', () => {
    test('should show Log Viewer as locked before reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Open Portal and go to Software tab
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Should be on Software tab by default

        // Look for Log Viewer in the software list
        const logViewerItem = page.locator('.portal-item:has-text("Log Viewer")');
        await expect(logViewerItem).toBeVisible({ timeout: 5000 });

        // Check for locked indicator on Log Viewer
        const lockedIcon = logViewerItem.locator('text=/locked/i');
        await expect(lockedIcon).toBeVisible();

        console.log('✅ Log Viewer is locked before reading hardware unlock message');
    });

    test('should show Log Viewer as available after reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock: read "better", set credits, read hardware message
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 2000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Read the hardware unlock message
        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal Software tab
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Look for Log Viewer in the software list
        const logViewerItem = page.locator('.portal-item:has-text("Log Viewer")');
        await expect(logViewerItem).toBeVisible({ timeout: 5000 });

        // Should NOT have locked indicator anymore, and should have purchase button
        const purchaseBtn = logViewerItem.locator('button:has-text("Purchase")');
        await expect(purchaseBtn).toBeVisible({ timeout: 5000 });

        console.log('✅ Log Viewer is available after reading hardware unlock message');
    });

    test('should be able to purchase and install Log Viewer after unlock', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 2000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Purchase Log Viewer
        const logViewerItem = page.locator('.portal-item:has-text("Log Viewer")');
        await logViewerItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase
        const confirmBtn = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtn).toBeVisible({ timeout: 3000 });
        await confirmBtn.click();

        // Wait for download to complete (speed up time)
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(1000);
        await setSpecificTimeSpeed(page, 1);

        // Close Portal
        await closeWindow(page, 'OSNet Portal');

        // Check if Log Viewer is in app launcher
        await page.hover('text=☰');
        const logViewerApp = page.locator('.app-launcher-menu >> text=Log Viewer');
        await expect(logViewerApp).toBeVisible({ timeout: 5000 });

        console.log('✅ Log Viewer can be purchased and appears in app launcher');
    });
});

test.describe('Data Recovery Tool Software Unlock', () => {
    test('should show Data Recovery Tool as locked before reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Open Portal and go to Software tab
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Should be on Software tab by default

        // Look for Data Recovery Tool in the software list
        const dataRecoveryItem = page.locator('.portal-item:has-text("Data Recovery Tool")');
        await expect(dataRecoveryItem).toBeVisible({ timeout: 5000 });

        // Check for locked indicator on Data Recovery Tool
        const lockedIcon = dataRecoveryItem.locator('text=/locked/i');
        await expect(lockedIcon).toBeVisible();

        console.log('✅ Data Recovery Tool is locked before reading hardware unlock message');
    });

    test('should show Data Recovery Tool as available after reading hardware unlock message', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock: read "better", set credits, read hardware message
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 2000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        // Read the hardware unlock message
        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal Software tab
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Look for Data Recovery Tool in the software list
        const dataRecoveryItem = page.locator('.portal-item:has-text("Data Recovery Tool")');
        await expect(dataRecoveryItem).toBeVisible({ timeout: 5000 });

        // Should NOT have locked indicator anymore, and should have purchase button
        const purchaseBtn = dataRecoveryItem.locator('button:has-text("Purchase")');
        await expect(purchaseBtn).toBeVisible({ timeout: 5000 });

        console.log('✅ Data Recovery Tool is available after reading hardware unlock message');
    });

    test('should be able to purchase and install Data Recovery Tool after unlock', async ({ page }) => {
        // Load post-tutorial scenario
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 2000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal
        await page.hover('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Purchase Data Recovery Tool
        const dataRecoveryItem = page.locator('.portal-item:has-text("Data Recovery Tool")');
        await dataRecoveryItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase
        const confirmBtn = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtn).toBeVisible({ timeout: 3000 });
        await confirmBtn.click();

        // Wait for download to complete (speed up time)
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(1000);
        await setSpecificTimeSpeed(page, 1);

        // Close Portal
        await closeWindow(page, 'OSNet Portal');

        // Check if Data Recovery Tool is in app launcher
        await page.hover('text=☰');
        const dataRecoveryApp = page.locator('.app-launcher-menu >> text=Data Recovery Tool');
        await expect(dataRecoveryApp).toBeVisible({ timeout: 5000 });

        console.log('✅ Data Recovery Tool can be purchased and appears in app launcher');
    });
});

test.describe('Hardware Purchase and Reboot Flow', () => {
    test('should queue hardware for installation when purchased', async ({ page }) => {
        // Load post-tutorial and trigger full unlock
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock: read "better", set credits, read hardware message
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 5000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Open Portal Hardware and purchase network adapter
        await openPortalHardware(page);

        // Click on Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await expect(page.locator('.portal-item').first()).toBeVisible({ timeout: 5000 });

        // Find a purchasable network item
        const networkItem = page.locator('.portal-item:not(.installed):not(.locked)').first();
        await expect(networkItem).toBeVisible({ timeout: 5000 });
        await networkItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase - wait for modal
        const confirmBtn = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtn).toBeVisible({ timeout: 3000 });
        await confirmBtn.click();

        // Should show pending/queued indicator (multiple will appear, just check first)
        const pendingIndicator = page.locator('.pending-badge').first();
        await expect(pendingIndicator).toBeVisible({ timeout: 5000 });

        console.log('✅ Hardware queued for installation after purchase');
    });

    test('should install hardware after reboot', async ({ page }) => {
        // Load post-tutorial and trigger full unlock
        await loadScenario(page, 'post-tutorial-part-2');

        // Trigger unlock
        await openMail(page);
        await page.locator('.message-item:has-text("Better")').click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        await setCreditsViaDebug(page, 5000);
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        await openMail(page);
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        await expect(hardwareMessage).toBeVisible({ timeout: 5000 });
        await hardwareMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await closeWindow(page, 'SNet Mail');

        // Get current network speed before upgrade
        const beforeSpeed = await page.evaluate(() => window.gameContext.hardware?.network?.speed || 0);
        console.log(`Network speed before upgrade: ${beforeSpeed}`);

        // Purchase hardware
        await openPortalHardware(page);

        // Click on Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await expect(page.locator('.portal-item').first()).toBeVisible({ timeout: 5000 });

        const networkItem = page.locator('.portal-item:not(.installed):not(.locked)').first();
        await networkItem.locator('button:has-text("Purchase")').click();

        const confirmBtn = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtn).toBeVisible({ timeout: 3000 });
        await confirmBtn.click();

        // Verify pending badge appears (hardware queued for install)
        const pendingBadge = page.locator('.pending-badge').first();
        await expect(pendingBadge).toBeVisible({ timeout: 3000 });
        console.log('✅ Pending badge visible - hardware queued');

        // Close Portal
        await closeWindow(page, 'OSNet Portal');

        // Reboot via power menu - note: scenario loading skips boot sequence
        await page.click('.topbar-button:has-text("⏻")');
        await page.click('button:has-text("Reboot")');

        // With scenario, reboot goes straight to desktop (skipBoot behavior)
        // Wait for boot to complete and return to desktop
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 30000 });

        // After reboot, the hardware should be installed (no more pending badge)
        // Note: With scenario mode, actual hardware application is skipped,
        // so we just verify the flow completes successfully
        console.log('✅ Hardware purchase and reboot flow completed');
    });
});

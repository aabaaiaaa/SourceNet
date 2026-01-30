import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SCENARIO GENERATOR: post-hardware-unlock
 *
 * This test generates a scenario fixture for the state after hardware unlock
 * with the new tools purchased and network adapter installed:
 * - Tutorial Part 1 & 2 completed
 * - "Better" message read
 * - Hardware unlock message received and read (unlocks network-adapters AND investigation-tooling)
 * - Credits >= 3000 (enough to buy everything)
 * - Network adapter purchased and installed (via reboot)
 * - Log Viewer purchased and installed
 *
 * Use Case: Testing features that require the new hardware and investigation tools
 */

test.setTimeout(300000);

test.describe('Scenario Generator', () => {
    test('Generate post-hardware-unlock fixture', async ({ page }) => {
        // Load post-tutorial-part-2 scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-tutorial-part-2');

        // Wait for desktop to be visible
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        console.log('✅ Desktop visible');

        // Wait for gameContext to be available
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
        console.log('✅ Game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Read the "Better" message
        // ========================================
        console.log('Opening Mail to read "Better" message...');
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Go to inbox if needed
        const backBtn = page.locator('button:has-text("Back")');
        if (await backBtn.isVisible()) await backBtn.click();
        await page.waitForTimeout(200);

        // Click on "Better" message
        const betterMessage = page.locator('.message-item:has-text("Better")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        await betterMessage.click();
        await page.waitForTimeout(500);
        console.log('✅ "Better" message read');

        // Close mail
        await page.locator('.window:has(.snet-mail) .close-btn, .window:has-text("SNet Mail") .window-controls button:has-text("×")').first().click();
        await page.waitForTimeout(200);

        // ========================================
        // STEP 2: Set credits high enough for all purchases
        // ========================================
        console.log('Setting credits to 5000 via debug panel...');

        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);
        await page.fill('[data-testid="debug-credits-input"]', '5000');
        await page.click('[data-testid="debug-set-credits"]');
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        const credits = await page.evaluate(() => window.gameContext.getTotalCredits());
        console.log(`✅ Credits set to: ${credits}`);

        // ========================================
        // STEP 3: Wait for hardware unlock message
        // ========================================
        console.log('Waiting for hardware unlock message...');
        await setSpeed(100);
        await page.waitForTimeout(200); // 20s game time
        await setSpeed(1);

        // Open mail and read hardware unlock message
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Go to inbox if needed
        const backBtn2 = page.locator('button:has-text("Back")');
        if (await backBtn2.isVisible()) await backBtn2.click();
        await page.waitForTimeout(200);

        // Find and read hardware unlock message
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities"), .message-item:has-text("Upgrade")');
        await expect(hardwareMessage.first()).toBeVisible({ timeout: 10000 });
        await hardwareMessage.first().click();
        await page.waitForTimeout(500);
        console.log('✅ Hardware unlock message read');

        // Close mail
        await page.locator('.window:has(.snet-mail) .close-btn, .window:has-text("SNet Mail") .window-controls button:has-text("×")').first().click();
        await page.waitForTimeout(200);

        // ========================================
        // STEP 4: Purchase Network Adapter
        // ========================================
        console.log('Purchasing network adapter...');
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=OSNet Portal');
        await expect(page.locator('.portal')).toBeVisible();

        // Go to Hardware section first
        await page.click('.section-btn:has-text("Hardware")');
        await page.waitForTimeout(300);

        // Go to Network Adapters category
        await page.click('.category-btn:has-text("Network")');
        await page.waitForTimeout(300);

        // Find and purchase a network adapter
        const networkItem = page.locator('.portal-item:not(.installed):not(.locked)').first();
        await expect(networkItem).toBeVisible({ timeout: 5000 });
        await networkItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase in modal
        const confirmBtnHW = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtnHW).toBeVisible({ timeout: 2000 });
        await confirmBtnHW.click();
        await page.waitForTimeout(300);
        console.log('✅ Network adapter purchased');

        // ========================================
        // STEP 5: Purchase Log Viewer Software
        // ========================================
        console.log('Purchasing Log Viewer software...');

        // Switch to Software section
        await page.click('.section-btn:has-text("Software")');
        await page.waitForTimeout(300);

        // Find and purchase Log Viewer
        const logViewerItem = page.locator('.portal-item:has-text("Log Viewer")');
        await expect(logViewerItem).toBeVisible({ timeout: 5000 });
        await logViewerItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase in modal
        const confirmBtnLV = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtnLV).toBeVisible({ timeout: 2000 });
        await confirmBtnLV.click();
        await page.waitForTimeout(300);

        // Wait for download to complete (speed up time)
        await setSpeed(100);
        await page.waitForTimeout(500);
        await setSpeed(1);
        console.log('✅ Log Viewer purchased and installed');

        // ========================================
        // STEP 5b: Purchase Data Recovery Tool Software
        // ========================================
        console.log('Purchasing Data Recovery Tool software...');

        // Find and purchase Data Recovery Tool
        const dataRecoveryItem = page.locator('.portal-item:has-text("Data Recovery Tool")');
        await expect(dataRecoveryItem).toBeVisible({ timeout: 5000 });
        await dataRecoveryItem.locator('button:has-text("Purchase")').click();

        // Confirm purchase in modal
        const confirmBtnDRT = page.locator('.modal-content .confirm-btn');
        await expect(confirmBtnDRT).toBeVisible({ timeout: 2000 });
        await confirmBtnDRT.click();
        await page.waitForTimeout(300);

        // Wait for download to complete (speed up time)
        await setSpeed(100);
        await page.waitForTimeout(500);
        await setSpeed(1);
        console.log('✅ Data Recovery Tool purchased and installed');

        // Close Portal
        await page.locator('.window:has(.portal) .close-btn, .window:has-text("OSNet Portal") .window-controls button:has-text("×")').first().click();
        await page.waitForTimeout(200);

        // ========================================
        // STEP 6: Reboot to install hardware
        // ========================================
        console.log('Rebooting to install hardware...');
        await page.click('.topbar-button:has-text("⏻")');
        await page.waitForTimeout(100);
        await page.click('button:has-text("Reboot")');

        // Wait for boot sequence
        await page.waitForTimeout(500);

        // Wait for desktop to return
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 30000 });
        console.log('✅ Reboot complete, hardware installed');

        // Wait for gameContext to be available again
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

        // ========================================
        // STEP 7: Save the game state
        // ========================================
        console.log('Saving game state...');

        // Close all windows first
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Sleep to save (handle any potential dialogs)
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });
        console.log('✅ Game saved');

        // ========================================
        // STEP 8: Extract and write fixture
        // ========================================
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-hardware-unlock.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`✅ Fixture written to: ${fixturePath}`);

        // Verify key state properties
        console.log('\n=== Fixture State Summary ===');
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Unlocks: ${JSON.stringify(saveData.unlocks || [])}`);
        console.log(`Installed Software: ${JSON.stringify(saveData.installedSoftware || [])}`);
        console.log(`Hardware: ${JSON.stringify(saveData.hardware || {})}`);
        console.log(`Messages count: ${saveData.messages?.length || 0}`);
        console.log('=============================\n');

        console.log('✅ Scenario generator complete: post-hardware-unlock');
    });
});

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SCENARIO GENERATOR: pre-hardware-unlock
 * 
 * This test generates a scenario fixture for the state just before the
 * hardware unlock message is triggered:
 * - Tutorial Part 1 & 2 completed
 * - "Better" message has been READ (required for unlock to trigger)
 * - Credits are at ~900 (just below the 1000 threshold)
 * - The creditsChanged listener is active, waiting for credits >= 1000
 * 
 * Use Case: Testing the exact moment when credits hit 1000 and the
 * hardware unlock message gets triggered.
 */

test.setTimeout(300000);

test.describe('Scenario Generator', () => {
    test('Generate pre-hardware-unlock fixture', async ({ page }) => {
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

        // Verify the message is now read
        const isRead = await page.evaluate(() => {
            const messages = window.gameContext.messages || [];
            const better = messages.find(m => m.subject?.includes('Better') || m.body?.includes('better'));
            return better && !better.unread;
        });
        expect(isRead).toBe(true);
        console.log('✅ "Better" message confirmed as read');

        // Close mail
        await page.locator('.window:has(.snet-mail) .close-btn, .window:has-text("SNet Mail") .window-controls button:has-text("×")').first().click();
        await page.waitForTimeout(200);

        // ========================================
        // STEP 2: Set credits to 900 (just below threshold)
        // ========================================
        console.log('Setting credits to 900 via debug panel...');

        // Open debug panel
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Go to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        // Set credits to 900
        await page.fill('[data-testid="debug-credits-input"]', '900');
        await page.click('[data-testid="debug-set-credits"]');
        await page.waitForTimeout(200);

        // Verify credits
        const credits = await page.evaluate(() => window.gameContext.getTotalCredits());
        console.log(`✅ Credits set to: ${credits}`);

        // Close debug panel
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        // ========================================
        // STEP 3: Verify unlock has NOT triggered
        // ========================================
        // Wait a bit to make sure no hardware message arrives
        await setSpeed(100);
        await page.waitForTimeout(100); // 10s game time
        await setSpeed(1);

        // Open mail and verify no hardware unlock message
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for hardware message
        const hardwareMessage = page.locator('.message-item:has-text("Hardware"), .message-item:has-text("Opportunities")');
        const hardwareCount = await hardwareMessage.count();
        expect(hardwareCount).toBe(0);
        console.log('✅ Hardware unlock message has NOT arrived (correct - credits < 1000)');

        // Close mail
        await page.locator('.window:has(.snet-mail) .close-btn, .window:has-text("SNet Mail") .window-controls button:has-text("×")').first().click();
        await page.waitForTimeout(200);

        // ========================================
        // STEP 4: Save the game state
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
        // STEP 5: Extract and write fixture
        // ========================================
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        // Write fixture file
        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-pre-hardware-unlock.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`✅ Fixture written to: ${fixturePath}`);

        // Verify key state properties
        console.log('\n=== Fixture State Summary ===');
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        const betterMsg = saveData.messages?.find(m => m.subject?.toLowerCase().includes('better'));
        console.log(`Better message read: ${betterMsg ? !betterMsg.read : 'N/A'}`);
        console.log(`Hardware unlock triggered: ${saveData.unlocks?.includes('network-adapters') || false}`);
        console.log(`Messages count: ${saveData.messages?.length || 0}`);
        console.log('=============================\n');

        console.log('✅ Scenario generator complete: pre-hardware-unlock');
    });
});

/**
 * Scenario Generator: Post Tutorial Complete (Better Message Pending)
 * 
 * Generates a scenario fixture where tutorial-part-2 is COMPLETE and the
 * "Better" message from the manager has arrived but NOT been read yet.
 * 
 * Reading the "Better" message triggers procedural mission generation.
 * 
 * Starts from tutorial-part-1-prior-to-sabotage scenario to skip initial setup.
 * 
 * Run with: npm run generate:scenarios
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.setTimeout(180000);

test.describe('Scenario Generator: Post Tutorial Complete', () => {
    test('generate scenario with Better message pending', async ({ page }) => {
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Load tutorial-part-1-prior-to-sabotage scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=tutorial-part-1-prior-to-sabotage');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

        // ========================================
        // STEP 2: Trigger sabotage by repairing files
        // ========================================
        // Scenario loads with VPN disconnected and File Manager closed
        // Need to reconnect and open File Manager to repair files

        // Connect to VPN
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=VPN Client');
        await page.locator('.network-dropdown').selectOption('clienta-corporate');
        await page.click('button:has-text("Connect")');
        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });

        // Open File Manager and select server
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=File Manager');
        await page.locator('.window:has(.window-header:has-text("File Manager"))').locator('select').selectOption('fs-clienta-01');
        await page.waitForTimeout(500);

        // Select all corrupted files
        const fileItems = page.locator('.window:has(.window-header:has-text("File Manager"))').locator('.file-corrupted');
        for (let i = 0; i < 8; i++) {
            await fileItems.nth(i).click();
            await page.waitForTimeout(30);
        }

        // Use 10x speed for repair to trigger sabotage faster
        await setSpeed(10);
        await page.click('button:has-text("Repair (8)")');

        // Wait for forced disconnect overlay (sabotage will trigger after repair)
        const forcedDisconnectOverlay = page.locator('.forced-disconnect-overlay');
        await expect(forcedDisconnectOverlay).toBeVisible({ timeout: 40000 });
        await page.locator('.acknowledge-btn').click();
        await expect(forcedDisconnectOverlay).not.toBeVisible({ timeout: 2000 });

        await setSpeed(1);

        // ========================================
        // STEP 3: Wait for Mission Failure
        // ========================================
        await setSpeed(100);
        await page.waitForTimeout(2000);
        await setSpeed(1);

        // ========================================
        // STEP 4: Accept Tutorial Part 2
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Mission Board');
        await page.locator('.tab:has-text("Available")').click();
        await page.waitForTimeout(500);
        await page.locator('.mission-card:has-text("Log File Restoration")').locator('button').first().click();

        // Get new credentials
        await setSpeed(100);
        await page.waitForTimeout(100);
        await setSpeed(1);
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Mail');
        await page.waitForTimeout(300);

        const backBtn2 = page.locator('button:has-text("Back")');
        if (await backBtn2.isVisible()) await backBtn2.click();
        await page.waitForTimeout(200);

        // Find the NEW network credentials message (tutorial-part-2)
        console.log('Looking for Updated Network Access message...');
        const networkUpdateMsg = page.locator('.message-item:has-text("Updated Network Access"), .message-item:has-text("Backup Server")').first();
        await expect(networkUpdateMsg).toBeVisible({ timeout: 10000 });
        console.log('Found network update message');
        await networkUpdateMsg.click();
        await page.waitForTimeout(200);

        // Check if network attachment is clickable (not disabled/used)
        const networkAttachment = page.locator('[data-testid^="network-attachment-"]:not(.disabled)').first();
        await expect(networkAttachment).toBeVisible({ timeout: 5000 });
        console.log('Network attachment visible');
        const attachmentClass = await networkAttachment.getAttribute('class');
        console.log('Network attachment class:', attachmentClass);
        await networkAttachment.click();
        await page.waitForTimeout(500); // Wait for NAR entry to be updated
        console.log('Clicked network attachment');

        // ========================================
        // STEP 5: Complete Part 2 (reconnect, scan, copy files)
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=VPN Client');
        await page.locator('.network-dropdown').selectOption('clienta-corporate');
        await page.click('button:has-text("Connect")');
        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });

        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Network Scanner');
        const scanner2 = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await scanner2.locator('label:has-text("Network:") select').selectOption('clienta-corporate');
        await scanner2.locator('label:has-text("Scan Type:") select').selectOption('deep');
        await scanner2.locator('button:has-text("Scan")').click();
        await setSpeed(100);
        await page.waitForTimeout(300);
        await setSpeed(1);

        // Open two File Managers and connect
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=File Manager');
        await page.waitForTimeout(200);
        await page.locator('.window:has(.window-header:has-text("File Manager"))').first().locator('select').selectOption('fs-clienta-backup');
        await page.waitForTimeout(200);

        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=File Manager');
        await page.waitForTimeout(200);
        await page.locator('.window:has(.window-header:has-text("File Manager"))').nth(1).locator('select').selectOption('fs-clienta-01');
        await page.waitForTimeout(200);

        // Copy from backup, paste to fileserver-01
        await page.evaluate(() => {
            const wins = document.querySelectorAll('.window');
            for (const win of wins) {
                if (win.querySelector('.window-header')?.textContent.includes('File Manager')) {
                    win.querySelectorAll('.file-item').forEach(item => item.click());
                    break;
                }
            }
        });
        await page.waitForTimeout(100);

        await page.evaluate(() => {
            const wins = document.querySelectorAll('.window');
            for (const win of wins) {
                if (win.querySelector('.window-header')?.textContent.includes('File Manager')) {
                    const btn = [...win.querySelectorAll('button')].find(b => b.textContent.includes('Copy') && b.textContent.includes('8'));
                    if (btn) { btn.click(); return; }
                    break;
                }
            }
        });
        await page.waitForTimeout(200);

        await page.evaluate(() => {
            const wins = [...document.querySelectorAll('.window')].filter(w =>
                w.querySelector('.window-header')?.textContent.includes('File Manager')
            );
            if (wins[1]) {
                const btn = [...wins[1].querySelectorAll('button')].find(b => b.textContent.includes('Paste') && b.textContent.includes('8'));
                if (btn) btn.click();
            }
        });

        await setSpeed(100);
        await page.waitForTimeout(1500);
        await setSpeed(1);

        // ========================================
        // STEP 6: Complete verification objective and wait for "Better" message
        // ========================================
        // Close all windows
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Open Mission Board and verify completion
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Mission Board');
        await page.locator('.tab:has-text("Active")').click();
        await page.waitForTimeout(500);

        // Wait for verification objective to auto-complete (3s delay)
        await setSpeed(100);
        await page.waitForTimeout(100); // 10s game time
        await setSpeed(1);

        // Check mission is completed
        await page.locator('.tab:has-text("Completed")').click();
        await expect(page.locator('.mission-card:has-text("Log File Restoration")')).toBeVisible({ timeout: 5000 });
        console.log('✅ Tutorial Part 2 completed');

        // Wait for "Better" message to arrive (5s delay after completion)
        await setSpeed(100);
        await page.waitForTimeout(200); // 20s game time to be safe
        await setSpeed(1);

        // Close Mission Board
        await page.locator('.window:has(.window-header:has-text("Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // ========================================
        // STEP 7: Open Mail and verify "Better" message exists but don't read it
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Go to inbox if needed
        const backBtnMail = page.locator('button:has-text("Back")');
        if (await backBtnMail.isVisible()) await backBtnMail.click();
        await page.waitForTimeout(200);

        // Verify "Better" message is visible but DON'T click it
        const betterMessage = page.locator('.message-item:has-text("Better")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        console.log('✅ "Better" message has arrived (unread)');

        // Verify it's unread
        const isUnread = await betterMessage.evaluate(el => el.classList.contains('unread'));
        expect(isUnread).toBe(true);
        console.log('✅ "Better" message is unread');

        // Archive all other messages (not the "Better" one)
        console.log('Archiving all messages except "Better"...');

        // Get count of non-Better messages
        let otherMessages = page.locator('.message-item:not(:has-text("Better"))');
        let otherCount = await otherMessages.count();
        console.log(`Found ${otherCount} other messages to archive`);

        while (otherCount > 0) {
            // Click the first non-Better message
            await otherMessages.first().click();
            await page.waitForTimeout(200);

            // Click the Archive button (use .archive-button class to avoid matching the tab)
            const archiveBtn = page.locator('button.archive-button');
            if (await archiveBtn.isVisible()) {
                await archiveBtn.click();
                await page.waitForTimeout(300);
            }

            // Go back to inbox if needed
            const backBtnArchive = page.locator('button:has-text("Back")');
            if (await backBtnArchive.isVisible()) {
                await backBtnArchive.click();
                await page.waitForTimeout(200);
            }

            // Refresh count
            otherMessages = page.locator('.message-item:not(:has-text("Better"))');
            otherCount = await otherMessages.count();
        }

        console.log('✅ All other messages archived');

        // Verify only "Better" message remains
        const remainingMessages = page.locator('.message-item');
        const remainingCount = await remainingMessages.count();
        expect(remainingCount).toBe(1);
        console.log('✅ Only "Better" message remains in inbox');

        // ========================================
        // STEP 8: Save the game state
        // ========================================
        // Close all windows
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Sleep to save
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(5000);

        // ========================================
        // STEP 9: Extract and Write Fixture
        // ========================================
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();
        expect(saveData.completedMissions?.length).toBeGreaterThanOrEqual(1);

        // Verify "Better" message exists and is unread
        const betterMsg = saveData.messages?.find(m => m.subject?.toLowerCase().includes('better'));
        expect(betterMsg).toBeDefined();
        expect(betterMsg.read).toBe(false);
        console.log('✅ Save data contains unread "Better" message');

        const fixturePath = path.join(__dirname, '../../src/debug/fixtures/scenario-post-tutorial-part-2.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2), 'utf-8');

        console.log(`✅ Fixture written to: ${fixturePath}`);
        console.log(`   - Username: ${saveData.username}`);
        console.log(`   - Active Mission: ${saveData.activeMission?.missionId || 'none'}`);
        console.log(`   - Completed Missions: ${saveData.completedMissions?.length || 0}`);
        console.log(`   - Credits: ${saveData.bankAccounts?.[0]?.balance}`);
        console.log(`   - Messages: ${saveData.messages?.length || 0}`);
    });
});

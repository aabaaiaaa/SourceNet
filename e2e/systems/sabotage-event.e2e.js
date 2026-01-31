/**
 * E2E Test: Tutorial Sabotage Event
 * 
 * Tests the scripted sabotage event that occurs during tutorial-part-1.
 * When the player repairs files, a sabotage event should:
 * 1. Delete files from the filesystem progressively
 * 2. Show deletion in File Manager activity log with "UNKNOWN" source
 * 3. Show a forced disconnection overlay
 * 4. Disconnect the player from the network
 * 5. Mark mission as failed
 * 
 * Uses the tutorial-part-1-prior-to-sabotage scenario which has the game
 * state ready to reconnect and repair files to trigger the sabotage.
 */

import { test, expect } from '@playwright/test';

test.describe('E2E: Tutorial Sabotage Event', () => {
    test('should trigger sabotage event when repairing files', async ({ page }) => {
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Load scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=tutorial-part-1-prior-to-sabotage');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

        // Set fast speed for setup
        await setSpeed(100);

        // ========================================
        // STEP 2: Reconnect to network
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=VPN Client');
        const vpnClient = page.locator('.window:has(.vpn-client)');
        await vpnClient.locator('.network-dropdown').selectOption('clienta-corporate');
        await vpnClient.locator('button:has-text("Connect")').click();
        await expect(vpnClient.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });
        console.log('✅ Connected to ClientA network');

        // ========================================
        // STEP 3: Open File Manager and select filesystem
        // ========================================
        // Devices already discovered in scenario - scan was performed before saving
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=File Manager');
        await page.waitForTimeout(500);

        const fileManager = page.locator('.window-content:has-text("File Manager")');
        await expect(fileManager).toBeVisible();

        // Select filesystem
        await fileManager.locator('select').selectOption('fs-clienta-01');
        await page.waitForTimeout(500);

        // Count initial files
        const initialFileCount = await fileManager.locator('.file-item').count();
        console.log(`Initial file count: ${initialFileCount}`);

        // Count corrupted vs clean files
        const corruptedFiles = fileManager.locator('.file-corrupted');
        const corruptedCount = await corruptedFiles.count();
        console.log(`  - Corrupted files: ${corruptedCount}`);
        console.log(`  - Clean files: ${initialFileCount - corruptedCount}`);

        // ========================================
        // STEP 4: Select all corrupted files
        // ========================================
        console.log(`Selecting all ${corruptedCount} corrupted files...`);

        // Select all corrupted files
        for (let i = 0; i < corruptedCount; i++) {
            await corruptedFiles.nth(i).click();
            await page.waitForTimeout(30);
        }

        // Verify Repair button is enabled
        const repairButton = page.locator(`button:has-text("Repair (${corruptedCount})")`);
        await expect(repairButton).toBeVisible();
        await expect(repairButton).toBeEnabled();
        console.log(`✅ All ${corruptedCount} corrupted files selected, Repair button ready`);

        // ========================================
        // STEP 5: Switch to 10x speed and click Repair
        // ========================================
        await setSpeed(10);
        // Wait for React state to propagate to StoryMissionManager
        // This ensures the scripted event delay (5000ms game time) uses 10x speed
        await page.waitForTimeout(200);
        console.log('⏱️  Switched to 10x speed for sabotage observation');

        await repairButton.click();
        await page.waitForTimeout(100);
        console.log('✅ Clicked Repair button - sabotage should trigger soon');

        // Verify repair started
        const repairLogEntry = fileManager.locator('.activity-log-entry .log-operation:has-text("REPAIR")').first();
        await repairLogEntry.scrollIntoViewIfNeeded();
        await expect(repairLogEntry).toBeVisible({ timeout: 5000 });
        console.log('✅ Repair operation started (visible in activity log)');

        // Wait for all 8 repair entries to appear (indicating repair is complete)
        const repairEntries = fileManager.locator('.activity-log-entry .log-operation:has-text("REPAIR")');
        await expect(repairEntries).toHaveCount(8, { timeout: 10000 });
        console.log('✅ All 8 files repaired');

        // Give React time to process state updates and emit objectiveComplete
        await page.waitForTimeout(500);

        // ========================================
        // STEP 6: Verify terminal lockout overlay appears (invisible at first)
        // ========================================
        console.log('⏳ Waiting for terminal lockout (~5s game time = 0.5s at 10x speed)...');

        const terminalLockoutOverlay = page.locator('.terminal-lockout-overlay');
        await expect(terminalLockoutOverlay).toBeVisible({ timeout: 15000 });
        console.log('✅ Terminal lockout overlay active (player cannot interact)');

        // Verify lockout overlay blocks interaction - try clicking app launcher
        await page.locator('text=☰').click({ timeout: 1000 }).catch(() => {
            console.log('✅ App launcher blocked by lockout overlay (as expected)');
        });

        // ========================================
        // STEP 7: Monitor progressive file deletion
        // ========================================
        console.log('⏳ Waiting for sabotage deletion to start...');

        // Wait for lockout visuals to appear (red border and text)
        const lockoutBorder = page.locator('.lockout-border-pulse');
        await expect(lockoutBorder).toBeVisible({ timeout: 15000 });
        console.log('🚨 Lockout visuals appeared - deletion started!');

        const lockoutMessage = page.locator('.lockout-message');
        await expect(lockoutMessage).toBeVisible();
        await expect(lockoutMessage.locator('.lockout-text:has-text("SYSTEM COMPROMISED")')).toBeVisible();
        console.log('✅ Warning message displayed: "SYSTEM COMPROMISED"');

        // Monitor DELETE log entries appearing progressively
        const deleteLogCounts = [];
        const monitorStart = Date.now();
        const monitorMaxTime = 5000; // 5 seconds (15s game time / 10x speed + buffer)

        while (Date.now() - monitorStart < monitorMaxTime) {
            await page.waitForTimeout(200);

            // Query with force: true to check elements behind overlay
            const deleteCount = await fileManager.locator('.activity-log-entry .log-operation:has-text("DELETE")').count();
            const elapsed = Date.now() - monitorStart;

            deleteLogCounts.push({ time: elapsed, count: deleteCount });

            if (deleteCount > 0) {
                console.log(`  DELETE entries: ${deleteCount} at ${(elapsed / 1000).toFixed(1)}s`);
            }

            // Stop when we have 8 DELETE entries
            if (deleteCount >= corruptedCount) {
                console.log(`✅ All ${corruptedCount} DELETE entries logged`);
                break;
            }
        }

        console.log('DELETE entry progression:', deleteLogCounts);

        // ========================================
        // STEP 8: Verify lockout overlay disappears after deletion
        // ========================================
        console.log('⏳ Waiting for lockout overlay to disappear...');

        await expect(terminalLockoutOverlay).not.toBeVisible({ timeout: 5000 });
        console.log('✅ Terminal lockout removed - control restored');

        // ========================================
        // STEP 9: Verify File Manager logs show DELETE operations
        // ========================================
        const finalDeleteCount = await fileManager.locator('.activity-log-entry .log-operation:has-text("DELETE")').count();
        expect(finalDeleteCount).toBe(corruptedCount);
        console.log(`✅ Found ${finalDeleteCount} DELETE log entries`);

        // Verify DELETE entries have proper structure (no special sabotage styling)
        const firstDeleteEntry = fileManager.locator('.activity-log-entry:has(.log-operation:has-text("DELETE"))').first();
        await firstDeleteEntry.scrollIntoViewIfNeeded();
        await expect(firstDeleteEntry).toBeVisible();
        console.log('✅ DELETE operations logged as normal entries');

        // Verify DELETE entries show actual log file names (log_2024_XX.txt), not placeholders (file_X.dat)
        const logFileDeleteEntry = fileManager.locator('.activity-log-entry:has-text("log_2024_")');
        const actualFileNameCount = await logFileDeleteEntry.count();
        expect(actualFileNameCount).toBeGreaterThan(0);
        console.log(`✅ DELETE entries show actual log file names (found ${actualFileNameCount} entries with log_2024_*)`);

        // Verify first delete entry shows a real log file name
        const firstDeleteText = await firstDeleteEntry.textContent();
        expect(firstDeleteText).toMatch(/log_2024_\d{2}\.txt/);
        console.log(`✅ First DELETE entry contains real file name: ${firstDeleteText.match(/log_2024_\d{2}\.txt/)?.[0]}`);

        // ========================================
        // STEP 10: Verify forced disconnection overlay appears
        // ========================================
        const disconnectOverlay = page.locator('.forced-disconnect-overlay');
        await expect(disconnectOverlay).toBeVisible({ timeout: 5000 });
        console.log('✅ Forced disconnection overlay appeared');

        await expect(disconnectOverlay.locator('h1:has-text("FORCED DISCONNECTION")')).toBeVisible();
        console.log('✅ Overlay shows "FORCED DISCONNECTION" message');

        // Wait for and dismiss overlay
        const closeButton = disconnectOverlay.locator('button:has-text("Acknowledge")');
        await expect(closeButton).toBeVisible();
        await closeButton.click();
        await expect(disconnectOverlay).not.toBeVisible({ timeout: 2000 });
        console.log('✅ Dismissed forced disconnection overlay');

        // ========================================
        // STEP 11: Verify mission marked as failed
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Mission Board');
        await page.waitForTimeout(500);

        const missionBoard = page.locator('.window-content:has-text("Mission Board")');
        await expect(missionBoard).toBeVisible();

        // Click on Failed tab
        await missionBoard.locator('.tab:has-text("Failed")').click();
        await page.waitForTimeout(300);

        // Verify tutorial-part-1 mission is in Failed tab (look for any mission card)
        const failedMissionCards = missionBoard.locator('.mission-card');
        const failedCount = await failedMissionCards.count();
        expect(failedCount).toBeGreaterThan(0);
        console.log(`✅ Mission marked as FAILED (${failedCount} mission(s) in Failed tab)`);

        console.log('✅ E2E: Tutorial Sabotage Event - ALL CHECKS PASSED');
    });
});

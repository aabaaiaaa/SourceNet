/**
 * SCENARIO GENERATOR: post-data-detective-completion
 *
 * This test generates a scenario fixture for the state after completing
 * the data-detective story mission:
 * - All post-data-detective-recovery state (archives-special files recovered)
 * - Periodicals optional objectives completed (scan + recover)
 * - Investigation objective completed (viewed archives-special device logs)
 * - Mission fully completed, payment deposited
 * - "Investigation Missions Unlocked" message in inbox (unread)
 * - All other messages archived
 * - data-detective in completedMissions, no active mission
 *
 * Use Case: Testing investigation mission generation, post-story-mission
 * state, and anything that requires the data-detective to be complete.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
    openApp,
    closeWindow,
    connectToNetwork,
    openMail,
    waitForMessage,
    readMessage,
    depositCheque,
    getObjectiveStatus,
} from '../helpers/common-actions.js';

test.setTimeout(300000);

test.describe('Scenario Generator', () => {
    test('Generate post-data-detective-completion fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-data-detective-recovery scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-recovery');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
        console.log('Step 1: Desktop visible, game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // Verify active mission is data-detective with pending objectives
        const initialState = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            if (!mission) return null;
            return {
                missionId: mission.missionId,
                objectives: mission.objectives.map(o => ({ id: o.id, status: o.status })),
            };
        });

        expect(initialState?.missionId).toBe('data-detective');

        const pendingIds = initialState.objectives
            .filter(o => o.status === 'pending')
            .map(o => o.id);
        expect(pendingIds).toContain('obj-investigate');
        expect(pendingIds).toContain('obj-periodicals-scan');
        expect(pendingIds).toContain('obj-periodicals-recover');
        console.log('Step 1: Verified data-detective active with pending objectives:', pendingIds.join(', '));

        // ========================================
        // STEP 2: Ensure connected to Westbrook Library
        // ========================================
        const isConnected = await page.evaluate(() =>
            window.gameContext.activeConnections?.some(c => c.networkId === 'westbrook-library') || false
        );
        if (!isConnected) {
            console.log('Step 2: Not connected, connecting to Westbrook Library...');
            await connectToNetwork(page, 'Westbrook Library');
        }
        console.log('Step 2: Connected to Westbrook Library');

        // ========================================
        // STEP 3: Complete optional objectives - Periodicals scan & recover
        // Do optional objectives FIRST so that when the last required objective
        // completes, ALL objectives are done and auto-verification fires.
        // ========================================
        console.log('Step 3: Completing periodicals objectives...');
        await setSpeed(100);

        await openApp(page, 'Data Recovery Tool');
        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await page.waitForTimeout(300);

        // Select periodicals file system
        await drtWindow.locator('select').selectOption('fs-lib-periodicals');
        await page.waitForTimeout(300);

        // Scan for deleted files
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 30000 });

        // Verify 2 deleted files found
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(2, { timeout: 5000 });
        console.log('Step 3: Periodicals scan complete, 2 deleted files found');

        // Verify obj-periodicals-scan complete
        expect(await getObjectiveStatus(page, 'obj-periodicals-scan')).toBe('complete');

        // Select all deleted files and restore
        const deletedItems = drtWindow.locator('.data-recovery-file-item.deleted');
        const deletedCount = await deletedItems.count();
        for (let i = 0; i < deletedCount; i++) {
            await deletedItems.nth(i).click();
        }

        await drtWindow.locator('button.restore').click();
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 30000 });

        // Verify no deleted files remain
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(0);

        // Verify obj-periodicals-recover complete
        expect(await getObjectiveStatus(page, 'obj-periodicals-recover')).toBe('complete');
        console.log('Step 3: Periodicals files restored (obj-periodicals-scan + obj-periodicals-recover complete)');

        await closeWindow(page, 'Data Recovery Tool');

        // ========================================
        // STEP 4: Complete investigation objective - View device logs
        // ========================================
        console.log('Step 4: Completing investigation objective...');
        await openApp(page, 'Log Viewer');
        const logViewer = page.locator('.window:has-text("Log Viewer")');

        // Click Device Logs tab
        await logViewer.locator('.log-viewer-tab:has-text("Device Logs")').click();

        // Select archives-special device (IP: 172.20.0.21)
        await logViewer.locator('.log-controls select').selectOption('172.20.0.21');

        // Click View Logs
        await logViewer.locator('.log-viewer-btn').click();

        // Wait for results (loading state may be too brief at 100x speed to observe)
        await expect(logViewer.locator('.log-table')).toBeVisible({ timeout: 30000 });

        // Wait for obj-investigate to complete (objective tracker processes after 50ms delay)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                if (!mission) return true; // Mission already completed
                const obj = mission.objectives?.find(o => o.id === 'obj-investigate');
                return obj?.status === 'complete';
            },
            { timeout: 10000 }
        );
        console.log('Step 4: Investigation complete (obj-investigate complete)');

        // Close Log Viewer if still open (may have been closed by forced disconnection)
        const logViewerStillOpen = await logViewer.isVisible().catch(() => false);
        if (logViewerStillOpen) {
            await closeWindow(page, 'Log Viewer');
        }

        // ========================================
        // STEP 5: Wait for mission auto-completion
        // All objectives done → verification schedules after VERIFICATION_DELAY_MS (3s game time)
        // At 100x speed this is ~30ms real time.
        // The mission may complete very quickly, clearing activeMission before we can
        // observe obj-verify. So we check for either condition.
        // ========================================
        console.log('Step 5: Waiting for mission auto-completion...');

        // Wait for mission to complete (obj-verify fires, then mission clears)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                if (!mission) return true; // Mission already completed and cleared
                const verify = mission.objectives?.find(o => o.id === 'obj-verify');
                return verify?.status === 'complete';
            },
            { timeout: 15000 }
        );
        console.log('Step 5: Mission verification complete or mission already cleared');

        // Handle forced disconnection overlay if it appears
        // (westbrook-library has revokeOnComplete: true)
        const overlay = page.locator('.forced-disconnect-overlay');
        const overlayVisible = await overlay.isVisible().catch(() => false);
        if (overlayVisible) {
            await page.click('.acknowledge-btn');
            await expect(overlay).not.toBeVisible({ timeout: 5000 });
            console.log('Step 5: Forced disconnection dismissed');
        } else {
            // Overlay may not have appeared yet - wait briefly for it
            try {
                await expect(overlay).toBeVisible({ timeout: 5000 });
                await page.click('.acknowledge-btn');
                await expect(overlay).not.toBeVisible({ timeout: 5000 });
                console.log('Step 5: Forced disconnection dismissed');
            } catch {
                // Overlay may have already been auto-dismissed or never appeared
                console.log('Step 5: No forced disconnection overlay to dismiss');
            }
        }

        // Wait for mission to fully complete (completedMissions is an array of objects)
        await page.waitForFunction(
            () => window.gameContext.completedMissions?.some(m => m.missionId === 'data-detective'),
            { timeout: 15000 }
        );

        // Verify activeMission is cleared
        const activeMission = await page.evaluate(() => window.gameContext.activeMission);
        expect(activeMission).toBeNull();
        console.log('Step 5: Mission completed, data-detective in completedMissions');

        // ========================================
        // STEP 6: Read payment message and deposit cheque
        // ========================================
        console.log('Step 6: Depositing payment cheque...');

        // Wait for messages to arrive (payment at 3s + investigation-intro at 5s game time)
        await page.waitForTimeout(500);
        await setSpeed(1);

        await openMail(page);

        // Navigate to inbox if needed
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        // Wait for payment message
        await waitForMessage(page, 'Payment for The Missing Archives', 15000);
        await readMessage(page, 'Payment for The Missing Archives');

        // Deposit cheque
        await depositCheque(page);
        console.log('Step 6: Payment cheque deposited');

        // Close banking window if opened
        const bankingWindow = page.locator('.window:has-text("Banking")');
        if (await bankingWindow.isVisible().catch(() => false)) {
            await closeWindow(page, 'Banking');
        }

        // ========================================
        // STEP 7: Archive all messages except "Investigation Missions Unlocked"
        // ========================================
        console.log('Step 7: Archiving messages...');

        // Navigate back to inbox
        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        // Wait for the investigation-unlocked message to arrive
        await waitForMessage(page, 'Investigation Missions Unlocked', 15000);
        console.log('Step 7: "Investigation Missions Unlocked" message received');

        // Archive all messages that are NOT "Investigation Missions Unlocked"
        let archiveLoopMax = 20;
        while (archiveLoopMax-- > 0) {
            const otherMessages = mailWindow.locator(
                '.message-item:not(:has-text("Investigation Missions Unlocked"))'
            );
            const otherCount = await otherMessages.count();
            if (otherCount === 0) break;

            // Click to read it
            await otherMessages.first().click();
            await expect(mailWindow.locator('.message-view')).toBeVisible({ timeout: 3000 });

            // Archive it
            await mailWindow.locator('.archive-button').click();
            await page.waitForTimeout(300);
        }

        // Verify: exactly 1 message remains, it's the investigation-unlocked one, and it's unread
        const remainingMessages = mailWindow.locator('.message-item');
        await expect(remainingMessages).toHaveCount(1);
        await expect(remainingMessages.first()).toContainText('Investigation Missions Unlocked');
        await expect(remainingMessages.first()).toHaveClass(/unread/);
        console.log('Step 7: All other messages archived, 1 unread message remains');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 8: Save fixture
        // ========================================
        console.log('Step 8: Saving game state...');

        // Close all windows first
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Sleep to save
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=\u23FB');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });
        console.log('Step 8: Game saved');

        // Extract and write fixture
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        // Verify key state in save data (completedMissions is an array of objects)
        expect(saveData.activeMission).toBeNull();
        const savedCompleted = saveData.completedMissions?.some(m => m.missionId === 'data-detective');
        expect(savedCompleted).toBe(true);

        // Verify messages - should have 1 unread message about investigation missions
        const unreadMessages = saveData.messages?.filter(m => !m.read && !m.archived) || [];
        expect(unreadMessages.length).toBeGreaterThanOrEqual(1);
        const unlockMessage = unreadMessages.find(m =>
            m.subject?.includes('Investigation Missions Unlocked')
        );
        expect(unlockMessage).toBeTruthy();

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-data-detective-completion.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`Fixture written to: ${fixturePath}`);

        // Summary
        const completedIds = saveData.completedMissions?.map(m => m.missionId) || [];
        console.log('\n=== Fixture State Summary ===');
        console.log(`Active Mission: ${saveData.activeMission}`);
        console.log(`Completed Missions: ${completedIds.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Messages count: ${saveData.messages?.length || 0}`);
        console.log(`Unread messages: ${unreadMessages.length}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-data-detective-completion');
    });
});

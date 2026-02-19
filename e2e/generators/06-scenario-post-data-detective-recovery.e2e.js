import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
    openApp,
    closeWindow,
    connectToNetwork,
    scanNetwork,
} from '../helpers/common-actions.js';

/**
 * SCENARIO GENERATOR: post-data-detective-recovery
 *
 * This test generates a scenario fixture for the state after completing the
 * data recovery portion of the data-detective story mission:
 * - All post-hardware-unlock state (tutorial complete, tools installed, etc.)
 * - "Investigative Work Available" message read (triggers data-detective)
 * - data-detective mission accepted and in progress
 * - Westbrook Library added to NAR, connected, scanned
 * - Data Recovery Tool connected to archives-special
 * - Deleted files scanned and all 4 Special Collection files recovered
 * - obj-investigate still pending (investigation not yet done)
 *
 * Use Case: Testing investigation objective completion, log viewer usage,
 * and mid-mission state scenarios.
 */

test.setTimeout(300000);

test.describe('Scenario Generator', () => {
    test('Generate post-data-detective-recovery fixture', async ({ page }) => {
        // Load post-hardware-unlock scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-hardware-unlock');

        // Wait for desktop to be visible
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        console.log('Step 1: Desktop visible');

        // Wait for gameContext to be available
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
        console.log('Step 1: Game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 2: Verify no story mission on Mission Board yet
        // ========================================
        console.log('Step 2: Verifying no story mission available yet...');
        await openApp(page, 'Mission Board');
        await page.locator('.mission-board .tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        const missingArchivesCard = page.locator('.mission-card:has-text("Missing Archives")');
        await expect(missingArchivesCard).not.toBeVisible();
        console.log('Step 2: Confirmed "Missing Archives" not yet available');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 3: Read "Investigative Work Available" message
        // ========================================
        console.log('Step 3: Reading "Investigative Work Available" message...');
        await openApp(page, 'SNet Mail');

        // Go to inbox if needed
        const backBtn = page.locator('button:has-text("Back")');
        if (await backBtn.isVisible()) await backBtn.click();
        await page.waitForTimeout(200);

        // Click on "Investigative Work" message
        const investigativeMessage = page.locator('.message-item:has-text("Investigative Work")');
        await expect(investigativeMessage).toBeVisible({ timeout: 5000 });
        await investigativeMessage.click();
        await page.waitForTimeout(500);
        console.log('Step 3: "Investigative Work Available" message read');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 4: Wait for data-detective mission to appear
        // ========================================
        console.log('Step 4: Waiting for data-detective mission to appear...');
        await setSpeed(100);
        await page.waitForTimeout(200); // 20s game time - covers the 3s trigger delay

        let hasDataDetective = false;
        for (let attempt = 0; attempt < 20; attempt++) {
            hasDataDetective = await page.evaluate(() =>
                window.gameContext.availableMissions?.some(m => m.missionId === 'data-detective') || false
            );
            if (hasDataDetective) {
                console.log(`Step 4: data-detective mission appeared after ${attempt + 1} attempts`);
                break;
            }
            await page.waitForTimeout(200);
        }
        await setSpeed(1);

        if (!hasDataDetective) {
            const available = await page.evaluate(() =>
                window.gameContext.availableMissions?.map(m => m.missionId)
            );
            console.log('Available missions:', available);
            throw new Error('data-detective mission did not appear - fixture would be invalid');
        }

        // ========================================
        // STEP 5: Accept mission on Mission Board
        // ========================================
        console.log('Step 5: Accepting data-detective mission...');
        await openApp(page, 'Mission Board');
        await page.locator('.mission-board .tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        const missionCard = page.locator('.mission-card:has-text("Missing Archives")');
        await expect(missionCard).toBeVisible({ timeout: 10000 });
        await missionCard.locator('button:has-text("Accept Mission")').click();
        await page.waitForTimeout(500);
        console.log('Step 5: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 6: Read briefing message and add NAR credentials
        // ========================================
        console.log('Step 6: Reading briefing message and adding NAR credentials...');

        // Speed up for message delivery
        await setSpeed(100);
        await page.waitForTimeout(500); // 50s game time for message delivery
        await setSpeed(1);

        await openApp(page, 'SNet Mail');

        // Go to inbox if needed
        const backBtn2 = page.locator('button:has-text("Back")');
        if (await backBtn2.isVisible()) await backBtn2.click();
        await page.waitForTimeout(200);

        // Click on briefing message
        const briefingMessage = page.locator('.message-item:has-text("Investigation Request")');
        await expect(briefingMessage).toBeVisible({ timeout: 10000 });
        await briefingMessage.click();
        await page.waitForTimeout(500);
        console.log('Step 6: Briefing message read');

        // Click network attachment to add to NAR
        const networkAttachment = page.locator('[data-testid^="network-attachment-"]');
        await expect(networkAttachment).toBeVisible({ timeout: 5000 });
        await networkAttachment.click();

        // Wait for "Network credentials used" confirmation
        await expect(page.locator('text=Network credentials used')).toBeVisible({ timeout: 5000 });
        console.log('Step 6: NAR credentials added (obj-nar complete)');

        await closeWindow(page, 'SNet Mail');

        // Verify obj-nar complete
        const narStatus = await page.evaluate(() => {
            const obj = window.gameContext.activeMission?.objectives?.find(o => o.id === 'obj-nar');
            return obj?.status;
        });
        console.log(`Step 6: obj-nar status: ${narStatus}`);

        // ========================================
        // STEP 7: Connect to Westbrook Library via VPN
        // ========================================
        console.log('Step 7: Connecting to Westbrook Library...');
        await connectToNetwork(page, 'Westbrook Library');
        console.log('Step 7: Connected to Westbrook Library (obj-connect complete)');

        // ========================================
        // STEP 8: Scan network for archives-special
        // ========================================
        console.log('Step 8: Scanning network for archives-special...');
        await scanNetwork(page, 'Westbrook Library', 'archives-special');
        console.log('Step 8: Network scanned, archives-special found (obj-scan complete)');

        // ========================================
        // STEP 9: Open Data Recovery Tool, connect to archives-special
        // ========================================
        console.log('Step 9: Connecting Data Recovery Tool to archives-special...');
        await setSpeed(100);

        await openApp(page, 'Data Recovery Tool');
        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await page.waitForTimeout(300);

        // Select fs-lib-archives-special from dropdown
        await drtWindow.locator('select').selectOption('fs-lib-archives-special');
        await page.waitForTimeout(500);
        console.log('Step 9: Data Recovery Tool connected to archives-special (obj-drt-connect complete)');

        // ========================================
        // STEP 10: Scan for deleted files
        // ========================================
        console.log('Step 10: Scanning for deleted files...');
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();

        // Wait for scan to complete
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 30000 });

        // Verify 4 deleted files found
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(4, { timeout: 5000 });
        console.log('Step 10: Scan complete, 4 deleted files found (obj-drt-scan complete)');

        // ========================================
        // STEP 11: Select and restore all 4 deleted files
        // ========================================
        console.log('Step 11: Restoring all deleted files...');

        // Click each deleted file to select
        const deletedItems = drtWindow.locator('.data-recovery-file-item.deleted');
        const deletedCount = await deletedItems.count();
        for (let i = 0; i < deletedCount; i++) {
            await deletedItems.nth(i).click();
        }

        // Verify restore button shows correct count
        await expect(drtWindow.locator('button.restore')).toContainText('Restore (4)');

        // Click Restore
        await drtWindow.locator('button.restore').click();

        // Wait for all restore operations to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 30000 });

        // Verify no more deleted files
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(0);
        console.log('Step 11: All 4 files restored (obj-recover-files complete)');

        await setSpeed(1);
        await closeWindow(page, 'Data Recovery Tool');

        // ========================================
        // STEP 12: Verify objective state
        // ========================================
        console.log('Step 12: Verifying objective state...');
        const objectiveState = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            if (!mission) return null;
            return {
                missionId: mission.missionId,
                objectives: mission.objectives.map(o => ({
                    id: o.id,
                    status: o.status,
                    type: o.type,
                })),
            };
        });

        if (!objectiveState) {
            throw new Error('No active mission found - fixture would be invalid');
        }

        console.log(`  Mission: ${objectiveState.missionId}`);
        for (const obj of objectiveState.objectives) {
            console.log(`  ${obj.id}: ${obj.status} (${obj.type})`);
        }

        // Verify completed objectives
        const completedIds = ['obj-nar', 'obj-connect', 'obj-scan', 'obj-drt-connect', 'obj-drt-scan', 'obj-recover-files'];
        for (const id of completedIds) {
            const obj = objectiveState.objectives.find(o => o.id === id);
            expect(obj?.status, `Expected ${id} to be complete`).toBe('complete');
        }

        // Verify obj-investigate is still pending
        const investigateObj = objectiveState.objectives.find(o => o.id === 'obj-investigate');
        expect(investigateObj?.status, 'Expected obj-investigate to be pending').toBe('pending');

        console.log('Step 12: Objective state verified');

        // ========================================
        // STEP 13: Save fixture
        // ========================================
        console.log('Step 13: Saving game state...');

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
        console.log('Step 13: Game saved');

        // Extract and write fixture
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        // Verify key state in save data
        const savedMission = saveData.activeMission;
        expect(savedMission?.missionId).toBe('data-detective');

        const savedRecoverObj = savedMission?.objectives?.find(o => o.id === 'obj-recover-files');
        expect(savedRecoverObj?.status).toBe('complete');

        const savedInvestigateObj = savedMission?.objectives?.find(o => o.id === 'obj-investigate');
        expect(savedInvestigateObj?.status).toBe('pending');

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-data-detective-recovery.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`Fixture written to: ${fixturePath}`);

        // Summary
        console.log('\n=== Fixture State Summary ===');
        console.log(`Active Mission: ${savedMission?.missionId}`);
        console.log(`Objectives:`);
        for (const obj of savedMission?.objectives || []) {
            console.log(`  ${obj.id}: ${obj.status}`);
        }
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Messages count: ${saveData.messages?.length || 0}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-data-detective-recovery');
    });
});

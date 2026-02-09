/**
 * Mission Failure and Retry E2E Tests
 *
 * Tests that securely deleting a critical mission file causes mission failure,
 * the failure message is delivered, the mission reappears for retry after
 * the retry delay, and the player can accept and receive the briefing again.
 *
 * Uses the post-hardware-unlock scenario as starting point.
 */

import { test, expect } from '@playwright/test';
import {
    openApp,
    closeWindow,
    setSpecificTimeSpeed,
    connectToNetwork,
    scanNetwork,
    waitForMessage,
    readMessage,
} from '../helpers/common-actions.js';

test.setTimeout(180000);

/**
 * Read the "Investigative Work Available" message to trigger the data-detective
 * story mission, then wait for it to appear in available missions.
 */
async function triggerDataDetectiveMission(page) {
    await openApp(page, 'SNet Mail');

    // Go to inbox if needed
    const backBtn = page.locator('button:has-text("Back")');
    if (await backBtn.isVisible()) await backBtn.click();
    await page.waitForTimeout(200);

    // Read the investigative work message
    const investigativeMessage = page.locator('.message-item:has-text("Investigative Work")');
    await expect(investigativeMessage).toBeVisible({ timeout: 5000 });
    await investigativeMessage.click();
    await page.waitForTimeout(500);

    await closeWindow(page, 'SNet Mail');

    // Speed up and wait for mission to appear (3s game time trigger delay)
    await setSpecificTimeSpeed(page, 100);
    await page.waitForTimeout(200);

    let hasDataDetective = false;
    for (let attempt = 0; attempt < 20; attempt++) {
        hasDataDetective = await page.evaluate(() =>
            window.gameContext.availableMissions?.some(m => m.missionId === 'data-detective') || false
        );
        if (hasDataDetective) break;
        await page.waitForTimeout(200);
    }
    await setSpecificTimeSpeed(page, 1);

    expect(hasDataDetective).toBe(true);
}

/**
 * Accept the data-detective mission from the Mission Board.
 */
async function acceptDataDetectiveMission(page) {
    await openApp(page, 'Mission Board');
    await page.locator('.mission-board .tab:has-text("Available")').click();
    await page.waitForTimeout(500);

    const missionCard = page.locator('.mission-card:has-text("Missing Archives")');
    await expect(missionCard).toBeVisible({ timeout: 10000 });
    await missionCard.locator('button:has-text("Accept Mission")').click();
    await page.waitForTimeout(500);

    await closeWindow(page, 'Mission Board');
}

/**
 * Read the briefing message and activate NAR credentials.
 */
async function readBriefingAndActivateNar(page) {
    // Speed up for message delivery
    await setSpecificTimeSpeed(page, 100);
    await page.waitForTimeout(500);
    await setSpecificTimeSpeed(page, 1);

    await openApp(page, 'SNet Mail');

    // Go to inbox if needed
    const backBtn = page.locator('button:has-text("Back")');
    if (await backBtn.isVisible()) await backBtn.click();
    await page.waitForTimeout(200);

    // Click on briefing message
    const briefingMessage = page.locator('.message-item:has-text("Investigation Request")');
    await expect(briefingMessage).toBeVisible({ timeout: 10000 });
    await briefingMessage.click();
    await page.waitForTimeout(500);

    // Click network attachment to add to NAR
    const networkAttachment = page.locator('[data-testid^="network-attachment-"]');
    await expect(networkAttachment).toBeVisible({ timeout: 5000 });
    await networkAttachment.click();

    // Wait for "Network credentials used" confirmation
    await expect(page.locator('text=Network credentials used')).toBeVisible({ timeout: 5000 });

    await closeWindow(page, 'SNet Mail');
}

/**
 * Use Data Recovery Tool to secure delete a critical file, causing mission failure.
 */
async function secureDeleteCriticalFile(page) {
    await openApp(page, 'Data Recovery Tool');
    const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
    await page.waitForTimeout(300);

    // Select fs-lib-archives-special from dropdown
    await drtWindow.locator('select').selectOption('fs-lib-archives-special');
    await page.waitForTimeout(500);

    // Scan for deleted files
    await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();

    // Wait for scan to complete (button reappears)
    await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 30000 });

    // Verify 4 deleted files found
    await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(4, { timeout: 5000 });

    // Select one critical file (founders-correspondence-1885.pdf)
    const targetFile = drtWindow.locator('.data-recovery-file-item:has-text("founders-correspondence-1885.pdf")');
    await expect(targetFile).toBeVisible();
    await targetFile.click();

    // Click secure delete (no confirmation dialog)
    await drtWindow.locator('button.secure-delete').click();

    // Wait for the secure delete operation to complete
    await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 30000 });

    await closeWindow(page, 'Data Recovery Tool');
}

test.describe('Mission Failure and Retry', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
    });

    test('securely deleting a critical file fails the mission and allows retry', async ({ page }) => {
        // STEP 1: Trigger and accept mission
        await triggerDataDetectiveMission(page);
        await acceptDataDetectiveMission(page);
        await readBriefingAndActivateNar(page);

        // STEP 2: Connect to Westbrook Library and scan
        await connectToNetwork(page, 'Westbrook Library');
        await scanNetwork(page, 'Westbrook Library', 'archives-special');

        // STEP 3: Secure delete a critical file at 100x speed
        await setSpecificTimeSpeed(page, 100);
        await secureDeleteCriticalFile(page);

        // STEP 4: Verify mission fails
        await page.waitForFunction(
            () => window.gameContext.activeMission === null,
            { timeout: 15000 }
        );

        // Verify data-detective is in completedMissions with failed status
        const completedMission = await page.evaluate(() =>
            window.gameContext.completedMissions.find(m => m.missionId === 'data-detective')
        );
        expect(completedMission).toBeTruthy();
        expect(completedMission.status).toBe('failed');

        // Handle forced disconnection overlay if it appears
        const overlay = page.locator('.forced-disconnect-overlay');
        try {
            await expect(overlay).toBeVisible({ timeout: 5000 });
            await page.click('.acknowledge-btn');
            await expect(overlay).not.toBeVisible({ timeout: 5000 });
        } catch {
            // Overlay may not appear at 100x speed
        }

        // STEP 5: Verify failure message arrives
        await setSpecificTimeSpeed(page, 1);
        await openApp(page, 'SNet Mail');

        // Go to inbox if needed
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Mission Failed', 15000);
        await closeWindow(page, 'SNet Mail');

        // STEP 6: Wait for retry delay (60000ms game time = 600ms at 100x)
        await setSpecificTimeSpeed(page, 100);

        // Wait for mission to reappear in available missions
        await page.waitForFunction(
            () => window.gameContext.availableMissions?.some(m => m.missionId === 'data-detective') || false,
            { timeout: 30000 }
        );

        // STEP 7: Verify mission is visible on Mission Board
        await setSpecificTimeSpeed(page, 1);
        await openApp(page, 'Mission Board');
        await page.locator('.mission-board .tab:has-text("Available")').click();

        const missionCard = page.locator('.mission-card:has-text("Missing Archives")');
        await expect(missionCard).toBeVisible({ timeout: 10000 });

        // STEP 8: Accept mission again
        await missionCard.locator('button:has-text("Accept Mission")').click();
        await page.waitForTimeout(500);

        // Verify mission is now active
        const activeMission = await page.evaluate(() => window.gameContext.activeMission?.missionId);
        expect(activeMission).toBe('data-detective');

        await closeWindow(page, 'Mission Board');

        // STEP 9: Verify briefing message is sent again (second copy)
        await setSpecificTimeSpeed(page, 100);
        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 1);

        await openApp(page, 'SNet Mail');

        // Go to inbox if needed
        const mailWindow2 = page.locator('.window:has-text("SNet Mail")');
        const backBtn2 = mailWindow2.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        // There should be two briefing messages (from first accept and retry accept)
        const briefingMessages = page.locator('.message-item:has-text("Investigation Request")');
        await expect(briefingMessages).toHaveCount(2, { timeout: 15000 });

        await closeWindow(page, 'SNet Mail');
    });
});

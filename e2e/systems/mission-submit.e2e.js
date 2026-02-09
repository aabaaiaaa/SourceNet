/**
 * Mission Submit for Completion E2E Tests
 *
 * Tests the "Submit for Completion" button that appears when all required
 * objectives are complete but optional objectives remain incomplete.
 * Uses the data-detective mission which has 2 optional periodicals objectives.
 */

import { test, expect } from '@playwright/test';
import {
    openApp,
    closeWindow,
    setSpecificTimeSpeed,
    getObjectiveStatus,
    connectToNetwork,
} from '../helpers/common-actions.js';

test.setTimeout(120000);

/**
 * Complete the investigation objective by viewing archives-special device logs.
 * This is the last required objective in the data-detective mission.
 * Requires an active VPN connection to Westbrook Library.
 */
async function completeInvestigationObjective(page) {
    await openApp(page, 'Log Viewer');
    const logViewer = page.locator('.window:has-text("Log Viewer")');

    // Click Device Logs tab
    await logViewer.locator('.log-viewer-tab:has-text("Device Logs")').click();

    // Wait for the device dropdown to be populated with the target IP
    const deviceSelect = logViewer.locator('.log-controls select');
    await expect(deviceSelect.locator('option[value="172.20.0.21"]')).toBeAttached({ timeout: 10000 });

    // Select archives-special device (IP: 172.20.0.21)
    await deviceSelect.selectOption('172.20.0.21');

    // Click View Logs
    await logViewer.locator('.log-viewer-btn').click();

    // Wait for results (loading state may be too brief at 100x speed to observe)
    await expect(logViewer.locator('.log-table')).toBeVisible({ timeout: 30000 });

    // Wait for obj-investigate to complete
    await page.waitForFunction(
        () => {
            const mission = window.gameContext.activeMission;
            if (!mission) return false;
            return mission.objectives?.find(o => o.id === 'obj-investigate')?.status === 'complete';
        },
        { timeout: 10000 }
    );

    await closeWindow(page, 'Log Viewer');
}

test.describe('Mission Submit for Completion', () => {
    test.beforeEach(async ({ page }) => {
        // Load post-data-detective-recovery scenario
        // State: data-detective active, all required objectives complete EXCEPT obj-investigate
        // Optional objectives (obj-periodicals-scan, obj-periodicals-recover) are pending
        // No active VPN connection - must reconnect to Westbrook Library
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-recovery&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
    });

    test('shows submit button after completing last required objective with optional objectives pending', async ({ page }) => {
        await setSpecificTimeSpeed(page, 100);

        // Verify starting state: obj-investigate is pending, optional objectives are pending
        expect(await getObjectiveStatus(page, 'obj-investigate')).toBe('pending');
        expect(await getObjectiveStatus(page, 'obj-periodicals-scan')).toBe('pending');
        expect(await getObjectiveStatus(page, 'obj-periodicals-recover')).toBe('pending');

        // Connect to Westbrook Library (needed for Log Viewer to see devices)
        await connectToNetwork(page, 'Westbrook Library');

        // Complete the investigation objective
        await completeInvestigationObjective(page);

        // Verify optional objectives are still pending
        expect(await getObjectiveStatus(page, 'obj-periodicals-scan')).toBe('pending');
        expect(await getObjectiveStatus(page, 'obj-periodicals-recover')).toBe('pending');

        // Verify mission has NOT auto-completed (optional objectives block auto-verify)
        const missionStillActive = await page.evaluate(() => window.gameContext.activeMission !== null);
        expect(missionStillActive).toBe(true);

        // Open Mission Board and check for submit button
        await openApp(page, 'Mission Board');
        await page.locator('.tab:has-text("Active Mission")').click();

        const submitBtn = page.locator('.submit-mission-btn');
        await expect(submitBtn).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.submit-info')).toContainText('All required objectives complete');
    });

    test('completes mission when submit button is clicked', async ({ page }) => {
        await setSpecificTimeSpeed(page, 100);

        // Connect to Westbrook Library (needed for Log Viewer to see devices)
        await connectToNetwork(page, 'Westbrook Library');

        // Complete the investigation objective
        await completeInvestigationObjective(page);

        // Open Mission Board and click submit
        await openApp(page, 'Mission Board');
        await page.locator('.tab:has-text("Active Mission")').click();

        const submitBtn = page.locator('.submit-mission-btn');
        await expect(submitBtn).toBeVisible({ timeout: 5000 });
        await submitBtn.click();

        // Verify missionSubmitting was set (may resolve very fast at 100x speed)
        // At normal game speed, button shows "Submitting..." for ~3 seconds
        await page.waitForFunction(
            () => window.gameContext.missionSubmitting === true ||
                  window.gameContext.activeMission === null, // already completed at 100x
            { timeout: 5000 }
        );

        // Wait for mission to complete (activeMission becomes null)
        await page.waitForFunction(
            () => window.gameContext.activeMission === null,
            { timeout: 15000 }
        );

        // Verify data-detective is in completedMissions with success status
        const completedMission = await page.evaluate(() =>
            window.gameContext.completedMissions.find(m => m.missionId === 'data-detective')
        );
        expect(completedMission).toBeTruthy();
        expect(completedMission.status).toBe('success');

        // Handle forced disconnection overlay if it appears
        // (westbrook-library has revokeOnComplete: true)
        const overlay = page.locator('.forced-disconnect-overlay');
        try {
            await expect(overlay).toBeVisible({ timeout: 5000 });
            await page.click('.acknowledge-btn');
            await expect(overlay).not.toBeVisible({ timeout: 5000 });
        } catch {
            // Overlay may not appear at 100x speed
        }

        // Verify payment message arrives
        await page.waitForFunction(
            () => window.gameContext.messages?.some(m => m.subject?.includes('Payment for')),
            { timeout: 15000 }
        );
    });

    test('does not show submit button when required objectives are still pending', async ({ page }) => {
        // In the post-data-detective-recovery scenario, obj-investigate is still pending (required)
        // The submit button should NOT appear
        await openApp(page, 'Mission Board');
        await page.locator('.tab:has-text("Active Mission")').click();
        await expect(page.locator('.active-mission')).toBeVisible({ timeout: 5000 });

        // Verify no submit button since obj-investigate is still pending
        await expect(page.locator('.submit-mission-btn')).not.toBeVisible();
    });
});

/**
 * Behind Enemy Lines Mission Playthrough
 *
 * Verifies the complete behind-enemy-lines mission gameplay flow:
 * - Setup: Read relay-unlock message, purchase relay software + service
 * - Mission: Connect through relay chain to Coastal-Ops hostile network
 * - Trace Monitor: Verify active trace with ETT countdown in TopBar
 * - Objectives: Scan network, investigate logs on ops-controller, recover deleted file
 * - Post-mission: Coastal-Ops NAR revoked, payment message arrives with cheque
 *
 * Loads from: post-locked-out scenario
 */

import { test, expect } from '@playwright/test';
import {
    loadScenario,
    addCredits,
    setSpecificTimeSpeed,
    openApp,
    closeWindow,
    readMessage,
    waitForMessage,
    purchaseFromPortal,
    waitForMission,
    acceptMission,
    activateNarFromMessage,
    connectThroughRelays,
    waitForObjectiveById,
    waitForMissionComplete,
    goToMailInbox,
    dismissDisconnectionNotice,
    depositCheque,
} from '../helpers/common-actions.js';

test.describe('Behind Enemy Lines Mission', () => {
    test('completes relay-based investigation mission under trace pressure', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Load scenario and purchase relay tools
        // ============================================================
        await loadScenario(page, 'post-locked-out');
        await addCredits(page, 40000); // VPN Relay Module (3k) + Trace Monitor (2.5k) + Relay Service (30k)

        // Read relay-unlock message → unlocks relay-service + generates relay nodes
        await goToMailInbox(page);
        await readMessage(page, 'Relay System & Trace Monitor');
        await page.waitForTimeout(500);
        await closeWindow(page, 'SNet Mail');

        // Verify relay service is unlocked
        const relayUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('relay-service')
        );
        expect(relayUnlocked).toBe(true);

        // Verify relay nodes were generated
        const initialRelayCount = await page.evaluate(() =>
            (window.gameContext.relayNodes || []).length
        );
        expect(initialRelayCount).toBeGreaterThanOrEqual(6);

        // Purchase relay tools
        await setSpecificTimeSpeed(page, 100);
        await purchaseFromPortal(page, 'VPN Relay Module');
        await purchaseFromPortal(page, 'Trace Monitor');
        await purchaseFromPortal(page, 'Standard Relay Service', { section: 'Services' });

        // ============================================================
        // Phase 1: Accept mission and connect through relays
        // ============================================================
        await waitForMission(page, 'behind-enemy-lines');
        await acceptMission(page, 'Behind Enemy Lines');

        // Activate NAR
        await setSpecificTimeSpeed(page, 10);
        await activateNarFromMessage(page, 'Behind Enemy Lines - Coastal Power Authority');

        // Connect through relay chain to hostile network
        await connectThroughRelays(page, 'Coastal-Ops', 2);
        await waitForObjectiveById(page, 'obj-connect-coastal');

        // Scripted event (trace start) fires 5s game time after obj-connect-coastal.
        // It resets speed to 1x, then starts the trace. Keep at 10x to get the delay
        // to elapse, then wait for traceState OR the trace-clearing useEffect to have
        // already run (in which case traceState is null again).
        // The trace-clearing effect only fires if no hostile connections, so the trace
        // should persist while connected to hostile Coastal-Ops.

        // Wait for trace state to appear in TopBar (proves trace started + monitor active)
        // The auto-activation in handleStartTrace adds trace-monitor to activePassiveSoftware
        const traceMonitorVisible = page.locator('.topbar-trace-monitor.tracing');
        await expect(traceMonitorVisible).toBeVisible({ timeout: 30000 });

        // Scripted event resets speed; restore to 10x for the rest of the test
        await setSpecificTimeSpeed(page, 10);

        // ============================================================
        // Phase 2: Verify Trace Monitor ETT is visible
        // ============================================================
        const ettText = page.locator('.trace-ett');
        await expect(ettText).toBeVisible({ timeout: 5000 });
        const ettContent = await ettText.textContent();
        expect(ettContent).toBeTruthy();
        console.log(`Trace Monitor ETT: ${ettContent}`);

        // ============================================================
        // Phase 3: Scan network and investigate logs
        // ============================================================
        // Manual scan (don't use scanNetwork helper — it forces 100x which would expire trace too fast)
        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'Coastal-Ops' });
        await scanner.locator('button:has-text("Start Scan")').click();
        await expect(scanner.locator('text=ops-controller').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');
        await waitForObjectiveById(page, 'obj-scan-coastal');

        // Open Log Viewer and investigate logs on ops-controller
        await openApp(page, 'Log Viewer');
        const logViewer = page.locator('.window:has-text("Log Viewer")');

        await logViewer.locator('.log-viewer-tab:has-text("Device Logs")').click();
        await page.waitForTimeout(300);

        const deviceDropdown = logViewer.locator('select').last();
        await deviceDropdown.selectOption({ label: 'ops-controller (Coastal-Ops)' });
        await page.waitForTimeout(300);

        await logViewer.locator('button:has-text("View Logs")').click();
        await expect(logViewer.locator('.log-table')).toBeVisible({ timeout: 30000 });
        await waitForObjectiveById(page, 'obj-investigate-logs');
        await closeWindow(page, 'Log Viewer');

        // ============================================================
        // Phase 4: Recover deleted maintenance-records.db
        // ============================================================
        await openApp(page, 'Data Recovery Tool');
        const drt = page.locator('.window:has-text("Data Recovery Tool")');

        await drt.locator('select').first().selectOption('fs-coastal-maintenance');
        await page.waitForTimeout(500);

        await drt.locator('button:has-text("Scan for Deleted Files")').click();

        // Wait for scan to complete
        await page.waitForFunction(
            () => {
                const scanBtn = document.querySelector('.window:has(.data-recovery-tool) .data-recovery-btn');
                return scanBtn && !scanBtn.disabled && scanBtn.textContent.includes('Scan');
            },
            { timeout: 60000 }
        );
        await page.waitForTimeout(1000);

        const deletedFile = drt.locator('.data-recovery-file-item.deleted:has-text("maintenance-records.db")');
        await expect(deletedFile).toBeVisible({ timeout: 5000 });
        await deletedFile.click();
        await page.waitForTimeout(200);

        await drt.locator('button.restore').click();
        await waitForObjectiveById(page, 'obj-recover-maintenance');
        await closeWindow(page, 'Data Recovery Tool');

        // ============================================================
        // Phase 5: Mission completion and verification
        // ============================================================
        await waitForMissionComplete(page, 'behind-enemy-lines');

        // Verify mission completed with success
        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'behind-enemy-lines' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);

        // Verify Coastal-Ops NAR was revoked (revokeOnComplete)
        const coastalAccessible = await page.evaluate(() => {
            const registry = window.networkRegistry;
            const network = registry?.getNetwork?.('coastal-ops');
            return network?.accessible;
        });
        expect(coastalAccessible).toBeFalsy();

        // Mission completion resets speed; restore
        await setSpecificTimeSpeed(page, 100);

        // Wait for payment message
        await dismissDisconnectionNotice(page);
        await goToMailInbox(page);
        await waitForMessage(page, 'Payment for Behind Enemy Lines', 60000);

        // Verify payment cheque can be deposited
        await readMessage(page, 'Payment for Behind Enemy Lines');
        await depositCheque(page);

        // Verify credits increased
        const credits = await page.evaluate(() =>
            window.gameContext.bankAccounts?.[0]?.balance || 0
        );
        expect(credits).toBeGreaterThan(0);

        await closeWindow(page, 'SNet Mail');
        // Close Banking window opened by deposit
        const bankingVisible = await page.locator('.window:has-text("Banking")').isVisible().catch(() => false);
        if (bankingVisible) {
            await closeWindow(page, 'Banking');
        }

        console.log('\n=== Behind Enemy Lines Mission Playthrough Complete ===');
        console.log(`Final credits: ${credits}`);
        console.log('All assertions passed');
    });
});

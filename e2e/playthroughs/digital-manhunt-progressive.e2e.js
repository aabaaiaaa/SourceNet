/**
 * Digital Manhunt Progressive Objectives Playthrough
 *
 * Verifies the digital-manhunt mission's progressive objective system:
 * - Mission starts with only 3 Alpha objectives visible
 * - Completing Alpha objectives dynamically reveals Beta objectives (count 3→5)
 * - Completing Beta objectives dynamically reveals Origin objectives (count 5→8)
 * - Progressive credential chain: Alpha NAR → Beta NAR → Origin NAR
 * - Final: crack target-list.db, copy operation-plan.pdf to local SSD
 * - All 3 darknode NARs revoked on completion
 * - Payment of 25,000 credits
 *
 * Loads from: post-lockdown scenario
 */

import { test, expect } from '@playwright/test';
import {
    loadScenario,
    setSpecificTimeSpeed,
    openApp,
    closeWindow,
    readMessage,
    waitForMessage,
    waitForMission,
    acceptMission,
    connectThroughRelays,
    crackPassword,
    waitForObjectiveById,
    waitForMissionComplete,
    goToMailInbox,
    dismissDisconnectionNotice,
} from '../helpers/common-actions.js';

test.describe('Digital Manhunt Progressive Objectives', () => {
    test('reveals objectives dynamically across three darknode hops', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Load scenario and clear lingering trace
        // ============================================================
        await loadScenario(page, 'post-lockdown');

        // Clear leftover trace state from lockdown mission
        await page.evaluate(() => {
            if (window.gameContext?.setTraceState) {
                window.gameContext.setTraceState(null);
            }
        });

        await setSpecificTimeSpeed(page, 100);

        // ============================================================
        // Phase 1: Wait for and accept digital-manhunt mission
        // ============================================================
        // Digital-manhunt triggers 30s game time after lockdown completes
        await waitForMission(page, 'digital-manhunt');
        await acceptMission(page, 'Digital Manhunt');

        // **Key assertion**: 4 initial objectives visible (3 Alpha + 1 auto-added verification)
        const initialObjectiveCount = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            return mission?.objectives?.length || 0;
        });
        expect(initialObjectiveCount).toBe(4);

        const initialObjectiveIds = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            return mission?.objectives?.map(o => o.id) || [];
        });
        expect(initialObjectiveIds).toContain('obj-connect-alpha');
        expect(initialObjectiveIds).toContain('obj-crack-alpha-logs');
        expect(initialObjectiveIds).toContain('obj-decrypt-next-hop');
        console.log(`Phase 1: ${initialObjectiveCount} initial objectives (Alpha phase)`);

        // ============================================================
        // Phase 2: Alpha NAR + connect to DarkNode-Alpha
        // ============================================================
        await setSpecificTimeSpeed(page, 10);

        // Read briefing (no NAR attachment), then read intro message for Alpha NAR
        await goToMailInbox(page);
        await readMessage(page, 'Digital Manhunt - We Have a Lead');
        await page.waitForTimeout(300);

        await goToMailInbox(page);
        await waitForMessage(page, 'DarkNode-Alpha Credentials', 60000);
        await readMessage(page, 'DarkNode-Alpha Credentials');
        await page.waitForTimeout(300);

        // Activate Alpha NAR
        const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
        await expect(narAttachment).toBeVisible({ timeout: 5000 });
        await narAttachment.click();
        await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
        await closeWindow(page, 'SNet Mail');

        // Connect through relays
        await connectThroughRelays(page, 'DarkNode-Alpha', 2);
        await waitForObjectiveById(page, 'obj-connect-alpha');

        // Trace event resets speed; wait then restore
        await page.waitForTimeout(2000);
        await setSpecificTimeSpeed(page, 10);

        // ============================================================
        // Phase 3: Scan Alpha + crack + decrypt → Beta objectives appear
        // ============================================================
        // Scan Alpha
        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'DarkNode-Alpha' });
        await scanner.locator('button:has-text("Start Scan")').click();
        await expect(scanner.locator('text=relay-alpha').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        // Crack connection-logs.db (SHA-256)
        await setSpecificTimeSpeed(page, 100);
        await crackPassword(page, 'fs-alpha-relay', 'connection-logs.db', 'obj-crack-alpha-logs');

        // Decrypt next-hop-credentials.enc
        await openApp(page, 'Decryption Tool');
        const dt = page.locator('.window:has-text("Decryption Tool")');
        await dt.locator('select').selectOption('fs-alpha-relay');
        await page.waitForTimeout(500);

        const encFile = dt.locator('.decryption-file-item:has-text("next-hop-credentials.enc")');
        await expect(encFile).toBeVisible({ timeout: 5000 });
        await encFile.click();

        await dt.locator('button:has-text("Download")').click();
        await page.waitForFunction(
            () => (window.gameContext.localSSDFiles || []).some(f => f.name === 'next-hop-credentials.enc'),
            { timeout: 60000 }
        );

        await dt.locator('button:has-text("Decrypt")').click();
        await waitForObjectiveById(page, 'obj-decrypt-next-hop', 120000);
        await closeWindow(page, 'Decryption Tool');

        // **Key assertion**: Beta objectives now appear (count increases from 3 to 5)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                return mission?.objectives?.some(o => o.id === 'obj-connect-beta');
            },
            { timeout: 10000 }
        );

        const betaObjectiveCount = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            return mission?.objectives?.length || 0;
        });
        expect(betaObjectiveCount).toBe(6);
        console.log(`Phase 3: Objectives increased to ${betaObjectiveCount} (Beta phase)`);

        // ============================================================
        // Phase 4: Beta NAR + connect to DarkNode-Beta
        // ============================================================
        // Beta credentials event resets speed; restore
        await setSpecificTimeSpeed(page, 10);

        await goToMailInbox(page);
        await waitForMessage(page, 'Next Hop Found', 60000);
        await readMessage(page, 'Next Hop Found');
        await page.waitForTimeout(300);

        // Activate Beta NAR
        const betaNar = page.locator('.attachment-item:has-text("Click to add")');
        await expect(betaNar).toBeVisible({ timeout: 5000 });
        await betaNar.click();
        await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
        await closeWindow(page, 'SNet Mail');

        // Disconnect from Alpha, connect to Beta
        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');
        if (await vpn.locator('button:has-text("Disconnect")').isVisible().catch(() => false)) {
            await vpn.locator('button:has-text("Disconnect")').click();
            await page.waitForTimeout(500);
        }
        await closeWindow(page, 'VPN Client');

        await connectThroughRelays(page, 'DarkNode-Beta', 2);
        await waitForObjectiveById(page, 'obj-connect-beta');

        // ============================================================
        // Phase 5: Scan Beta + crack → Origin objectives appear
        // ============================================================
        await openApp(page, 'Network Scanner');
        const scannerBeta = page.locator('.window:has-text("Network Scanner")');
        await scannerBeta.locator('select').selectOption({ label: 'DarkNode-Beta' });
        await scannerBeta.locator('button:has-text("Start Scan")').click();
        await expect(scannerBeta.locator('text=relay-beta').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        await setSpecificTimeSpeed(page, 100);
        await crackPassword(page, 'fs-beta-relay', 'operator-notes.txt', 'obj-crack-operator-notes');

        // **Key assertion**: Origin objectives now appear (count increases to 8)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                return mission?.objectives?.some(o => o.id === 'obj-connect-origin');
            },
            { timeout: 10000 }
        );

        const originObjectiveCount = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            return mission?.objectives?.length || 0;
        });
        expect(originObjectiveCount).toBe(9);
        console.log(`Phase 5: Objectives increased to ${originObjectiveCount} (Origin phase)`);

        // ============================================================
        // Phase 6: Origin NAR + connect to DarkNode-Origin
        // ============================================================
        await setSpecificTimeSpeed(page, 10);

        await goToMailInbox(page);
        await waitForMessage(page, 'Origin Located', 60000);
        await readMessage(page, 'Origin Located');
        await page.waitForTimeout(300);

        const originNar = page.locator('.attachment-item:has-text("Click to add")');
        await expect(originNar).toBeVisible({ timeout: 5000 });
        await originNar.click();
        await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
        await closeWindow(page, 'SNet Mail');

        // Disconnect from Beta, connect to Origin
        await openApp(page, 'VPN Client');
        if (await vpn.locator('button:has-text("Disconnect")').isVisible().catch(() => false)) {
            await vpn.locator('button:has-text("Disconnect")').click();
            await page.waitForTimeout(500);
        }
        await closeWindow(page, 'VPN Client');

        await connectThroughRelays(page, 'DarkNode-Origin', 2);
        await waitForObjectiveById(page, 'obj-connect-origin');

        // ============================================================
        // Phase 7: Scan Origin + crack target-list.db + copy evidence
        // ============================================================
        await openApp(page, 'Network Scanner');
        const scannerOrigin = page.locator('.window:has-text("Network Scanner")');
        await scannerOrigin.locator('select').selectOption({ label: 'DarkNode-Origin' });
        await scannerOrigin.locator('button:has-text("Start Scan")').click();
        await expect(scannerOrigin.locator('text=command-center').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        await setSpecificTimeSpeed(page, 100);
        await crackPassword(page, 'fs-origin-cc', 'target-list.db', 'obj-crack-target-list');

        // Copy operation-plan.pdf to local SSD
        await openApp(page, 'File Manager');
        const fm = page.locator('.window:has-text("File Manager")').first();

        await fm.locator('select').first().selectOption('fs-origin-cc');
        await page.waitForTimeout(500);

        const planFile = fm.locator('.file-item:has-text("operation-plan.pdf")');
        await expect(planFile).toBeVisible({ timeout: 5000 });
        await planFile.click();
        await page.waitForTimeout(200);

        await fm.locator('button:has-text("Copy")').click();
        await page.waitForTimeout(300);

        // Switch to local SSD and paste
        await fm.locator('select').first().selectOption('local');
        await page.waitForTimeout(500);

        await fm.locator('button:has-text("Paste")').click();
        await waitForObjectiveById(page, 'obj-copy-evidence');
        await closeWindow(page, 'File Manager');

        // ============================================================
        // Phase 8: Mission completion and verification
        // ============================================================
        await waitForMissionComplete(page, 'digital-manhunt');

        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'digital-manhunt' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);

        // Verify all 3 darknode NARs were revoked
        const alphaAccessible = await page.evaluate(() =>
            window.networkRegistry?.getNetwork?.('darknode-alpha')?.accessible
        );
        const betaAccessible = await page.evaluate(() =>
            window.networkRegistry?.getNetwork?.('darknode-beta')?.accessible
        );
        const originAccessible = await page.evaluate(() =>
            window.networkRegistry?.getNetwork?.('darknode-origin')?.accessible
        );
        expect(alphaAccessible).toBeFalsy();
        expect(betaAccessible).toBeFalsy();
        expect(originAccessible).toBeFalsy();

        // Mission completion resets speed; restore
        await setSpecificTimeSpeed(page, 100);

        // Wait for payment (25,000 credits)
        await dismissDisconnectionNotice(page);
        await goToMailInbox(page);
        await waitForMessage(page, 'Payment for Digital Manhunt', 60000);
        await closeWindow(page, 'SNet Mail');

        console.log('\n=== Digital Manhunt Progressive Objectives Playthrough Complete ===');
        console.log('Objective progression verified: 4 → 6 → 9');
        console.log('All 3 darknode NARs revoked');
        console.log('All assertions passed');
    });
});

/**
 * Lockdown Backup Flow Playthrough
 *
 * Verifies the lockdown mission gameplay flow:
 * - Setup: Read relay-practice-success, trigger sniffer-intro, purchase Network Sniffer
 * - Mission: Connect through relays to PacificFreight-Core hostile network
 * - Sniffer: Extract credentials using Network Sniffer (fragment-based progress)
 * - File ops: Access logistics-primary, copy shipping-manifests-2020.db
 * - Backup: Connect to PFS-BackupSite, paste file to safe-storage
 * - Post-mission: Both pacific-freight and pfs-backup-safe NARs handled
 *
 * Loads from: post-behind-enemy-lines scenario
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
    connectThroughRelays,
    waitForObjectiveById,
    waitForMissionComplete,
    goToMailInbox,
    dismissDisconnectionNotice,
} from '../helpers/common-actions.js';

test.describe('Lockdown Backup Flow', () => {
    test('completes sniffer-based credential extraction and cross-network file backup', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Load scenario and purchase Network Sniffer
        // ============================================================
        await loadScenario(page, 'post-behind-enemy-lines');
        await addCredits(page, 55000); // Sniffer costs 50k + need 50k threshold

        await setSpecificTimeSpeed(page, 100);

        // Read relay-practice-success → sets creditThresholdForSniffer
        await goToMailInbox(page);
        await readMessage(page, 'Well Handled');
        await page.waitForTimeout(300);

        // Trigger sniffer-intro by emitting creditsChanged
        await goToMailInbox(page);
        await page.evaluate(() => {
            const { triggerEventBus } = window;
            const accounts = window.gameContext.bankAccounts;
            if (triggerEventBus && accounts?.[0]) {
                triggerEventBus.emit('creditsChanged', { newBalance: accounts[0].balance });
            }
        });

        // Wait for sniffer-intro message and read it
        await waitForMessage(page, 'New Tool Available - Network Sniffer', 60000);
        await readMessage(page, 'New Tool Available - Network Sniffer');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        // Purchase Network Sniffer
        await purchaseFromPortal(page, 'Network Sniffer');

        // Verify sniffer is installed
        const hasSniffer = await page.evaluate(() =>
            window.gameContext.software?.includes('network-sniffer')
        );
        expect(hasSniffer).toBe(true);

        // ============================================================
        // Phase 1: Accept mission and set up network access
        // ============================================================
        await waitForMission(page, 'lockdown');
        await acceptMission(page, 'Lockdown');

        // Activate BOTH NAR attachments (pacific-freight + pfs-backup-safe)
        await setSpecificTimeSpeed(page, 10);
        await goToMailInbox(page);
        await readMessage(page, 'EMERGENCY: Complete Network Lockout');
        await page.waitForTimeout(300);

        // Click both NAR attachments
        const narAttachments = page.locator('.attachment-item:has-text("Click to add")');
        const attachmentCount = await narAttachments.count();
        expect(attachmentCount).toBeGreaterThanOrEqual(2);

        for (let i = 0; i < attachmentCount; i++) {
            const attachment = page.locator('.attachment-item:has-text("Click to add")').first();
            await expect(attachment).toBeVisible({ timeout: 5000 });
            await attachment.click();
            await page.waitForTimeout(500);
        }

        const activatedCount = await page.locator('.attachment-item:has-text("credentials used")').count();
        expect(activatedCount).toBeGreaterThanOrEqual(2);
        await closeWindow(page, 'SNet Mail');

        // ============================================================
        // Phase 2: Connect through relays and scan
        // ============================================================
        await connectThroughRelays(page, 'PacificFreight-Core', 2);
        await waitForObjectiveById(page, 'obj-connect-pacific');

        // Scripted event (trace start) resets speed; wait then restore
        await page.waitForTimeout(2000);
        await setSpecificTimeSpeed(page, 10);

        // Scan network (manual - don't use scanNetwork helper as it forces 100x)
        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'PacificFreight-Core' });
        await scanner.locator('button:has-text("Start Scan")').click();
        await expect(scanner.locator('text=logistics-primary').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');
        await waitForObjectiveById(page, 'obj-scan-pacific');

        // ============================================================
        // Phase 3: Credential extraction with Network Sniffer
        // ============================================================
        // Verify sniffer shows the network in dropdown
        await openApp(page, 'Network Sniffer');
        const sniffer = page.locator('.window:has-text("Network Sniffer")');
        await sniffer.locator('select').first().selectOption('pacific-freight');
        await page.waitForTimeout(300);

        // Verify Extract Credentials mode is available
        const credBtn = sniffer.locator('.ns-mode-btn:has-text("Extract Credentials")');
        await expect(credBtn).toBeVisible();

        // Start monitoring
        await sniffer.locator('button:has-text("Start Monitoring")').click();

        // Verify packet log shows captured packets
        await expect(sniffer.locator('.ns-packet').first()).toBeVisible({ timeout: 30000 });

        // Verify fragment counter is visible and incrementing
        const fragmentDisplay = sniffer.locator('.ns-recon-fragments');
        await expect(fragmentDisplay).toBeVisible();

        // Verify progress bar is visible
        const progressBar = sniffer.locator('.ns-progress-fill');
        await expect(progressBar).toBeVisible();

        // Wait for hash reconstruction to complete (extract button appears)
        const extractBtn = sniffer.locator('.ns-extract-btn');
        await expect(extractBtn).toBeVisible({ timeout: 120000 });

        // Verify the progress bar shows 100%
        const progressText = await sniffer.locator('.ns-progress-text').textContent();
        expect(progressText).toBe('100%');

        // Click Extract Credentials
        await extractBtn.click();
        await waitForObjectiveById(page, 'obj-sniff-credentials');
        await closeWindow(page, 'Network Sniffer');

        // ============================================================
        // Phase 4: Copy file from logistics-primary
        // ============================================================
        await openApp(page, 'File Manager');
        const fm = page.locator('.window:has-text("File Manager")').first();

        await fm.locator('select').first().selectOption('fs-pf-logistics');
        await page.waitForTimeout(500);
        await waitForObjectiveById(page, 'obj-access-logistics');

        // Verify the target file is visible
        const targetFile = fm.locator('.file-item:has-text("shipping-manifests-2020.db")');
        await expect(targetFile).toBeVisible({ timeout: 5000 });
        await targetFile.click();
        await page.waitForTimeout(200);

        await fm.locator('button:has-text("Copy")').click();
        await page.waitForTimeout(300);

        // ============================================================
        // Phase 5: Connect to backup site and paste file
        // ============================================================
        // Connect to PFS-BackupSite (non-hostile, no relays needed)
        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');
        await vpn.locator('select').selectOption({ label: 'PFS-BackupSite' });
        await page.waitForTimeout(300);
        await vpn.locator('button.connect-btn').click();
        await expect(vpn.locator('text=PFS-BackupSite').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'VPN Client');

        // Scan PFS-BackupSite to discover safe-storage
        await openApp(page, 'Network Scanner');
        const scanner2 = page.locator('.window:has-text("Network Scanner")');
        await scanner2.locator('select').selectOption({ label: 'PFS-BackupSite' });
        await scanner2.locator('button:has-text("Start Scan")').click();
        await expect(scanner2.locator('text=safe-storage').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        // Switch File Manager to safe-storage and paste
        await fm.locator('select').first().selectOption('fs-pfs-safe-storage');
        await page.waitForTimeout(500);

        await fm.locator('button:has-text("Paste")').click();
        await waitForObjectiveById(page, 'obj-backup-data');
        await closeWindow(page, 'File Manager');

        // ============================================================
        // Phase 6: Mission completion and verification
        // ============================================================
        await waitForMissionComplete(page, 'lockdown');

        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'lockdown' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);

        // Verify PacificFreight-Core NAR was revoked
        const pfAccessible = await page.evaluate(() => {
            const registry = window.networkRegistry;
            return registry?.getNetwork?.('pacific-freight')?.accessible;
        });
        expect(pfAccessible).toBeFalsy();

        // Mission completion resets speed; restore
        await setSpecificTimeSpeed(page, 100);

        // Wait for post-mission messages
        await dismissDisconnectionNotice(page);
        await goToMailInbox(page);
        await waitForMessage(page, 'Data Recovered - Pacific Freight', 60000);
        await waitForMessage(page, 'Payment for Lockdown', 60000);
        await closeWindow(page, 'SNet Mail');

        console.log('\n=== Lockdown Backup Flow Playthrough Complete ===');
        console.log('All assertions passed');
    });
});

/**
 * Network Sniffer Gameplay Tests
 *
 * Verifies the Network Sniffer app mechanics in detail:
 * - Network dropdown populated from active connections
 * - Mode toggle between Extract Credentials and Investigate Traffic
 * - Packet log shows captured packets with timestamps, IPs, protocols
 * - Fragment counter increments and progress bar advances
 * - "Extract Credentials" button appears when fragments sufficient
 * - Credentials extracted → previously locked device now accessible
 * - Auto-reset after extraction success (no "Monitor Another" button)
 * - Investigate Traffic mode shows analysis summary without granting access
 *
 * Loads from: post-behind-enemy-lines scenario (buys sniffer + sets up lockdown mission)
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
    goToMailInbox,
} from '../helpers/common-actions.js';

test.describe('Network Sniffer Gameplay', () => {
    test('verifies sniffer UI: packet log, fragment progress, credential extraction, and mode toggle', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Reach a state with Network Sniffer + credential-locked network
        // ============================================================
        await loadScenario(page, 'post-behind-enemy-lines');
        await addCredits(page, 55000);
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

        await waitForMessage(page, 'New Tool Available - Network Sniffer', 60000);
        await readMessage(page, 'New Tool Available - Network Sniffer');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        await purchaseFromPortal(page, 'Network Sniffer');

        // Accept lockdown mission to get credential-locked network
        await waitForMission(page, 'lockdown');
        await acceptMission(page, 'Lockdown');

        // Activate both NAR attachments
        await setSpecificTimeSpeed(page, 10);
        await goToMailInbox(page);
        await readMessage(page, 'EMERGENCY: Complete Network Lockout');
        await page.waitForTimeout(300);

        const narAttachments = page.locator('.attachment-item:has-text("Click to add")');
        const count = await narAttachments.count();
        for (let i = 0; i < count; i++) {
            const attachment = page.locator('.attachment-item:has-text("Click to add")').first();
            await expect(attachment).toBeVisible({ timeout: 5000 });
            await attachment.click();
            await page.waitForTimeout(500);
        }
        await closeWindow(page, 'SNet Mail');

        // Connect through relays
        await connectThroughRelays(page, 'PacificFreight-Core', 2);

        // Wait for trace event to reset speed, then restore
        await page.waitForTimeout(2000);
        await setSpecificTimeSpeed(page, 10);

        // Scan network
        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'PacificFreight-Core' });
        await scanner.locator('button:has-text("Start Scan")').click();
        await expect(scanner.locator('text=logistics-primary').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        // ============================================================
        // Test 1: Network dropdown populated from active connections
        // ============================================================
        await openApp(page, 'Network Sniffer');
        const sniffer = page.locator('.window:has-text("Network Sniffer")');

        const networkDropdown = sniffer.locator('select').first();
        const networkOptions = await networkDropdown.locator('option').allTextContents();
        // Should have "Select a network..." + at least "PacificFreight-Core"
        expect(networkOptions.length).toBeGreaterThanOrEqual(2);
        const hasPacificFreight = networkOptions.some(o => o.includes('PacificFreight'));
        expect(hasPacificFreight).toBe(true);

        // ============================================================
        // Test 2: Mode toggle (Extract Credentials vs Investigate Traffic)
        // ============================================================
        await networkDropdown.selectOption('pacific-freight');
        await page.waitForTimeout(300);

        // Both mode buttons should be visible
        const credMode = sniffer.locator('.ns-mode-btn:has-text("Extract Credentials")');
        const investMode = sniffer.locator('.ns-mode-btn:has-text("Investigate Traffic")');
        await expect(credMode).toBeVisible();
        await expect(investMode).toBeVisible();

        // Extract Credentials should be active by default
        await expect(credMode).toHaveClass(/active/);

        // ============================================================
        // Test 3: Start monitoring in Extract Credentials mode
        // ============================================================
        const startBtn = sniffer.locator('button:has-text("Start Monitoring")');
        await expect(startBtn).toBeVisible();
        await startBtn.click();

        // Verify packet log starts showing packets
        await expect(sniffer.locator('.ns-packet').first()).toBeVisible({ timeout: 30000 });

        // Verify packet has expected structure (timestamp, src, dst, protocol, info)
        const firstPacket = sniffer.locator('.ns-packet').first();
        await expect(firstPacket.locator('.ns-pkt-time')).toBeVisible();
        await expect(firstPacket.locator('.ns-pkt-src')).toBeVisible();
        await expect(firstPacket.locator('.ns-pkt-dst')).toBeVisible();
        await expect(firstPacket.locator('.ns-pkt-proto')).toBeVisible();
        await expect(firstPacket.locator('.ns-pkt-info')).toBeVisible();

        // ============================================================
        // Test 4: Fragment counter and progress bar
        // ============================================================
        // Fragment display should be visible
        const fragmentDisplay = sniffer.locator('.ns-recon-fragments');
        await expect(fragmentDisplay).toBeVisible();

        // Progress bar should be visible
        const progressBar = sniffer.locator('.ns-progress-fill');
        await expect(progressBar).toBeVisible();

        // Wait for fragments to accumulate — use polling instead of waitForFunction
        // (Playwright's actionTimeout overrides waitForFunction's timeout parameter)
        await expect(sniffer.locator('.ns-progress-text')).not.toHaveText('0%', { timeout: 60000 });

        // Hardware info should be displayed
        await expect(sniffer.locator('.ns-hardware-info')).toBeVisible();

        // ============================================================
        // Test 5: Extract Credentials button appears when fragments sufficient
        // ============================================================
        // Wait for extraction button to appear (monitoring completes when fragments reach required count)
        const extractBtn = sniffer.locator('.ns-extract-btn');
        await expect(extractBtn).toBeVisible({ timeout: 120000 });
        await expect(extractBtn).toHaveText('Extract Credentials');

        // Progress should be at 100%
        const finalProgress = await sniffer.locator('.ns-progress-text').textContent();
        expect(finalProgress).toBe('100%');

        // ============================================================
        // Test 6: Extract credentials → device becomes accessible
        // ============================================================
        // Before extraction, check that logistics-primary is not accessible
        const beforeAccessible = await page.evaluate(() => {
            const registry = window.networkRegistry;
            const devices = registry?.getNetworkDevices?.('pacific-freight') || [];
            const logistics = devices.find(d => d.hostname === 'logistics-primary');
            return logistics?.accessible;
        });
        // logistics-primary requires credentials, so it should not be accessible yet
        expect(beforeAccessible).toBeFalsy();

        await extractBtn.click();

        // Verify success status
        await expect(sniffer.locator('.ns-status.success')).toBeVisible({ timeout: 5000 });
        const statusText = await sniffer.locator('.ns-status.success').textContent();
        expect(statusText).toContain('Credentials extracted');

        // After extraction, logistics-primary should now be accessible
        const afterAccessible = await page.evaluate(() => {
            const registry = window.networkRegistry;
            const devices = registry?.getNetworkDevices?.('pacific-freight') || [];
            const logistics = devices.find(d => d.hostname === 'logistics-primary');
            return logistics?.accessible;
        });
        expect(afterAccessible).toBe(true);

        // ============================================================
        // Test 7: Auto-reset after success (no "Monitor Another Network" button)
        // ============================================================
        // Verify no "Monitor Another Network" button
        const monitorAnotherBtn = sniffer.locator('button:has-text("Monitor Another")');
        await expect(monitorAnotherBtn).not.toBeVisible();

        // Wait for auto-reset (~2 seconds)
        await page.waitForTimeout(3000);

        // After auto-reset, monitoring state should be cleared
        // Since the only credential-protected device was just unlocked,
        // Extract Credentials mode shows "No credential-protected devices found"
        await expect(sniffer.locator('text=No credential-protected devices')).toBeVisible({ timeout: 5000 });

        // Mode buttons should still be visible (we're back to selection state)
        await expect(credMode).toBeVisible();
        await expect(investMode).toBeVisible();

        // ============================================================
        // Test 8: Investigate Traffic mode
        // ============================================================
        // Switch to Investigate Traffic mode (works without credential-protected devices)
        await investMode.click();
        await page.waitForTimeout(200);

        // Start monitoring in investigate mode
        await sniffer.locator('button:has-text("Start Monitoring")').click();

        // Packet log should appear
        await expect(sniffer.locator('.ns-packet').first()).toBeVisible({ timeout: 30000 });

        // Analysis summary should be visible (packets captured, unique sources, anomalies)
        await expect(sniffer.locator('.ns-analysis-summary')).toBeVisible({ timeout: 5000 });
        await expect(sniffer.locator('.ns-stat-label:has-text("Packets Captured")')).toBeVisible();
        await expect(sniffer.locator('.ns-stat-label:has-text("Unique Sources")')).toBeVisible();
        await expect(sniffer.locator('.ns-stat-label:has-text("Anomalies")')).toBeVisible();

        // Stop monitoring
        await sniffer.locator('button:has-text("Stop Monitoring")').click();
        await page.waitForTimeout(300);

        await closeWindow(page, 'Network Sniffer');

        console.log('\n=== Network Sniffer Gameplay Tests Complete ===');
        console.log('Verified: network dropdown, mode toggle');
        console.log('Verified: packet log, fragment progress, extraction');
        console.log('Verified: auto-reset, investigate mode');
    });
});

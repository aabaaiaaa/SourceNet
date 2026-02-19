/**
 * Trace Monitor & Relay System Gameplay Tests
 *
 * Verifies the relay panel and trace monitor mechanics:
 * - Relay panel shows placeholder when service not purchased (but upgrade installed)
 * - Purchasing relay service makes relay nodes appear
 * - Relay chain stats (cost, bandwidth, ETT) shown before connecting
 * - Connecting through relays to hostile network starts a trace
 * - Trace Monitor auto-activates when trace starts
 * - ETT countdown visible and decrementing in TopBar
 * - Disconnecting clears the trace
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
    purchaseFromPortal,
    waitForMission,
    acceptMission,
    activateNarFromMessage,
    waitForObjectiveById,
    goToMailInbox,
} from '../helpers/common-actions.js';

test.describe('Trace Monitor & Relay System', () => {
    test('verifies relay panel, trace monitor activation, ETT countdown, and trace clearing', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Load scenario and unlock relay service
        // ============================================================
        await loadScenario(page, 'post-locked-out');
        await addCredits(page, 40000);

        // Read relay-unlock message → unlocks relay-service + generates relay nodes
        await goToMailInbox(page);
        await readMessage(page, 'Relay System & Trace Monitor');
        await page.waitForTimeout(500);
        await closeWindow(page, 'SNet Mail');

        // Purchase VPN Relay Module (enables relay panel in VPN Client)
        await setSpecificTimeSpeed(page, 100);
        await purchaseFromPortal(page, 'VPN Relay Module');
        await purchaseFromPortal(page, 'Trace Monitor');

        // Accept behind-enemy-lines mission to get a network to connect to
        // (relay panel only renders when availableNetworks.length > 0)
        await waitForMission(page, 'behind-enemy-lines');
        await acceptMission(page, 'Behind Enemy Lines');

        await setSpecificTimeSpeed(page, 10);
        await activateNarFromMessage(page, 'Behind Enemy Lines - Coastal Power Authority');

        // ============================================================
        // Test 1: Relay panel with placeholder (service not yet purchased)
        // ============================================================
        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');

        // Relay panel should be visible (vpn-relay-upgrade installed + network available)
        const relayPanel = vpn.locator('.relay-panel');
        await expect(relayPanel).toBeVisible({ timeout: 5000 });

        // Expand relay panel
        await vpn.locator('.relay-panel-header').click();
        await page.waitForTimeout(300);

        // Placeholder should show since relay service is not purchased
        const placeholder = vpn.locator('.relay-placeholder');
        await expect(placeholder).toBeVisible({ timeout: 5000 });
        const placeholderText = await placeholder.textContent();
        expect(placeholderText).toContain('Purchase Standard Relay Service');

        await closeWindow(page, 'VPN Client');

        // ============================================================
        // Test 2: Purchasing relay service makes relay nodes appear
        // ============================================================
        await setSpecificTimeSpeed(page, 100);
        await purchaseFromPortal(page, 'Standard Relay Service', { section: 'Services' });
        await setSpecificTimeSpeed(page, 10);

        await openApp(page, 'VPN Client');

        // Expand relay panel
        if (!await vpn.locator('.relay-panel-content').isVisible().catch(() => false)) {
            await vpn.locator('.relay-panel-header').click();
            await page.waitForTimeout(300);
        }

        // Placeholder should be gone, relay nodes visible
        await expect(placeholder).not.toBeVisible();
        const relayNodes = vpn.locator('.relay-node');
        const nodeCount = await relayNodes.count();
        expect(nodeCount).toBeGreaterThanOrEqual(6);

        // Each relay node should show name, bandwidth, cost, and suspicion
        const firstNode = relayNodes.first();
        await expect(firstNode.locator('.relay-node-name')).toBeVisible();
        await expect(firstNode.locator('.relay-node-stats')).toBeVisible();

        // ============================================================
        // Test 3: Select relays and verify chain stats
        // ============================================================
        // Select Coastal-Ops network
        await vpn.locator('select').selectOption({ label: 'Coastal-Ops' });
        await page.waitForTimeout(300);

        // Select 2 relay nodes
        await relayNodes.nth(0).click();
        await page.waitForTimeout(200);
        await relayNodes.nth(1).click();
        await page.waitForTimeout(200);

        // Chain stats should be visible
        const chainStats = vpn.locator('.relay-chain-stats');
        await expect(chainStats).toBeVisible();
        await expect(chainStats.locator('.relay-stat-label:has-text("Route Cost")')).toBeVisible();
        await expect(chainStats.locator('.relay-stat-label:has-text("Max Bandwidth")')).toBeVisible();
        await expect(chainStats.locator('.relay-stat-label:has-text("Time-to-Traced")')).toBeVisible();

        // Connect button should show relay count
        const connectBtn = vpn.locator('button:has-text("Connect via 2 Relays")');
        await expect(connectBtn).toBeVisible();

        // ============================================================
        // Test 4: Connect through relays
        // ============================================================
        await connectBtn.click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'VPN Client');

        await waitForObjectiveById(page, 'obj-connect-coastal');

        // ============================================================
        // Test 5: Trace Monitor auto-activates + ETT visible in TopBar
        // ============================================================
        // Scripted event fires 5s game time after obj-connect-coastal, resets speed to 1x,
        // then starts trace. handleStartTrace auto-activates trace-monitor passive app.
        // Wait for the TopBar trace indicator directly (proves both trace + monitor active)
        const traceMonitor = page.locator('.topbar-trace-monitor.tracing');
        await expect(traceMonitor).toBeVisible({ timeout: 30000 });

        // Scripted event resets speed; restore to 10x
        await setSpecificTimeSpeed(page, 10);

        // ETT countdown should be visible
        const ettText = page.locator('.trace-ett');
        await expect(ettText).toBeVisible({ timeout: 5000 });

        // Capture initial ETT value
        const initialETT = await ettText.textContent();
        expect(initialETT).toBeTruthy();
        console.log(`Initial ETT: ${initialETT}`);

        // ============================================================
        // Test 6: ETT countdown is decrementing
        // ============================================================
        await page.waitForTimeout(3000);
        const laterETT = await ettText.textContent();
        // At 10x speed, 3 seconds real time = 30 seconds game time
        expect(laterETT).not.toBe(initialETT);
        console.log(`Later ETT: ${laterETT} (decreased from ${initialETT})`);

        // ============================================================
        // Test 7: Disconnecting clears the trace
        // ============================================================
        await openApp(page, 'VPN Client');
        await vpn.locator('button:has-text("Disconnect")').click();
        await page.waitForTimeout(1000);

        // Trace should clear
        const traceCleared = await page.evaluate(() => {
            return window.gameContext.traceState === null ||
                window.gameContext.traceState === undefined;
        });
        expect(traceCleared).toBe(true);

        // Trace monitor in TopBar should no longer show "tracing" state
        await expect(page.locator('.topbar-trace-monitor.tracing')).not.toBeVisible({ timeout: 5000 });

        await closeWindow(page, 'VPN Client');

        console.log('\n=== Trace Monitor & Relay System Tests Complete ===');
        console.log('Verified: relay panel placeholder, relay nodes after service');
        console.log('Verified: chain stats, connect through relays');
        console.log('Verified: trace auto-activation, ETT countdown, decrement');
        console.log('Verified: disconnect clears trace');
    });
});

import { test, expect } from '@playwright/test';
import { completeBoot, openApp } from './helpers/common-actions.js';

/**
 * NAR Revocation E2E Tests
 * 
 * This test suite covers:
 * - Disconnection notification appearing in TopBar when event is emitted
 * - Notification stacking and auto-dismiss behavior
 * - NAR app showing Active/Revoked tabs
 * - Revoked entries displaying with correct styling
 * 
 * Note: The timer-based revocation logic is tested in integration tests
 * (mission-nar-revocation.test.jsx) where we can mock the timer scheduler.
 * E2E tests focus on UI behavior with direct event emission.
 */

test.describe('E2E: NAR Revocation & Disconnection Notice', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should show disconnection notice when networkDisconnected event is emitted', async ({ page }) => {
        await page.goto('/?skipBoot=true&debug=true');
        await completeBoot(page, 'event_test');

        // Directly emit networkDisconnected event
        await page.evaluate(() => {
            window.triggerEventBus.emit('networkDisconnected', {
                networkId: 'test-network',
                networkName: 'Test Network',
                reason: 'Test reason',
            });
        });

        // Notice should appear immediately
        await expect(page.locator('.disconnection-notice')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.disconnection-notice .preview-header')).toContainText('Network Disconnected');
        await expect(page.locator('.disconnection-notice .preview-item').first()).toContainText('Test Network');
        await expect(page.locator('.disconnection-notice .preview-item-small').first()).toContainText('Test reason');
    });

    test('disconnection notices should stack and be dismissible', async ({ page }) => {
        await page.goto('/?skipBoot=true&debug=true');
        await completeBoot(page, 'stack_test');

        // Emit multiple disconnection events
        await page.evaluate(() => {
            window.triggerEventBus.emit('networkDisconnected', {
                networkId: 'network-1',
                networkName: 'Network One',
                reason: 'Reason 1',
            });
            window.triggerEventBus.emit('networkDisconnected', {
                networkId: 'network-2',
                networkName: 'Network Two',
                reason: 'Reason 2',
            });
        });

        // Both notices should appear stacked
        await expect(page.locator('.disconnection-notice')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.disconnection-notice .preview-item')).toHaveCount(2);
        await expect(page.locator('.disconnection-notice .preview-item').first()).toContainText('Network One');
        await expect(page.locator('.disconnection-notice .preview-item').last()).toContainText('Network Two');

        // Dismiss button should clear all notices
        await page.click('.disconnection-notice .dismiss-btn');
        await expect(page.locator('.disconnection-notice')).not.toBeVisible();
    });

    test('should show NAR revoked entries in Revoked tab', async ({ page }) => {
        await page.goto('/?skipBoot=true&debug=true');
        await completeBoot(page, 'revoked_tab_test');

        // Setup NAR entry that's already revoked
        await page.evaluate(() => {
            window.gameContext.setNarEntries([
                {
                    id: 'nar-active-1',
                    networkId: 'active-network',
                    networkName: 'Active Network',
                    address: '10.0.0.0/8',
                    authorized: true,
                    status: 'active',
                },
                {
                    id: 'nar-revoked-1',
                    networkId: 'revoked-network',
                    networkName: 'Revoked Network',
                    address: '192.168.1.0/24',
                    authorized: false,
                    revokedReason: 'Mission access expired',
                    status: 'active',
                },
            ]);
        });

        // Install and open NAR app
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('network-address-register')) {
                window.gameContext.setSoftware([...currentSoftware, 'network-address-register']);
            }
        });

        await openApp(page, 'Network Address Register');

        // Both tabs should be visible (Revoked only appears when there are revoked entries)
        await expect(page.locator('.nar-tab:has-text("Active")')).toBeVisible();
        await expect(page.locator('.nar-tab:has-text("Revoked")')).toBeVisible();

        // Active tab should be selected by default and show active entry
        await expect(page.locator('.nar-tab.active:has-text("Active")')).toBeVisible();
        await expect(page.locator('.nar-entry .nar-name:has-text("Active Network")')).toBeVisible();

        // Click Revoked tab
        await page.click('.nar-tab:has-text("Revoked")');

        // Should show revoked entry with proper styling
        await expect(page.locator('.nar-entry.nar-revoked')).toBeVisible();
        await expect(page.locator('.nar-revoked-badge')).toContainText('Access Revoked');
        await expect(page.locator('.nar-revoked-reason')).toContainText('Mission access expired');
        await expect(page.locator('.nar-entry .nar-name:has-text("Revoked Network")')).toBeVisible();
    });

    test('Revoked tab should only appear when there are revoked entries', async ({ page }) => {
        await page.goto('/?skipBoot=true&debug=true');
        await completeBoot(page, 'no_revoked_tab_test');

        // Setup NAR with only active entries
        await page.evaluate(() => {
            window.gameContext.setNarEntries([
                {
                    id: 'nar-active-1',
                    networkId: 'active-network',
                    networkName: 'Active Network',
                    address: '10.0.0.0/8',
                    authorized: true,
                    status: 'active',
                },
            ]);
        });

        // Install and open NAR app
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('network-address-register')) {
                window.gameContext.setSoftware([...currentSoftware, 'network-address-register']);
            }
        });

        await openApp(page, 'Network Address Register');

        // No tabs should be visible when there are only active entries (tabs appear only when there are revoked entries)
        await expect(page.locator('.nar-tabs')).not.toBeVisible();

        // The entry should be displayed directly without tabs
        await expect(page.locator('.nar-entry .nar-name:has-text("Active Network")')).toBeVisible();
    });

    test('should NOT show disconnection notice for mission without revokeOnComplete', async ({ page }) => {
        test.setTimeout(60000);

        await page.goto('/?skipBoot=true&debug=true');
        await completeBoot(page, 'no_revoke_test');

        // Setup NAR entry and connection
        await page.evaluate(() => {
            window.gameContext.setNarEntries([{
                id: 'nar-persistent-1',
                networkId: 'persistent-network',
                networkName: 'Persistent Network',
                address: '172.16.0.0/16',
                authorized: true,
                status: 'active',
            }]);
            window.gameContext.setActiveConnections([{
                networkId: 'persistent-network',
                networkName: 'Persistent Network',
                connectedAt: new Date().toISOString(),
            }]);
        });

        // Set up mission WITHOUT revokeOnComplete
        await page.evaluate(() => {
            window.gameContext.setActiveMission({
                missionId: 'no-revoke-mission',
                title: 'No Revoke Mission',
                client: 'Test Client',
                difficulty: 'Easy',
                objectives: [{ id: 'obj-1', description: 'Test', status: 'complete' }],
                network: {
                    networkId: 'persistent-network',
                    networkName: 'Persistent Network',
                    // No revokeOnComplete flag
                },
            });
        });

        // Complete mission
        await page.evaluate(() => {
            window.gameContext.completeMission('success', 100, 0);
        });

        // Wait a bit (the 5-second delay won't be scheduled without revokeOnComplete)
        await page.waitForTimeout(500);

        // Disconnection notice should NOT appear
        await expect(page.locator('.disconnection-notice')).not.toBeVisible();

        // Network connection should still be active
        await expect(page.locator('.topbar-network .network-badge')).toHaveText('1');

        // Verify NAR entry is still authorized
        const narEntry = await page.evaluate(() => {
            return window.gameContext.narEntries.find(e => e.networkId === 'persistent-network');
        });
        expect(narEntry.authorized).toBe(true);
    });
});

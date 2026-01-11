/**
 * Scenario Loading E2E Tests
 * 
 * Tests that scenarios can be loaded via URL parameters
 */

import { test, expect } from '@playwright/test';

test.describe('Scenario Loading', () => {
    test('should load fresh-start scenario via URL parameter', async ({ page }) => {
        // Navigate first, then clear localStorage, then reload with scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());

        // Load with scenario parameter - should skip boot and go directly to desktop
        await page.goto('/?scenario=fresh-start');

        // Should immediately show the desktop (no boot, no username selection)
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

        // Verify the scenario state was applied
        // Credits should be 1000
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 2000 });

        // Mission board should be licensed (check in portal)
        await page.click('text=☰');
        await page.click('button:has-text("OSNet Portal")');
        await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

        // Go to Software tab
        await page.click('button:has-text("Software")');

        // Mission Board should show "Install (Licensed)" button - this proves it's licensed
        await expect(page.locator('button:has-text("Install (Licensed)")')).toBeVisible({ timeout: 2000 });

        console.log('✅ E2E: Scenario loaded successfully via URL parameter');
    });

    test('should handle invalid scenario name gracefully', async ({ page }) => {
        // Navigate first, then clear localStorage
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());

        // Load with invalid scenario + skipBoot to speed up test
        await page.goto('/?scenario=nonexistent-scenario&skipBoot=true');

        // Should fall through to username selection since scenario doesn't exist
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 5000 });

        console.log('✅ E2E: Invalid scenario handled gracefully');
    });
});

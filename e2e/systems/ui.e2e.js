import { test, expect } from '@playwright/test';

/**
 * UI & Display System E2E Tests
 * 
 * Tests for UI elements, visual components, and display systems:
 * - TopBar elements (reputation badge, credits, time)
 * - App launcher and storage display
 * - Portal tabs and navigation
 * - Debug panel functionality
 */

const completeBoot = async (page, username = 'ui_test') => {
    await page.goto('/?skipBoot=true');
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 5000 });
    await page.locator('input.username-input').fill(username);
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

test.describe('TopBar Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should display reputation badge with correct starting tier', async ({ page }) => {
        await completeBoot(page, 'rep_display_test');

        // Reputation badge should be visible
        await expect(page.locator('.reputation-badge')).toBeVisible();

        // Should show tier 9 (Superb) at start
        const tierText = await page.locator('.reputation-badge').textContent();
        expect(tierText).toBe('Tier 9');

        console.log('✅ E2E: Reputation badge displays correctly');
    });

    test('should show reputation preview on hover', async ({ page }) => {
        await completeBoot(page, 'rep_hover_test');

        // Hover over reputation badge
        await page.hover('.reputation-badge');
        await page.waitForTimeout(200);

        // Preview should appear with reputation details
        await expect(page.locator('text=Reputation:')).toBeVisible();

        console.log('✅ E2E: Reputation hover preview works');
    });

    test('should display credits in TopBar', async ({ page }) => {
        await completeBoot(page, 'credits_test');

        // Credits should be visible in TopBar
        await expect(page.locator('.topbar-credits')).toBeVisible();

        console.log('✅ E2E: Credits display in TopBar');
    });
});

test.describe('App Launcher', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should show basic apps available at start', async ({ page }) => {
        await completeBoot(page, 'apps_test');

        // Open app launcher
        await page.hover('text=☰');
        await page.waitForTimeout(200);

        // Verify basic apps present
        await expect(page.locator('button:has-text("OSNet Portal")')).toBeVisible();
        await expect(page.locator('button:has-text("SNet Banking App")')).toBeVisible();
        await expect(page.locator('button:has-text("SNet Mail")')).toBeVisible();

        console.log('✅ E2E: Basic apps available in launcher');
    });

    test('should display storage usage', async ({ page }) => {
        await completeBoot(page, 'storage_test');

        // Open app launcher
        await page.hover('text=☰');
        await page.waitForTimeout(200);

        // Storage should be visible (format: "Apps: X GB | Y GB free")
        await expect(page.locator('text=GB free')).toBeVisible();

        console.log('✅ E2E: Storage display in launcher');
    });
});

test.describe('Portal Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should show Hardware and Software tabs', async ({ page }) => {
        await completeBoot(page, 'portal_tabs_test');

        // Open Portal
        await page.hover('text=☰');
        await page.waitForTimeout(200);
        await page.click('button:has-text("OSNet Portal")');
        await expect(page.locator('.portal')).toBeVisible();

        // Should have both tabs
        await expect(page.locator('button:has-text("Hardware")')).toBeVisible();
        await expect(page.locator('button:has-text("Software")')).toBeVisible();

        console.log('✅ E2E: Portal tabs visible');
    });

    test('should display purchasable software items', async ({ page }) => {
        await completeBoot(page, 'portal_software_test');

        // Open Portal
        await page.hover('text=☰');
        await page.waitForTimeout(200);
        await page.click('button:has-text("OSNet Portal")');
        await expect(page.locator('.portal')).toBeVisible();

        // Switch to Software tab
        await page.click('button:has-text("Software")');

        // Verify software items available
        await expect(page.locator('text=SourceNet Mission Board')).toBeVisible();
        await expect(page.locator('text=SourceNet VPN Client')).toBeVisible();

        const itemCount = await page.locator('.portal-item').count();
        expect(itemCount).toBeGreaterThan(0);

        console.log('✅ E2E: Portal shows purchasable software');
    });

    test('should browse hardware categories in Portal', async ({ page }) => {
        await completeBoot(page, 'portal_hardware_test');

        // Open Portal
        await page.hover('text=☰');
        await page.waitForTimeout(200);
        await page.click('button:has-text("OSNet Portal")');
        await expect(page.locator('.portal')).toBeVisible();

        // Switch to Hardware tab
        await page.click('button:has-text("Hardware")');

        // Browse Memory category
        await page.click('button:has-text("Memory")');
        await expect(page.locator('.item-name:has-text("2GB RAM")').first()).toBeVisible();
        await expect(page.locator('.installed-badge').first()).toBeVisible();

        // Browse Storage category
        await page.click('button:has-text("Storage")');
        await expect(page.locator('.item-name:has-text("90GB SSD")').first()).toBeVisible();

        // Browse Motherboards category
        await page.click('button:has-text("Motherboards")');
        await expect(page.locator('text=Basic Board')).toBeVisible();

        console.log('✅ E2E: Portal hardware categories browsing');
    });
});

test.describe('Debug System', () => {
    test('should enable debug mode with query parameter', async ({ page }) => {
        await page.goto('/?debug=true&skipBoot=true');

        // Complete boot
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('debug_test');
        await page.click('button:has-text("Continue")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Verify debug mode is active by checking URL
        const url = page.url();
        expect(url).toContain('debug=true');

        console.log('✅ E2E: Debug mode enabled');
    });

    test('should open debug panel with keyboard shortcut', async ({ page }) => {
        await page.goto('/?debug=true&skipBoot=true');

        // Complete boot
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('debug_panel_test');
        await page.click('button:has-text("Continue")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open debug panel with Ctrl+D
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Close with Escape
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        console.log('✅ E2E: Debug panel opens and closes');
    });

    test('should load debug state via State Controls tab', async ({ page }) => {
        await page.goto('/?debug=true&skipBoot=true');

        // Complete boot
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('debug_scenario_test');
        await page.click('button:has-text("Continue")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open debug panel
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Switch to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');

        // Set reputation to tier 3 (Accident Prone)
        await page.fill('[data-testid="debug-reputation-input"]', '3');
        await page.click('[data-testid="debug-set-reputation"]');

        // Close debug panel
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        // Verify state changed - reputation should show low tier
        await expect(page.locator('.reputation-badge')).toHaveText('Tier 3');

        console.log('✅ E2E: Debug state modified successfully');
    });
});

test.describe('Banking App Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should display Transaction History tab', async ({ page }) => {
        await completeBoot(page, 'banking_display_test');

        // Open Banking App
        await page.hover('text=☰');
        await page.waitForTimeout(200);
        await page.click('button:has-text("SNet Banking App")');
        await expect(page.locator('.banking-app')).toBeVisible();

        // Click Transaction History tab
        await page.click('button:has-text("Transaction History")');

        // Should show empty state or transactions
        await expect(page.locator('.transactions-list, .empty-state')).toBeVisible();

        console.log('✅ E2E: Transaction History tab working');
    });
});

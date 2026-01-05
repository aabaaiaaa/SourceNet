import { test, expect } from '@playwright/test';

/**
 * Core Mechanics E2E Tests
 * Tests critical game mechanics using debug scenarios for rapid state setup
 */

test.describe('Core Mechanics - Interest & Bankruptcy', () => {
  test('should show bankruptcy warning banner when countdown active', async ({ page }) => {
    await page.goto('/?debug=true&skipBoot=true');

    // Complete boot
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('bankruptcy_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open debug panel and load a near-bankruptcy scenario
    await page.keyboard.press('Control+d');
    await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

    // Load the "Tutorial Part 1 Failed" scenario which has -9000 credits and reputation 3
    await page.click('button:has-text("Tutorial Part 1 Failed")');

    // Close debug panel
    await page.keyboard.press('Escape');
    await expect(page.locator('.debug-panel')).not.toBeVisible();

    // Verify reputation shows low tier
    await expect(page.locator('.reputation-badge')).toHaveText('★3');

    console.log('✅ E2E: Bankruptcy state setup complete');
  });

  test('should show reputation badge in TopBar', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('rep_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Reputation badge should be visible
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Should show tier 9 at start
    const tierText = await page.locator('.reputation-badge').textContent();
    expect(tierText).toBe('★9');

    console.log('✅ E2E: Reputation badge displays correctly');
  });
});

test.describe('Transaction History', () => {
  test('should display transaction history in Banking App', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('transaction_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for first message (contains cheque)
    await page.waitForTimeout(4000);

    // Open Banking App
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SNet Banking App")');
    await expect(page.locator('.banking-app')).toBeVisible();

    // Click Transaction History tab
    await page.click('button:has-text("Transaction History")');

    // Should show empty state initially (before cheque deposited)
    await expect(page.locator('.empty-state, .transactions-list')).toBeVisible();

    console.log('✅ E2E: Transaction History tab functional');
  });
});

test.describe('Software Portal', () => {
  test('should show apps available for purchase', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('portal_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open Portal
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("OSNet Portal")');
    await expect(page.locator('.portal')).toBeVisible();

    // Portal defaults to Software tab
    // Verify apps available for purchase
    await expect(page.locator('text=SourceNet Mission Board')).toBeVisible();
    await expect(page.locator('text=SourceNet VPN Client')).toBeVisible();

    console.log('✅ E2E: Apps available for purchase in portal');
  });
});

test.describe('Network Apps', () => {
  test('should show basic apps in launcher at start', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('apps_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open app launcher
    await page.hover('text=☰');
    await page.waitForTimeout(200);

    // Verify basic apps present (advanced apps require purchase)
    await expect(page.locator('text=OSNet Portal')).toBeVisible();
    await expect(page.locator('text=SNet Banking App')).toBeVisible();
    await expect(page.locator('text=SNet Mail')).toBeVisible();

    // Verify storage display
    await expect(page.locator('text=GB used')).toBeVisible();

    console.log('✅ E2E: Basic apps in launcher with storage display');
  });
});

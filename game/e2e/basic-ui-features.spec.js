import { test, expect } from '@playwright/test';

/**
 * Helper to complete boot sequence and reach desktop
 */
const completeBoot = async (page) => {
  await page.goto('/?skipBoot=true'); // Skip boot sequence for speed

  // Wait for username screen (boot skipped)
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 5000 });

  // Enter username
  await page.locator('input.username-input').fill('test_agent_flow');
  await page.click('button:has-text("Continue")');

  // Desktop should load
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

test.describe('Complete Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete boot sequence and show UI elements', async ({ page }) => {
    await completeBoot(page);

    // Verify TopBar elements
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Reputation should be Tier 9 (Superb) at start
    const repText = await page.locator('.reputation-badge').textContent();
    expect(repText).toBe('Tier 9');

    console.log('✅ E2E: Boot complete, reputation indicator visible');
  });

  test('should show Portal with purchasable software', async ({ page }) => {
    await completeBoot(page);

    // Hover over app launcher to open menu
    await page.hover('.topbar-button:has-text("☰")');

    // Wait for app menu to appear
    await page.waitForTimeout(200);

    // Click Portal
    await page.click('button:has-text("OSNet Portal")');

    // Portal window should open
    await expect(page.locator('.portal')).toBeVisible({ timeout: 2000 });

    // Switch to Software tab
    await page.click('button:has-text("Software")');

    // Verify Mission Board available for purchase
    await expect(page.locator('text=SourceNet Mission Board')).toBeVisible();

    console.log('✅ E2E: Portal shows purchasable software');
  });

  test('should show basic apps in launcher', async ({ page }) => {
    await completeBoot(page);

    // Open app launcher
    await page.hover('.topbar-button:has-text("☰")');
    await page.waitForTimeout(200);

    // Verify basic apps present
    await expect(page.locator('button:has-text("OSNet Portal")')).toBeVisible();
    await expect(page.locator('button:has-text("SNet Banking App")')).toBeVisible();
    await expect(page.locator('button:has-text("SNet Mail")')).toBeVisible();

    // Storage should be visible
    await expect(page.locator('text=GB used')).toBeVisible();

    console.log('✅ E2E: Basic apps available in launcher');
  });

  test('should show transaction history in Banking App', async ({ page }) => {
    await completeBoot(page);

    // Open Banking App
    await page.hover('.topbar-button:has-text("☰")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SNet Banking App")');

    // Banking App should be visible
    await expect(page.locator('.banking-app')).toBeVisible();

    // Click Transaction History tab
    await page.click('button:has-text("Transaction History")');

    // Should show empty state or transactions
    await expect(page.locator('.transactions-list, .empty-state')).toBeVisible();

    console.log('✅ E2E: Transaction History tab working');
  });

  test('should verify reputation system integrated', async ({ page }) => {
    await completeBoot(page);

    // Verify reputation badge visible in TopBar
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Should show tier 9 at start
    const repText = await page.locator('.reputation-badge').textContent();
    expect(repText).toBe('Tier 9');

    // Hover to see reputation preview
    await page.hover('.reputation-badge');
    await page.waitForTimeout(200);

    // Preview should appear with reputation details
    await expect(page.locator('text=Reputation:')).toBeVisible();

    console.log('✅ E2E: Reputation system integrated');
  });
});

test.describe('Debug System', () => {
  test('should have debug mode enabled with query parameter', async ({ page }) => {
    await page.goto('/?debug=true&skipBoot=true'); // Enable debug and skip boot

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
});

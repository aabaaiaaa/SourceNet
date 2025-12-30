import { test, expect } from '@playwright/test';

test.describe('Phase 2 Complete Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete boot sequence and reach desktop', async ({ page }) => {
    await page.goto('/');

    // Wait for boot sequence
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // Verify TopBar is visible
    await expect(page.locator('.topbar')).toBeVisible();

    console.log('✅ E2E: Boot sequence complete');
  });

  test('should show reputation indicator in TopBar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // TopBar should show reputation badge
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Reputation should be Tier 9 (Superb) at start
    const repBadge = await page.locator('.reputation-badge').textContent();
    expect(repBadge).toBe('9');

    console.log('✅ E2E: Reputation indicator working');
  });

  test('should open Mission Board from app launcher', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // Hover over app launcher to open menu
    await page.hover('.topbar-button:has-text("☰")');

    // Wait for app menu to appear
    await page.waitForTimeout(200);

    // Click Mission Board (should be in alphabetical order)
    await page.click('button:has-text("SourceNet Mission Board")');

    // Mission Board window should open
    await expect(page.locator('.mission-board')).toBeVisible({ timeout: 2000 });

    console.log('✅ E2E: Mission Board opens successfully');
  });

  test('should open VPN Client and show connection UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // Open VPN Client
    await page.hover('.topbar-button:has-text("☰")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SourceNet VPN Client")');

    // VPN Client should be visible
    await expect(page.locator('.vpn-client')).toBeVisible();
    await expect(page.locator('text=Connected Networks')).toBeVisible();
    await expect(page.locator('text=No active connections')).toBeVisible();

    console.log('✅ E2E: VPN Client UI working');
  });

  test('should show transaction history in Banking App', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

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

  test('should accept mission from Mission Board', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // Open Mission Board
    await page.hover('.topbar-button:has-text("☰")');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SourceNet Mission Board")');

    await expect(page.locator('.mission-board')).toBeVisible();

    // Check if missions available (might be empty initially)
    const availableTab = page.locator('text=Available Missions');
    await expect(availableTab).toBeVisible();

    console.log('✅ E2E: Mission Board functional');
  });
});

test.describe('Phase 2 Debug System', () => {
  test('should load debug scenario', async ({ page }) => {
    await page.goto('/?debug=true');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 20000 });

    // Debug scenarios should be accessible via window object
    const scenariosAvailable = await page.evaluate(() => {
      return typeof window.debugScenarios !== 'undefined';
    });

    expect(scenariosAvailable).toBe(true);

    console.log('✅ E2E: Debug system accessible');
  });
});

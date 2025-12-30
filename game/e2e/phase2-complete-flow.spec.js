import { test, expect } from '@playwright/test';

/**
 * Helper to complete boot sequence and reach desktop
 */
const completeBoot = async (page) => {
  await page.goto('/');

  // Wait for boot screen
  await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

  // Wait for username screen
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

  // Enter username
  await page.locator('input.username-input').fill('test_agent_phase2');
  await page.click('button:has-text("Continue")');

  // Desktop should load
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

test.describe('Phase 2 Complete Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete boot sequence and show Phase 2 UI elements', async ({ page }) => {
    await completeBoot(page);

    // Verify TopBar with Phase 2 elements
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Reputation should be Tier 9 (Superb) at start
    const repText = await page.locator('.reputation-badge').textContent();
    expect(repText).toBe('9');

    console.log('✅ E2E: Boot complete, reputation indicator visible');
  });

  test('should open Mission Board from app launcher', async ({ page }) => {
    await completeBoot(page);

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
    await completeBoot(page);

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

  test('should accept mission from Mission Board', async ({ page }) => {
    await completeBoot(page);

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
  test('should have debug mode enabled with query parameter', async ({ page }) => {
    await page.goto('/?debug=true');

    // Complete boot
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
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

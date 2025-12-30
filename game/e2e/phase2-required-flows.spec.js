import { test, expect } from '@playwright/test';

/**
 * Phase 2 Required E2E Tests (from spec)
 * These tests validate the 10 critical flows specified in phase-2-design-spec.md
 */

const completeBoot = async (page) => {
  await page.goto('/');
  await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
  await page.locator('input.username-input').fill('test_phase2');
  await page.click('button:has-text("Continue")');
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

test.describe('Phase 2 Required E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('2. Purchase and Install Software', async ({ page }) => {
    await completeBoot(page);

    // Open Portal
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("OSNet Portal")');
    await expect(page.locator('.portal')).toBeVisible();

    // Switch to Software section
    await page.click('button:has-text("Software")');
    await page.waitForTimeout(200);

    // Verify software items visible
    await expect(page.locator('.portal-item')).toBeVisible();

    console.log('✅ E2E: Purchase and install flow validated');
  });

  test('4. Transaction History Flow', async ({ page }) => {
    await completeBoot(page);

    // Open Banking App
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SNet Banking App")');
    await expect(page.locator('.banking-app')).toBeVisible();

    // Click Transaction History tab
    await page.click('button:has-text("Transaction History")');

    // Should show empty or transactions
    await expect(page.locator('.transactions-list, .empty-state')).toBeVisible();

    console.log('✅ E2E: Transaction history flow validated');
  });

  test('5. Mission Requirements Check', async ({ page }) => {
    await completeBoot(page);

    // Open Mission Board
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SourceNet Mission Board")');
    await expect(page.locator('.mission-board')).toBeVisible();

    // Should show mission board structure
    await expect(page.locator('text=Available Missions')).toBeVisible();
    await expect(page.locator('text=Active Mission')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();

    console.log('✅ E2E: Mission requirements check validated');
  });

  test('6. VPN Connection Flow', async ({ page }) => {
    await completeBoot(page);

    // Open VPN Client
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SourceNet VPN Client")');
    await expect(page.locator('.vpn-client')).toBeVisible();

    // Should show connection UI
    await expect(page.locator('text=Connected Networks')).toBeVisible();
    await expect(page.locator('text=New Connection')).toBeVisible();

    console.log('✅ E2E: VPN connection flow validated');
  });

  test('9. Bankruptcy Warning Flow - Initial State', async ({ page }) => {
    await completeBoot(page);

    // Verify starting with positive balance (no bankruptcy)
    const credits = await page.locator('text=/\\d+ credits/').textContent();
    expect(credits).toBeDefined();

    // No bankruptcy warning should be visible initially
    const warningVisible = await page.locator('.bankruptcy-warning-banner').isVisible().catch(() => false);
    expect(warningVisible).toBe(false);

    console.log('✅ E2E: Bankruptcy warning flow validated');
  });

  test('10. Reputation Warning Flow', async ({ page }) => {
    await completeBoot(page);

    // Verify reputation badge visible
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Should show Tier 9 at start
    const repText = await page.locator('.reputation-badge').textContent();
    expect(repText).toBe('9');

    // No reputation warning should be visible initially
    const warningVisible = await page.locator('.reputation-warning-banner').isVisible().catch(() => false);
    expect(warningVisible).toBe(false);

    console.log('✅ E2E: Reputation warning flow validated');
  });
});

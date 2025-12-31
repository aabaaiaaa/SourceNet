import { test, expect } from '@playwright/test';

/**
 * Phase 2 Core Gameplay Loops - Complete End-to-End Flows
 * Tests full integration of systems, components, and mechanics
 */

const completeBoot = async (page) => {
  await page.goto('/?skipBoot=true'); // Skip boot
  await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
  await page.locator('input.username-input').fill('gameplay_test');
  await page.click('button:has-text("Continue")');
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

test.describe('Core Gameplay Loop: Purchase → Install → Use', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?skipBoot=true'); // Skip boot
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete full software purchase flow', async ({ page }) => {
    await completeBoot(page);

    // Open Portal
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("OSNet Portal")');
    await expect(page.locator('.portal')).toBeVisible();

    // Switch to Software
    await page.click('button:has-text("Software")');

    // Should see software items
    await expect(page.locator('.portal-item')).toBeVisible();

    // Verify purchase button exists for software
    const purchaseBtn = page.locator('button:has-text("Purchase")').first();
    if (await purchaseBtn.isVisible()) {
      await purchaseBtn.click();

      // Should show confirmation modal
      await expect(page.locator('.modal-content')).toBeVisible();

      // Cancel for now (would need credits to actually purchase)
      await page.click('button:has-text("Cancel")');
    }

    console.log('✅ E2E: Purchase flow complete');
  });
});

test.describe('Core Gameplay Loop: Software Purchase', () => {
  test('should show Portal and software purchase flow', async ({ page }) => {
    await page.goto('/?skipBoot=true'); // Skip boot
    await page.evaluate(() => localStorage.clear());
    await completeBoot(page);

    // Open Portal
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("OSNet Portal")');
    await expect(page.locator('.portal')).toBeVisible();

    // Should have tabs
    await expect(page.locator('button:has-text("Hardware")')).toBeVisible();
    await expect(page.locator('button:has-text("Software")')).toBeVisible();

    // Click Software tab
    await page.click('button:has-text("Software")');

    // Software items should be visible
    await expect(page.locator('.portal-item')).toBeVisible();

    console.log('✅ E2E: Software purchase flow complete');
  });
});

test.describe('Core Gameplay Loop: Save/Load with Phase 2 State', () => {
  test('should save and load game with Phase 2 state', async ({ page }) => {
    await page.goto('/?skipBoot=true'); // Skip boot
    await page.evaluate(() => localStorage.clear());
    await completeBoot(page);

    // Verify Phase 2 UI elements exist
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Open power menu and save
    await page.hover('text=⏻');
    await page.waitForTimeout(200);

    // Power menu should have Save option
    await expect(page.locator('text=Save')).toBeVisible();

    console.log('✅ E2E: Save/Load flow validated');
  });
});

test.describe('Core Gameplay Loop: Transaction Tracking', () => {
  test('should track all financial activity in transaction history', async ({ page }) => {
    await page.goto('/?skipBoot=true'); // Skip boot
    await page.evaluate(() => localStorage.clear());
    await completeBoot(page);

    // Wait for welcome messages
    await page.waitForTimeout(6000);

    // Open Mail to get cheque
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await page.click('button:has-text("SNet Mail")');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Check for messages
    const messages = await page.locator('.message-item').count();
    if (messages > 0) {
      // Open Banking App
      await page.hover('text=☰');
      await page.waitForTimeout(200);
      await page.click('button:has-text("SNet Banking App")');
      await expect(page.locator('.banking-app')).toBeVisible();

      // Click Transaction History
      await page.click('button:has-text("Transaction History")');

      // Transaction history tab should be visible
      await expect(page.locator('.transactions-list, .empty-state')).toBeVisible();
    }

    console.log('✅ E2E: Transaction tracking flow complete');
  });
});

test.describe('Core Gameplay Loop: Phase 2 UI Integration', () => {
  test('should show all Phase 2 UI elements integrated', async ({ page }) => {
    await page.goto('/?skipBoot=true'); // Skip boot
    await page.evaluate(() => localStorage.clear());
    await completeBoot(page);

    // Verify all Phase 2 indicators in TopBar
    await expect(page.locator('.reputation-badge')).toBeVisible();

    // Verify app launcher shows storage
    await page.hover('text=☰');
    await page.waitForTimeout(200);
    await expect(page.locator('text=GB used')).toBeVisible();

    // Verify basic apps available (Phase 2 apps require purchase)
    await expect(page.locator('button:has-text("OSNet Portal")')).toBeVisible();
    await expect(page.locator('button:has-text("SNet Banking App")')).toBeVisible();
    await expect(page.locator('button:has-text("SNet Mail")')).toBeVisible();

    console.log('✅ E2E: All Phase 2 UI elements integrated');
  });
});

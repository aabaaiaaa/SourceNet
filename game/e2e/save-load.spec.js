import { test, expect } from '@playwright/test';

test.describe('E2E Test 3: Save/Load Cycle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should save game state and restore it correctly', async ({ page }) => {
    await page.goto('/');

    // Complete boot and username
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'save_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for messages and deposit cheque
    await page.waitForTimeout(4000);
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await page.click('.message-item:has-text("Welcome")');
    await page.click('button:has-text("Back")');

    await page.waitForTimeout(4000);
    await page.click('.message-item:has-text("Hi from your manager")');
    await page.click('.attachment-item');
    await page.click('.account-select-btn');

    // Verify 1000 credits
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    // Save game with dialog mocking
    page.on('dialog', (dialog) => dialog.accept('SaveTest1'));

    await page.hover('text=⏻');
    await page.click('text=Save');

    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();

    // Verify login screen
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-item:has-text("save_test")')).toBeVisible();

    // Load save
    await page.click('.save-item:has-text("save_test") button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify credits persisted
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible();

    console.log('✅ E2E Test 3: Save/Load Cycle - PASS');
  });
});

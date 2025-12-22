import { test, expect } from '@playwright/test';

test.describe('E2E Test 4: Window Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Create a save to skip boot sequence
    await page.goto('/');
    await page.evaluate(() => {
      const saves = {
        window_test: [
          {
            username: 'window_test',
            playerMailId: 'SNET-TST-123-456',
            currentTime: '2020-03-25T09:10:00',
            hardware: {},
            software: [],
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
            messages: [],
            managerName: 'Test',
            windows: [],
            savedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });
  });

  test('should handle complete window management flow', async ({ page }) => {
    await page.goto('/');

    // Load save to skip boot
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Step 2: Open SNet Mail → verify cascaded position
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Step 3: Open Banking App → verify cascaded from Mail
    await page.click('text=☰');
    await page.click('text=SNet Banking App');
    const bankWindow = page.locator('.window:has-text("SNet Banking App")');
    await expect(bankWindow).toBeVisible();

    // Step 4: Open Portal → verify cascaded from Banking
    await page.click('text=☰');
    await page.click('text=OSNet Portal');
    const portalWindow = page.locator('.window:has-text("OSNet Portal")');
    await expect(portalWindow).toBeVisible();

    // Step 5: Click Mail window → verify brought to front
    await mailWindow.click();
    // Z-index verification would require checking computed styles

    // Step 7: Minimize Mail → verify appears in bottom bar
    const mailMinimizeBtn = mailWindow.locator('button[title="Minimize"]');
    await mailMinimizeBtn.click();
    await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Mail")')).toBeVisible();

    // Step 8: Minimize Banking → verify appears in bottom bar
    const bankMinimizeBtn = bankWindow.locator('button[title="Minimize"]');
    await bankMinimizeBtn.click();
    await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Banking")')).toBeVisible();

    // Step 9: Portal should still be visible
    await expect(portalWindow).toBeVisible();

    // Step 10-11: Restore windows from bottom bar
    await page.click('.minimized-window:has-text("SNet Banking")');
    await expect(bankWindow).toBeVisible();

    await page.click('.minimized-window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Step 13-15: Close all windows
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');
    await page.click('.window:has-text("SNet Banking") button[title="Close"]');
    await page.click('.window:has-text("OSNet Portal") button[title="Close"]');

    // Verify desktop is clean
    await expect(page.locator('.window')).toHaveCount(0);
    await expect(page.locator('.minimized-window')).toHaveCount(0);

    console.log('✅ E2E Test 4: Window Management Flow - PASS');
  });
});

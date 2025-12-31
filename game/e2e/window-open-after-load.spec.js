import { test, expect } from '@playwright/test';

test.describe('Window Opening After Load Bug', () => {
  test('should open Mail window after loading a save', async ({ page }) => {
    // Go to app and clear storage
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Complete boot and username
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'test_user');
    await page.click('button:has-text("Continue")');

    // Wait for desktop
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open Mail window
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Close Mail window (this is what happens in complete gameplay test)
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');
    await expect(page.locator('.window:has-text("SNet Mail")')).not.toBeVisible();

    // Open Banking and Portal windows (like in complete gameplay test)
    await page.click('text=☰');
    await page.click('text=SNet Banking App');
    await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();

    await page.click('text=☰');
    await page.click('text=OSNet Portal');
    await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

    // Test clicking topbar credits (this happens in complete gameplay test)
    await page.click('.topbar-credits');

    // Test hovering notifications (this happens in complete gameplay test)
    await page.hover('text=✉');
    await page.hover('text=💳');

    // Save the game with Banking and Portal windows open
    page.once('dialog', (dialog) => dialog.accept('TestSave'));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(1000);

    // Reload to get back to login
    await page.reload();
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Load the save
    await page.click('button:has-text("Load")');

    // Wait for boot and desktop
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

    // Try to open Mail after loading - this tests the bug fix
    await page.click('text=☰');
    await page.waitForTimeout(500);
    await page.click('text=SNet Mail');

    // Verify Mail window opens successfully after load
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible({ timeout: 5000 });
  });
});

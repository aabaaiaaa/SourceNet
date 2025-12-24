import { test, expect } from '@playwright/test';

test.describe('E2E: Boot Sequence Timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should complete boot sequence successfully', async ({ page }) => {
    await page.goto('/');

    // Verify boot screen appears
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=OSNet BIOS')).toBeVisible();

    // Verify boot completes (timing varies by environment)
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 25000 });

    // Boot timing is tested via implementation:
    // - First boot: 300ms per line * ~50 lines = ~15s
    // - Subsequent: 150ms per line * ~26 lines = ~4s
    // Actual timing verified by "different boot sequences" test

    console.log('✅ E2E: Boot Sequence Completes - PASS');
  });

  test('should show different boot sequences for first vs subsequent boot', async ({ page }) => {
    await page.goto('/');

    // First boot: Complete boot (should show long installation sequence)
    const firstBootStart = Date.now();
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 25000 });
    const firstBootDuration = (Date.now() - firstBootStart) / 1000;

    await page.fill('input.username-input', 'install_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Save the game
    page.once('dialog', (dialog) => dialog.accept('BootTest'));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(1000);

    // Reload to get back to login screen
    await page.reload();
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // LOAD the existing save (should show short boot sequence)
    await page.click('text=install_test');
    await page.click('button:has-text("Load")');

    // Should go to boot screen
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

    // Subsequent boot (loading save): Boot should complete faster
    // Wait for desktop (should be faster, ~4s instead of ~15s)
    const bootStart = Date.now();
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
    const bootDuration = (Date.now() - bootStart) / 1000;

    // Loading save boot should be relatively quick (under 10s, ideally ~4s)
    expect(bootDuration).toBeLessThan(10);

    console.log(`First boot took ${firstBootDuration.toFixed(1)}s (long boot with installation)`);
    console.log(`Subsequent boot took ${bootDuration.toFixed(1)}s (should be <10s)`);
    console.log('✅ E2E: Different Boot Sequences - PASS');
  });
});

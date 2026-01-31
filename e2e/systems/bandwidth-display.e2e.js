import { test, expect } from '@playwright/test';

/**
 * Bandwidth Display E2E Tests
 * Tests the TopBar bandwidth indicator showing adapter speed and active operations
 */

/**
 * Complete boot sequence and get to desktop
 */
const completeBoot = async (page, username = 'bandwidth_test') => {
  await page.goto('/?debug=true&skipBoot=true');
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
  await page.locator('input.username-input').fill(username);
  await page.click('button:has-text("Continue")');
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

/**
 * Set credits using debug panel
 */
const setCreditsViaDebug = async (page, credits = 1000) => {
  await page.keyboard.press('Control+d');
  await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });
  await page.click('.debug-tab:has-text("State Controls")');
  await expect(page.locator('[data-testid="debug-credits-input"]')).toBeVisible();
  await page.fill('[data-testid="debug-credits-input"]', String(credits));
  await page.click('[data-testid="debug-set-credits"]');
  await page.keyboard.press('Escape');
  await expect(page.locator('.debug-panel')).not.toBeVisible();
};

/**
 * Open Portal Software tab
 */
const openPortalSoftware = async (page) => {
  await page.hover('text=☰');
  // Wait for menu to appear instead of fixed timeout
  await expect(page.locator('.app-launcher-menu')).toBeVisible();
  await page.click('button:has-text("OSNet Portal")');
  await expect(page.locator('.portal')).toBeVisible();
  await page.click('button:has-text("Software")');
  await expect(page.locator('.portal-item').first()).toBeVisible();
};

/**
 * Purchase software to trigger download
 */
const purchaseSoftware = async (page) => {
  const purchasableItem = page.locator('.portal-item:has(button:has-text("Purchase"))').first();
  await expect(purchasableItem).toBeVisible();
  await purchasableItem.locator('button:has-text("Purchase")').click();

  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.locator('button:has-text("Confirm Purchase")').click();
  // Wait for modal to close
  await expect(modal).not.toBeVisible();
};

test.describe('Bandwidth Display - Downloads', () => {
  test('should show download icon and speed during software download', async ({ page }) => {
    await completeBoot(page, 'bw_download_test');
    await setCreditsViaDebug(page, 1000);
    await openPortalSoftware(page);

    // Bandwidth indicator should show idle state initially
    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await expect(bandwidthIndicator).toContainText('○');

    // Purchase software to start download
    await purchaseSoftware(page);

    // Bandwidth indicator should now show active icon (with auto-retry)
    await expect(bandwidthIndicator).toContainText('⬇', { timeout: 5000 });

    // Speed should be displayed
    const speedElement = page.locator('.bandwidth-speed');
    await expect(speedElement).toBeVisible();

    console.log('Download icon and speed visible during download');
  });

  test('should show shared bandwidth with multiple concurrent downloads', async ({ page }) => {
    await completeBoot(page, 'bw_multi_download');
    await setCreditsViaDebug(page, 5000);
    await openPortalSoftware(page);

    // Purchase first software
    await purchaseSoftware(page);

    // Wait for speed element to be visible and have a value
    const speedElement = page.locator('.bandwidth-speed');
    await expect(speedElement).toBeVisible({ timeout: 5000 });

    // Wait for speed to stabilize with a numeric value
    await expect(speedElement).toHaveText(/\d+\.\d+/, { timeout: 5000 });
    const initialSpeed = await speedElement.textContent();
    const initialSpeedNum = parseFloat(initialSpeed);

    // Purchase second software (if available)
    const secondPurchasable = page.locator('.portal-item:has(button:has-text("Purchase"))').first();
    if (await secondPurchasable.isVisible()) {
      await secondPurchasable.locator('button:has-text("Purchase")').click();
      const modal = page.locator('.modal-content');
      await expect(modal).toBeVisible();
      await modal.locator('button:has-text("Confirm Purchase")').click();
      await expect(modal).not.toBeVisible();

      // Wait for speed to change (should be less than initial due to sharing)
      // Use a function matcher to wait for the speed to decrease
      await expect(async () => {
        const newSpeed = await speedElement.textContent();
        const newSpeedNum = parseFloat(newSpeed);
        expect(newSpeedNum).toBeLessThan(initialSpeedNum);
      }).toPass({ timeout: 5000 });

      const newSpeed = await speedElement.textContent();
      console.log(`Speed reduced from ${initialSpeed} to ${newSpeed} with concurrent download`);
    } else {
      console.log('Only one purchasable item available, skipping concurrent test');
    }
  });

  test('should revert to idle after download completes', async ({ page }) => {
    await completeBoot(page, 'bw_complete_test');
    await setCreditsViaDebug(page, 1000);
    await openPortalSoftware(page);
    await purchaseSoftware(page);

    const bandwidthIndicator = page.locator('.topbar-bandwidth');

    // Should show active
    await expect(bandwidthIndicator).toContainText('⬇', { timeout: 5000 });

    // Speed up to complete download
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));

    // Wait for download to complete (widget disappears)
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).not.toBeVisible({ timeout: 15000 });

    // Reset time speed
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));

    // Bandwidth indicator should return to idle
    await expect(bandwidthIndicator).toContainText('○', { timeout: 5000 });

    console.log('Bandwidth indicator reverted to idle after download');
  });
});

test.describe('Bandwidth Display - Preview Values', () => {
  test('should show adapter speed in Mbps in preview', async ({ page }) => {
    await completeBoot(page, 'bw_preview_adapter');

    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // Should show adapter speed in Mbps
    await expect(preview).toContainText('Adapter: 250 Mbps');

    console.log('Adapter speed displayed in Mbps');
  });

  test('should show correct max bandwidth for current adapter in MB/s', async ({ page }) => {
    await completeBoot(page, 'bw_preview_max');

    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // 250 Mbps = 31.25 MB/s, displayed as 31.3
    await expect(preview).toContainText('Max: 31.3 MB/s');

    console.log('Max bandwidth displayed in MB/s');
  });

  test('should show current speed during operation', async ({ page }) => {
    await completeBoot(page, 'bw_preview_current');
    await setCreditsViaDebug(page, 1000);
    await openPortalSoftware(page);
    await purchaseSoftware(page);

    // Wait for bandwidth indicator to show active state first
    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await expect(bandwidthIndicator).toContainText('⬇', { timeout: 5000 });

    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // Should show current speed matching single operation speed
    await expect(preview).toContainText('Current: 31.3 MB/s');

    console.log('Current speed displayed during operation');
  });

  test('should show accurate active operation count', async ({ page }) => {
    await completeBoot(page, 'bw_preview_count');
    await setCreditsViaDebug(page, 1000);
    await openPortalSoftware(page);
    await purchaseSoftware(page);

    // Wait for bandwidth indicator to show active state first
    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await expect(bandwidthIndicator).toContainText('⬇', { timeout: 5000 });

    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // Should show 1 active operation
    await expect(preview).toContainText('Active Operations: 1');

    console.log('Active operation count displayed correctly');
  });

  test('should show both Mbps and MB/s to help player understand conversion', async ({ page }) => {
    await completeBoot(page, 'bw_preview_both');

    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // Both Mbps (adapter) and MB/s (max/current) should be visible
    await expect(preview).toContainText('Mbps');
    await expect(preview).toContainText('MB/s');

    console.log('Both Mbps and MB/s shown in preview');
  });
});

test.describe('Bandwidth Display - Adapter Warning', () => {
  test('should not show warning when not connected to fast network', async ({ page }) => {
    await completeBoot(page, 'bw_no_warning');

    const bandwidthIndicator = page.locator('.topbar-bandwidth');
    await bandwidthIndicator.hover();

    const preview = page.locator('.bandwidth-preview');
    await expect(preview).toBeVisible();

    // No adapter warning should appear (not connected to any VPN)
    await expect(preview.locator('.bandwidth-limited')).not.toBeVisible();

    console.log('No adapter warning when not connected to fast network');
  });
});

test.describe('Bandwidth Display - File Operations', () => {
  test('should show active indicator during file operations registered via context', async ({ page }) => {
    await completeBoot(page, 'bw_file_op');

    const bandwidthIndicator = page.locator('.topbar-bandwidth');

    // Should be idle initially
    await expect(bandwidthIndicator).toContainText('○');

    // Register a bandwidth operation directly (simulating file copy)
    await page.evaluate(() => {
      window.gameContext.registerBandwidthOperation('file_copy', 50, { filename: 'test.dat' });
    });

    // Should show active icon (with auto-retry)
    await expect(bandwidthIndicator).toContainText('⬇', { timeout: 5000 });

    console.log('Bandwidth indicator active during file operation');
  });

  test('should share bandwidth during concurrent file operations', async ({ page }) => {
    await completeBoot(page, 'bw_concurrent_ops');

    // Register first operation
    await page.evaluate(() => {
      window.gameContext.registerBandwidthOperation('file_copy', 50, { id: 'op1' });
    });

    const speedElement = page.locator('.bandwidth-speed');
    await expect(speedElement).toBeVisible({ timeout: 5000 });

    // Wait for speed to have a numeric value
    await expect(speedElement).toHaveText(/\d+\.\d+/, { timeout: 5000 });
    const singleOpSpeed = await speedElement.textContent();
    const singleOpSpeedNum = parseFloat(singleOpSpeed);

    // Register second operation
    await page.evaluate(() => {
      window.gameContext.registerBandwidthOperation('file_copy', 50, { id: 'op2' });
    });

    // Wait for speed to decrease (bandwidth sharing)
    await expect(async () => {
      const dualOpSpeed = await speedElement.textContent();
      const dualOpSpeedNum = parseFloat(dualOpSpeed);
      expect(dualOpSpeedNum).toBeCloseTo(singleOpSpeedNum / 2, 0);
    }).toPass({ timeout: 5000 });

    const dualOpSpeed = await speedElement.textContent();
    console.log(`Speed reduced from ${singleOpSpeed} to ${dualOpSpeed} with concurrent operations`);
  });
});

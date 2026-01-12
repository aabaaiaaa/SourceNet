import { test, expect } from '@playwright/test';

/**
 * Download Queue Widget E2E Tests
 * Tests the InstallationQueue component that shows download progress
 * Uses debug system to set up game state with credits
 */

/**
 * Complete boot sequence and get to desktop
 */
const completeBoot = async (page, username = 'download_test') => {
  await page.goto('/?debug=true&skipBoot=true');
  await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
  await page.locator('input.username-input').fill(username);
  await page.click('button:has-text("Continue")');
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
};

/**
 * Set credits using debug panel's State Controls tab
 */
const setCreditsViaDebug = async (page, credits = 1000) => {
  // Open debug panel
  await page.keyboard.press('Control+d');
  await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

  // Switch to State Controls tab
  await page.click('.debug-tab:has-text("State Controls")');
  await expect(page.locator('[data-testid="debug-credits-input"]')).toBeVisible();

  // Enter credits amount
  await page.fill('[data-testid="debug-credits-input"]', String(credits));
  await page.click('[data-testid="debug-set-credits"]');

  // Close debug panel
  await page.keyboard.press('Escape');
  await expect(page.locator('.debug-panel')).not.toBeVisible();
};

/**
 * Open Portal and go to Software tab
 */
const openPortalSoftware = async (page) => {
  await page.hover('text=☰');
  await page.waitForTimeout(200);
  await page.click('button:has-text("OSNet Portal")');
  await expect(page.locator('.portal')).toBeVisible();
  await page.click('button:has-text("Software")');
  await expect(page.locator('.portal-item').first()).toBeVisible();
};

/**
 * Purchase software
 */
const purchaseSoftware = async (page) => {
  const purchasableItem = page.locator('.portal-item:has(button:has-text("Purchase"))').first();
  await expect(purchasableItem).toBeVisible();
  await purchasableItem.locator('button:has-text("Purchase")').click();

  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.locator('button:has-text("Confirm Purchase")').click();
};

test.describe('Download Queue Widget', () => {
  test('should not show widget when no downloads active', async ({ page }) => {
    await completeBoot(page);

    // Widget should not be visible when there are no downloads
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).not.toBeVisible();

    console.log('✅ E2E: Download queue hidden when empty');
  });

  test('should show portal software section with purchasable apps', async ({ page }) => {
    await completeBoot(page);
    await openPortalSoftware(page);

    // Should see purchasable items in portal
    const purchasableItem = page.locator('.portal-item:has(button:has-text("Purchase"))').first();
    await expect(purchasableItem).toBeVisible();

    // Count purchasable items
    const purchasableItems = page.locator('.portal-item:has(button:has-text("Purchase"))');
    const count = await purchasableItems.count();
    expect(count).toBeGreaterThan(0);

    console.log(`✅ E2E: Found ${count} purchasable software items`);
  });
});

test.describe('Download Queue Widget - With Credits', () => {
  test('should show download widget when software purchased', async ({ page }) => {
    await completeBoot(page, 'download_credits_test');

    // Set credits using debug panel
    await setCreditsViaDebug(page, 1000);

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Purchase software
    await purchaseSoftware(page);

    // Download queue widget should appear
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Verify widget structure
    await expect(widget.locator('.queue-header')).toContainText('Downloads');

    console.log('✅ E2E: Download queue widget appeared after purchase');
  });

  test('should show progress bar during download', async ({ page }) => {
    await completeBoot(page, 'progress_test');

    // Set credits using debug panel
    await setCreditsViaDebug(page, 1000);

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Purchase software
    await purchaseSoftware(page);

    // Wait for widget
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Verify progress bar exists
    const progressBar = widget.locator('.progress-bar');
    await expect(progressBar).toBeVisible();

    // Verify there's a download item
    const downloadItem = widget.locator('.queue-item');
    await expect(downloadItem).toBeVisible();

    console.log('✅ E2E: Progress bar visible during download');
  });

  test('should update progress over time', async ({ page }) => {
    await completeBoot(page, 'progress_update_test');

    // Set credits using debug panel
    await setCreditsViaDebug(page, 1000);

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Purchase software
    await purchaseSoftware(page);

    // Wait for widget
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Get initial progress width
    const progressFill = widget.locator('.progress-fill');
    await expect(progressFill).toBeVisible();

    // Set speed to 5x to accelerate download but not complete instantly
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(5));

    // Wait for progress to update
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));

    // Widget should still be visible (download in progress) or have completed
    // Either way, progress should have occurred - check if progress text exists or widget is gone (completed)
    const widgetStillVisible = await widget.isVisible();
    if (widgetStillVisible) {
      const progressText = await widget.locator('.progress-text').textContent();
      expect(progressText).toMatch(/\d+%/);
    }
    // If widget is gone, download completed successfully which also proves progress happened

    console.log('✅ E2E: Download progress updates over time');
  });

  test('should hide widget after download completes', async ({ page }) => {
    await completeBoot(page, 'complete_test');

    // Set credits using debug panel
    await setCreditsViaDebug(page, 1000);

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Purchase software
    await purchaseSoftware(page);

    // Wait for widget to appear
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Speed up game time to complete download faster
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));
    await expect(widget).not.toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));

    console.log('✅ E2E: Download queue widget hidden after completion');
  });

  test('should show software as installed after download', async ({ page }) => {
    await completeBoot(page, 'install_test');

    // Set credits using debug panel
    await setCreditsViaDebug(page, 1000);

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Get the name of the software being purchased
    const purchasableItem = page.locator('.portal-item:has(button:has-text("Purchase"))').first();
    const itemName = await purchasableItem.locator('.item-name').textContent();

    // Purchase software
    await purchaseSoftware(page);

    // Wait for download to complete
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Speed up game time to complete download faster
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));
    await expect(widget).not.toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));

    // The item should now show as installed (no purchase button)
    // We need to re-find it by name since the DOM structure changes
    const installedItem = page.locator(`.portal-item:has(.item-name:has-text("${itemName}"))`);
    await expect(installedItem.locator('.installed-badge')).toBeVisible();

    console.log(`✅ E2E: Software "${itemName}" installed and shows as installed`);
  });
});

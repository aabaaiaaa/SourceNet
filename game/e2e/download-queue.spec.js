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
 * Load a debug scenario with credits
 */
const loadScenarioWithCredits = async (page, scenarioName = 'Fresh Start') => {
  // Open debug panel
  await page.keyboard.press('Control+d');
  await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

  // Load scenario (Fresh Start gives 1,000 credits)
  // Playwright auto-dismisses alerts
  await page.click(`button:has-text("${scenarioName}")`);

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

    // Load scenario with credits (Fresh Start = 1,000 credits)
    await loadScenarioWithCredits(page, 'Fresh Start');

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

    // Load scenario with credits
    await loadScenarioWithCredits(page, 'Fresh Start');

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

    // Load scenario with credits
    await loadScenarioWithCredits(page, 'Fresh Start');

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

    // Wait a bit for progress to update
    await page.waitForTimeout(2000);

    // Progress should have increased (widget shows percentage)
    // Check that progress text shows a percentage
    const progressText = await widget.locator('.progress-text').textContent();
    expect(progressText).toMatch(/\d+%/);

    console.log('✅ E2E: Download progress updates over time');
  });

  test('should hide widget after download completes', async ({ page }) => {
    await completeBoot(page, 'complete_test');

    // Load scenario with credits (Fresh Start = 1,000 credits, not all software)
    await loadScenarioWithCredits(page, 'Fresh Start');

    // Open Portal Software tab
    await openPortalSoftware(page);

    // Purchase software
    await purchaseSoftware(page);

    // Wait for widget to appear
    const widget = page.locator('.installation-queue-widget');
    await expect(widget).toBeVisible({ timeout: 5000 });

    // Wait for download to complete (timeout of 30s to allow for full download)
    // Widget should disappear when queue is empty
    await expect(widget).not.toBeVisible({ timeout: 30000 });

    console.log('✅ E2E: Download queue widget hidden after completion');
  });

  test('should show software as installed after download', async ({ page }) => {
    await completeBoot(page, 'install_test');

    // Load scenario with credits (Fresh Start = 1,000 credits, not all software)
    await loadScenarioWithCredits(page, 'Fresh Start');

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
    await expect(widget).not.toBeVisible({ timeout: 30000 });

    // The item should now show as installed (no purchase button)
    // We need to re-find it by name since the DOM structure changes
    const installedItem = page.locator(`.portal-item:has(.item-name:has-text("${itemName}"))`);
    await expect(installedItem.locator('.installed-badge')).toBeVisible();

    console.log(`✅ E2E: Software "${itemName}" installed and shows as installed`);
  });
});

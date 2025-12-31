import { test, expect } from '@playwright/test';

test.describe('E2E Test 5: App Interactions Flow', () => {
  test('should handle complete app interaction flow', async ({ page }) => {
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());

    // Complete boot sequence quickly
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'app_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Step 2-3: Hover over App Launcher → verify menu appears
    await page.hover('text=☰');
    await expect(page.locator('text=OSNet Portal')).toBeVisible();
    await expect(page.locator('text=SNet Banking App')).toBeVisible();
    await expect(page.locator('text=SNet Mail')).toBeVisible();

    // Verify alphabetical order (now 8 apps instead of 3)
    const menuItems = await page.locator('.app-launcher-menu button').allTextContents();
    expect(menuItems.length).toBe(8); // 3 Phase 1 + 5 Phase 2 apps
    // Verify apps are alphabetically sorted
    const sortedItems = [...menuItems].sort();
    expect(menuItems).toEqual(sortedItems);

    // Step 4: Click "SNet Mail" → verify opens
    await page.click('.app-launcher-menu button:has-text("SNet Mail")');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Step 6-7: Hover over mail notification and click
    await page.waitForTimeout(4000); // Wait for first message
    await page.hover('text=✉');
    await page.click('text=✉');

    // Step 8-11: Read and archive Message 1
    await page.click('.message-item:has-text("Welcome to SourceNet!")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Click Archive button in message view
    await page.click('.archive-button');

    // Should automatically go back to inbox
    // Switch to Archive tab to verify
    await page.click('.tab:has-text("Archive")');

    // Verify message in Archive tab
    await expect(page.locator('.message-item:has-text("Welcome to SourceNet!")')).toBeVisible();

    // Switch back to Inbox
    await page.click('.tab:has-text("Inbox")');

    // Step 12-14: Wait for and deposit cheque
    await page.waitForTimeout(5000); // Wait for second message after reading first
    await page.click('.message-item:has-text("Hi from your manager")');
    await page.click('.attachment-item');

    // Banking app should open with deposit prompt
    await expect(page.locator('text=Cheque Deposit')).toBeVisible();
    await page.click('.account-select-btn:has-text("First Bank Ltd")');

    // Step 15: Hover over bank notification
    await page.hover('text=💳');
    await expect(page.locator('text=First Bank Ltd: 1000 credits')).toBeVisible();

    // Step 16-20: Open Portal and browse
    await page.click('text=☰');
    await page.click('text=OSNet Portal');

    const portalWindow = page.locator('.window:has-text("OSNet Portal")');
    await expect(portalWindow).toBeVisible();

    // Browse to Software section
    await page.click('button:has-text("Software")');
    await expect(page.locator('.item-name:has-text("SourceNet VPN Client")')).toBeVisible();
    await expect(page.locator('.unavailable-badge:has-text("Coming Soon")')).toBeVisible();

    // Step 21: Close all apps
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');
    await page.click('.window:has-text("SNet Banking") button[title="Close"]');
    await page.click('.window:has-text("OSNet Portal") button[title="Close"]');

    console.log('✅ E2E Test 5: App Interactions - PASS');
  });
});

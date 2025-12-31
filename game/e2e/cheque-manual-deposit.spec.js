import { test, expect } from '@playwright/test';

test.describe('Cheque Manual Deposit', () => {
  test('should only show deposit prompt when user clicks attachment, not auto-deposit', async ({ page }) => {
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Complete boot
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'cheque_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for first message
    await page.waitForTimeout(4000);

    // Open Mail and read first message (triggers second message)
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
    await page.click('.message-item:has-text("Welcome to SourceNet!")');
    await expect(page.locator('.message-view')).toBeVisible();
    await page.click('button:has-text("Back")');

    // Wait for second message to arrive
    await page.waitForTimeout(4000);
    await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible();

    // Close Mail
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');

    // CRITICAL TEST: Open Banking app BEFORE clicking cheque attachment
    await page.click('text=☰');
    await page.click('text=SNet Banking App');
    await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();

    // Banking should show accounts but NO deposit prompt (cheque not clicked yet)
    await expect(page.locator('.accounts-list')).toBeVisible();
    await expect(page.locator('.account-card')).toBeVisible();

    // CRITICAL: Deposit prompt should NOT be visible
    await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();

    // Close Banking
    await page.click('.window:has-text("SNet Banking") button[title="Close"]');

    // NOW open Mail again and click the cheque attachment
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Click second message to view it
    await page.click('.message-item:has-text("Hi from your manager")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Click cheque attachment
    await page.click('.attachment-item');

    // NOW Banking should open with deposit prompt
    await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();
    await expect(page.locator('text=1,000 credits')).toBeVisible();

    // Test Cancel button
    await page.click('.cancel-deposit-btn');
    await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();

    // Click attachment again to retry
    await page.click('.window:has-text("SNet Mail") .window-header');
    await page.click('.attachment-item');

    // Deposit prompt should appear again
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

    // Select account and deposit
    await page.click('.account-select-btn');

    // Prompt should disappear and credits should update
    await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible();

    console.log('✅ Manual Cheque Deposit - PASS');
  });
});

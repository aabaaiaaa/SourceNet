import { test, expect } from '@playwright/test';

test.describe('Cheque Status Update', () => {
  test('should update attachment status to deposited when cheque is deposited', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Complete boot
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'cheque_status_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for first message and read it
    await page.waitForTimeout(4000);
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await page.click('.message-item:has-text("Welcome")');
    await page.click('button:has-text("Back")');

    // Wait for second message with cheque
    await page.waitForTimeout(4000);
    await page.click('.message-item:has-text("Hi from your manager")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Verify attachment shows "Click to deposit"
    await expect(page.locator('.attachment-status:has-text("Click to deposit")')).toBeVisible();

    // Click attachment to initiate deposit
    await page.click('.attachment-item');

    // Banking opens with deposit prompt
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

    // Select account and deposit
    await page.click('.account-select-btn');

    // Wait for deposit to complete
    await page.waitForTimeout(500);

    // CRITICAL: Go back to Mail window (it should still be open)
    await page.click('.window:has-text("SNet Mail") .window-header');

    // Verify attachment now shows "✓ Deposited" instead of "Click to deposit"
    await expect(page.locator('.attachment-status:has-text("✓ Deposited")')).toBeVisible();
    await expect(page.locator('.attachment-status:has-text("Click to deposit")')).not.toBeVisible();

    // Verify attachment has deposited styling (grayed out)
    const attachment = page.locator('.attachment-item.deposited');
    await expect(attachment).toBeVisible();

    console.log('✅ Cheque Status Update - PASS');
  });
});

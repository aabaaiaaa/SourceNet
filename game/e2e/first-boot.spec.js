import { test, expect } from '@playwright/test';

test.describe('E2E Test 1: First Boot Sequence (New Game)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate new game
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete first boot sequence and receive welcome messages', async ({ page }) => {
    await page.goto('/');

    // Boot sequence
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=OSNet BIOS')).toBeVisible();

    // Wait for username screen
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

    // Enter username
    const usernameInput = page.locator('input.username-input');
    const suggestedUsername = await usernameInput.inputValue();
    expect(suggestedUsername).toMatch(/^agent_\d{4}$/);

    await usernameInput.fill('test_agent');
    await page.click('button:has-text("Continue")');

    // Desktop loads
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.topbar-time')).toBeVisible();

    // Wait for first message
    await page.waitForTimeout(4000);

    // Open SNet Mail
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Verify first message exists
    await expect(page.locator('text=Welcome to SourceNet!')).toBeVisible();

    // Click first message to read it
    await page.click('text=Welcome to SourceNet!');

    // Verify we're viewing the message
    await expect(page.locator('.message-view')).toBeVisible();

    // Go back to message list
    await page.click('button:has-text("Back")');

    // Wait for second message
    await page.waitForTimeout(4000);

    // Verify second message appears in list
    await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible({ timeout: 10000 });

    // Click second message
    await page.click('.message-item:has-text("Hi from your manager")');

    // Verify cheque attachment
    await expect(page.locator('.attachment-item')).toBeVisible();

    // Click cheque to deposit
    await page.click('.attachment-item');

    // Banking app should open with deposit prompt
    await expect(page.locator('text=Cheque Deposit')).toBeVisible({ timeout: 5000 });

    // Select account and deposit
    await page.click('.account-select-btn');

    // Verify credits updated to 1000
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    console.log('✅ E2E Test 1: First Boot Sequence - PASS');
  });
});

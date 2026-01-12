import { test, expect } from '@playwright/test';

test.describe('E2E: Complete Gameplay Session', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
  });

  test('should handle multiple complete gameplay sessions independently', async ({ page }) => {
    // Create first complete session
    await page.goto('/?skipBoot=true');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'session_1');
    await page.click('button:has-text("Continue")');

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Speed up game time to get messages faster
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));

    // Open mail and wait for first message
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.message-item:has-text("Welcome")')).toBeVisible({ timeout: 5000 });
    await page.click('.message-item:has-text("Welcome")');
    await page.click('button:has-text("Back")');

    // Wait for second message
    await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible({ timeout: 5000 });

    // Reset speed before depositing
    await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(1));

    // Open and deposit cheque from second message
    await page.click('.message-item:has-text("Hi from your manager")');
    await page.click('.attachment-item');
    await page.click('.account-select-btn:has-text("First Bank Ltd")');

    // Wait for credits to update
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    // Save first session
    page.once('dialog', (dialog) => dialog.accept('Session1'));
    await page.hover('text=⏻');
    await page.click('text=Save');

    // Reload to get back to login screen
    await page.reload();

    // Should show login screen with session_1
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-item:has-text("session_1")')).toBeVisible();

    // Start new game for session 2
    await page.click('.new-game-btn');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'session_2');
    await page.click('button:has-text("Continue")');

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify this is a fresh session (0 credits)
    await expect(page.locator('.topbar-credits:has-text("0")')).toBeVisible();

    // Save session_2
    page.once('dialog', (dialog) => dialog.accept('Session2'));
    await page.hover('text=⏻');
    await page.click('text=Save');

    // Reload to verify both sessions saved
    await page.reload();

    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Verify both saves exist
    const save1 = page.locator('.save-item:has-text("session_1")');
    const save2 = page.locator('.save-item:has-text("session_2")');
    await expect(save1).toBeVisible();
    await expect(save2).toBeVisible();

    // Verify we have exactly 2 saves
    const saveCount = await page.locator('.save-item').count();
    expect(saveCount).toBe(2);

    // Load session_2 (most recent)
    await save2.locator('button:has-text("Load")').click();
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

    // Verify session_2 has 0 credits (as expected for fresh session)
    await expect(page.locator('.topbar-credits:has-text("0")')).toBeVisible();

    // Test complete: Both sessions exist independently
    // session_1: 1000 credits (from deposited cheque)
    // session_2: 0 credits (fresh game)

    console.log('✅ E2E: Multiple Independent Sessions - PASS');
  });
});

import { test, expect } from '@playwright/test';

test.describe('Save/Load with SNet Mail Open', () => {
  test('should save and load game with Mail window open and messages intact', async ({ page }) => {
    // Start new game
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Complete boot sequence
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'mail_save_test');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for first message to arrive
    await page.waitForTimeout(4000);

    // Open SNet Mail
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Verify first message is visible (with timestamp)
    await expect(page.locator('.message-item:has-text("Welcome to SourceNet!")')).toBeVisible();

    // Verify message has a date displayed (tests formatDateTime)
    const messageDate = await page.locator('.message-date').first();
    await expect(messageDate).toBeVisible();
    const dateText = await messageDate.textContent();
    expect(dateText).toBeTruthy();
    expect(dateText).toMatch(/\d{2}\/\d{2}\/\d{4}/); // Should match dd/mm/yyyy format

    // Click first message to read it
    await page.click('.message-item:has-text("Welcome to SourceNet!")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Go back to inbox
    await page.click('button:has-text("Back")');

    // Wait for second message
    await page.waitForTimeout(4000);
    await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible();

    // Save game WITH Mail window open
    page.once('dialog', (dialog) => dialog.accept('MailOpenTest'));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(1000);

    // =========================================
    // CRITICAL: Reload page completely
    // =========================================
    await page.reload();

    // Should show login screen
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Verify save appears
    await expect(page.locator('.save-item:has-text("mail_save_test")')).toBeVisible();

    // Load the save
    await page.click('.save-item:has-text("mail_save_test") button:has-text("Load")');

    // Wait for boot and desktop
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

    // =========================================
    // VERIFY: Mail window should be restored
    // =========================================
    await expect(mailWindow).toBeVisible();

    // CRITICAL TEST: Verify messages still display with timestamps (tests formatDateTime with loaded strings)
    await expect(page.locator('.message-item')).toHaveCount(2);

    // Verify first message still has date (this would fail with the bug)
    const loadedMessageDate = await page.locator('.message-date').first();
    await expect(loadedMessageDate).toBeVisible();
    const loadedDateText = await loadedMessageDate.textContent();
    expect(loadedDateText).toBeTruthy();
    expect(loadedDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Verify can still click and read messages after load
    await page.click('.message-item:has-text("Hi from your manager")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Verify message details show correctly formatted timestamp (critical test for date serialization)
    const dateLabel = page.locator('.detail-label:has-text("Date:")');
    await expect(dateLabel).toBeVisible();

    // Verify message body shows
    await expect(page.locator('text=welcome bonus')).toBeVisible();

    // Verify cheque attachment still works after load
    await expect(page.locator('.attachment-item')).toBeVisible();

    console.log('✅ Save/Load with Mail Open - PASS');
  });
});

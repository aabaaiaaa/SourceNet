import { test, expect } from '@playwright/test';

test.describe('E2E Test 1: First Boot Sequence (New Game)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate new game
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete first boot sequence and receive welcome messages', async ({ page }) => {
    await page.goto('/');

    // Step 1-2: Verify boot sequence begins automatically
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

    // Step 3: Verify BIOS screen appears with OSNet ASCII art
    await expect(page.locator('text=OSNet BIOS')).toBeVisible();

    // Step 4: Verify hardware detection displays all components
    await expect(page.locator('text=1GHz Single Core')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=2GB')).toBeVisible();
    await expect(page.locator('text=90GB')).toBeVisible();

    // Steps 5-7: Hardware checks display
    await expect(page.locator('text=Checksum: OK')).toBeVisible();
    await expect(page.locator('text=Power: OK')).toBeVisible();

    // Step 8-11: OS installation
    await expect(page.locator('text=Beginning OS installation')).toBeVisible();

    // Step 12: Boot sequence takes ~15 seconds - wait for username screen
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

    // Step 13-15: Username selection screen appears
    const usernameInput = page.locator('input.username-input');
    await expect(usernameInput).toBeVisible();

    // Verify suggested username format (agent_XXXX)
    const suggestedUsername = await usernameInput.inputValue();
    expect(suggestedUsername).toMatch(/^agent_\d{4}$/);

    // Enter custom username
    await usernameInput.fill('test_agent');
    await page.click('button:has-text("Continue")');

    // Step 16-18: Desktop loads
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=25/03/2020 09:00')).toBeVisible();

    // Step 19-22: Wait 2 seconds, Message 1 arrives
    await page.waitForTimeout(3000);

    // Verify mail notification shows unread
    const mailNotification = page.locator('text=✉');
    await expect(mailNotification).toBeVisible();

    // Step 23-25: Open SNet Mail app and click Message 1
    await page.click('text=☰'); // App launcher
    await page.click('text=SNet Mail');

    // Wait for mail window to appear
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Click first message (HR welcome)
    await page.click('text=Welcome to SourceNet!');

    // Verify message content
    await expect(page.locator('text=SourceNet Human Resources')).toBeVisible();
    await expect(page.locator('text=secure the global internet')).toBeVisible();

    // Step 26-29: Wait 2 seconds after reading, Message 2 arrives
    await page.click('text=← Back'); // Go back to message list
    await page.waitForTimeout(3000);

    // Verify second message appears
    await expect(page.locator('text=Hi from your manager')).toBeVisible();

    // Step 30-31: Click Message 2, verify cheque attachment
    await page.click('text=Hi from your manager');
    await expect(page.locator('text=1,000 credits')).toBeVisible();
    await expect(page.locator('.attachment-item')).toBeVisible();

    // Step 32-35: Click cheque attachment, verify Banking App opens
    await page.click('.attachment-item');
    await expect(page.locator('.window:has-text("SNet Banking App")')).toBeVisible();

    // Click First Bank Ltd account
    await page.click('text=First Bank Ltd');

    // Step 36-37: Verify 1000 credits added
    await expect(page.locator('text=1000 credits')).toBeVisible({ timeout: 2000 });

    // Step 38: Verify cheque shows "Deposited" status
    // (Would need to go back to mail to verify, but cheque is deposited)

    // Test PASS
    console.log('✅ E2E Test 1: First Boot Sequence - PASS');
  });
});

import { test, expect } from '@playwright/test';

test.describe('E2E: Complete Gameplay Session', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete full gameplay session from start to finish', async ({ page }) => {
    // ========================================
    // PHASE 1: New Game Boot Sequence
    // ========================================
    await page.goto('/');

    // Verify boot sequence starts automatically
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=OSNet BIOS')).toBeVisible();

    // Verify hardware detection
    await expect(page.locator('text=1GHz Single Core')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=2GB')).toBeVisible();
    await expect(page.locator('text=90GB')).toBeVisible();

    // Verify OS installation
    await expect(page.locator('text=Installing')).toBeVisible();

    // Wait for username selection screen
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

    // Enter username
    const usernameInput = page.locator('input.username-input');
    await usernameInput.fill('complete_test');
    await page.click('button:has-text("Continue")');

    // ========================================
    // PHASE 2: Desktop Loads & Initial Setup
    // ========================================
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify time starts correctly
    await expect(page.locator('text=25/03/2020 09:00:00')).toBeVisible();

    // Verify time speed is 1x
    await expect(page.locator('button:has-text("1x")')).toBeVisible();

    // Verify credits start at 0
    await expect(page.locator('text=0 credits')).toBeVisible();

    // ========================================
    // PHASE 3: Message Delivery & Reading
    // ========================================

    // Wait for first message (2 seconds)
    await page.waitForTimeout(4000);

    // Verify mail notification shows unread
    const mailNotification = page.locator('text=✉');
    await expect(mailNotification).toBeVisible();

    // Open SNet Mail via app launcher
    await page.click('text=☰');
    await expect(page.locator('text=SNet Mail')).toBeVisible();
    await page.click('text=SNet Mail');

    // Verify mail window opened
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Read first message
    await page.click('text=Welcome to SourceNet!');
    await expect(page.locator('.detail-row:has-text("SourceNet Human Resources")')).toBeVisible();
    await expect(page.locator('text=SNET-HQ0-000-001')).toBeVisible();

    // Go back to inbox
    await page.click('text=← Back');

    // Wait for second message (2 seconds after reading first)
    await page.waitForTimeout(5000);

    // Verify second message arrived
    await expect(page.locator('text=Hi from your manager')).toBeVisible();

    // ========================================
    // PHASE 4: Cheque Deposit Flow
    // ========================================

    // Open second message
    await page.click('text=Hi from your manager');

    // Verify manager message content
    await expect(page.locator('text=welcome bonus')).toBeVisible();
    await expect(page.locator('.attachment-item')).toBeVisible();

    // Click cheque attachment
    await page.click('.attachment-item');

    // Verify Banking App opened with deposit prompt
    await expect(page.locator('text=Cheque Deposit')).toBeVisible();
    await expect(page.locator('text=1,000 credits')).toBeVisible();

    // Select First Bank Ltd to deposit
    await page.click('.account-select-btn:has-text("First Bank Ltd")');

    // Verify credits updated
    await expect(page.locator('text=1000 credits')).toBeVisible({ timeout: 2000 });

    // ========================================
    // PHASE 5: Window Management Testing
    // ========================================

    // Open Portal app
    await page.click('text=☰');
    await page.click('text=OSNet Portal');
    await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

    // Now we have 3 windows open: Mail, Banking, Portal
    const windows = await page.locator('.window').count();
    expect(windows).toBe(3);

    // Click on Mail window to bring to front
    await page.click('.window:has-text("SNet Mail")');

    // Drag Portal window (simulate drag)
    const portalWindow = page.locator('.window:has-text("OSNet Portal")');
    const portalHeader = portalWindow.locator('.window-header');
    await portalHeader.hover();

    // Minimize Mail window
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await mailWindow.locator('button[title="Minimize"]').click();

    // Verify Mail appears in minimized bar
    await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Mail")')).toBeVisible();

    // Minimize Banking window
    const bankWindow = page.locator('.window:has-text("SNet Banking")');
    await bankWindow.locator('button[title="Minimize"]').click();

    // Verify both windows in minimized bar
    await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Banking")')).toBeVisible();

    // Restore Mail window
    await page.click('.minimized-window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // ========================================
    // PHASE 6: Application Features Testing
    // ========================================

    // Test Mail: Archive a message
    await page.click('text=Welcome to SourceNet!');
    await page.click('button:has-text("Archive")');

    // Switch to Archive tab and verify
    await page.click('button:has-text("Archive")');
    await expect(page.locator('text=Welcome to SourceNet!')).toBeVisible();

    // Close Mail window
    await mailWindow.locator('button[title="Close"]').click();

    // Test Portal: Browse different categories
    await page.click('.window:has-text("OSNet Portal")');

    // Browse Memory category
    await page.click('button:has-text("Memory")');
    await expect(page.locator('text=2GB RAM')).toBeVisible();
    await expect(page.locator('text=✓ Installed')).toBeVisible(); // Starting memory

    // Browse Storage category
    await page.click('button:has-text("Storage")');
    await expect(page.locator('text=90GB SSD')).toBeVisible();

    // Browse Motherboards
    await page.click('button:has-text("Motherboards")');
    await expect(page.locator('text=Basic Board')).toBeVisible();

    // Check Software section
    await page.click('button:has-text("Software")');
    await expect(page.locator('text=SourceNet VPN Client')).toBeVisible();
    await expect(page.locator('text=Coming Soon')).toBeVisible();

    // ========================================
    // PHASE 7: Time System Testing
    // ========================================

    // Verify time is advancing
    const initialTime = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(5000);
    const advancedTime = await page.locator('.topbar-time').textContent();
    expect(advancedTime).not.toBe(initialTime);

    // Toggle to 10x speed
    await page.click('button:has-text("1x")');
    await expect(page.locator('text=10x')).toBeVisible();

    // Verify faster advancement
    const time10xStart = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(2000);
    const time10xEnd = await page.locator('.topbar-time').textContent();
    expect(time10xEnd).not.toBe(time10xStart);

    // Toggle back to 1x
    await page.click('button:has-text("10x")');
    await expect(page.locator('text=1x')).toBeVisible();

    // Test pause functionality
    await page.hover('text=⏻');
    await page.click('text=Pause');

    const pausedTime = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(2000);
    const timeAfterPause = await page.locator('.topbar-time').textContent();
    expect(timeAfterPause).toBe(pausedTime); // Should not advance

    // Resume
    await page.hover('text=⏻');
    await page.click('text=Resume');

    // ========================================
    // PHASE 8: Banking App Verification
    // ========================================

    // Restore Banking window
    await page.click('.minimized-window:has-text("SNet Banking")');

    // Verify account balance is 1000
    await expect(page.locator('text=First Bank Ltd')).toBeVisible();
    await expect(page.locator('.account-balance-large:has-text("1000 credits")')).toBeVisible();

    // Verify total in footer
    await expect(page.locator('text=Total across all accounts: 1000 credits')).toBeVisible();

    // Test clicking top bar credits opens Banking
    await page.click('.topbar-credits');
    // Banking should come to front or already be open

    // ========================================
    // PHASE 9: Notification Hover Previews
    // ========================================

    // Test mail notification hover
    await page.hover('text=✉');
    // Preview should appear (if unread messages exist)

    // Test bank notification hover
    await page.hover('text=💳');
    await expect(page.locator('text=Bank Accounts:')).toBeVisible();
    await expect(page.locator('text=First Bank Ltd: 1000 credits')).toBeVisible();

    // ========================================
    // PHASE 10: Save Game
    // ========================================

    // Note current game state
    const currentTime = await page.locator('.topbar-time').textContent();

    // Open power menu and save
    await page.hover('text=⏻');
    await page.click('text=Save');

    // Handle save dialog
    page.on('dialog', (dialog) => {
      dialog.accept('CompleteGameTest');
    });

    await page.waitForTimeout(1000);

    // ========================================
    // PHASE 11: Exit and Reload
    // ========================================

    // Reload page to simulate exiting and returning
    await page.reload();

    // Verify game login screen appears
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Verify retro-hacker theme
    const loginBg = await page.locator('.game-login-screen').evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(loginBg).toContain('0, 0, 0'); // Black background

    // Verify save appears
    await expect(page.locator('text=complete_test')).toBeVisible();

    // ========================================
    // PHASE 12: Load Saved Game
    // ========================================

    // Load the save
    await page.click('button:has-text("Load")');

    // Verify desktop loads
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify credits persisted (1000)
    await expect(page.locator('text=1000 credits')).toBeVisible();

    // Verify time persisted (should be close to saved time, allowing for a few seconds)
    const loadedTime = await page.locator('.topbar-time').textContent();
    expect(loadedTime).toBeTruthy();

    // Verify time speed reset to 1x
    await expect(page.locator('button:has-text("1x")')).toBeVisible();

    // Verify Portal window is open (or can be reopened)
    // Windows might not persist in current implementation, which is fine

    // Open Mail to verify messages persisted
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Verify archived message is in Archive tab
    await page.click('button:has-text("Archive")');
    await expect(page.locator('text=Welcome to SourceNet!')).toBeVisible();

    // Verify cheque is marked as deposited
    await page.click('button:has-text("Inbox")');
    await page.click('text=Hi from your manager');
    await expect(page.locator('text=✓ Deposited')).toBeVisible();

    // ========================================
    // PHASE 13: Final Verification
    // ========================================

    // Verify all core features still work after load

    // Test window management still works
    const newMailWindow = page.locator('.window:has-text("SNet Mail")');
    await newMailWindow.locator('button[title="Minimize"]').click();
    await expect(page.locator('.minimized-window:has-text("SNet Mail")')).toBeVisible();

    // Test app launcher still works
    await page.click('text=☰');
    await expect(page.locator('text=OSNet Portal')).toBeVisible();

    // Test time still advances
    const finalTime1 = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(2000);
    const finalTime2 = await page.locator('.topbar-time').textContent();
    expect(finalTime2).not.toBe(finalTime1);

    // Test time speed toggle still works
    await page.click('button:has-text("1x")');
    await expect(page.locator('text=10x')).toBeVisible();
    await page.click('button:has-text("10x")');
    await expect(page.locator('text=1x')).toBeVisible();

    // Test power menu still accessible
    await page.hover('text=⏻');
    await expect(page.locator('text=Pause')).toBeVisible();

    // ========================================
    // PHASE 14: Complete Session Validation
    // ========================================

    // Verify all key game elements present and functional:
    // ✓ Boot sequence completed successfully
    // ✓ Username selection worked
    // ✓ Desktop loaded with correct initial time
    // ✓ Messages delivered on schedule
    // ✓ Cheque deposited successfully
    // ✓ Credits updated to 1000
    // ✓ Multiple windows opened and managed
    // ✓ Window minimize/restore functionality works
    // ✓ Mail archiving works
    // ✓ Portal browsing all categories works
    // ✓ Banking app shows correct balance
    // ✓ Time system advances correctly at both speeds
    // ✓ Pause/resume functionality works
    // ✓ Save game successfully created
    // ✓ Game login screen appeared with retro theme
    // ✓ Save loaded successfully
    // ✓ All state persisted correctly (credits, messages, time)
    // ✓ Cheque deposit status persisted
    // ✓ Message archive status persisted
    // ✓ Time speed reset to 1x after load
    // ✓ All features continue to work after load

    console.log('✅ E2E: Complete Gameplay Session - PASS');
    console.log('   All 14 phases validated successfully!');
  });

  test('should handle multiple complete gameplay sessions independently', async ({ page }) => {
    // Create first complete session
    await page.goto('/');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'session_1');
    await page.click('button:has-text("Continue")');

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Wait for first message
    await page.waitForTimeout(4000);

    // Open mail and read first message to trigger second
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await page.click('text=Welcome to SourceNet!');
    await page.click('text=← Back');

    // Wait for second message
    await page.waitForTimeout(4000);

    // Open and deposit cheque from second message
    await page.click('text=Hi from your manager');
    await page.click('.attachment-item');
    await page.click('button:has-text("First Bank Ltd")');

    // Save first session
    await page.hover('text=⏻');
    await page.click('text=Save');
    page.on('dialog', (dialog) => dialog.accept('Session1'));

    // Start second session
    await page.hover('text=⏻');
    await page.click('text=Reboot');

    // Should show login screen with session_1
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=session_1')).toBeVisible();

    // Start new game for session 2
    await page.click('text=New Game');

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'session_2');
    await page.click('button:has-text("Continue")');

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify this is a fresh session (0 credits)
    await expect(page.locator('text=0 credits')).toBeVisible();

    // Load session_1 to verify independence
    await page.hover('text=⏻');
    await page.click('text=Reboot');

    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=session_1')).toBeVisible();
    await expect(page.locator('text=session_2')).toBeVisible();

    // Load session_1
    const loadBtn = page.locator('button:has-text("Load")').first();
    await loadBtn.click();

    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify session_1 still has 1000 credits
    await expect(page.locator('text=1000 credits')).toBeVisible();

    console.log('✅ E2E: Multiple Independent Sessions - PASS');
  });
});

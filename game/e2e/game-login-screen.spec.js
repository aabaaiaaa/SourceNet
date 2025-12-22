import { test, expect } from '@playwright/test';

test.describe('E2E Test 2: Game Login Screen (Multiple Saves)', () => {
  test('should handle multiple saves and new game creation', async ({ page }) => {
    await page.goto('/');

    // Create first save
    await page.evaluate(() => {
      const saves = {
        agent_1111: [
          {
            username: 'agent_1111',
            currentTime: '2020-03-25T09:00:00',
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 500 }],
            savedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        agent_2222: [
          {
            username: 'agent_2222',
            currentTime: '2020-03-25T10:00:00',
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
            savedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        agent_3333: [
          {
            username: 'agent_3333',
            currentTime: '2020-03-25T11:00:00',
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1500 }],
            savedAt: '2024-01-03T00:00:00.000Z',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    // Step 2: Restart game
    await page.reload();

    // Step 3: Verify Game Login Screen appears
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Step 4: Verify retro-hacker theme
    const loginScreen = page.locator('.game-login-screen');
    const bgColor = await loginScreen.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toContain('0, 0, 0'); // Black background

    // Step 5: Verify all 3 usernames listed
    await expect(page.locator('text=agent_1111')).toBeVisible();
    await expect(page.locator('text=agent_2222')).toBeVisible();
    await expect(page.locator('text=agent_3333')).toBeVisible();

    // Step 6: Verify "New Game" button at bottom
    await expect(page.locator('text=New Game')).toBeVisible();

    // Step 7: Click second username (agent_2222)
    // Find the save item containing agent_2222, then click its Load button
    const save2 = page.locator('.save-item:has-text("agent_2222")');
    await save2.locator('button:has-text("Load")').click();

    // Step 8-9: Verify game loads that save's state
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=1000 credits')).toBeVisible();

    // Step 10: Reboot to login screen
    await page.hover('text=⏻');
    await page.click('text=Reboot');

    // Step 11: Delete first save
    await expect(page.locator('.game-login-screen')).toBeVisible();

    // Handle confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    const save1 = page.locator('.save-item:has-text("agent_1111")');
    await save1.locator('button:has-text("Delete")').click();

    // Step 12: Verify first username removed
    await expect(page.locator('text=agent_1111')).not.toBeVisible();

    // Step 13-14: Click "New Game" and verify boot sequence
    await page.click('text=New Game');
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

    console.log('✅ E2E Test 2: Game Login Screen - PASS');
  });
});

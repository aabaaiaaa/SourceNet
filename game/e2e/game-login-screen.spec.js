import { test, expect } from '@playwright/test';

test.describe('E2E Test 2: Game Login Screen (Multiple Saves)', () => {
  test('should handle multiple saves and new game creation', async ({ page }) => {
    await page.goto('/');

    // Create first save
    await page.evaluate(() => {
      const createSave = (username, balance) => ({
        username,
        playerMailId: `SNET-TST-${username.slice(-4)}-XXX`,
        currentTime: '2020-03-25T09:00:00',
        hardware: {
          cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
          memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
          storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
          motherboard: { id: 'board-basic', name: 'Basic Board' },
          powerSupply: { id: 'psu-300w', wattage: 300 },
          network: { id: 'net-250mb', speed: 250 },
        },
        software: [],
        bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance }],
        messages: [],
        managerName: 'TestManager',
        windows: [],
        savedAt: new Date().toISOString(),
        saveName: username,
      });

      const saves = {
        agent_1111: [createSave('agent_1111', 500)],
        agent_2222: [createSave('agent_2222', 1000)],
        agent_3333: [createSave('agent_3333', 1500)],
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

    // Wait for boot sequence to complete
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });

    // Step 8-9: Verify game loads that save's state
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible();

    // Step 10-11: Go back to login screen to test delete
    // Reload page to get back to login screen
    await page.reload();
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Delete first save
    page.once('dialog', (dialog) => dialog.accept());
    const save1 = page.locator('.save-item:has-text("agent_1111")');
    await save1.locator('button:has-text("Delete")').click();

    // Wait for reload after delete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 12: Verify first username removed
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-item:has-text("agent_1111")')).not.toBeVisible();
    await expect(page.locator('.save-item:has-text("agent_2222")')).toBeVisible();
    await expect(page.locator('.save-item:has-text("agent_3333")')).toBeVisible();

    // Step 13-14: Click "New Game" and verify boot sequence
    await page.click('.new-game-btn');
    await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

    console.log('✅ E2E Test 2: Game Login Screen - PASS');
  });
});

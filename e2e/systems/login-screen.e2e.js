import { test, expect } from '@playwright/test';
import { STARTING_SOFTWARE } from '../../src/constants/gameConstants.js';

test.describe('Login Screen - Load Latest without skipBoot', () => {
  test('should load game using Load Latest button (without skipBoot)', async ({ page }) => {
    // Create save in localStorage
    await page.goto('/?skipBoot=true');
    await page.evaluate((startingSoftware) => {
      const saveData = {
        username: 'test_user',
        playerMailId: 'SNET-TST-USER-XXX',
        currentTime: '2020-03-25T10:30:00.000Z',
        hardware: {
          cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
          memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
          storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
          motherboard: { id: 'board-basic', name: 'Basic Board' },
          powerSupply: { id: 'psu-300w', wattage: 300 },
          network: { id: 'net-250mb', speed: 250 },
        },
        software: startingSoftware,
        bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 500 }],
        messages: [],
        managerName: 'TestManager',
        windows: [],
        savedAt: new Date().toISOString(),
        saveName: 'test_user',
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify({ test_user: [saveData] }));
    }, STARTING_SOFTWARE);

    // Navigate WITHOUT skipBoot to test real flow
    await page.goto('/');

    // Wait for login screen (initial boot detects saves)
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

    // Click Load Latest
    await page.locator('.save-item:has-text("test_user")').locator('button:has-text("Load Latest")').click();

    // Should NOT stay on login screen - should proceed to boot sequence
    await expect(page.locator('.game-login-screen')).not.toBeVisible({ timeout: 5000 });

    // Eventually reach desktop after boot
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('E2E Test 2: Game Login Screen (Multiple Saves)', () => {
  test('should handle multiple saves and new game creation', async ({ page }) => {
    // Use skipBoot to speed up the test
    await page.goto('/?skipBoot=true');

    // Create first save
    await page.evaluate((startingSoftware) => {
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
        software: startingSoftware,
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
    }, STARTING_SOFTWARE);

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

    // Step 5: Verify all 3 usernames listed (use .save-username class to avoid matching saveName)
    await expect(page.locator('.save-username:has-text("agent_1111")')).toBeVisible();
    await expect(page.locator('.save-username:has-text("agent_2222")')).toBeVisible();
    await expect(page.locator('.save-username:has-text("agent_3333")')).toBeVisible();

    // Step 6: Verify "New Game" button at bottom
    await expect(page.locator('text=New Game')).toBeVisible();

    // Step 7: Click second username (agent_2222)
    // Find the save item containing agent_2222, then click its Load button
    const save2 = page.locator('.save-item:has-text("agent_2222")');
    await save2.locator('button:has-text("Load")').click();

    // Step 8-9: Verify game loads that save's state (skipBoot skips boot sequence)
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

    // Step 12: Verify first username removed
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-item:has-text("agent_1111")')).not.toBeVisible();
    await expect(page.locator('.save-item:has-text("agent_2222")')).toBeVisible();
    await expect(page.locator('.save-item:has-text("agent_3333")')).toBeVisible();

    // Step 13-14: Click "New Game" and verify it initiates new game
    await page.click('.new-game-btn');
    // With skipBoot, new game goes to username selection (first boot) or desktop (subsequent)
    // Just verify we're no longer on the login screen
    await expect(page.locator('.game-login-screen')).not.toBeVisible({ timeout: 5000 });

    console.log('✅ E2E Test 2: Game Login Screen - PASS');
  });
});

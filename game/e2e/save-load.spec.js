import { test, expect } from '@playwright/test';

test.describe('E2E Test 3: Save/Load Cycle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
  });

  test('should save game state and restore it correctly', async ({ page }) => {
    // Create a save directly in localStorage
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => {
      const saveData = {
        username: 'save_test',
        playerMailId: 'SNET-TST-123-456',
        currentTime: '2020-03-25T10:30:00.000Z',
        hardware: {
          cpu: { id: 'cpu-1ghz-single', name: '1GHz Single Core', power: 65 },
          memory: [{ id: 'ram-2gb', name: '2GB RAM', power: 3 }],
          storage: [{ id: 'ssd-90gb', name: '90GB SSD', power: 2 }],
          motherboard: { id: 'board-basic', name: 'Basic Board', power: 5 },
          powerSupply: { id: 'psu-300w', name: '300W PSU', wattage: 300 },
          network: { id: 'net-250mb', name: '250Mb Network Card', power: 5 },
        },
        software: [],
        bankAccounts: [
          { id: 'account-first-bank', bankName: 'First Bank Ltd', balance: 1500 },
        ],
        messages: [
          {
            id: 'msg-1',
            from: 'HR',
            fromId: 'SNET-HQ0-000-001',
            subject: 'Welcome',
            read: true,
            archived: true,
          },
          {
            id: 'msg-2',
            from: 'Manager',
            fromId: 'SNET-MGR-ABC-123',
            subject: 'Hello',
            read: true,
            archived: false,
            attachment: { type: 'cheque', amount: 1000, deposited: true },
          },
        ],
        managerName: 'TestManager',
        windows: [],
        savedAt: '2024-01-01T12:00:00.000Z',
        saveName: 'TestSave',
      };

      const saves = { save_test: [saveData] };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    // Reload to trigger game to check for saves
    await page.reload();

    // Should show login screen
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-item:has-text("save_test")')).toBeVisible();

    // Click Load button
    await page.click('.save-item:has-text("save_test") button:has-text("Load")');

    // Desktop should load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 10000 });

    // Verify loaded state
    await expect(page.locator('.topbar-credits:has-text("1500")')).toBeVisible();
    await expect(page.locator('.topbar-time:has-text("25/03/2020")')).toBeVisible();

    // Verify time advances
    await page.waitForTimeout(2000);
    const time1 = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(2000);
    const time2 = await page.locator('.topbar-time').textContent();
    expect(time2).not.toBe(time1);

    console.log('✅ E2E Test 3: Save/Load Cycle - PASS');
  });
});

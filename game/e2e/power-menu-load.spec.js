import { test, expect } from '@playwright/test';

test.describe('E2E: Power Menu Load', () => {
  test.beforeEach(async ({ page }) => {
    // Create multiple saves
    await page.goto('/');
    await page.evaluate(() => {
      const createSave = (username, balance) => ({
        username,
        playerMailId: `SNET-TST-${username.slice(-3)}-XXX`,
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
        save_1: [createSave('save_1', 500)],
        save_2: [createSave('save_2', 1000)],
        save_3: [createSave('save_3', 1500)],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });
  });

  test('should load game from power menu', async ({ page }) => {
    await page.goto('/');

    // Should show login screen with saves
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

    // Load first save to enter game
    await page.click('.save-item:has-text("save_1") button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify save_1 loaded (500 credits)
    await expect(page.locator('.topbar-credits:has-text("500")')).toBeVisible();

    // Open power menu and click Load
    await page.hover('text=⏻');
    await page.click('text=Load');

    // Load modal should appear
    await expect(page.locator('.modal-content:has-text("Load Game")')).toBeVisible();

    // Should show all 3 saves
    await expect(page.locator('.load-save-btn:has-text("save_1")')).toBeVisible();
    await expect(page.locator('.load-save-btn:has-text("save_2")')).toBeVisible();
    await expect(page.locator('.load-save-btn:has-text("save_3")')).toBeVisible();

    // Click to load save_2
    await page.click('.load-save-btn:has-text("save_2")');

    // Should load save_2 (1000 credits)
    await page.waitForTimeout(500);
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    // Modal should close
    await expect(page.locator('.modal-content')).not.toBeVisible();

    // Verify we're still on desktop
    await expect(page.locator('.desktop')).toBeVisible();

    console.log('✅ E2E: Power Menu Load - PASS');
  });

  test('should close load modal when clicking Cancel', async ({ page }) => {
    await page.goto('/');

    // Load a save to enter game
    await page.click('button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open load modal
    await page.hover('text=⏻');
    await page.click('text=Load');
    await expect(page.locator('.modal-content:has-text("Load Game")')).toBeVisible();

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Modal should close
    await expect(page.locator('.modal-content')).not.toBeVisible();

    // Should still be on desktop
    await expect(page.locator('.desktop')).toBeVisible();

    console.log('✅ E2E: Load Modal Cancel - PASS');
  });

  test('should close load modal when clicking overlay', async ({ page }) => {
    await page.goto('/');

    // Load a save
    await page.click('button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open load modal
    await page.hover('text=⏻');
    await page.click('text=Load');
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Click overlay (outside modal content)
    await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

    // Modal should close
    await expect(page.locator('.modal-content')).not.toBeVisible();

    console.log('✅ E2E: Load Modal Overlay Click - PASS');
  });
});

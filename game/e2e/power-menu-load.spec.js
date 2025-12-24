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
    // Wait for boot sequence to complete
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
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

    // Wait for boot sequence to complete
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });

    // Should load save_2 (1000 credits)
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
    // Wait for boot sequence to complete
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
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
    // Wait for boot sequence to complete
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
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

  test('should load game with messages via power menu and display timestamps correctly', async ({ page }) => {
    // Create saves WITH messages (to test formatDateTime with power menu load)
    await page.goto('/');
    await page.evaluate(() => {
      const createSaveWithMessages = (username, balance) => ({
        username,
        playerMailId: `SNET-MSG-${username.slice(-3)}-XXX`,
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
        messages: [
          {
            id: 'msg-1',
            from: 'Test Sender',
            fromId: 'SNET-TST-001-001',
            subject: 'Test Message',
            body: 'This is a test message.',
            timestamp: '2020-03-25T09:05:00',  // ISO string (as saved in localStorage)
            read: false,
            archived: false,
          }
        ],
        managerName: 'TestManager',
        windows: [],
        savedAt: new Date().toISOString(),
        saveName: username,
      });

      const saves = {
        msg_save_1: [createSaveWithMessages('msg_save_1', 500)],
        msg_save_2: [createSaveWithMessages('msg_save_2', 1000)],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    await page.reload();

    // Load first save from login screen
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await page.click('.save-item:has-text("msg_save_1") button:has-text("Load")');
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open Mail to verify timestamps work
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Verify message displays with formatted timestamp (tests formatDateTime with loaded string)
    await expect(page.locator('.message-item:has-text("Test Message")')).toBeVisible();
    const firstDate = await page.locator('.message-date').first();
    await expect(firstDate).toBeVisible();
    const firstDateText = await firstDate.textContent();
    expect(firstDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Close Mail
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');

    // NOW load a different save via POWER MENU (from within game)
    await page.hover('text=⏻');
    await page.click('text=Load');
    await expect(page.locator('.modal-content:has-text("Load Game")')).toBeVisible();

    // Click to load msg_save_2
    await page.click('.load-save-btn:has-text("msg_save_2")');

    // Wait for boot sequence
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });

    // Verify loaded successfully (1000 credits)
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    // CRITICAL: Open Mail after power menu load and verify timestamps work
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Verify message still displays with timestamp after power menu load
    await expect(page.locator('.message-item:has-text("Test Message")')).toBeVisible();
    const loadedDate = await page.locator('.message-date').first();
    await expect(loadedDate).toBeVisible();
    const loadedDateText = await loadedDate.textContent();
    expect(loadedDateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Verify can click and view message details
    await page.click('.message-item:has-text("Test Message")');
    await expect(page.locator('.message-view')).toBeVisible();
    await expect(page.locator('text=This is a test message')).toBeVisible();

    console.log('✅ E2E: Power Menu Load with Messages - PASS');
  });
});

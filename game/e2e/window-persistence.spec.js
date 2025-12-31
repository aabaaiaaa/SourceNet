import { test, expect } from '@playwright/test';

test.describe('E2E: Window State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist open windows and their positions after save/load', async ({ page }) => {
    await page.goto('/?skipBoot=true');

    // Create a save with specific window state
    await page.evaluate(() => {
      const saves = {
        window_persist_test: [
          {
            username: 'window_persist_test',
            playerMailId: 'SNET-WIN-123-456',
            currentTime: '2020-03-25T09:15:00',
            hardware: {
              cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
              memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
              storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
              motherboard: { id: 'board-basic', name: 'Basic Board' },
              powerSupply: { id: 'psu-300w', wattage: 300 },
              network: { id: 'net-250mb', speed: 250 },
            },
            software: [],
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
            messages: [],
            managerName: 'Test',
            windows: [
              {
                appId: 'mail',
                zIndex: 1001,
                minimized: false,
                position: { x: 50, y: 100 },
              },
              {
                appId: 'banking',
                zIndex: 1000,
                minimized: true,
                position: { x: 80, y: 130 },
              },
              {
                appId: 'portal',
                zIndex: 1002,
                minimized: false,
                position: { x: 110, y: 160 },
              },
            ],
            savedAt: '2024-01-01T00:00:00.000Z',
            saveName: 'WindowPersistTest',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    await page.reload();

    // Load the save
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    const saveItem = page.locator('.save-item:has-text("window_persist_test")');
    await saveItem.locator('button:has-text("Load")').click();
    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify window state persisted
    const openWindowsAfterLoad = await page.locator('.window').count();
    const minimizedWindowsAfterLoad = await page.locator('.minimized-window').count();

    // Verify we have 2 open windows and 1 minimized (as defined in save)
    expect(openWindowsAfterLoad).toBe(2); // Mail and Portal
    expect(minimizedWindowsAfterLoad).toBe(1); // Banking

    // Verify specific windows are present
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    const portalWindow = page.locator('.window:has-text("OSNet Portal")');
    await expect(mailWindow).toBeVisible();
    await expect(portalWindow).toBeVisible();
    await expect(page.locator('.minimized-window:has-text("SNet Banking")')).toBeVisible();

    // Verify window positions persisted (check they're at saved positions)
    const mailPos = await mailWindow.boundingBox();
    const portalPos = await portalWindow.boundingBox();

    // Positions should match saved values (x:50,y:100 for mail, x:110,y:160 for portal)
    expect(mailPos.x).toBe(50);
    expect(mailPos.y).toBe(100);
    expect(portalPos.x).toBe(110);
    expect(portalPos.y).toBe(160);

    // Verify minimized window can be restored
    await page.click('.minimized-window:has-text("SNet Banking")');
    await expect(page.locator('.window:has-text("SNet Banking App")')).toBeVisible();

    // Verify all windows are still functional
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');
    await page.click('.window:has-text("SNet Banking") button[title="Close"]');
    await page.click('.window:has-text("OSNet Portal") button[title="Close"]');

    // All windows should be closed
    await expect(page.locator('.window')).toHaveCount(0);
    await expect(page.locator('.minimized-window')).toHaveCount(0);

    console.log('✅ E2E: Window State Persistence - PASS');
  });

  test('should persist window z-index order after save/load', async ({ page }) => {
    await page.goto('/?skipBoot=true');

    // Create a save with credits to skip message flow
    await page.evaluate(() => {
      const saves = {
        zindex_test: [
          {
            username: 'zindex_test',
            playerMailId: 'SNET-ZZZ-123-456',
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
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
            messages: [],
            managerName: 'Test',
            windows: [],
            savedAt: '2024-01-01T00:00:00.000Z',
            saveName: 'ZIndexTest',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    await page.reload();
    await page.click('button:has-text("Load")');
    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open 3 windows in specific order
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await page.waitForTimeout(200);

    await page.click('text=☰');
    await page.click('text=SNet Banking App');
    await page.waitForTimeout(200);

    await page.click('text=☰');
    await page.click('text=OSNet Portal');
    await page.waitForTimeout(200);

    // Click Mail window to bring it to front
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await mailWindow.locator('.window-header').click();
    await page.waitForTimeout(200);

    // Mail should now be on top (highest z-index)
    // Get z-index values
    const mailZIndex = await mailWindow.evaluate((el) => window.getComputedStyle(el).zIndex);
    const bankZIndex = await page
      .locator('.window:has-text("SNet Banking")')
      .evaluate((el) => window.getComputedStyle(el).zIndex);
    const portalZIndex = await page
      .locator('.window:has-text("OSNet Portal")')
      .evaluate((el) => window.getComputedStyle(el).zIndex);

    // Mail should have highest z-index (was clicked last)
    expect(parseInt(mailZIndex)).toBeGreaterThan(parseInt(bankZIndex));
    expect(parseInt(mailZIndex)).toBeGreaterThan(parseInt(portalZIndex));

    // Save the game with this window order
    page.once('dialog', (dialog) => dialog.accept('ZIndexSave'));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(1000);

    // Reload and load save
    await page.reload();
    await page.click('.save-item:has-text("zindex_test") button:has-text("Load")');
    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Verify all 3 windows restored
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
    await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();
    await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

    // Verify z-index order persisted
    const mailZIndexAfter = await page
      .locator('.window:has-text("SNet Mail")')
      .evaluate((el) => window.getComputedStyle(el).zIndex);
    const bankZIndexAfter = await page
      .locator('.window:has-text("SNet Banking")')
      .evaluate((el) => window.getComputedStyle(el).zIndex);
    const portalZIndexAfter = await page
      .locator('.window:has-text("OSNet Portal")')
      .evaluate((el) => window.getComputedStyle(el).zIndex);

    // Mail should still be on top
    expect(parseInt(mailZIndexAfter)).toBeGreaterThan(parseInt(bankZIndexAfter));
    expect(parseInt(mailZIndexAfter)).toBeGreaterThan(parseInt(portalZIndexAfter));

    console.log('✅ E2E: Window Z-Index Persistence - PASS');
  });
});

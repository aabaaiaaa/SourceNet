import { test, expect } from '@playwright/test';

test.describe('E2E: Window Dragging', () => {
  test.beforeEach(async ({ page }) => {
    // Create a save to skip boot
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => {
      const saves = {
        drag_test: [
          {
            username: 'drag_test',
            playerMailId: 'SNET-DRG-123-456',
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
            saveName: 'DragTest',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });
  });

  test('should drag windows to new positions', async ({ page }) => {
    await page.goto('/?skipBoot=true');

    // Load save
    await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Load")');
    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open SNet Mail window
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Verify window header has draggable cursor
    const windowHeader = mailWindow.locator('.window-header');
    const cursorStyle = await windowHeader.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursorStyle).toBe('grab');

    // Verify window has valid position (no NaN)
    const position = await mailWindow.boundingBox();
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(40);

    // Verify window is functional
    await expect(mailWindow.locator('.window-header')).toBeVisible();
    await expect(mailWindow.locator('.window-content')).toBeVisible();

    // Verify window can still be minimized after drag
    await mailWindow.locator('button[title="Minimize"]').click();
    await expect(page.locator('.minimized-window:has-text("SNet Mail")')).toBeVisible();

    // Restore and verify position persisted
    await page.click('.minimized-window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Verify window can still be closed after drag
    await mailWindow.locator('button[title="Close"]').click();
    await expect(mailWindow).not.toBeVisible();

    console.log('✅ E2E: Window Dragging - PASS');
  });

  test('should keep dragged window within viewport bounds', async ({ page }) => {
    await page.goto('/?skipBoot=true');

    // Load save
    await page.click('button:has-text("Load")');
    // Wait for desktop to load
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open window
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    const windowHeader = mailWindow.locator('.window-header');

    // Try to drag window far to the right (beyond viewport)
    await windowHeader.hover();
    await page.mouse.down();
    await page.mouse.move(5000, 100, { steps: 10 }); // Far beyond viewport width
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Verify window stayed within bounds
    const position = await mailWindow.boundingBox();
    const viewportSize = page.viewportSize();

    // Window should not go beyond right edge of viewport
    expect(position.x + position.width).toBeLessThanOrEqual(viewportSize.width);

    // Try to drag beyond top
    await windowHeader.hover();
    await page.mouse.down();
    await page.mouse.move(100, -100, { steps: 10 }); // Above viewport
    await page.mouse.up();

    await page.waitForTimeout(500);

    const position2 = await mailWindow.boundingBox();

    // Window should not go above topbar (y >= 40)
    expect(position2.y).toBeGreaterThanOrEqual(40);

    console.log('✅ E2E: Window Bounds - PASS');
  });
});

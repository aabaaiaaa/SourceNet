import { test, expect } from '@playwright/test';

test.describe('Window Drag Verification', () => {
  test('should actually drag windows and update positions', async ({ page }) => {
    // Setup: Create a new game
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.fill('input.username-input', 'drag_test_user');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // Open Mail window
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Get initial position
    const initialBox = await mailWindow.boundingBox();
    console.log('Initial position:', { x: initialBox.x, y: initialBox.y });

    // Method 1: Try using Playwright's mouse API directly on the header
    const header = mailWindow.locator('.window-header');
    const headerBox = await header.boundingBox();

    // Move to center of header
    await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
    await page.waitForTimeout(100);

    // Press mouse down
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move mouse to new position (100px right, 50px down)
    await page.mouse.move(headerBox.x + headerBox.width / 2 + 100, headerBox.y + headerBox.height / 2 + 50, { steps: 10 });
    await page.waitForTimeout(100);

    // Release mouse
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Check if window moved
    const newBox = await mailWindow.boundingBox();
    console.log('New position after drag:', { x: newBox.x, y: newBox.y });
    console.log('Position changed?', { x: newBox.x !== initialBox.x, y: newBox.y !== initialBox.y });

    // Verify movement occurred
    if (newBox.x === initialBox.x && newBox.y === initialBox.y) {
      throw new Error(`Window did not move! Still at (${newBox.x}, ${newBox.y})`);
    }

    console.log('✅ Window drag verification PASSED - window actually moved!');
  });
});

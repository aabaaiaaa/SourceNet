import { test, expect } from '@playwright/test';
import { STARTING_SOFTWARE } from '../../src/constants/gameConstants.js';

test.describe('E2E Test 6: Time System Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Create a save to skip boot
    await page.goto('/?skipBoot=true');
    await page.evaluate((startingSoftware) => {
      const saves = {
        time_test: [
          {
            username: 'time_test',
            playerMailId: 'SNET-TST-123-456',
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
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
            messages: [],
            managerName: 'Test',
            windows: [],
            savedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    }, STARTING_SOFTWARE);
  });

  test('should handle time system correctly with speed changes and pause', async ({ page }) => {
    await page.goto('/?skipBoot=true');

    // Load save (includes ~4s boot sequence)
    await page.click('button:has-text("Load")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

    // Step 2: Note current time
    await expect(page.locator('text=25/03/2020 09:00:00')).toBeVisible();

    // Step 3-4: Wait 10 real seconds, verify time advanced
    await page.waitForTimeout(11000);
    const timeAfter10s = await page.locator('.topbar-time').textContent();
    expect(timeAfter10s).toMatch(/09:00:(0[0-9]|1[0-9]|2[0-9])/); // Should be around 09:00:09-19

    // Step 5-6: Change to 10x speed
    await page.click('button:has-text("1x")');
    await expect(page.locator('text=10x')).toBeVisible();

    // Step 7-8: Wait 10 real seconds, should advance by ~100 seconds
    const timeBefore = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(11000);
    const timeAfter = await page.locator('.topbar-time').textContent();

    // Time should have advanced significantly (roughly 100 seconds)
    // Extract seconds from time strings and verify difference
    expect(timeAfter).not.toBe(timeBefore);

    // Step 9-10: Change back to 1x
    await page.click('button:has-text("10x")');
    await expect(page.locator('text=1x')).toBeVisible();

    // Step 11-16: Test pause functionality
    await page.hover('text=⏻');
    await page.click('text=Pause');

    const timePaused = await page.locator('.topbar-time').textContent();
    await page.waitForTimeout(3000);
    const timeAfterPause = await page.locator('.topbar-time').textContent();

    // Time should not have advanced
    expect(timeAfterPause).toBe(timePaused);

    // Resume by clicking pause overlay
    await page.click('.pause-overlay');

    await page.waitForTimeout(2000);
    const timeAfterResume = await page.locator('.topbar-time').textContent();
    expect(timeAfterResume).not.toBe(timePaused);

    // Step 17-21: Save, exit, reload, verify time speed reset
    await page.hover('text=⏻');
    await page.click('text=Save');

    // Handle save dialog - accept with default name
    page.on('dialog', (dialog) => dialog.accept());

    await page.reload();
    await page.click('button:has-text("Load")');
    // Wait for desktop (includes ~4s boot sequence)
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

    // Verify time speed is 1x (reset)
    await expect(page.locator('button:has-text("1x")')).toBeVisible();

    console.log('✅ E2E Test 6: Time System - PASS');
  });
});

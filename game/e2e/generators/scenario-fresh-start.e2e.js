/**
 * Scenario Generator: Fresh Start
 * 
 * Generates the 'fresh-start' scenario fixture by playing through:
 * 1. Boot sequence (skipped)
 * 2. Username selection
 * 3. Wait for initial messages
 * 4. Read welcome message from HR
 * 5. Read manager message and deposit cheque
 * 6. Read mission board license message and activate license
 * 7. Save game and export to fixture file
 * 
 * The end state is: user is ready to install Mission Board app
 * 
 * Run with: npm run generate:scenarios
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase timeout for generator tests
test.setTimeout(120000);

test.describe('Scenario Generator: Fresh Start', () => {
  test('generate fresh-start scenario fixture', async ({ page }) => {
    // Helper to set game speed directly
    const setSpeed = async (speed) => {
      await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
    };

    // ========================================
    // STEP 1: Start with clean state
    // ========================================
    await page.goto('/?skipBoot=true');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // ========================================
    // STEP 2: Username Selection
    // ========================================
    await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
    await page.locator('input.username-input').fill('scenario_user');
    await page.click('button:has-text("Continue")');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

    // ========================================
    // STEP 3: Speed up time for messages
    // ========================================
    await setSpeed(100);
    await page.waitForTimeout(100); // Wait for HR welcome message (2s game time)

    // ========================================
    // STEP 4: Read HR Welcome Message
    // ========================================
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Read welcome message
    await page.click('.message-item:has-text("Welcome to SourceNet!")');
    await expect(page.locator('.message-view')).toBeVisible();
    await page.click('button:has-text("Back")');

    // Wait for manager message (triggered by reading first message)
    await page.waitForTimeout(100); // 2s game time at 100x

    // ========================================
    // STEP 5: Read Manager Message and Deposit Cheque
    // ========================================
    await page.click('.message-item:has-text("Hi from your manager")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Click cheque attachment to open banking
    await page.click('.attachment-item');

    // Deposit to First Bank Ltd
    await page.click('.account-select-btn:has-text("First Bank Ltd")');
    await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

    // Close banking window if open
    const bankingWindow = page.locator('.window:has-text("SNet Banking")');
    if (await bankingWindow.isVisible()) {
      await bankingWindow.locator('button[title="Close"]').click();
    }

    // ========================================
    // STEP 6: Wait for Mission Board License Message
    // ========================================
    // Set speed to 100x for waiting
    await setSpeed(100);
    await page.waitForTimeout(300); // 20s game time at 100x for mission board message
    await setSpeed(1); // Reset to 1x

    // Go back to mail inbox
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    if (await mailWindow.isVisible()) {
      const backButton = page.locator('button:has-text("Back")');
      if (await backButton.isVisible()) {
        await backButton.click();
      }
    } else {
      await page.click('text=☰');
      await page.click('text=SNet Mail');
    }

    // ========================================
    // STEP 7: Read Mission Board License Message and Activate
    // ========================================
    const missionBoardMessage = page.locator('.message-item:has-text("Get Ready")').or(
      page.locator('.message-item:has-text("First Mission")')
    );
    await expect(missionBoardMessage.first()).toBeVisible({ timeout: 10000 });
    await missionBoardMessage.first().click();
    await expect(page.locator('.message-view')).toBeVisible();

    // Activate the license attachment
    const licenseBadge = page.locator('.attachment-item:has-text("Software License")').or(
      page.locator('.attachment-item:has-text("Mission Board")')
    );
    await licenseBadge.click();
    await expect(page.locator('text=Activated').or(page.locator('text=✓'))).toBeVisible({ timeout: 2000 });

    // ========================================
    // STEP 8: Ensure speed is 1x for save
    // ========================================
    await setSpeed(1);

    // Close mail window
    const mailWindowFinal = page.locator('.window:has-text("SNet Mail")');
    if (await mailWindowFinal.isVisible()) {
      await mailWindowFinal.locator('button[title="Close"]').click();
    }

    // ========================================
    // STEP 9: Save game
    // ========================================
    // Save using the power menu
    page.once('dialog', (dialog) => dialog.accept('ScenarioFreshStart'));
    await page.hover('text=⏻');
    await page.click('text=Save');
    await page.waitForTimeout(500);

    // ========================================
    // STEP 10: Extract save data and write fixture
    // ========================================
    const saveData = await page.evaluate(() => {
      const savesJson = localStorage.getItem('sourcenet_saves');
      if (!savesJson) return null;

      const saves = JSON.parse(savesJson);
      // Get the save for our user
      const userSaves = saves['scenario_user'];
      if (!userSaves || userSaves.length === 0) return null;

      // Return the most recent save
      return userSaves[0];
    });

    expect(saveData).not.toBeNull();
    expect(saveData.username).toBe('scenario_user');

    // Verify expected state
    expect(saveData.bankAccounts[0].balance).toBe(1000);
    expect(saveData.messages.length).toBeGreaterThanOrEqual(3); // At least 3 messages
    expect(saveData.licensedSoftware).toContain('mission-board');
    expect(saveData.processedEvents).toBeDefined();
    expect(saveData.processedEvents.length).toBeGreaterThan(0);

    // Write to fixture file
    const fixtureDir = path.join(__dirname, '../../src/debug/fixtures');
    const fixturePath = path.join(fixtureDir, 'scenario-fresh-start.save.json');

    // Format the save data nicely
    const fixtureContent = JSON.stringify(saveData, null, 2);

    fs.writeFileSync(fixturePath, fixtureContent, 'utf-8');
    console.log(`✅ Fixture written to: ${fixturePath}`);
    console.log(`   - Username: ${saveData.username}`);
    console.log(`   - Credits: ${saveData.bankAccounts[0].balance}`);
    console.log(`   - Messages: ${saveData.messages.length}`);
    console.log(`   - Licensed Software: ${saveData.licensedSoftware.join(', ')}`);
    console.log(`   - Processed Events: ${saveData.processedEvents.length}`);
  });
});

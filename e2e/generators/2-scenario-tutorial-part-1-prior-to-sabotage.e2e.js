/**
 * Scenario Generator: Tutorial Part 1 - Prior to Sabotage
 * 
 * Generates a scenario fixture where tutorial-part-1 is accepted and the player
 * is ready to repair files, which will trigger the sabotage event.
 * 
 * State:
 * - Mission Board and required software installed
 * - Tutorial Part 1 accepted
 * - Connected to ClientA network (will disconnect on sleep)
 * - Network scanned
 * - File Manager open (window state saved, but filesystem disconnected)
 * - Ready to reconnect and repair files (which triggers sabotage)
 * 
 * This scenario is used for testing the sabotage scripted event.
 * 
 * Starts from fresh-start scenario to skip initial setup.
 * 
 * Run with: npm run generate:scenarios
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.setTimeout(180000);

test.describe('Scenario Generator: Tutorial Part 1 - Prior to Sabotage', () => {
    test('generate scenario ready to trigger sabotage', async ({ page }) => {
        // Listen for console to debug
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('📋') || text.includes('Scenario')) {
                console.log('BROWSER:', text);
            }
        });

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Load fresh-start scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
        });
        await page.goto('/?scenario=fresh-start');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

        // ========================================
        // STEP 2: Install Mission Board (already licensed in fresh-start scenario)
        // ========================================
        // The fresh-start scenario already has:
        // - msg-mission-board-license READ
        // - Mission Board LICENSED
        // So we just need to install it, which will trigger the tutorial-software-licenses event

        await page.click('text=☰');
        await page.click('text=OSNet Portal');
        await expect(page.locator('button:has-text("Software")')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Software")');
        await page.waitForTimeout(200);

        // Install Mission Board (now licensed from reading the message)
        await page.locator('button:has-text("Install")').first().click();
        await setSpeed(100);
        await page.waitForTimeout(300);
        await setSpeed(1);

        // Get software licenses from mail
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        const backBtn = page.locator('button:has-text("Back")');
        if (await backBtn.isVisible()) await backBtn.click();

        // Wait for story event message to arrive (5s delay + processing time)
        // This message arrives after reading "Get Ready" + installing Mission Board
        const softwareMsg = page.locator('.message-item:has-text("Mission Software")').first();
        await expect(softwareMsg).toBeVisible({ timeout: 10000 });
        await softwareMsg.click();

        const licenseAttachments = page.locator('.attachment-item:has-text("Software License")');
        const count = await licenseAttachments.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
            await licenseAttachments.nth(i).click();
            await page.waitForTimeout(50);
        }

        // Install all required software
        await page.click('text=☰');
        await page.click('text=OSNet Portal');
        await page.click('button:has-text("Software")');
        const softwareToInstall = ['VPN Client', 'Network Scanner', 'File Manager', 'Network Address Register'];
        for (const software of softwareToInstall) {
            const btn = page.locator(`.portal-item:has-text("${software}") button:has-text("Install")`).first();
            await expect(btn).toBeVisible({ timeout: 5000 });
            await btn.click();
        }
        await setSpeed(100);
        await page.waitForTimeout(1500);
        await setSpeed(1);

        // ========================================
        // STEP 3: Accept Tutorial Part 1
        // ========================================
        await page.locator('.window:has(.window-header:has-text("OSNet Portal"))').locator('.window-controls button:has-text("×")').click();
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Mission Board');
        await expect(page.locator('.window:has(.window-header:has-text("Mission Board"))')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);

        const missionCard = page.locator('.mission-card:has-text("Log File Repair")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });
        await missionCard.locator('.accept-mission-btn').click();

        // Get network credentials
        await setSpeed(100);
        await page.waitForTimeout(100);
        await setSpeed(1);
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=SNet Mail');
        if (await page.locator('button:has-text("Back")').isVisible()) await page.click('button:has-text("Back")');
        await page.locator('.message-item:has-text("ClientA")').first().click();
        await page.locator('[data-testid^="network-attachment-"]').first().click();

        // ========================================
        // STEP 4: Connect to network and scan
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=VPN Client');
        await page.locator('.network-dropdown').selectOption('clienta-corporate');
        await page.click('button:has-text("Connect")');
        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });

        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=Network Scanner');
        const scanner = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await scanner.locator('label:has-text("Network:") select').selectOption('clienta-corporate');
        await scanner.locator('button:has-text("Scan")').click();
        await setSpeed(100);
        await page.waitForTimeout(300);
        await setSpeed(1);

        // ========================================
        // STEP 5: Open File Manager (but DON'T repair)
        // ========================================
        await page.click('text=☰');
        await page.click('.app-launcher-menu >> text=File Manager');
        await page.locator('.window:has(.window-header:has-text("File Manager"))').locator('select').selectOption('fs-clienta-01');
        await page.waitForTimeout(500);

        // Verify corrupted files are visible
        const fileItems = page.locator('.window:has(.window-header:has-text("File Manager"))').locator('.file-corrupted');
        const corruptedCount = await fileItems.count();
        expect(corruptedCount).toBe(8);
        console.log(`✅ ${corruptedCount} corrupted files visible in File Manager`);

        // Don't select files or repair - save with File Manager open showing corrupted files
        // Sleep will disconnect VPN, so files won't be selected on reload anyway

        // ========================================
        // STEP 6: Save the game state (before repairing)
        // ========================================
        // Close other windows except File Manager
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                const header = win.querySelector('.window-header');
                if (header && !header.textContent.includes('File Manager')) {
                    win.querySelector('.window-controls button:last-child')?.click();
                }
            });
        });
        await page.waitForTimeout(200);
        // Now close File Manager too so scenario starts with no windows open
        await page.locator('.window:has(.window-header:has-text("File Manager"))').locator('.window-controls button:last-child').click();
        await page.waitForTimeout(200);
        console.log('✅ Closed all windows');

        // Sleep to save
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=⏻');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(5000);

        // ========================================
        // STEP 7: Extract and Write Fixture
        // ========================================
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();
        expect(saveData.activeMission).not.toBeNull();
        expect(saveData.activeMission.missionId).toBe('tutorial-part-1');
        console.log('✅ Tutorial Part 1 is active mission');

        const fixturePath = path.join(__dirname, '../../src/debug/fixtures/scenario-tutorial-part-1-prior-to-sabotage.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2), 'utf-8');

        console.log(`✅ Fixture written to: ${fixturePath}`);
        console.log(`   - Username: ${saveData.username}`);
        console.log(`   - Active Mission: ${saveData.activeMission?.missionId || 'none'}`);
        console.log(`   - Completed Missions: ${saveData.completedMissions?.length || 0}`);
        console.log(`   - Credits: ${saveData.bankAccounts?.[0]?.balance}`);
        console.log(`   - Messages: ${saveData.messages?.length || 0}`);
        console.log(`   - State: Ready to reconnect, scan, and repair files to trigger sabotage event`);
    });
});

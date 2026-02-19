/**
 * SCENARIO GENERATOR: post-ransomware-recovery
 *
 * Generates a fixture for the state after completing the ransomware-recovery mission
 * via the antivirus success path. The key feature: post-completion messages that
 * unlock CPU upgrades, algorithm modules, and decryption missions are UNREAD.
 *
 * Starting from: pre-ransomware-trap scenario (obj-decrypt-trap pending)
 *
 * Steps:
 * 1. Decrypt passenger-data.dat.enc (triggers ransomware attack)
 * 2. Read rescue message, activate AV license
 * 3. Install AV from Portal, start as passive software
 * 4. Ransomware halted, read resolution message → mission completes
 * 5. Wait for post-completion messages to arrive (unread)
 * 6. Save fixture
 *
 * Final state:
 * - ransomware-recovery mission completed (success)
 * - decryption-algorithms and decryption-missions unlocked
 * - Unread messages: "Hardware Upgrade - CPU Priority", "Algorithm Modules - How It Works",
 *   "Thank You - Systems Coming Back Online"
 * - advanced-firewall-av installed and active
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
    openApp,
    closeWindow,
    connectToNetwork,
    openMail,
    waitForMessage,
    readMessage,
} from '../helpers/common-actions.js';

test.setTimeout(600000);

test.describe('Scenario Generator', () => {
    test('Generate post-ransomware-recovery fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load pre-ransomware-trap scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=pre-ransomware-trap');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
        console.log('Step 1: Desktop visible, game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        const mailWindow = page.locator('.window:has-text("SNet Mail")');

        // ========================================
        // STEP 2: Reconnect to MetroLink-Operations (VPN not persisted in save)
        // ========================================
        console.log('Step 2: Reconnecting to MetroLink-Operations...');
        await connectToNetwork(page, 'MetroLink-Operations');
        console.log('Step 2: Connected');

        // ========================================
        // STEP 3: Decrypt passenger-data.dat.enc to trigger ransomware
        // ========================================
        console.log('Step 3: Decrypting passenger-data.dat.enc (will trigger ransomware)...');

        await setSpeed(100);

        await openApp(page, 'Decryption Tool');
        const dtWindow = page.locator('.window:has-text("Decryption Tool")');
        await page.waitForTimeout(300);

        // Select ticketing-db file system where passenger-data.dat.enc lives
        await dtWindow.locator('select').selectOption('fs-metro-ticketing');
        await page.waitForTimeout(500);

        // Select the trap file
        const trapFile = dtWindow.locator('.decryption-file-item:has-text("passenger-data.dat.enc")');
        await expect(trapFile).toBeVisible({ timeout: 5000 });
        await trapFile.click();

        // Download to local SSD
        await dtWindow.locator('button:has-text("Download")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'passenger-data.dat.enc');
            },
            { timeout: 60000 }
        );
        console.log('Step 2a: File downloaded to local SSD');

        // Decrypt it (this triggers the ransomware attack after 2s game time)
        await dtWindow.locator('button:has-text("Decrypt")').click();
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-decrypt-trap');
                return obj?.status === 'complete';
            },
            { timeout: 120000 }
        );
        console.log('Step 2b: File decrypted, obj-decrypt-trap complete');

        // Slow down IMMEDIATELY so ransomware timer doesn't complete before we can respond
        // At 100x, the 60s ransomware timer would complete in 600ms - too fast
        await setSpeed(10);

        await closeWindow(page, 'Decryption Tool');

        // ========================================
        // STEP 3: Wait for ransomware overlay and rescue message
        // ========================================
        console.log('Step 3: Waiting for ransomware attack and rescue message...');

        // Wait for ransomware overlay to appear
        await expect(page.locator('.ransomware-overlay')).toBeVisible({ timeout: 30000 });
        console.log('Step 3a: Ransomware overlay visible');

        // Move overlay off-screen so it doesn't block interactions throughout
        await page.evaluate(() => {
            const overlay = document.querySelector('.ransomware-overlay');
            if (overlay) overlay.style.left = '-9999px';
        });

        // Wait for rescue message to arrive (5s game time after attack)
        await openMail(page);

        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'EMERGENCY', 30000);
        console.log('Step 3b: Rescue message arrived');

        // ========================================
        // STEP 4: Read rescue message and activate AV license
        // ========================================
        console.log('Step 4: Reading rescue message and activating AV license...');

        await readMessage(page, 'EMERGENCY');
        await page.waitForTimeout(500);

        // Click the software license attachment to activate it
        const licenseAttachment = page.locator('.attachment-item:has-text("Advanced Firewall")');
        await expect(licenseAttachment).toBeVisible({ timeout: 5000 });
        await licenseAttachment.click();
        await page.waitForTimeout(500);

        // Verify license was activated
        const isLicensed = await page.evaluate(() =>
            window.gameContext.licensedSoftware?.includes('advanced-firewall-av')
        );
        expect(isLicensed).toBe(true);
        console.log('Step 4: AV license activated');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 5: Install AV from Portal using the license
        // ========================================
        console.log('Step 5: Installing AV from Portal...');

        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');

        // Should be on Software section by default
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        // Find AV and install (should show "Install (Licensed)")
        const avItem = portal.locator('.portal-item').filter({ has: page.locator('.item-name', { hasText: 'Advanced Firewall' }) });
        await expect(avItem).toBeVisible({ timeout: 5000 });

        const installBtn = avItem.locator('.install-btn, .purchase-btn');
        await expect(installBtn).toBeVisible({ timeout: 5000 });
        await installBtn.click();

        // If a confirmation modal appears, confirm it
        const modal = portal.locator('.modal-content');
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }

        // Wait for download to complete
        await expect(avItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
        console.log('Step 5: AV installed');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 6: Start AV as passive software from app launcher
        // ========================================
        console.log('Step 6: Starting AV as passive software...');

        await page.hover('text=☰');
        await page.waitForTimeout(300);
        await page.click('.app-launcher-menu >> text=Advanced Firewall');
        await page.waitForTimeout(500);

        // Verify AV is active
        const avActive = await page.evaluate(() =>
            window.gameContext.activePassiveSoftware?.includes('advanced-firewall-av')
        );
        expect(avActive).toBe(true);
        console.log('Step 6: AV started as passive software');

        // ========================================
        // STEP 7: Wait for ransomware to be halted and resolution message
        // ========================================
        console.log('Step 7: Waiting for ransomware to be halted...');

        // Ransomware should be paused now (overlay is off-screen, check via JS)
        await page.waitForFunction(
            () => document.querySelector('.ransomware-overlay.paused') !== null,
            { timeout: 10000 }
        );
        console.log('Step 7a: Ransomware paused');

        // Wait for resolution message
        await openMail(page);

        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Crisis Averted', 30000);
        console.log('Step 7b: Resolution message arrived');

        // ========================================
        // STEP 8: Read resolution message to complete mission
        // ========================================
        console.log('Step 8: Reading resolution message to complete mission...');

        await readMessage(page, 'Crisis Averted');
        await page.waitForTimeout(500);

        // Wait for mission to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const completed = window.gameContext.completedMissions;
                // Mission should be null (cleared) or in completedMissions
                return mission === null || completed?.some(m => m.missionId === 'ransomware-recovery');
            },
            { timeout: 30000 }
        );
        console.log('Step 8: Mission completed (success)');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 9: Wait for post-completion messages to arrive
        // Messages are scheduled at 8s, 15s, and 25s game time after completion
        // ========================================
        console.log('Step 9: Waiting for post-completion messages...');

        // Speed up to let all scheduled messages arrive (25s game time needed)
        // At 100x speed, 25s game time = 250ms real time, but add buffer
        await page.waitForTimeout(1000); // Let mission completion events settle at current speed

        // Wait for ransomware overlay cleanup to complete and fade
        await page.waitForFunction(
            () => {
                const overlay = document.querySelector('.ransomware-overlay');
                return !overlay || overlay.classList.contains('fading') || !overlay.offsetParent;
            },
            { timeout: 60000 }
        );
        console.log('Step 9a: Ransomware overlay cleaned up');

        // Wait for all three messages: payment (8s), cpu-unlock (15s), algorithm-info (25s)
        await openMail(page);

        const backBtn3 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn3.isVisible().catch(() => false)) {
            await backBtn3.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Thank You - Systems Coming Back Online', 60000);
        console.log('Step 9b: Payment message arrived');

        await waitForMessage(page, 'Hardware Upgrade', 60000);
        console.log('Step 9c: CPU unlock message arrived');

        await waitForMessage(page, 'Algorithm Modules', 60000);
        console.log('Step 9d: Algorithm info message arrived');

        // DO NOT read these messages - they should remain unread in the fixture

        await closeWindow(page, 'SNet Mail');

        // Slow down for save
        await setSpeed(1);

        // ========================================
        // STEP 10: Verify state
        // ========================================
        console.log('Step 10: Verifying state...');

        // Verify mission is completed
        const completedMissions = await page.evaluate(() =>
            window.gameContext.completedMissions?.map(m => m.missionId) || []
        );
        expect(completedMissions).toContain('ransomware-recovery');

        // Verify unlocked features
        const unlockedFeatures = await page.evaluate(() =>
            window.gameContext.unlockedFeatures || []
        );
        expect(unlockedFeatures).toContain('decryption-algorithms');
        expect(unlockedFeatures).toContain('decryption-missions');
        // cpu-upgrades should NOT be unlocked yet (unlocked on reading msg-cpu-unlock)
        expect(unlockedFeatures).not.toContain('cpu-upgrades');

        // Verify unread messages exist
        const messages = await page.evaluate(() =>
            window.gameContext.messages?.map(m => ({ id: m.id, subject: m.subject, read: m.read })) || []
        );

        const cpuMsg = messages.find(m => m.subject?.includes('Hardware Upgrade'));
        const algoMsg = messages.find(m => m.subject?.includes('Algorithm Modules'));
        const paymentMsg = messages.find(m => m.subject?.includes('Thank You'));

        expect(cpuMsg, 'CPU unlock message should exist').toBeTruthy();
        expect(cpuMsg.read, 'CPU unlock message should be unread').toBeFalsy();

        expect(algoMsg, 'Algorithm info message should exist').toBeTruthy();
        expect(algoMsg.read, 'Algorithm info message should be unread').toBeFalsy();

        expect(paymentMsg, 'Payment message should exist').toBeTruthy();
        expect(paymentMsg.read, 'Payment message should be unread').toBeFalsy();

        console.log('Step 10: State verified');
        console.log('  Unread messages:');
        for (const msg of [cpuMsg, algoMsg, paymentMsg]) {
            console.log(`    - ${msg.subject} (${msg.id})`);
        }

        // ========================================
        // STEP 11: Archive old/read messages, keep unread ones
        // ========================================
        console.log('Step 11: Cleaning up old messages...');
        await openMail(page);

        const backBtn4 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn4.isVisible().catch(() => false)) {
            await backBtn4.click();
            await page.waitForTimeout(200);
        }

        // Keep only the unread post-completion messages and EMERGENCY/Crisis Averted for context
        const keepSubjects = [
            'Hardware Upgrade',
            'Algorithm Modules',
            'Thank You',
            'EMERGENCY',
            'Crisis Averted',
        ];

        let archiveLoopMax = 30;
        while (archiveLoopMax-- > 0) {
            const allMessages = mailWindow.locator('.message-item');
            const count = await allMessages.count();
            if (count === 0) break;

            let archivedOne = false;
            for (let i = 0; i < count; i++) {
                const msgText = await allMessages.nth(i).textContent();
                const shouldKeep = keepSubjects.some(s => msgText.includes(s));
                if (!shouldKeep) {
                    await allMessages.nth(i).click();
                    await expect(mailWindow.locator('.message-view')).toBeVisible({ timeout: 3000 });
                    await mailWindow.locator('.archive-button').click();
                    await page.waitForTimeout(300);
                    archivedOne = true;
                    break;
                }
            }
            if (!archivedOne) break;
        }

        console.log('Step 11: Messages cleaned up');
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 12: Save fixture
        // ========================================
        console.log('Step 12: Saving game state...');

        // Close all windows
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Sleep to save
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=\u23FB');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });
        console.log('Step 12: Game saved');

        // Extract and write fixture
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        // Verify key state in save data
        const savedCompleted = saveData.completedMissions?.map(m =>
            typeof m === 'string' ? m : m.missionId
        );
        expect(savedCompleted).toContain('ransomware-recovery');

        // Verify unread messages in save data
        const savedMessages = saveData.messages || [];
        const savedCpuMsg = savedMessages.find(m => m.subject?.includes('Hardware Upgrade'));
        const savedAlgoMsg = savedMessages.find(m => m.subject?.includes('Algorithm Modules'));
        const savedPaymentMsg = savedMessages.find(m => m.subject?.includes('Thank You'));

        expect(savedCpuMsg).toBeTruthy();
        expect(savedCpuMsg.read).toBeFalsy();
        expect(savedAlgoMsg).toBeTruthy();
        expect(savedAlgoMsg.read).toBeFalsy();
        expect(savedPaymentMsg).toBeTruthy();
        expect(savedPaymentMsg.read).toBeFalsy();

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-ransomware-recovery.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`Fixture written to: ${fixturePath}`);

        // Summary
        console.log('\n=== Fixture State Summary ===');
        console.log(`Completed Missions: ${savedCompleted?.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Messages count: ${savedMessages.length}`);
        console.log(`Unread messages: ${savedMessages.filter(m => !m.read).map(m => m.subject).join(', ')}`);
        console.log(`Software: ${saveData.software?.map(s => typeof s === 'string' ? s : s.id).join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-ransomware-recovery');
    });
});

/**
 * SCENARIO GENERATOR: post-locked-out
 *
 * Generates a fixture for the state after completing the locked-out story mission.
 * This mission introduces password cracking and ends with the intrusion attack
 * that sets up the relay system (unlocked after reboot).
 *
 * Starting from: post-ransomware-recovery scenario
 *
 * Steps:
 * 1. Read CPU unlock and algorithm info messages
 * 2. Buy both algorithm packs from Portal → triggers story teaser message
 * 3. Read story teaser → triggers cracking-intro message
 * 4. Read cracking-intro → unlocks cracking-tooling, triggers locked-out mission
 * 5. Purchase Password Cracker from Portal
 * 6. Accept mission, activate mission NAR, connect to Meridian-Internal
 * 7. Scan network, crack both password-protected files
 * 8. Intrusion attack → forced disconnect + intrusion alert
 * 9. Read intrusion alert → mission completes, relay-setup-pending flag set
 * 10. Reboot → desktopLoaded fires → relay-unlock message sent after 5s
 * 11. Wait for relay-unlock message + payment, save fixture
 *
 * Final state:
 * - locked-out mission completed (success)
 * - cracking-tooling unlocked, relay-service NOT unlocked (deferred to message read)
 * - Unread messages: relay-system-unlock, client payment
 * - Password Cracker installed, algorithm packs installed
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
    openApp,
    closeWindow,
    connectToNetwork,
    scanNetwork,
    openMail,
    waitForMessage,
    readMessage,
    waitForAndDismissForcedDisconnection,
    dismissDisconnectionNotice,
} from '../helpers/common-actions.js';

test.setTimeout(600000);

test.describe('Scenario Generator', () => {
    test('Generate post-locked-out fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-ransomware-recovery scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-ransomware-recovery');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, null, { timeout: 10000 });
        console.log('Step 1: Desktop visible, game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        const mailWindow = page.locator('.window:has-text("SNet Mail")');

        // ========================================
        // STEP 2: Add credits (player needs funds for algo packs + Password Cracker)
        // ========================================
        console.log('Step 2: Adding buffer credits...');
        await page.evaluate(() => {
            const accounts = window.gameContext.bankAccounts;
            if (accounts && accounts.length > 0) {
                accounts[0].balance += 12000;
            }
        });

        // ========================================
        // STEP 3: Read CPU unlock and algorithm info messages
        // ========================================
        console.log('Step 3: Reading unread messages...');

        await openMail(page);

        // Read CPU unlock message → unlocks cpu-upgrades
        await readMessage(page, 'Hardware Upgrade');
        await page.waitForTimeout(500);

        // Go back to inbox
        const backBtn = mailWindow.locator('button:has-text("Back")');
        await backBtn.click();
        await page.waitForTimeout(300);

        // Read algorithm info message
        await readMessage(page, 'Algorithm Modules');
        await page.waitForTimeout(500);
        await backBtn.click();
        await page.waitForTimeout(300);

        // Verify cpu-upgrades unlocked
        const cpuUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('cpu-upgrades')
        );
        expect(cpuUnlocked).toBe(true);
        console.log('Step 3: Messages read, cpu-upgrades unlocked');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 4: Buy algorithm packs from Portal
        // ========================================
        console.log('Step 4: Buying algorithm packs from Portal...');

        await setSpeed(100);

        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        // Buy Blowfish pack
        const blowfishItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Blowfish Decryption Module' })
        });
        await expect(blowfishItem).toBeVisible({ timeout: 5000 });
        await blowfishItem.locator('.purchase-btn').click();

        // Handle confirmation modal
        const modal = portal.locator('.modal-content');
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }

        // Wait for download
        await expect(blowfishItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 4a: Blowfish pack installed');

        // Buy RSA pack
        const rsaItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'RSA-2048 Decryption Module' })
        });
        await expect(rsaItem).toBeVisible({ timeout: 5000 });
        await rsaItem.locator('.purchase-btn').click();

        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }

        // Wait for download — this triggers the story teaser message (10s game time after install)
        await expect(rsaItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 4b: RSA pack installed → story teaser will arrive');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 5: Wait for and read story teaser message
        // ========================================
        console.log('Step 5: Waiting for story teaser message...');

        await openMail(page);

        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Next Phase - Password Cracking', 60000);
        console.log('Step 5a: Story teaser arrived');

        await readMessage(page, 'Next Phase - Password Cracking');
        await page.waitForTimeout(300);
        console.log('Step 5b: Story teaser read → cracking-intro arrives in 5s game time');

        // ========================================
        // STEP 6: Wait for cracking-intro message and read it
        // ========================================
        console.log('Step 6: Waiting for cracking-intro message...');

        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        // Cracking intro arrives 5s game time after reading story teaser (at 100x = 50ms)
        await waitForMessage(page, 'Password Cracking Tools - Ready', 30000);
        await readMessage(page, 'Password Cracking Tools - Ready');
        await page.waitForTimeout(500);
        console.log('Step 6: Cracking intro read → cracking-tooling unlocked, locked-out triggers in 5s');

        // Verify cracking-tooling unlocked (now happens on reading cracking-intro)
        const crackingUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('cracking-tooling')
        );
        expect(crackingUnlocked).toBe(true);

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 7: Purchase Password Cracker from Portal
        // ========================================
        console.log('Step 7: Purchasing Password Cracker from Portal...');

        await openApp(page, 'Portal');
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        const pcItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Password Cracker' })
        });
        await expect(pcItem).toBeVisible({ timeout: 5000 });
        await pcItem.locator('.purchase-btn').click();

        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }

        await expect(pcItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 7: Password Cracker purchased and installed');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 8: Wait for locked-out mission and accept it
        // ========================================
        console.log('Step 8: Waiting for locked-out mission...');

        // Mission triggers 5s game time after reading cracking-intro
        await page.waitForFunction(
            () => {
                const board = window.gameContext.availableMissions || [];
                const active = window.gameContext.activeMission;
                return board.some(m => m.missionId === 'locked-out') ||
                    active?.missionId === 'locked-out';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 8a: Locked-out mission available');

        await openApp(page, 'Mission Board');
        const missionBoard = page.locator('.window:has-text("Mission Board")');

        const missionCard = missionBoard.locator('.mission-card:has-text("Locked Out")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });
        await missionCard.locator('.accept-mission-btn').click();
        await page.waitForTimeout(500);
        console.log('Step 8b: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 9: Activate mission NAR and connect to Meridian-Internal
        // ========================================
        console.log('Step 9: Activating NAR and connecting...');

        // Slow down briefly for NAR activation (more reliable)
        await setSpeed(10);

        // Activate NAR from the specific briefing message (not just first unread)
        await openMail(page);
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }
        await readMessage(page, 'URGENT: Locked Out of Critical Systems');
        await page.waitForTimeout(300);

        // Click the NAR attachment
        const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
        await expect(narAttachment).toBeVisible({ timeout: 5000 });
        await narAttachment.click();
        await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
        await closeWindow(page, 'SNet Mail');

        await setSpeed(100);

        console.log('Step 9a: NAR activated');

        // Connect to Meridian-Internal
        await connectToNetwork(page, 'Meridian-Internal');
        console.log('Step 9b: Connected to Meridian-Internal');

        // Wait for network connection objective to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-meridian');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 9c: Connection objective complete');

        // ========================================
        // STEP 10: Scan network and find hr-server
        // ========================================
        console.log('Step 10: Scanning network...');

        await scanNetwork(page, 'Meridian-Internal', 'hr-server');

        // Wait for scan objective to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-scan-meridian');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 10: Scan objective complete');

        // scanNetwork resets speed to 1x, restore to 100x for fast cracking
        await setSpeed(100);

        // ========================================
        // STEP 11: Crack personnel-records.db (MD5)
        // ========================================
        console.log('Step 11: Cracking personnel-records.db...');

        await openApp(page, 'Password Cracker');
        const pcWindow = page.locator('.window:has-text("Password Cracker")');

        // Select hr-server file system (dropdown now shows file systems, not networks)
        await pcWindow.locator('.pc-dropdown').selectOption('fs-meridian-hr');
        await page.waitForTimeout(500);

        // Click on personnel-records.db
        const personnelFile = pcWindow.locator('.pc-file-item:has-text("personnel-records.db")');
        await expect(personnelFile).toBeVisible({ timeout: 5000 });
        await personnelFile.click();
        await page.waitForTimeout(300);

        // Select brute force method (always available)
        await pcWindow.locator('.pc-method-btn:has-text("Brute Force")').click();
        await page.waitForTimeout(200);

        // Start crack
        await pcWindow.locator('.pc-start-btn').click();

        // Wait for crack objective to complete (MD5 brute force = 10s game time, at 100x = 100ms)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-crack-personnel');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 11: Personnel records cracked');

        // ========================================
        // STEP 12: Crack payroll-Q4-2019.zip (SHA-256)
        // ========================================
        console.log('Step 12: Cracking payroll-Q4-2019.zip...');

        // Wait for success auto-clear (auto-clears after 2s real time)
        await page.waitForTimeout(3000);

        // After cracking personnel-records.db, it's no longer password-protected
        // so only payroll file remains. Need to re-select the finance server file system
        await pcWindow.locator('.pc-dropdown').selectOption('fs-meridian-finance');
        await page.waitForTimeout(500);

        // Select payroll file
        const payrollFile = pcWindow.locator('.pc-file-item:has-text("payroll-Q4-2019.zip")');
        await expect(payrollFile).toBeVisible({ timeout: 5000 });
        await payrollFile.click();
        await page.waitForTimeout(300);

        // Select brute force
        await pcWindow.locator('.pc-method-btn:has-text("Brute Force")').click();
        await page.waitForTimeout(200);

        // Start crack
        await pcWindow.locator('.pc-start-btn').click();

        // Wait for payroll crack objective to complete (SHA-256 brute force = 90s game time, at 100x = 900ms)
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-crack-payroll');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 120000 }
        );
        console.log('Step 12: Payroll cracked → intrusion attack incoming in 5s game time');

        // ========================================
        // STEP 13: Handle intrusion attack
        // ========================================
        console.log('Step 13: Waiting for intrusion attack...');

        // Intrusion fires 5s game time after both cracks complete (requiredObjectives trigger)
        // Wait for and dismiss forced disconnection overlay (appears before we can close the cracker)
        await waitForAndDismissForcedDisconnection(page, 30000);
        console.log('Step 13a: Forced disconnection handled');

        // Scripted event resets speed to 1x; restore for faster completion
        await setSpeed(100);

        await closeWindow(page, 'Password Cracker');

        // ========================================
        // STEP 14: Read intrusion alert → mission completes + relay-setup-pending flag
        // ========================================
        console.log('Step 14: Reading intrusion alert...');

        await openMail(page);

        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'ALERT: They Found You', 30000);
        await readMessage(page, 'ALERT: They Found You');
        await page.waitForTimeout(500);
        console.log('Step 14a: Intrusion alert read → mission completes, relay-setup-pending set');

        // Wait for mission to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const completed = window.gameContext.completedMissions;
                return mission === null || completed?.some(m => m.missionId === 'locked-out');
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 14b: Mission completed');

        // Verify relay-setup-pending is set (NOT relay-service)
        const hasPendingFlag = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('relay-setup-pending')
        );
        expect(hasPendingFlag).toBe(true);
        console.log('Step 14c: relay-setup-pending flag confirmed');

        // Scripted event reset speed to 1x; restore to get payment message quickly
        await setSpeed(100);

        // Close and reopen mail to get back to inbox view
        await dismissDisconnectionNotice(page);
        await closeWindow(page, 'SNet Mail');

        // Wait for payment message (scheduled 3s game time after mission completion)
        // Must arrive before reboot or the timer is lost
        await openMail(page);
        const backBtnPay = page.locator('.window:has-text("SNet Mail") button:has-text("Back")');
        if (await backBtnPay.isVisible().catch(() => false)) {
            await backBtnPay.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'Payment for Locked Out', 60000);
        console.log('Step 14d: Payment message arrived');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 15: Reboot to trigger relay-unlock message delivery
        // ========================================
        console.log('Step 15: Rebooting to trigger relay system delivery...');

        await setSpeed(1);

        // Sleep to save first
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=\u23FB');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

        // Now login to trigger desktopLoaded which processes relay-setup-pending
        const loadBtn = page.locator('button:has-text("Load Latest")');
        await expect(loadBtn.first()).toBeVisible({ timeout: 10000 });
        await loadBtn.first().click();

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, null, { timeout: 10000 });

        // Dismiss pause overlay if visible (game pauses on load)
        const pauseOverlay = page.locator('text=Click anywhere or press ESC to resume');
        if (await pauseOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
            await page.click('.desktop');
            await page.waitForTimeout(500);
        }

        console.log('Step 15a: Rebooted, desktop loaded');

        await setSpeed(100);

        // ========================================
        // STEP 16: Wait for post-reboot messages
        // ========================================
        console.log('Step 16: Waiting for post-reboot messages...');

        // Relay unlock message: 5s game time after desktopLoaded (at 100x = 50ms)
        await openMail(page);

        const backBtn2 = page.locator('.window:has-text("SNet Mail") button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Relay System & Trace Monitor', 60000);
        console.log('Step 16a: Relay unlock message arrived');

        // Payment message already arrived pre-reboot (step 14d)

        // Verify relay-setup-pending was cleared
        const pendingCleared = await page.evaluate(() =>
            !window.gameContext.unlockedFeatures?.includes('relay-setup-pending')
        );
        expect(pendingCleared).toBe(true);
        console.log('Step 16c: relay-setup-pending cleared after reboot');

        // DO NOT read these messages — they should remain unread in the fixture
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 17: Verify state
        // ========================================
        console.log('Step 17: Verifying state...');

        const completedMissions = await page.evaluate(() =>
            window.gameContext.completedMissions?.map(m => m.missionId) || []
        );
        expect(completedMissions).toContain('locked-out');

        const unlockedFeatures = await page.evaluate(() =>
            window.gameContext.unlockedFeatures || []
        );
        expect(unlockedFeatures).toContain('cracking-tooling');
        expect(unlockedFeatures).not.toContain('relay-service');
        expect(unlockedFeatures).not.toContain('relay-setup-pending');

        const software = await page.evaluate(() => window.gameContext.software || []);
        expect(software).toContain('password-cracker');
        expect(software).toContain('algorithm-pack-blowfish');
        expect(software).toContain('algorithm-pack-rsa');

        const relayNodes = await page.evaluate(() => window.gameContext.relayNodes || []);
        expect(relayNodes.length).toBe(0);
        console.log(`Step 17: State verified (no relay nodes yet, features: ${unlockedFeatures.join(', ')})`);

        // ========================================
        // STEP 18: Clean up old messages (keep only relevant ones)
        // ========================================
        console.log('Step 18: Cleaning up old messages...');

        await setSpeed(1);

        const mailWindow2 = page.locator('.window:has-text("SNet Mail")');

        await openMail(page);

        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        // Keep: relay unlock, payment, intrusion alert (for context)
        const keepSubjects = [
            'Relay System',
            'Payment for Locked Out',
            'ALERT: They Found You',
        ];

        let archiveLoopMax = 30;
        while (archiveLoopMax-- > 0) {
            const allMessages = mailWindow2.locator('.message-item');
            const count = await allMessages.count();
            if (count === 0) break;

            let archivedOne = false;
            for (let i = 0; i < count; i++) {
                const msgText = await allMessages.nth(i).textContent();
                const shouldKeep = keepSubjects.some(s => msgText.includes(s));
                if (!shouldKeep) {
                    await allMessages.nth(i).click();
                    await expect(mailWindow2.locator('.message-view')).toBeVisible({ timeout: 3000 });
                    await mailWindow2.locator('.archive-button').click();
                    await page.waitForTimeout(300);
                    archivedOne = true;
                    break;
                }
            }
            if (!archivedOne) break;
        }

        console.log('Step 18: Messages cleaned up');
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 19: Save fixture
        // ========================================
        console.log('Step 19: Saving game state...');

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
        console.log('Step 19: Game saved');

        // Extract and write fixture (last save = most recent, after reboot)
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            const userSaves = saves['scenario_user'] || [];
            return userSaves[userSaves.length - 1] || null;
        });

        expect(saveData).not.toBeNull();

        // Verify key state in save data
        const savedCompleted = saveData.completedMissions?.map(m =>
            typeof m === 'string' ? m : m.missionId
        );
        expect(savedCompleted).toContain('locked-out');
        expect(saveData.unlockedFeatures).toContain('cracking-tooling');
        expect(saveData.unlockedFeatures).not.toContain('relay-service');
        expect(saveData.unlockedFeatures).not.toContain('relay-setup-pending');

        // Verify unread messages
        const savedMessages = saveData.messages || [];
        const relayMsg = savedMessages.find(m => m.subject?.includes('Relay System'));
        const paymentMsg = savedMessages.find(m => m.subject?.includes('Payment for Locked Out'));

        expect(relayMsg, 'Relay unlock message should exist').toBeTruthy();
        expect(relayMsg.read, 'Relay unlock message should be unread').toBeFalsy();
        expect(paymentMsg, 'Payment message should exist').toBeTruthy();

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-locked-out.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`Fixture written to: ${fixturePath}`);

        // Summary
        console.log('\n=== Fixture State Summary ===');
        console.log(`Completed Missions: ${savedCompleted?.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Messages count: ${savedMessages.length}`);
        console.log(`Unread messages: ${savedMessages.filter(m => !m.read).map(m => m.subject).join(', ')}`);
        console.log(`Software: ${saveData.software?.join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log(`Relay Nodes: ${saveData.relayNodes?.length || 0}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-locked-out');
    });
});

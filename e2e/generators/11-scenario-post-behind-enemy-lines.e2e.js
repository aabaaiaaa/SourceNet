/**
 * SCENARIO GENERATOR: post-behind-enemy-lines
 *
 * Generates a fixture for the state after completing the behind-enemy-lines mission.
 * This mission practices relay routing, log investigation, and file recovery
 * under trace pressure.
 *
 * Starting from: post-locked-out scenario
 *
 * Steps:
 * 1. Read relay-unlock message → relay-service unlocked, relay nodes generated
 * 2. Purchase VPN Relay Module (3,000) + Trace Monitor (2,500) from Portal,
 *    purchase Standard Relay Service (30,000). Total ~35,500 credits needed.
 * 3. Wait for behind-enemy-lines mission to trigger (10s after reading relay-unlock)
 * 4. Accept mission, activate NAR
 * 5. Start Trace Monitor, connect to Coastal-Ops through relay chain
 * 6. Scan network, investigate logs via Log Viewer, recover deleted file
 * 7. Mission completes (Coastal-Ops NAR revoked on completion via revokeOnComplete)
 * 8. Wait for post-mission messages
 * 9. Save fixture
 *
 * Final state:
 * - behind-enemy-lines mission completed
 * - Relay system fully operational
 * - Coastal-Ops NAR revoked (revokeOnComplete: true)
 * - Unread messages: relay-practice-success (trigger for lockdown)
 * - sniffer-intro message will NOT arrive until credits reach 50k
 *   (no longer triggered by reading relay-practice-success)
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
    openApp,
    closeWindow,
    openMail,
    waitForMessage,
    readMessage,
    dismissDisconnectionNotice,
} from '../helpers/common-actions.js';

test.setTimeout(600000);

test.describe('Scenario Generator', () => {
    test('Generate post-behind-enemy-lines fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-locked-out scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-locked-out');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, null, { timeout: 10000 });
        console.log('Step 1: Desktop visible, game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        const mailWindow = page.locator('.window:has-text("SNet Mail")');

        // ========================================
        // STEP 1b: Add credits for purchases
        // VPN Relay Module: 3,000 + Trace Monitor: 2,500 + Standard Relay Service: 30,000 = 35,500
        // Adding 36,000 to be safe
        // ========================================
        console.log('Step 1b: Adding buffer credits for tool purchases...');
        await page.evaluate(() => {
            const accounts = window.gameContext.bankAccounts;
            if (accounts && accounts.length > 0) {
                accounts[0].balance += 36000;
            }
        });

        // ========================================
        // STEP 2: Read relay-unlock message → triggers relay-service unlock + relay node generation
        // ========================================
        console.log('Step 2: Reading relay-unlock message...');

        await openMail(page);

        await readMessage(page, 'Relay System & Trace Monitor');
        await page.waitForTimeout(500);

        // Reading relay-unlock triggers evt-relay-activate (delay 0): unlockFeature + generateRelayNodes
        const relayUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('relay-service')
        );
        expect(relayUnlocked).toBe(true);

        const relayNodesGenerated = await page.evaluate(() =>
            (window.gameContext.relayNodes || []).length
        );
        expect(relayNodesGenerated).toBeGreaterThanOrEqual(6);
        console.log(`Step 2: Relay service unlocked, ${relayNodesGenerated} relay nodes generated`);

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 3: Purchase relay software and relay service from Portal
        // ========================================
        console.log('Step 3: Purchasing relay software and service...');

        await setSpeed(100);

        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');
        const modal = portal.locator('.modal-content');

        // Purchase VPN Relay Module
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        const relayItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'VPN Relay Module' })
        });
        await expect(relayItem).toBeVisible({ timeout: 5000 });
        await relayItem.locator('.purchase-btn').click();
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }
        await expect(relayItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 3a: VPN Relay Module purchased and installed');

        // Purchase Trace Monitor
        const traceItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Trace Monitor' })
        });
        await expect(traceItem).toBeVisible({ timeout: 5000 });
        await traceItem.locator('.purchase-btn').click();
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }
        await expect(traceItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 3b: Trace Monitor purchased and installed');

        // Purchase Standard Relay Service from Services tab (costs 30,000)
        await portal.locator('.section-btn:has-text("Services")').click();
        await page.waitForTimeout(300);

        const relayService = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Standard Relay Service' })
        });
        await expect(relayService).toBeVisible({ timeout: 5000 });
        await relayService.locator('.purchase-btn').click();
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }
        // Wait for purchase confirmation
        await page.waitForTimeout(1000);
        console.log('Step 3c: Standard Relay Service purchased');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 4: Wait for behind-enemy-lines mission
        // ========================================
        console.log('Step 4: Waiting for behind-enemy-lines mission...');

        // Mission triggers 10s game time after reading msg-relay-unlock
        await page.waitForFunction(
            () => {
                const board = window.gameContext.availableMissions || [];
                const active = window.gameContext.activeMission;
                return board.some(m => m.missionId === 'behind-enemy-lines') ||
                    active?.missionId === 'behind-enemy-lines';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 4: Mission available');

        // ========================================
        // STEP 5: Accept mission
        // ========================================
        console.log('Step 5: Accepting mission...');

        await openApp(page, 'Mission Board');
        const missionBoard = page.locator('.window:has-text("Mission Board")');

        const missionCard = missionBoard.locator('.mission-card:has-text("Behind Enemy Lines")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });
        await missionCard.locator('.accept-mission-btn').click();
        await page.waitForTimeout(500);
        console.log('Step 5: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 6: Activate NAR from the specific briefing message
        // ========================================
        console.log('Step 6: Activating NAR...');
        await setSpeed(10);

        await openMail(page);
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }
        await readMessage(page, 'Behind Enemy Lines - Coastal Power Authority');
        await page.waitForTimeout(300);

        const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
        await expect(narAttachment).toBeVisible({ timeout: 5000 });
        await narAttachment.click();
        await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
        await closeWindow(page, 'SNet Mail');

        await setSpeed(100);
        console.log('Step 6: NAR activated');

        // ========================================
        // STEP 7: Start Trace Monitor as passive app
        // ========================================
        console.log('Step 7: Starting Trace Monitor...');
        await page.hover('text=\u2630');
        await page.waitForTimeout(300);

        const traceMonitorBtn = page.locator('.app-launcher-menu >> text=Trace Monitor');
        if (await traceMonitorBtn.isVisible().catch(() => false)) {
            await traceMonitorBtn.click();
            await page.waitForTimeout(500);
        }
        console.log('Step 7: Trace Monitor started');

        // ========================================
        // STEP 8: Connect to Coastal-Ops through relay chain
        // ========================================
        console.log('Step 8: Connecting through relay chain...');

        // Use 10x speed for all trace-active operations (trace ETT = 360s game time;
        // at 100x that's only 3.6s real time which is too fast)
        await setSpeed(10);

        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');

        // Select Coastal-Ops network
        await vpn.locator('select').selectOption({ label: 'Coastal-Ops' });
        await page.waitForTimeout(300);

        // Expand relay panel
        await vpn.locator('.relay-panel-header').click();
        await page.waitForTimeout(300);

        // Select first 2 relay nodes for the chain
        const relayNodes = vpn.locator('.relay-node');
        const nodeCount = await relayNodes.count();
        if (nodeCount >= 2) {
            await relayNodes.nth(0).click();
            await page.waitForTimeout(200);
            await relayNodes.nth(1).click();
            await page.waitForTimeout(200);
        } else if (nodeCount >= 1) {
            await relayNodes.nth(0).click();
            await page.waitForTimeout(200);
        }
        console.log('Step 8a: Relay nodes selected');

        // Connect
        await vpn.locator('button:has-text("Connect")').click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        console.log('Step 8b: Connected through relay chain');

        await closeWindow(page, 'VPN Client');

        // Wait for connection objective
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-coastal');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 8c: Connection objective complete');

        // Scripted event (trace start) resets speed to 1x; wait then restore to 10x
        await page.waitForTimeout(2000);
        await setSpeed(10);

        // ========================================
        // STEP 9: Scan network (manual - don't use scanNetwork helper as it forces 100x speed)
        // ========================================
        console.log('Step 9: Scanning network...');

        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'Coastal-Ops' });
        await scanner.locator('button:has-text("Start Scan")').click();

        await expect(scanner.locator('text=ops-controller').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-scan-coastal');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 9: Scan objective complete');

        // ========================================
        // STEP 10: Investigate logs on ops-controller via Log Viewer
        // ========================================
        console.log('Step 10: Investigating logs...');

        await openApp(page, 'Log Viewer');
        const logViewer = page.locator('.window:has-text("Log Viewer")');

        // Switch to Device Logs tab
        await logViewer.locator('.log-viewer-tab:has-text("Device Logs")').click();
        await page.waitForTimeout(300);

        // Select ops-controller device from dropdown
        const deviceDropdown = logViewer.locator('select').last();
        await deviceDropdown.selectOption({ label: 'ops-controller (Coastal-Ops)' });
        await page.waitForTimeout(300);

        // Click View Logs
        await logViewer.locator('button:has-text("View Logs")').click();

        // Wait for logs to load (3s game time delay)
        await expect(logViewer.locator('.log-table')).toBeVisible({ timeout: 30000 });
        console.log('Step 10a: Logs loaded');

        // Wait for investigation objective to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-investigate-logs');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 10b: Investigation objective complete');

        await closeWindow(page, 'Log Viewer');

        // ========================================
        // STEP 11: Recover maintenance-records.db using Data Recovery Tool
        // ========================================
        console.log('Step 11: Recovering deleted file...');

        await openApp(page, 'Data Recovery Tool');
        const drt = page.locator('.window:has-text("Data Recovery Tool")');

        // Select the maintenance file system
        const drtDropdown = drt.locator('select').first();
        await drtDropdown.selectOption('fs-coastal-maintenance');
        await page.waitForTimeout(500);

        // Scan for deleted files
        await drt.locator('button:has-text("Scan for Deleted Files")').click();

        // Wait for scan to complete
        await page.waitForFunction(
            () => {
                // Check if scan is done by looking for deleted files in the list
                const scanBtn = document.querySelector('.window:has(.data-recovery-tool) .data-recovery-btn');
                return scanBtn && !scanBtn.disabled && scanBtn.textContent.includes('Scan');
            },
            null,
            { timeout: 60000 }
        );
        // Wait a bit more for the scan to fully finish
        await page.waitForTimeout(1000);
        console.log('Step 11a: Scan complete');

        // Select maintenance-records.db (deleted file)
        const deletedFile = drt.locator('.data-recovery-file-item.deleted:has-text("maintenance-records.db")');
        await expect(deletedFile).toBeVisible({ timeout: 5000 });
        await deletedFile.click();
        await page.waitForTimeout(200);
        console.log('Step 11b: Deleted file selected');

        // Click Restore button
        await drt.locator('button.restore').click();

        // Wait for restore to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-recover-maintenance');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 11c: File recovered, objective complete');

        await closeWindow(page, 'Data Recovery Tool');

        // ========================================
        // STEP 12: Wait for mission to complete
        // (Note: Coastal-Ops NAR is revoked on completion via revokeOnComplete: true)
        // ========================================
        console.log('Step 12: Waiting for mission completion...');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const completed = window.gameContext.completedMissions;
                return mission === null || completed?.some(m => m.missionId === 'behind-enemy-lines');
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 12: Mission completed');

        // Mission completion event resets speed; restore to 100x for messages
        await setSpeed(100);

        // ========================================
        // STEP 13: Wait for post-mission messages
        // Payment message (8s delay) and relay-practice-success (15s delay)
        // DO NOT read relay-practice-success — the next generator will read it
        // Note: sniffer-intro will NOT arrive here; it's gated behind 50k credits
        // ========================================
        console.log('Step 13: Waiting for post-mission messages...');

        await openMail(page);
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Payment for Behind Enemy Lines', 60000);
        console.log('Step 13a: Payment message arrived');

        await waitForMessage(page, 'relay', 60000);
        console.log('Step 13b: Relay practice success message arrived');

        // DO NOT read relay-practice-success — keep it unread for the next generator
        await dismissDisconnectionNotice(page);
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 14: Verify state
        // ========================================
        console.log('Step 14: Verifying state...');

        const completedMissions = await page.evaluate(() =>
            window.gameContext.completedMissions?.map(m => m.missionId) || []
        );
        expect(completedMissions).toContain('behind-enemy-lines');
        console.log('Step 14: State verified');

        // ========================================
        // STEP 15: Clean up and save
        // ========================================
        console.log('Step 15: Cleaning up and saving...');
        await setSpeed(1);

        // Clean up messages - keep only recent relevant ones
        await openMail(page);
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        const keepSubjects = [
            'Payment for Behind Enemy Lines',
            'relay',
            'Well Handled', // relay-practice-success — Gen 12 needs this unread
        ];

        let archiveLoopMax = 30;
        while (archiveLoopMax-- > 0) {
            const allMessages = mailWindow.locator('.message-item');
            const count = await allMessages.count();
            if (count === 0) break;

            let archivedOne = false;
            for (let i = 0; i < count; i++) {
                const msgText = await allMessages.nth(i).textContent();
                const shouldKeep = keepSubjects.some(s => msgText.toLowerCase().includes(s.toLowerCase()));
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

        await closeWindow(page, 'SNet Mail');

        // Close all windows
        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

        // Save
        page.once('dialog', async (dialog) => dialog.accept());
        await page.hover('text=\u23FB');
        await page.click('.dropdown-menu button:has-text("Sleep")');
        await expect(page.locator('.sleep-overlay')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });
        expect(saveData).not.toBeNull();

        const savedCompleted = saveData.completedMissions?.map(m =>
            typeof m === 'string' ? m : m.missionId
        );
        expect(savedCompleted).toContain('behind-enemy-lines');

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-behind-enemy-lines.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));

        console.log('\n=== Fixture State Summary ===');
        console.log(`Completed Missions: ${savedCompleted?.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Software: ${saveData.software?.join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log('Note: sniffer-intro gated behind 50k credits (not triggered by relay-practice-success)');
        console.log('=============================\n');

        console.log('Scenario generator complete: post-behind-enemy-lines');
    });
});

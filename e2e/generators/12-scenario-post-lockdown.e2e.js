/**
 * SCENARIO GENERATOR: post-lockdown
 *
 * Generates a fixture for the state after completing the lockdown mission.
 * This mission introduces the Network Sniffer for credential extraction
 * on a seized network under trace pressure, with a backup-to-safe-storage objective.
 *
 * Starting from: post-behind-enemy-lines scenario
 *
 * Steps:
 * 1. Load scenario, add 55,000 credits (sniffer costs 50k, threshold trigger also 50k)
 * 2. Read relay-practice-success message → sets creditThresholdForSniffer = 50000
 * 3. Emit creditsChanged to trigger sniffer-intro (gated behind 50k credits)
 * 4. Wait for sniffer-intro ("New Tool Available - Network Sniffer"), read it
 * 5. Purchase Network Sniffer from Portal (costs 50,000 credits)
 * 6. Wait for lockdown mission, accept it
 * 7. Read briefing, activate BOTH NAR attachments (pacific-freight + pfs-backup-safe)
 * 8. Connect through relays to PacificFreight-Core
 * 9. Scan network, use Network Sniffer to extract credentials
 * 10. Access logistics-primary, copy shipping-manifests-2020.db
 * 11. Connect to PFS-BackupSite (non-hostile), scan to discover safe-storage
 * 12. Open second File Manager, paste file to fs-pfs-safe-storage (obj-backup-data)
 * 13. Wait for mission completion + lockdown-complete message + payment
 * 14. Save fixture
 *
 * Final state:
 * - lockdown mission completed
 * - sniffer-tooling unlocked
 * - Network Sniffer installed
 * - pacific-freight NAR revoked on completion
 * - digital-manhunt triggers automatically (5s after lockdown completes)
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
    test('Generate post-lockdown fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-behind-enemy-lines scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-behind-enemy-lines');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, null, { timeout: 10000 });
        console.log('Step 1: Desktop visible');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        const mailWindow = page.locator('.window:has-text("SNet Mail")');

        // ========================================
        // STEP 1b: Add credits (Network Sniffer costs 50,000 + need 50k to trigger sniffer-intro)
        // ========================================
        console.log('Step 1b: Adding 55,000 credits for sniffer threshold and purchase...');
        await page.evaluate(() => {
            const accounts = window.gameContext.bankAccounts;
            if (accounts && accounts.length > 0) {
                accounts[0].balance += 55000;
            }
        });

        // ========================================
        // STEP 2: Read relay-practice-success message → sets creditThresholdForSniffer = 50000
        // ========================================
        console.log('Step 2: Reading relay-practice-success message...');

        await setSpeed(100);

        await openMail(page);
        await readMessage(page, 'Well Handled');
        await page.waitForTimeout(300);
        console.log('Step 2: Message read → creditThresholdForSniffer set to 50000');

        // ========================================
        // STEP 3: Trigger sniffer-intro by emitting creditsChanged (balance >= 50k threshold)
        // ========================================
        console.log('Step 3: Emitting creditsChanged to trigger sniffer-intro...');

        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        // Emit creditsChanged so the threshold listener fires
        await page.evaluate(() => {
            const { triggerEventBus } = window;
            const accounts = window.gameContext.bankAccounts;
            if (triggerEventBus && accounts && accounts.length > 0) {
                triggerEventBus.emit('creditsChanged', { newBalance: accounts[0].balance });
            }
        });

        // Wait for sniffer-intro message to arrive (5s game time delay at 100x = ~50ms)
        await waitForMessage(page, 'New Tool Available - Network Sniffer', 60000);
        await readMessage(page, 'New Tool Available - Network Sniffer');
        await page.waitForTimeout(500);
        console.log('Step 3: Sniffer intro read → lockdown triggers in 5s game time');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 4: Purchase Network Sniffer from Portal
        // ========================================
        console.log('Step 4: Purchasing Network Sniffer...');

        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');
        const modal = portal.locator('.modal-content');

        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        const snifferItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Network Sniffer' })
        });
        await expect(snifferItem).toBeVisible({ timeout: 5000 });
        await snifferItem.locator('.purchase-btn').click();

        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            await modal.locator('button:has-text("Confirm")').click();
            await page.waitForTimeout(200);
        }

        await expect(snifferItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 120000 });
        console.log('Step 4: Network Sniffer purchased and installed');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 5: Wait for lockdown mission and accept
        // ========================================
        console.log('Step 5: Waiting for lockdown mission...');

        await page.waitForFunction(
            () => {
                const board = window.gameContext.availableMissions || [];
                const active = window.gameContext.activeMission;
                return board.some(m => m.missionId === 'lockdown') ||
                    active?.missionId === 'lockdown';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 5a: Mission available');

        await openApp(page, 'Mission Board');
        const missionBoard = page.locator('.window:has-text("Mission Board")');

        const missionCard = missionBoard.locator('.mission-card:has-text("Lockdown")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });
        await missionCard.locator('.accept-mission-btn').click();
        await page.waitForTimeout(500);
        console.log('Step 5b: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 6: Activate BOTH NAR attachments from the briefing message
        // ========================================
        console.log('Step 6: Activating NAR (two attachments)...');
        await setSpeed(10);

        await openMail(page);
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }
        await readMessage(page, 'EMERGENCY: Complete Network Lockout');
        await page.waitForTimeout(300);

        // Click both NAR attachments (pacific-freight edge + pfs-backup-safe)
        const narAttachments = page.locator('.attachment-item:has-text("Click to add")');
        const attachmentCount = await narAttachments.count();
        console.log(`Step 6a: Found ${attachmentCount} NAR attachments`);

        for (let i = 0; i < attachmentCount; i++) {
            // Re-query each time since DOM may change after click
            const attachment = page.locator('.attachment-item:has-text("Click to add")').first();
            await expect(attachment).toBeVisible({ timeout: 5000 });
            await attachment.click();
            await page.waitForTimeout(500);
        }

        // Verify both were activated
        const activatedCount = await page.locator('.attachment-item:has-text("credentials used")').count();
        expect(activatedCount).toBeGreaterThanOrEqual(2);
        console.log(`Step 6b: ${activatedCount} NAR attachments activated`);

        await closeWindow(page, 'SNet Mail');

        console.log('Step 6: NAR activated for both networks');

        // ========================================
        // STEP 7: Connect to PacificFreight-Core through relays
        // ========================================
        console.log('Step 7: Connecting through relay chain...');

        // Use 10x speed for all trace-active operations
        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');

        await vpn.locator('select').selectOption({ label: 'PacificFreight-Core' });
        await page.waitForTimeout(300);

        // Expand relay panel and select nodes
        await vpn.locator('.relay-panel-header').click();
        await page.waitForTimeout(300);

        const relayNodes = vpn.locator('.relay-node');
        const nodeCount = await relayNodes.count();
        if (nodeCount >= 2) {
            await relayNodes.nth(0).click();
            await page.waitForTimeout(200);
            await relayNodes.nth(1).click();
            await page.waitForTimeout(200);
        }

        await vpn.locator('button:has-text("Connect")').click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        console.log('Step 7: Connected through relay chain');

        await closeWindow(page, 'VPN Client');

        // Wait for connection objective
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-pacific');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 7b: Connection objective complete');

        // Scripted event (trace start) resets speed to 1x; wait then restore to 10x
        await page.waitForTimeout(2000);
        await setSpeed(10);

        // ========================================
        // STEP 8: Scan network (manual - don't use scanNetwork helper as it forces 100x speed)
        // ========================================
        console.log('Step 8: Scanning network...');

        await openApp(page, 'Network Scanner');
        const scanner = page.locator('.window:has-text("Network Scanner")');
        await scanner.locator('select').selectOption({ label: 'PacificFreight-Core' });
        await scanner.locator('button:has-text("Start Scan")').click();

        await expect(scanner.locator('text=logistics-primary').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-scan-pacific');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 8: Scan complete');

        // ========================================
        // STEP 9: Use Network Sniffer to extract credentials
        // ========================================
        console.log('Step 9: Extracting credentials with Network Sniffer...');

        await openApp(page, 'Network Sniffer');
        const sniffer = page.locator('.window:has-text("Network Sniffer")');

        // Select PacificFreight-Core network
        await sniffer.locator('select').first().selectOption('pacific-freight');
        await page.waitForTimeout(500);

        // Click Extract Credentials mode (should be default, but click to be sure)
        const credModeBtn = sniffer.locator('.ns-mode-btn:has-text("Extract Credentials")');
        if (await credModeBtn.isVisible().catch(() => false)) {
            await credModeBtn.click();
            await page.waitForTimeout(200);
        }

        // Start Monitoring
        await sniffer.locator('button:has-text("Start Monitoring")').click();
        console.log('Step 9a: Monitoring started');

        // Wait for hash reconstruction to complete (60s base game time, at 10x = 6s)
        await page.waitForFunction(
            () => {
                // Check if the Extract Credentials button appears (signals reconstruction complete)
                const btn = document.querySelector('.window:has(.network-sniffer) .ns-extract-btn');
                return btn !== null;
            },
            null,
            { timeout: 120000 }
        );
        console.log('Step 9b: Reconstruction complete');

        // Click Extract Credentials
        await sniffer.locator('.ns-extract-btn').click();

        // Wait for credential extraction objective
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-sniff-credentials');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 9c: Credentials extracted');

        await closeWindow(page, 'Network Sniffer');

        // ========================================
        // STEP 10: Access logistics file system and copy file
        // ========================================
        console.log('Step 10: Accessing logistics system and copying file...');

        // Open File Manager and connect to fs-pf-logistics
        await openApp(page, 'File Manager');
        const fm1 = page.locator('.window:has-text("File Manager")').first();

        await fm1.locator('select').first().selectOption('fs-pf-logistics');
        await page.waitForTimeout(500);

        // Wait for fileSystemConnection objective
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-access-logistics');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 10a: File system connected');

        // Select shipping-manifests-2020.db and copy
        const targetFile = fm1.locator('.file-item:has-text("shipping-manifests-2020.db")');
        await expect(targetFile).toBeVisible({ timeout: 5000 });
        await targetFile.click();
        await page.waitForTimeout(200);

        await fm1.locator('button:has-text("Copy")').click();
        await page.waitForTimeout(300);
        console.log('Step 10b: File copied to clipboard');

        // ========================================
        // STEP 11: Connect to PFS-BackupSite and scan for safe-storage
        // ========================================
        console.log('Step 11: Connecting to PFS-BackupSite (non-hostile)...');

        // Stay at 10x — can't use 100x because PacificFreight-Core trace is still
        // active and would expire instantly, causing forced disconnection + clipboard clear.

        await openApp(page, 'VPN Client');
        const vpn2 = page.locator('.window:has-text("VPN Client")');

        await vpn2.locator('select').selectOption({ label: 'PFS-BackupSite' });
        await page.waitForTimeout(300);

        // No relay nodes needed for non-hostile network.
        // Use .connect-btn class because has-text("Connect") also matches "Disconnect"
        await vpn2.locator('button.connect-btn').click();
        await expect(vpn2.locator('text=PFS-BackupSite').first()).toBeVisible({ timeout: 30000 });
        console.log('Step 11a: Connected to PFS-BackupSite');

        await closeWindow(page, 'VPN Client');

        // Scan PFS-BackupSite to discover safe-storage
        await openApp(page, 'Network Scanner');
        const scanner2 = page.locator('.window:has-text("Network Scanner")');
        await scanner2.locator('select').selectOption({ label: 'PFS-BackupSite' });
        await scanner2.locator('button:has-text("Start Scan")').click();

        await expect(scanner2.locator('text=safe-storage').first()).toBeVisible({ timeout: 30000 });
        console.log('Step 11b: PFS-BackupSite scanned, safe-storage discovered');

        await closeWindow(page, 'Network Scanner');

        // ========================================
        // STEP 12: Switch File Manager to safe-storage, paste file
        // ========================================
        console.log('Step 12: Pasting file to safe-storage...');

        // Reuse the existing File Manager window — just switch to safe-storage.
        // Clipboard still has shipping-manifests-2020.db since we're still connected
        // to PacificFreight-Core (source network).
        await fm1.locator('select').first().selectOption('fs-pfs-safe-storage');
        await page.waitForTimeout(500);

        // Paste the copied file
        await fm1.locator('button:has-text("Paste")').click();

        // Wait for obj-backup-data objective to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-backup-data');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 12: File pasted, backup objective complete');

        await closeWindow(page, 'File Manager');

        // ========================================
        // STEP 13: Wait for mission completion
        // ========================================
        console.log('Step 13: Waiting for mission completion...');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const completed = window.gameContext.completedMissions;
                return mission === null || completed?.some(m => m.missionId === 'lockdown');
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 13: Mission completed');

        // Mission completion event resets speed; restore to 100x for messages
        await setSpeed(100);

        // ========================================
        // STEP 14: Wait for lockdown-complete message and payment
        // ========================================
        console.log('Step 14: Waiting for post-mission messages...');

        await openMail(page);
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Data Recovered - Pacific Freight', 60000);
        console.log('Step 14a: Lockdown complete message arrived');

        await waitForMessage(page, 'Payment for Lockdown', 60000);
        console.log('Step 14b: Payment arrived');

        await dismissDisconnectionNotice(page);
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 15: Clean up and save
        // ========================================
        console.log('Step 15: Saving...');
        await setSpeed(1);

        // Clear lingering trace state before saving (prevents issues when next generator loads this fixture at high speed)
        await page.evaluate(() => {
            if (window.gameContext?.setTraceState) {
                window.gameContext.setTraceState(null);
            }
        });

        await page.evaluate(() => {
            document.querySelectorAll('.window').forEach(win => {
                win.querySelector('.window-controls button:last-child')?.click();
            });
        });
        await page.waitForTimeout(200);

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
        expect(savedCompleted).toContain('lockdown');
        expect(saveData.unlockedFeatures).toContain('sniffer-tooling');

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-lockdown.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));

        console.log('\n=== Fixture State Summary ===');
        console.log(`Completed Missions: ${savedCompleted?.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Software: ${saveData.software?.join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-lockdown');
    });
});

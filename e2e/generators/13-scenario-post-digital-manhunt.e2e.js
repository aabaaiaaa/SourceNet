/**
 * SCENARIO GENERATOR: post-digital-manhunt
 *
 * Generates a fixture for the state after completing the digital-manhunt mission.
 * This is the final story mission combining all mechanics: relay chains, password
 * cracking, decryption, file operations across three hostile networks.
 *
 * Starting from: post-lockdown scenario
 *
 * Steps:
 * 1. digital-manhunt triggers automatically (30s game time after lockdown completes)
 * 2. Accept mission from Mission Board
 * 3. Read briefing message (no attachment), then read intro message
 *    "DarkNode-Alpha Credentials" to activate Alpha NAR
 * 4. Connect to DarkNode-Alpha through relays
 * 5. Scan Alpha, crack connection-logs.db (SHA-256), decrypt next-hop-credentials.enc
 * 6. Verify Beta objectives appear (progressive objectives via addExtensionObjectives)
 * 7. Wait for Beta credentials message, activate Beta NAR
 * 8. Connect to DarkNode-Beta, crack operator-notes.txt (MD5)
 * 9. Verify Origin objectives appear (progressive objectives via addExtensionObjectives)
 * 10. Wait for Origin credentials message, activate Origin NAR
 * 11. Connect to DarkNode-Origin, crack target-list.db (SHA-256)
 * 12. Copy operation-plan.pdf then paste to local SSD (destination: "local")
 * 13. Mission completes, wait for payment and aftermath messages
 * 14. Save fixture
 *
 * Progressive objectives:
 * - Initially visible: obj-connect-alpha, obj-crack-alpha-logs, obj-decrypt-next-hop
 * - After obj-decrypt-next-hop completes: obj-connect-beta, obj-crack-operator-notes added
 * - After obj-crack-operator-notes completes: obj-connect-origin, obj-crack-target-list,
 *   obj-copy-evidence added
 *
 * Progressive credential chain:
 * - Intro message "DarkNode-Alpha Credentials" provides Alpha NAR (sent on mission acceptance)
 * - Decrypting next-hop-credentials.enc -> Beta NAR arrives via "Next Hop Found" message
 * - Cracking operator-notes.txt -> Origin NAR arrives via "Origin Located" message
 *
 * Post-mission:
 * - All three darknode NARs revoked (revokeOnComplete: true)
 *
 * Final state:
 * - All story missions completed (locked-out through digital-manhunt)
 * - All features unlocked
 * - Placeholder for future story arcs
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
    test('Generate post-digital-manhunt fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-lockdown scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-lockdown');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, null, { timeout: 10000 });
        console.log('Step 1: Desktop visible');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');

        // Helper: go to mail inbox (open mail, navigate to list if needed)
        const goToMailInbox = async () => {
            await openMail(page);
            if (await backBtn.isVisible().catch(() => false)) {
                await backBtn.click();
                await page.waitForTimeout(200);
            }
        };

        // Helper: activate NAR attachment in currently-open message
        const activateNarAttachment = async (networkName) => {
            const narAttachment = page.locator('.attachment-item:has-text("Click to add")');
            await expect(narAttachment).toBeVisible({ timeout: 5000 });
            await narAttachment.click();
            await expect(page.locator('.attachment-item:has-text("credentials used")')).toBeVisible({ timeout: 5000 });
            console.log(`  NAR activated: ${networkName}`);
        };

        // Clear leftover trace state from lockdown mission before speeding up
        // (at 100x, a lingering trace would expire instantly, burning relay nodes)
        await page.evaluate(() => {
            if (window.gameContext?.setTraceState) {
                window.gameContext.setTraceState(null);
            }
        });

        await setSpeed(100);

        // ========================================
        // STEP 2: Wait for digital-manhunt mission (30s game time after lockdown completes)
        // ========================================
        console.log('Step 2: Waiting for digital-manhunt mission...');

        await page.waitForFunction(
            () => {
                const board = window.gameContext.availableMissions || [];
                const active = window.gameContext.activeMission;
                return board.some(m => m.missionId === 'digital-manhunt') ||
                    active?.missionId === 'digital-manhunt';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 2: Mission available');

        // ========================================
        // STEP 3: Accept mission
        // ========================================
        console.log('Step 3: Accepting mission...');

        await openApp(page, 'Mission Board');
        const missionBoard = page.locator('.window:has-text("Mission Board")');

        const missionCard = missionBoard.locator('.mission-card:has-text("Digital Manhunt")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });
        await missionCard.locator('.accept-mission-btn').click();
        await page.waitForTimeout(500);
        console.log('Step 3: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 4: Activate Alpha NAR from intro message
        // ========================================
        // The briefing ("Digital Manhunt - We Have a Lead") has no NAR attachment.
        // The Alpha NAR comes in a separate intro message ("DarkNode-Alpha Credentials")
        // sent when the mission becomes available.
        console.log('Step 4: Activating Alpha NAR...');
        await setSpeed(10);

        await goToMailInbox();

        // Read the briefing for context (no attachment)
        await readMessage(page, 'Digital Manhunt - We Have a Lead');
        await page.waitForTimeout(300);

        // Go back to inbox and read the intro message with the NAR attachment
        // (B1: intro message now fires on acceptance, not activation; wait for it)
        await backBtn.click();
        await page.waitForTimeout(200);

        await waitForMessage(page, 'DarkNode-Alpha Credentials', 60000);
        await readMessage(page, 'DarkNode-Alpha Credentials');
        await page.waitForTimeout(300);

        await activateNarAttachment('DarkNode-Alpha');
        await closeWindow(page, 'SNet Mail');

        // Stay at 10x for all trace-active operations (trace ETT = 600s;
        // at 100x that's only 6s real time which is too fast for cracking)
        console.log('Step 4: Alpha NAR activated');

        // ========================================
        // STEP 5: Connect to DarkNode-Alpha through relays
        // ========================================
        console.log('Step 5: Connecting to DarkNode-Alpha...');

        await openApp(page, 'VPN Client');
        const vpn = page.locator('.window:has-text("VPN Client")');

        await vpn.locator('select').selectOption({ label: 'DarkNode-Alpha' });
        await page.waitForTimeout(300);

        // Expand relay panel and select nodes
        await vpn.locator('.relay-panel-header').click();
        await page.waitForTimeout(300);

        const relayNodesList = vpn.locator('.relay-node');
        const nodeCount = await relayNodesList.count();
        if (nodeCount >= 2) {
            await relayNodesList.nth(0).click();
            await page.waitForTimeout(200);
            await relayNodesList.nth(1).click();
            await page.waitForTimeout(200);
        }

        await vpn.locator('button:has-text("Connect")').click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        console.log('Step 5: Connected to DarkNode-Alpha');

        await closeWindow(page, 'VPN Client');

        // Wait for connection objective
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-alpha');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );

        // Trace event resets speed to 1x; wait then restore to 10x
        await page.waitForTimeout(2000);
        await setSpeed(10);

        // ========================================
        // STEP 6: Scan DarkNode-Alpha then crack connection-logs.db
        // ========================================
        // Scan first (Password Cracker requires discovered devices)
        console.log('Step 6: Scanning DarkNode-Alpha...');
        await openApp(page, 'Network Scanner');
        const scannerAlpha = page.locator('.window:has-text("Network Scanner")');
        await scannerAlpha.locator('select').selectOption({ label: 'DarkNode-Alpha' });
        await scannerAlpha.locator('button:has-text("Start Scan")').click();
        await expect(scannerAlpha.locator('text=relay-alpha').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');
        console.log('Step 6a: DarkNode-Alpha scanned');

        await setSpeed(100);

        console.log('Step 6b: Cracking connection-logs.db...');
        await openApp(page, 'Password Cracker');
        const pc = page.locator('.window:has-text("Password Cracker")');

        await pc.locator('.pc-dropdown').selectOption('fs-alpha-relay');
        await page.waitForTimeout(500);

        const logsFile = pc.locator('.pc-file-item:has-text("connection-logs.db")');
        await expect(logsFile).toBeVisible({ timeout: 5000 });
        await logsFile.click();
        await page.waitForTimeout(300);

        await pc.locator('.pc-method-btn:has-text("Brute Force")').click();
        await page.waitForTimeout(200);
        await pc.locator('.pc-start-btn').click();

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-crack-alpha-logs');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 120000 }
        );
        console.log('Step 6b: Connection logs cracked');

        await closeWindow(page, 'Password Cracker');

        // ========================================
        // STEP 7: Decrypt next-hop-credentials.enc (AES-256)
        // ========================================
        console.log('Step 7: Decrypting next-hop credentials...');

        await openApp(page, 'Decryption Tool');
        const dt = page.locator('.window:has-text("Decryption Tool")');

        await dt.locator('select').selectOption('fs-alpha-relay');
        await page.waitForTimeout(500);

        const encFile = dt.locator('.decryption-file-item:has-text("next-hop-credentials.enc")');
        await expect(encFile).toBeVisible({ timeout: 5000 });
        await encFile.click();

        await dt.locator('button:has-text("Download")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'next-hop-credentials.enc');
            },
            null,
            { timeout: 60000 }
        );

        await dt.locator('button:has-text("Decrypt")').click();

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-decrypt-next-hop');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 120000 }
        );
        console.log('Step 7: Next-hop credentials decrypted');

        await closeWindow(page, 'Decryption Tool');

        // Verify Beta objectives appeared via addExtensionObjectives
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                return mission?.objectives?.some(o => o.id === 'obj-connect-beta');
            },
            null,
            { timeout: 10000 }
        );
        console.log('Step 7: Verified Beta objectives now visible');

        // Beta credentials event resets speed; restore to 10x
        await setSpeed(10);

        // ========================================
        // STEP 8: Wait for Beta credentials message, activate Beta NAR
        // ========================================
        console.log('Step 8: Waiting for Beta credentials...');

        // Beta credentials message arrives 2s after obj-decrypt-next-hop completes
        await goToMailInbox();
        await waitForMessage(page, 'Next Hop Found', 60000);
        await readMessage(page, 'Next Hop Found');
        await page.waitForTimeout(300);

        await activateNarAttachment('DarkNode-Beta');
        await closeWindow(page, 'SNet Mail');
        console.log('Step 8: Beta NAR activated');

        // ========================================
        // STEP 9: Connect to DarkNode-Beta
        // ========================================
        console.log('Step 9: Connecting to DarkNode-Beta...');

        await openApp(page, 'VPN Client');

        // Disconnect from Alpha first
        if (await vpn.locator('button:has-text("Disconnect")').isVisible().catch(() => false)) {
            await vpn.locator('button:has-text("Disconnect")').click();
            await page.waitForTimeout(500);
        }

        await vpn.locator('select').selectOption({ label: 'DarkNode-Beta' });
        await page.waitForTimeout(300);

        // Select relay nodes (relay panel should still be expanded)
        const relayNodes2 = vpn.locator('.relay-node');
        const nodeCount2 = await relayNodes2.count();

        // Clear previous selection first
        const clearBtn = vpn.locator('.relay-clear-btn');
        if (await clearBtn.isVisible().catch(() => false)) {
            await clearBtn.click();
            await page.waitForTimeout(200);
        }

        if (nodeCount2 >= 2) {
            // Select different nodes to vary the chain
            const startIdx = Math.min(2, nodeCount2 - 1);
            await relayNodes2.nth(startIdx).click();
            await page.waitForTimeout(200);
            if (startIdx + 1 < nodeCount2) {
                await relayNodes2.nth(startIdx + 1).click();
                await page.waitForTimeout(200);
            }
        }

        await vpn.locator('button:has-text("Connect")').click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        console.log('Step 9: Connected to DarkNode-Beta');

        await closeWindow(page, 'VPN Client');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-beta');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );

        // ========================================
        // STEP 10: Scan DarkNode-Beta then crack operator-notes.txt
        // ========================================
        // Scan first (Password Cracker requires discovered devices)
        console.log('Step 10: Scanning DarkNode-Beta...');
        await openApp(page, 'Network Scanner');
        const scannerBeta = page.locator('.window:has-text("Network Scanner")');
        await scannerBeta.locator('select').selectOption({ label: 'DarkNode-Beta' });
        await scannerBeta.locator('button:has-text("Start Scan")').click();
        await expect(scannerBeta.locator('text=relay-beta').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');
        console.log('Step 10a: DarkNode-Beta scanned');

        await setSpeed(100);

        console.log('Step 10b: Cracking operator-notes.txt...');
        await openApp(page, 'Password Cracker');

        await pc.locator('.pc-dropdown').selectOption('fs-beta-relay');
        await page.waitForTimeout(500);

        const notesFile = pc.locator('.pc-file-item:has-text("operator-notes.txt")');
        await expect(notesFile).toBeVisible({ timeout: 5000 });
        await notesFile.click();
        await page.waitForTimeout(300);

        await pc.locator('.pc-method-btn:has-text("Brute Force")').click();
        await page.waitForTimeout(200);
        await pc.locator('.pc-start-btn').click();

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-crack-operator-notes');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 10b: Operator notes cracked');

        await closeWindow(page, 'Password Cracker');

        // Verify Origin objectives appeared via addExtensionObjectives
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                return mission?.objectives?.some(o => o.id === 'obj-connect-origin');
            },
            null,
            { timeout: 10000 }
        );
        console.log('Step 10: Verified Origin objectives now visible');

        // Origin credentials event resets speed; restore to 10x
        await setSpeed(10);

        // ========================================
        // STEP 11: Wait for Origin credentials message, activate Origin NAR
        // ========================================
        console.log('Step 11: Waiting for Origin credentials...');

        // Origin credentials message arrives 2s after obj-crack-operator-notes completes
        await goToMailInbox();
        await waitForMessage(page, 'Origin Located', 60000);
        await readMessage(page, 'Origin Located');
        await page.waitForTimeout(300);

        await activateNarAttachment('DarkNode-Origin');
        await closeWindow(page, 'SNet Mail');
        console.log('Step 11: Origin NAR activated');

        // ========================================
        // STEP 12: Connect to DarkNode-Origin
        // ========================================
        console.log('Step 12: Connecting to DarkNode-Origin...');

        await openApp(page, 'VPN Client');

        if (await vpn.locator('button:has-text("Disconnect")').isVisible().catch(() => false)) {
            await vpn.locator('button:has-text("Disconnect")').click();
            await page.waitForTimeout(500);
        }

        await vpn.locator('select').selectOption({ label: 'DarkNode-Origin' });
        await page.waitForTimeout(300);

        // Clear and select relay nodes
        if (await clearBtn.isVisible().catch(() => false)) {
            await clearBtn.click();
            await page.waitForTimeout(200);
        }

        const relayNodes3 = vpn.locator('.relay-node');
        const nodeCount3 = await relayNodes3.count();
        if (nodeCount3 >= 2) {
            await relayNodes3.nth(0).click();
            await page.waitForTimeout(200);
            await relayNodes3.nth(1).click();
            await page.waitForTimeout(200);
        }

        await vpn.locator('button:has-text("Connect")').click();
        await expect(vpn.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 30000 });
        console.log('Step 12: Connected to DarkNode-Origin');

        await closeWindow(page, 'VPN Client');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-connect-origin');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 30000 }
        );

        // ========================================
        // STEP 13: Scan DarkNode-Origin then crack target-list.db
        // ========================================
        // Scan first (Password Cracker and File Manager require discovered devices)
        console.log('Step 13: Scanning DarkNode-Origin...');
        await openApp(page, 'Network Scanner');
        const scannerOrigin = page.locator('.window:has-text("Network Scanner")');
        await scannerOrigin.locator('select').selectOption({ label: 'DarkNode-Origin' });
        await scannerOrigin.locator('button:has-text("Start Scan")').click();
        await expect(scannerOrigin.locator('text=command-center').first()).toBeVisible({ timeout: 30000 });
        await closeWindow(page, 'Network Scanner');
        console.log('Step 13a: DarkNode-Origin scanned');

        await setSpeed(100);

        console.log('Step 13b: Cracking target-list.db...');
        await openApp(page, 'Password Cracker');

        await pc.locator('.pc-dropdown').selectOption('fs-origin-cc');
        await page.waitForTimeout(500);

        const targetFile = pc.locator('.pc-file-item:has-text("target-list.db")');
        await expect(targetFile).toBeVisible({ timeout: 5000 });
        await targetFile.click();
        await page.waitForTimeout(300);

        await pc.locator('.pc-method-btn:has-text("Brute Force")').click();
        await page.waitForTimeout(200);
        await pc.locator('.pc-start-btn').click();

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-crack-target-list');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 120000 }
        );
        console.log('Step 13b: Target list cracked');

        await closeWindow(page, 'Password Cracker');

        // ========================================
        // STEP 14: Copy operation-plan.pdf then paste to local SSD
        // ========================================
        // obj-copy-evidence uses operation "paste" with destination "local",
        // so we must copy the file to clipboard then paste it into local SSD.
        console.log('Step 14: Copying operation-plan.pdf to local SSD...');

        await openApp(page, 'File Manager');
        const fm = page.locator('.window:has-text("File Manager")').first();

        // Connect to Origin command-center file system
        await fm.locator('select').first().selectOption('fs-origin-cc');
        await page.waitForTimeout(500);

        const planFile = fm.locator('.file-item:has-text("operation-plan.pdf")');
        await expect(planFile).toBeVisible({ timeout: 5000 });
        await planFile.click();
        await page.waitForTimeout(200);

        // Copy file to clipboard
        await fm.locator('button:has-text("Copy")').click();
        await page.waitForTimeout(300);

        // Switch to local SSD file system (id "local")
        await fm.locator('select').first().selectOption('local');
        await page.waitForTimeout(500);

        // Paste the file to local SSD (destination "local" matches local SSD IP)
        await fm.locator('button:has-text("Paste")').click();

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-copy-evidence');
                return obj?.status === 'complete';
            },
            null,
            { timeout: 60000 }
        );
        console.log('Step 14: Evidence pasted to local SSD');

        await closeWindow(page, 'File Manager');

        // ========================================
        // STEP 15: Wait for mission completion
        // ========================================
        console.log('Step 15: Waiting for mission completion...');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const completed = window.gameContext.completedMissions;
                return mission === null || completed?.some(m => m.missionId === 'digital-manhunt');
            },
            null,
            { timeout: 30000 }
        );
        console.log('Step 15: Mission completed');

        // Mission completion event resets speed; restore to 100x for messages
        await setSpeed(100);

        // ========================================
        // STEP 16: Wait for post-mission messages
        // ========================================
        console.log('Step 16: Waiting for post-mission messages...');

        await goToMailInbox();

        await waitForMessage(page, 'Payment for Digital Manhunt', 60000);
        console.log('Step 16a: Payment arrived');

        // Manhunt aftermath arrives at 20s delay
        await waitForMessage(page, 'We Got Them', 120000);
        console.log('Step 16b: Aftermath message arrived');

        await dismissDisconnectionNotice(page);
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 17: Save
        // ========================================
        console.log('Step 17: Saving...');
        await setSpeed(1);

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
        expect(savedCompleted).toContain('digital-manhunt');

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-post-digital-manhunt.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));

        console.log('\n=== Fixture State Summary ===');
        console.log(`Completed Missions: ${savedCompleted?.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Software: ${saveData.software?.join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log(`Relay Nodes: ${saveData.relayNodes?.length || 0}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: post-digital-manhunt');
    });
});

/**
 * SCENARIO GENERATOR: pre-ransomware-trap
 *
 * This test generates a scenario fixture for the state just before the ransomware
 * trap triggers in the ransomware-recovery mission:
 * - All post-data-detective-completion state (data-detective completed)
 * - "Decryption Work" message read (decryption-tooling unlocked)
 * - Decryption Tool purchased and installed
 * - ransomware-recovery mission accepted and in progress
 * - MetroLink-Operations NAR added, connected, scanned
 * - Investigation objective complete (viewed ticketing-db logs)
 * - Malware securely deleted (svchost32.exe, winupdate.dll)
 * - ticketing-database.db.enc decrypted and uploaded
 * - crew-roster.db.enc decrypted and uploaded
 * - Extension objectives added (obj-decrypt-trap pending)
 * - passenger-data.dat.enc file present on ticketing-db but NOT yet decrypted
 *
 * Use Case: Testing both success path (decrypt trap → ransomware → antivirus → complete)
 * and failure path (ransomware → game over) from the same fixture.
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
    depositCheque,
    getObjectiveStatus,
} from '../helpers/common-actions.js';

test.setTimeout(600000);

test.describe('Scenario Generator', () => {
    test('Generate pre-ransomware-trap fixture', async ({ page }) => {
        // ========================================
        // STEP 1: Load post-data-detective-completion scenario
        // ========================================
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-completion');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });
        console.log('Step 1: Desktop visible, game context available');

        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 2: Read "Investigation Missions Unlocked" message
        // This sets the creditThresholdForDecryption
        // ========================================
        console.log('Step 2: Reading "Investigation Missions Unlocked" message...');
        await openMail(page);

        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Investigation Missions Unlocked', 5000);
        await readMessage(page, 'Investigation Missions Unlocked');
        await page.waitForTimeout(500);
        console.log('Step 2: Message read, creditThresholdForDecryption should be set');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 3: Inject credits to trigger the decryption-tease message
        // The threshold is currentBalance + 10000 (set when reading the message above).
        // creditThresholdForDecryption is internal state not exposed on gameContext,
        // so we inject a large fixed amount that will always exceed any threshold.
        // ========================================
        console.log('Step 3: Injecting credits to trigger decryption message...');

        const currentBalance = await page.evaluate(() =>
            window.gameContext.bankAccounts?.[0]?.balance || 0
        );
        const creditsToInject = 50000;
        console.log(`Step 3: Current balance: ${currentBalance}, injecting: ${creditsToInject}`);

        await page.evaluate((amount) => {
            window.gameContext.updateBankBalance('account-first-bank', amount, 'test-injection');
        }, creditsToInject);

        // Wait for the decryption-tease message to be sent (5s game time delay)
        await setSpeed(100);
        await page.waitForTimeout(500); // 50s game time
        await setSpeed(1);

        // ========================================
        // STEP 4: Read "Decryption Work" message (unlocks decryption-tooling)
        // ========================================
        console.log('Step 4: Reading "Decryption Work" message...');
        await openMail(page);

        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Decryption Work', 15000);
        await readMessage(page, 'Decryption Work');
        await page.waitForTimeout(500);
        console.log('Step 4: "Decryption Work" message read, decryption-tooling unlocked');

        // Verify decryption-tooling is unlocked
        const unlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('decryption-tooling')
        );
        expect(unlocked).toBe(true);

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 5: Purchase and install Decryption Tool from Portal
        // ========================================
        console.log('Step 5: Purchasing Decryption Tool...');
        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');

        // Switch to Software section
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        // Find and click Purchase on Decryption Tool
        const decryptionItem = portal.locator('.portal-item:has-text("Decryption Tool")');
        await expect(decryptionItem).toBeVisible({ timeout: 5000 });
        await decryptionItem.locator('.purchase-btn').click();

        // Confirm purchase in modal
        const modal = portal.locator('.modal-content');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await modal.locator('button:has-text("Confirm")').click();
        await page.waitForTimeout(200);

        // Wait for download to complete
        await setSpeed(100);
        await expect(decryptionItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
        await setSpeed(1);
        console.log('Step 5: Decryption Tool installed');

        await closeWindow(page, 'Portal');

        // ========================================
        // STEP 6: Wait for ransomware-recovery mission to appear and accept it
        // ========================================
        console.log('Step 6: Waiting for ransomware-recovery mission...');
        await setSpeed(100);

        let hasMission = false;
        for (let attempt = 0; attempt < 40; attempt++) {
            hasMission = await page.evaluate(() =>
                window.gameContext.availableMissions?.some(m => m.missionId === 'ransomware-recovery') || false
            );
            if (hasMission) {
                console.log(`Step 6: ransomware-recovery mission appeared after ${attempt + 1} attempts`);
                break;
            }
            await page.waitForTimeout(200);
        }
        await setSpeed(1);

        if (!hasMission) {
            const available = await page.evaluate(() =>
                window.gameContext.availableMissions?.map(m => m.missionId)
            );
            console.log('Available missions:', available);
            throw new Error('ransomware-recovery mission did not appear');
        }

        // Accept mission
        await openApp(page, 'Mission Board');
        await page.locator('.mission-board .tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        const missionCard = page.locator('.mission-card:has-text("Ransomware Recovery")');
        await expect(missionCard).toBeVisible({ timeout: 10000 });
        await missionCard.locator('button:has-text("Accept Mission")').click();
        await page.waitForTimeout(500);
        console.log('Step 6: Mission accepted');

        await closeWindow(page, 'Mission Board');

        // ========================================
        // STEP 7: Read briefing and activate NAR credentials
        // ========================================
        console.log('Step 7: Reading briefing and activating NAR...');
        await setSpeed(100);
        await page.waitForTimeout(300); // Let briefing message arrive
        await setSpeed(1);

        await openMail(page);
        const backBtn3 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn3.isVisible().catch(() => false)) {
            await backBtn3.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'URGENT: Ransomware Attack', 15000);
        await readMessage(page, 'URGENT: Ransomware Attack');

        // Activate NAR attachment
        const narAttachment = page.locator('[data-testid^="network-attachment-"]');
        await expect(narAttachment).toBeVisible({ timeout: 5000 });
        await narAttachment.click();
        await expect(page.locator('text=Network credentials used')).toBeVisible({ timeout: 5000 });
        console.log('Step 7: NAR credentials added (obj-nar complete)');

        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 8: Connect to MetroLink-Operations and scan network
        // ========================================
        console.log('Step 8: Connecting and scanning...');
        await connectToNetwork(page, 'MetroLink-Operations');
        console.log('Step 8: Connected (obj-connect complete)');

        await scanNetwork(page, 'MetroLink-Operations', 'ticketing-db');
        console.log('Step 8: Scanned (obj-scan complete)');

        // ========================================
        // STEP 9: Investigate - View ticketing-db logs
        // ========================================
        console.log('Step 9: Investigating ticketing-db logs...');
        await openApp(page, 'Log Viewer');
        const logViewer = page.locator('.window:has-text("Log Viewer")');

        await logViewer.locator('.log-viewer-tab:has-text("Device Logs")').click();
        await logViewer.locator('.log-controls select').selectOption('10.50.0.10');
        await logViewer.locator('.log-viewer-btn').click();

        await expect(logViewer.locator('.log-table')).toBeVisible({ timeout: 30000 });

        // Wait for obj-investigate to complete
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                if (!mission) return false;
                const obj = mission.objectives?.find(o => o.id === 'obj-investigate');
                return obj?.status === 'complete';
            },
            { timeout: 10000 }
        );
        console.log('Step 9: Investigation complete (obj-investigate complete)');

        await closeWindow(page, 'Log Viewer');

        // ========================================
        // STEP 10: Secure delete malware files using Data Recovery Tool
        // ========================================
        console.log('Step 10: Secure deleting malware...');
        await setSpeed(100);

        await openApp(page, 'Data Recovery Tool');
        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await page.waitForTimeout(300);

        // Select ticketing-db file system
        await drtWindow.locator('select').selectOption('fs-metro-ticketing');
        await page.waitForTimeout(500);

        // Select svchost32.exe
        const svchostItem = drtWindow.locator('.data-recovery-file-item:has-text("svchost32.exe")');
        await expect(svchostItem).toBeVisible({ timeout: 5000 });
        await svchostItem.click();

        // Select winupdate.dll
        const winupdateItem = drtWindow.locator('.data-recovery-file-item:has-text("winupdate.dll")');
        await expect(winupdateItem).toBeVisible({ timeout: 5000 });
        await winupdateItem.click();

        // Click Secure Delete
        await drtWindow.locator('button.secure-delete').click();

        // Wait for operations to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 60000 });

        // Verify files are gone
        await expect(svchostItem).not.toBeVisible({ timeout: 5000 });
        await expect(winupdateItem).not.toBeVisible({ timeout: 5000 });
        console.log('Step 10: Malware securely deleted (obj-delete-malware complete)');

        expect(await getObjectiveStatus(page, 'obj-delete-malware')).toBe('complete');

        await closeWindow(page, 'Data Recovery Tool');

        // ========================================
        // STEP 11: Decrypt and upload ticketing-database.db.enc
        // ========================================
        console.log('Step 11: Decrypting and uploading ticketing database...');

        await openApp(page, 'Decryption Tool');
        const dtWindow = page.locator('.window:has-text("Decryption Tool")');
        await page.waitForTimeout(300);

        // Select ticketing-db file system
        await dtWindow.locator('select').selectOption('fs-metro-ticketing');
        await page.waitForTimeout(500);

        // Select the encrypted file
        const ticketingFile = dtWindow.locator('.decryption-file-item:has-text("ticketing-database.db.enc")');
        await expect(ticketingFile).toBeVisible({ timeout: 5000 });
        await ticketingFile.click();

        // Download
        await dtWindow.locator('button:has-text("Download")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'ticketing-database.db.enc');
            },
            { timeout: 60000 }
        );
        console.log('Step 11a: File downloaded to local SSD');

        // Decrypt
        await dtWindow.locator('button:has-text("Decrypt")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'ticketing-database.db');
            },
            { timeout: 120000 }
        );
        console.log('Step 11b: File decrypted');

        // Upload
        await dtWindow.locator('button:has-text("Upload")').click();
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-upload-ticketing');
                return obj?.status === 'complete';
            },
            { timeout: 60000 }
        );
        console.log('Step 11c: Decrypted file uploaded (obj-decrypt-ticketing + obj-upload-ticketing complete)');

        expect(await getObjectiveStatus(page, 'obj-decrypt-ticketing')).toBe('complete');
        expect(await getObjectiveStatus(page, 'obj-upload-ticketing')).toBe('complete');

        // ========================================
        // STEP 12: Decrypt and upload crew-roster.db.enc
        // ========================================
        console.log('Step 12: Decrypting and uploading crew roster...');

        // Switch to scheduling-srv file system
        await dtWindow.locator('select').selectOption('fs-metro-scheduling');
        await page.waitForTimeout(500);

        // Select the encrypted file
        const crewFile = dtWindow.locator('.decryption-file-item:has-text("crew-roster.db.enc")');
        await expect(crewFile).toBeVisible({ timeout: 5000 });
        await crewFile.click();

        // Download
        await dtWindow.locator('button:has-text("Download")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'crew-roster.db.enc');
            },
            { timeout: 60000 }
        );
        console.log('Step 12a: File downloaded to local SSD');

        // Decrypt
        await dtWindow.locator('button:has-text("Decrypt")').click();
        await page.waitForFunction(
            () => {
                const files = window.gameContext.localSSDFiles || [];
                return files.some(f => f.name === 'crew-roster.db');
            },
            { timeout: 120000 }
        );
        console.log('Step 12b: File decrypted');

        // Upload
        await dtWindow.locator('button:has-text("Upload")').click();
        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                const obj = mission?.objectives?.find(o => o.id === 'obj-upload-scheduling');
                return obj?.status === 'complete';
            },
            { timeout: 60000 }
        );
        console.log('Step 12c: Decrypted file uploaded (obj-decrypt-scheduling + obj-upload-scheduling complete)');

        expect(await getObjectiveStatus(page, 'obj-decrypt-scheduling')).toBe('complete');
        expect(await getObjectiveStatus(page, 'obj-upload-scheduling')).toBe('complete');

        await closeWindow(page, 'Decryption Tool');

        // ========================================
        // STEP 13: Wait for extension objectives to be added
        // After obj-upload-scheduling completes, evt-extension-request fires after 8s delay
        // which adds obj-decrypt-trap and the passenger-data.dat.enc file
        // ========================================
        console.log('Step 13: Waiting for extension objectives...');

        await page.waitForFunction(
            () => {
                const mission = window.gameContext.activeMission;
                if (!mission) return false;
                return mission.objectives?.some(o => o.id === 'obj-decrypt-trap');
            },
            { timeout: 30000 }
        );
        console.log('Step 13: Extension objective added (obj-decrypt-trap pending)');

        // Verify extension message arrived
        await openMail(page);
        const backBtn4 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn4.isVisible().catch(() => false)) {
            await backBtn4.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'One More File', 10000);
        console.log('Step 13: Extension request message received');
        await closeWindow(page, 'SNet Mail');

        // Slow back down for save
        await setSpeed(1);

        // ========================================
        // STEP 14: Verify full objective state
        // ========================================
        console.log('Step 14: Verifying objective state...');
        const objectiveState = await page.evaluate(() => {
            const mission = window.gameContext.activeMission;
            if (!mission) return null;
            return {
                missionId: mission.missionId,
                objectives: mission.objectives.map(o => ({
                    id: o.id,
                    status: o.status,
                    type: o.type,
                })),
            };
        });

        if (!objectiveState) {
            throw new Error('No active mission found - fixture would be invalid');
        }

        expect(objectiveState.missionId).toBe('ransomware-recovery');

        // Verify all completed objectives
        const expectedComplete = [
            'obj-nar', 'obj-connect', 'obj-scan', 'obj-investigate',
            'obj-delete-malware',
            'obj-decrypt-ticketing', 'obj-upload-ticketing',
            'obj-decrypt-scheduling', 'obj-upload-scheduling',
        ];
        for (const id of expectedComplete) {
            const obj = objectiveState.objectives.find(o => o.id === id);
            expect(obj?.status, `Expected ${id} to be complete`).toBe('complete');
        }

        // Verify obj-decrypt-trap is still pending
        const trapObj = objectiveState.objectives.find(o => o.id === 'obj-decrypt-trap');
        expect(trapObj?.status, 'Expected obj-decrypt-trap to be pending').toBe('pending');

        // Verify obj-verify is still pending
        const verifyObj = objectiveState.objectives.find(o => o.id === 'obj-verify');
        expect(verifyObj?.status, 'Expected obj-verify to be pending').toBe('pending');

        console.log('Step 14: Objective state verified');
        for (const obj of objectiveState.objectives) {
            console.log(`  ${obj.id}: ${obj.status} (${obj.type})`);
        }

        // ========================================
        // STEP 15: Archive old messages, keep only relevant ones
        // ========================================
        console.log('Step 15: Cleaning up messages...');
        await openMail(page);

        const backBtn5 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn5.isVisible().catch(() => false)) {
            await backBtn5.click();
            await page.waitForTimeout(200);
        }

        // Archive all messages except mission-related ones
        const keepSubjects = ['URGENT: Ransomware Attack', 'One More File'];
        let archiveLoopMax = 30;
        while (archiveLoopMax-- > 0) {
            // Find messages that aren't in the keep list
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
                    break; // Re-check after archiving
                }
            }
            if (!archivedOne) break; // All remaining are keepers
        }

        console.log('Step 15: Messages cleaned up');
        await closeWindow(page, 'SNet Mail');

        // ========================================
        // STEP 16: Save fixture
        // ========================================
        console.log('Step 16: Saving game state...');

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
        console.log('Step 16: Game saved');

        // Extract and write fixture
        const saveData = await page.evaluate(() => {
            const saves = JSON.parse(localStorage.getItem('sourcenet_saves') || '{}');
            return saves['scenario_user']?.[0] || null;
        });

        expect(saveData).not.toBeNull();

        // Verify key state in save data
        const savedMission = saveData.activeMission;
        expect(savedMission?.missionId).toBe('ransomware-recovery');

        // Verify obj-decrypt-trap exists and is pending
        const savedTrapObj = savedMission?.objectives?.find(o => o.id === 'obj-decrypt-trap');
        expect(savedTrapObj).toBeTruthy();
        expect(savedTrapObj.status).toBe('pending');

        // Verify all initial objectives are complete
        for (const id of expectedComplete) {
            const obj = savedMission?.objectives?.find(o => o.id === id);
            expect(obj?.status, `Save: Expected ${id} to be complete`).toBe('complete');
        }

        const fixturePath = path.join(process.cwd(), 'src', 'debug', 'fixtures', 'scenario-pre-ransomware-trap.save.json');
        fs.writeFileSync(fixturePath, JSON.stringify(saveData, null, 2));
        console.log(`Fixture written to: ${fixturePath}`);

        // Summary
        const completedIds = savedMission?.objectives
            ?.filter(o => o.status === 'complete')
            .map(o => o.id) || [];
        const pendingIds = savedMission?.objectives
            ?.filter(o => o.status === 'pending')
            .map(o => o.id) || [];
        console.log('\n=== Fixture State Summary ===');
        console.log(`Active Mission: ${savedMission?.missionId}`);
        console.log(`Completed Objectives: ${completedIds.join(', ')}`);
        console.log(`Pending Objectives: ${pendingIds.join(', ')}`);
        console.log(`Credits: ${saveData.bankAccounts?.[0]?.balance || 0}`);
        console.log(`Messages count: ${saveData.messages?.length || 0}`);
        console.log(`Software: ${saveData.software?.map(s => typeof s === 'string' ? s : s.id).join(', ')}`);
        console.log(`Unlocked Features: ${saveData.unlockedFeatures?.join(', ')}`);
        console.log('=============================\n');

        console.log('Scenario generator complete: pre-ransomware-trap');
    });
});

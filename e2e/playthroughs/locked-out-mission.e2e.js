/**
 * Locked Out Mission Playthrough
 *
 * Verifies the complete locked-out mission gameplay flow:
 * - Setup: Read progression messages, buy algorithm packs + Password Cracker
 * - Mission: Connect to Meridian-Internal, scan for hr-server, crack two files
 * - Intrusion attack: Forced disconnect overlay, network actually disconnected
 * - Post-mission: relay-setup-pending unlocked, meridian NAR revoked
 * - Reboot: relay-unlock message arrives, reading it unlocks relay-service + generates relay nodes
 *
 * Loads from: post-ransomware-recovery scenario
 */

import { test, expect } from '@playwright/test';
import {
    loadScenario,
    addCredits,
    setSpecificTimeSpeed,
    openMail,
    closeWindow,
    waitForMessage,
    readMessage,
    purchaseFromPortal,
    waitForMission,
    acceptMission,
    activateNarFromMessage,
    connectToNetwork,
    scanNetwork,
    crackPassword,
    waitForObjectiveById,
    waitForMissionComplete,
    waitForAndDismissForcedDisconnection,
    dismissDisconnectionNotice,
    goToMailInbox,
    rebootGame,
} from '../helpers/common-actions.js';

test.describe('Locked Out Mission', () => {
    test('completes password cracking mission with intrusion attack and relay unlock', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Load scenario and prepare tools
        // ============================================================
        await loadScenario(page, 'post-ransomware-recovery');
        await addCredits(page, 15000);

        // Read CPU unlock and algorithm info messages (required for progression)
        await openMail(page);
        await readMessage(page, 'Hardware Upgrade');
        await page.waitForTimeout(300);
        await goToMailInbox(page);
        await readMessage(page, 'Algorithm Modules');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        // Verify cpu-upgrades unlocked by reading the message
        const cpuUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('cpu-upgrades')
        );
        expect(cpuUnlocked).toBe(true);

        // Buy algorithm packs at 100x speed
        await setSpecificTimeSpeed(page, 100);
        await purchaseFromPortal(page, 'Blowfish Decryption Module');
        await purchaseFromPortal(page, 'RSA-2048 Decryption Module');

        // Wait for story teaser and read it
        await goToMailInbox(page);
        await waitForMessage(page, 'Next Phase - Password Cracking', 60000);
        await readMessage(page, 'Next Phase - Password Cracking');
        await page.waitForTimeout(300);

        // Wait for cracking-intro message and read it (unlocks cracking-tooling)
        await goToMailInbox(page);
        await waitForMessage(page, 'Password Cracking Tools - Ready', 30000);
        await readMessage(page, 'Password Cracking Tools - Ready');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        const crackingUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('cracking-tooling')
        );
        expect(crackingUnlocked).toBe(true);

        // Purchase Password Cracker
        await purchaseFromPortal(page, 'Password Cracker');

        // ============================================================
        // Phase 1: Accept mission and set up network
        // ============================================================
        await waitForMission(page, 'locked-out');
        await acceptMission(page, 'Locked Out');

        // Verify mission is active
        const activeMissionId = await page.evaluate(() =>
            window.gameContext.activeMission?.missionId
        );
        expect(activeMissionId).toBe('locked-out');

        // Activate NAR from briefing message
        await setSpecificTimeSpeed(page, 10);
        await activateNarFromMessage(page, 'URGENT: Locked Out of Critical Systems');
        await setSpecificTimeSpeed(page, 100);

        // Connect to Meridian-Internal
        await connectToNetwork(page, 'Meridian-Internal');
        await waitForObjectiveById(page, 'obj-connect-meridian');

        // Scan network and find hr-server
        await scanNetwork(page, 'Meridian-Internal', 'hr-server');
        await waitForObjectiveById(page, 'obj-scan-meridian');

        // ============================================================
        // Phase 2: Password cracking (core gameplay verification)
        // ============================================================
        await setSpecificTimeSpeed(page, 100);

        // Crack personnel-records.db (MD5) on hr-server
        await crackPassword(page, 'fs-meridian-hr', 'personnel-records.db', 'obj-crack-personnel');

        // Verify progress bar reached 100% (it was visible during crack)
        // File should no longer be password-protected
        const personnelStillProtected = await page.evaluate(() => {
            const registry = window.networkRegistry;
            const fs = registry?.getFileSystem?.('fs-meridian-hr');
            return fs?.files?.find(f => f.name === 'personnel-records.db')?.passwordProtected;
        });
        expect(personnelStillProtected).toBeFalsy();

        // Crack payroll-Q4-2019.zip (SHA-256) on finance-server
        // Use keepOpen because intrusion attack fires shortly after both cracks complete
        // and the forced disconnect overlay will block the close button
        await crackPassword(page, 'fs-meridian-finance', 'payroll-Q4-2019.zip', 'obj-crack-payroll', { keepOpen: true });

        // ============================================================
        // Phase 3: Intrusion attack (forced disconnection)
        // ============================================================
        // Intrusion fires 5s game time after both cracks complete (compound trigger)
        await waitForAndDismissForcedDisconnection(page, 30000);

        // Scripted event resets speed to 1x; restore
        await setSpecificTimeSpeed(page, 100);

        await closeWindow(page, 'Password Cracker');

        // Verify network is actually disconnected
        const isConnected = await page.evaluate(() =>
            (window.gameContext.activeConnections || []).some(c => c.networkId === 'meridian-internal')
        );
        expect(isConnected).toBe(false);

        // Read intrusion alert → mission completes
        await goToMailInbox(page);
        await waitForMessage(page, 'ALERT: They Found You', 30000);
        await readMessage(page, 'ALERT: They Found You');
        await page.waitForTimeout(500);
        await closeWindow(page, 'SNet Mail');

        // ============================================================
        // Phase 4: Post-mission verification
        // ============================================================
        await waitForMissionComplete(page, 'locked-out');

        // Verify completed with success status
        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'locked-out' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);

        // Verify relay-setup-pending is set (NOT relay-service yet)
        const features = await page.evaluate(() => window.gameContext.unlockedFeatures);
        expect(features).toContain('relay-setup-pending');
        expect(features).not.toContain('relay-service');

        // Verify meridian-internal NAR was revoked
        const meridianAccessible = await page.evaluate(() => {
            const registry = window.networkRegistry;
            const network = registry?.getNetwork?.('meridian-internal');
            return network?.accessible;
        });
        expect(meridianAccessible).toBeFalsy();

        // Wait for payment message before rebooting (or timer is lost)
        await dismissDisconnectionNotice(page);
        await goToMailInbox(page);
        await waitForMessage(page, 'Payment for Locked Out', 60000);
        await closeWindow(page, 'SNet Mail');

        // ============================================================
        // Phase 5: Reboot and relay unlock
        // ============================================================
        await setSpecificTimeSpeed(page, 1);
        await rebootGame(page);
        await setSpecificTimeSpeed(page, 100);

        // Verify relay-setup-pending was cleared after reboot
        const pendingCleared = await page.evaluate(() =>
            !window.gameContext.unlockedFeatures?.includes('relay-setup-pending')
        );
        expect(pendingCleared).toBe(true);

        // Wait for relay unlock message (5s game time after desktopLoaded)
        await goToMailInbox(page);
        await waitForMessage(page, 'Relay System & Trace Monitor', 60000);

        // Read relay unlock message → should unlock relay-service + generate relay nodes
        await readMessage(page, 'Relay System & Trace Monitor');
        await page.waitForTimeout(500);

        const relayUnlocked = await page.evaluate(() =>
            window.gameContext.unlockedFeatures?.includes('relay-service')
        );
        expect(relayUnlocked).toBe(true);

        const relayNodeCount = await page.evaluate(() =>
            (window.gameContext.relayNodes || []).length
        );
        expect(relayNodeCount).toBeGreaterThanOrEqual(6);

        await closeWindow(page, 'SNet Mail');

        console.log('\n=== Locked Out Mission Playthrough Complete ===');
        console.log(`Relay nodes generated: ${relayNodeCount}`);
        console.log('All assertions passed');
    });
});

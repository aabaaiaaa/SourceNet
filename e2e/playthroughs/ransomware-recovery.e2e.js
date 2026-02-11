/**
 * Ransomware Recovery Mission E2E Tests
 *
 * Tests the ransomware-recovery story mission using the pre-ransomware-trap
 * scenario fixture. The fixture has:
 * - ransomware-recovery mission active with all objectives complete except
 *   obj-decrypt-trap and obj-verify
 * - Connected to MetroLink-Operations network
 * - Decryption Tool installed
 * - passenger-data.dat.enc file present on ticketing-db server
 *
 * Test paths:
 * - Success (antivirus): Decrypt trap file → ransomware triggers → install antivirus →
 *   ransomware paused → mission completes → payment received
 * - Success (decryption key): Decrypt trap file → ransomware reaches 100% → grace period →
 *   forced reboot → lock screen → enter "rosebud" → desktop → confused manager message →
 *   mission completes → payment received
 */

import { test, expect } from '@playwright/test';
import {
    openApp,
    closeWindow,
    openMail,
    waitForMessage,
    readMessage,
    depositCheque,
    dismissForcedDisconnectionOverlay,
    setSpecificTimeSpeed,
    connectToNetwork,
} from '../helpers/common-actions.js';

/**
 * Helper: Decrypt the trap file (passenger-data.dat.enc) using the Decryption Tool.
 * Assumes the fixture is loaded and time speed is set to 100x.
 */
async function decryptTrapFile(page) {
    await openApp(page, 'Decryption Tool');
    const dtWindow = page.locator('.window:has-text("Decryption Tool")');
    await page.waitForTimeout(300);

    // Select fs-metro-ticketing file system
    await dtWindow.locator('select').selectOption('fs-metro-ticketing');
    await page.waitForTimeout(500);

    // Select passenger-data.dat.enc
    const trapFile = dtWindow.locator('.decryption-file-item:has-text("passenger-data.dat.enc")');
    await expect(trapFile).toBeVisible({ timeout: 5000 });
    await trapFile.click();

    // Download
    await dtWindow.locator('button:has-text("Download")').click();
    await page.waitForFunction(
        () => {
            const files = window.gameContext.localSSDFiles || [];
            return files.some(f => f.name === 'passenger-data.dat.enc');
        },
        { timeout: 60000 }
    );
    console.log('Trap file downloaded to local SSD');

    // Decrypt
    await dtWindow.locator('button:has-text("Decrypt")').click();
    await page.waitForFunction(
        () => {
            const files = window.gameContext.localSSDFiles || [];
            return files.some(f => f.name === 'passenger-data.dat');
        },
        { timeout: 120000 }
    );
    console.log('Trap file decrypted (obj-decrypt-trap complete)');

    await closeWindow(page, 'Decryption Tool');
}

/**
 * Helper: Load the pre-ransomware-trap fixture and verify initial state.
 */
async function loadFixtureAndVerify(page) {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?scenario=pre-ransomware-trap&debug=true');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

    // Verify mission state
    const missionState = await page.evaluate(() => {
        const mission = window.gameContext.activeMission;
        if (!mission) return null;
        return {
            missionId: mission.missionId,
            trapStatus: mission.objectives?.find(o => o.id === 'obj-decrypt-trap')?.status,
            verifyStatus: mission.objectives?.find(o => o.id === 'obj-verify')?.status,
        };
    });
    expect(missionState?.missionId).toBe('ransomware-recovery');
    expect(missionState?.trapStatus).toBe('pending');
    expect(missionState?.verifyStatus).toBe('pending');
    console.log('Fixture loaded: ransomware-recovery active, obj-decrypt-trap pending');
}

test.describe('Ransomware Recovery Mission', () => {
    test('completes ransomware recovery mission successfully', async ({ page }) => {
        await loadFixtureAndVerify(page);

        // Record initial credits
        const initialCredits = await page.evaluate(() => window.gameContext.getTotalCredits());
        console.log(`Initial credits: ${initialCredits}`);

        // Set 100x speed for fast file operations
        await setSpecificTimeSpeed(page, 100);

        // Connect to MetroLink-Operations (disconnected on save/sleep)
        await connectToNetwork(page, 'MetroLink-Operations');
        console.log('Connected to MetroLink-Operations');

        // Decrypt the trap file
        await decryptTrapFile(page);

        // Wait for ransomware overlay to appear (triggers 2s game time after obj-decrypt-trap)
        await expect(page.locator('.ransomware-overlay')).toBeVisible({ timeout: 15000 });
        console.log('Ransomware overlay appeared');

        // Slow down time so ransomware doesn't complete before we can install AV
        // (at 100x, the 60s ransomware finishes in 600ms real time)
        await setSpecificTimeSpeed(page, 10);

        // Verify ransomware shows encryption text
        await expect(
            page.locator('.ransomware-overlay:has-text("ENCRYPTING")')
        ).toBeVisible({ timeout: 5000 });
        console.log('Ransomware shows ENCRYPTING status');

        // Wait for rescue message (evt-manager-rescue fires 5s game time after ransomware)
        await page.waitForFunction(
            () => {
                const messages = window.gameContext.messages || [];
                return messages.some(m => m.subject && m.subject.includes('EMERGENCY'));
            },
            { timeout: 30000 }
        );
        console.log('Emergency rescue message received');

        // Move ransomware overlay to bottom-right corner so it doesn't block UI
        const overlayHeader = page.locator('.ransomware-header');
        const headerBox = await overlayHeader.boundingBox();
        if (headerBox) {
            await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
            await page.mouse.down();
            await page.mouse.move(800, 500, { steps: 5 });
            await page.mouse.up();
        }
        console.log('Ransomware overlay moved aside');

        // Read rescue message and activate software license
        await openMail(page);
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'EMERGENCY');
        await readMessage(page, 'EMERGENCY');

        // Click the software license attachment
        const licenseAttachment = page.locator('.attachment-item:has-text("Click to add")');
        await expect(licenseAttachment).toBeVisible({ timeout: 5000 });
        await licenseAttachment.click();
        await expect(page.locator('.attachment-item:has-text("Activated")')).toBeVisible({ timeout: 5000 });
        console.log('Software license activated');

        await closeWindow(page, 'SNet Mail');

        // Install antivirus from Portal
        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');
        const avItem = portal.locator('.portal-item:has-text("Advanced Firewall")');
        await expect(avItem).toBeVisible({ timeout: 5000 });

        // Click "Install (Licensed)" button
        await avItem.locator('.install-btn, .purchase-btn').click();

        // Wait for download to complete
        await expect(avItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
        console.log('Advanced Firewall & Antivirus installed');

        await closeWindow(page, 'Portal');

        // Activate antivirus from app launcher (passive software)
        await page.hover('text=☰');
        await page.click('.app-launcher-menu button:has-text("Advanced Firewall")');
        await page.waitForTimeout(300);
        console.log('Antivirus activated (passive software started)');

        // Restore 100x speed now that AV is running
        await setSpecificTimeSpeed(page, 100);

        // Verify ransomware overlay is paused
        await expect(page.locator('.ransomware-overlay.paused')).toBeVisible({ timeout: 10000 });
        console.log('Ransomware overlay paused');

        // Verify ransomware shows "HALTED" text
        await expect(
            page.locator('.ransomware-overlay:has-text("HALTED")')
        ).toBeVisible({ timeout: 5000 });
        console.log('Ransomware shows HALTED status');

        // Verify security indicator appears in top bar
        await expect(page.locator('.security-indicator')).toBeVisible({ timeout: 5000 });
        console.log('Security indicator visible');

        // Wait for resolution message
        await page.waitForFunction(
            () => {
                const messages = window.gameContext.messages || [];
                return messages.some(m => m.subject && m.subject.includes('Crisis Averted'));
            },
            { timeout: 30000 }
        );
        console.log('Resolution message received');

        // Verify ransomware recovery payment has NOT arrived yet
        // (mission shouldn't complete before reading resolution message)
        const hasPaymentEarly = await page.evaluate(() => {
            const messages = window.gameContext.messages || [];
            return messages.some(m => m.subject && m.subject.includes('Payment for Ransomware'));
        });
        expect(hasPaymentEarly).toBe(false);
        console.log('Verified: no ransomware payment before reading Crisis Averted');

        // Read resolution message (triggers evt-mission-complete → setMissionStatus success)
        await openMail(page);
        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'Crisis Averted');
        await readMessage(page, 'Crisis Averted');
        await closeWindow(page, 'SNet Mail');

        // Wait for mission to complete (via obj-verify triggered by setMissionStatus:success)
        await page.waitForFunction(
            () => window.gameContext.activeMission === null,
            { timeout: 30000 }
        );
        console.log('Mission completed (activeMission is null)');

        // Verify mission completed as success
        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'ransomware-recovery' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);
        console.log('Mission verified as success');

        // Dismiss forced disconnection overlay (network revoked on complete)
        try {
            await dismissForcedDisconnectionOverlay(page, 10000);
            console.log('Forced disconnection dismissed');
        } catch {
            console.log('No forced disconnection overlay (may have been too fast)');
        }

        // Wait for ransomware overlay to disappear (cleanup timer)
        await expect(page.locator('.ransomware-overlay')).not.toBeVisible({ timeout: 30000 });
        console.log('Ransomware overlay cleaned up');

        // Wait for payment message
        await page.waitForFunction(
            () => {
                const messages = window.gameContext.messages || [];
                return messages.some(m => m.subject && m.subject.includes('Payment for Ransomware'));
            },
            { timeout: 30000 }
        );
        console.log('Payment message received');

        // Open mail, deposit cheque
        await openMail(page);
        const backBtn3 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn3.isVisible().catch(() => false)) {
            await backBtn3.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'Payment for Ransomware');
        await readMessage(page, 'Payment for Ransomware');
        await depositCheque(page);
        console.log('Cheque deposited');

        // Verify credits increased
        const finalCredits = await page.evaluate(() => window.gameContext.getTotalCredits());
        expect(finalCredits).toBeGreaterThan(initialCredits);
        console.log(`Credits: ${initialCredits} → ${finalCredits}`);

        await closeWindow(page, 'SNet Mail');
    });

    test('ransomware lockout and decryption key recovery', async ({ page }) => {
        await loadFixtureAndVerify(page);

        // Record initial credits
        const initialCredits = await page.evaluate(() => window.gameContext.getTotalCredits());
        console.log(`Initial credits: ${initialCredits}`);

        // Use 100x speed for file operations
        await setSpecificTimeSpeed(page, 100);

        // Connect to MetroLink-Operations (disconnected on save/sleep)
        await connectToNetwork(page, 'MetroLink-Operations');
        console.log('Connected to MetroLink-Operations');

        // Decrypt the trap file
        await decryptTrapFile(page);

        // Wait for ransomware overlay to appear
        await expect(page.locator('.ransomware-overlay')).toBeVisible({ timeout: 15000 });
        console.log('Ransomware overlay appeared');

        // DO NOT install antivirus - let ransomware progress to 100%
        // At 100x speed: 60s game time = 600ms real, 3s grace = 30ms real
        // Wait for ransomware lock screen to appear (scenario param skips boot)
        await expect(page.locator('.ransomware-lock-screen')).toBeVisible({ timeout: 30000 });
        console.log('Ransomware lock screen appeared');

        // Verify lock screen content
        await expect(page.locator('.lock-screen-content')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.lock-screen-line:has-text("LOCKED")')).toBeVisible({ timeout: 5000 });
        console.log('Lock screen content verified (skull + encryption details)');

        // Wait for terminal input to appear (typewriter completes ~2s real time)
        await expect(page.locator('.terminal-input')).toBeVisible({ timeout: 10000 });
        console.log('Terminal input visible');

        // Test wrong key
        await page.locator('.terminal-input').fill('wrongkey');
        await page.locator('.terminal-input').press('Enter');
        await expect(page.locator('.terminal-error')).toBeVisible({ timeout: 3000 });
        console.log('Wrong key shows INVALID KEY error');

        // Wait for game over modal (3 real seconds after text completes)
        await expect(page.locator('.ransomware-game-over-modal')).toBeVisible({ timeout: 10000 });
        console.log('Game over modal appeared');

        // Verify game over modal buttons
        await expect(page.locator('.game-over-btn:has-text("Load Previous Save")')).toBeVisible();
        await expect(page.locator('.game-over-btn:has-text("Return to Main Menu")')).toBeVisible();
        console.log('Game over modal buttons verified');

        // Enter correct decryption key (input should still be clickable behind modal)
        await page.locator('.terminal-input').fill('rosebud');
        await page.locator('.terminal-input').press('Enter');
        console.log('Entered decryption key: rosebud');

        // Verify desktop loads and game over modal is gone
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.ransomware-game-over-modal')).not.toBeVisible({ timeout: 5000 });
        console.log('Desktop loaded, game over modal dismissed');

        // Verify mission is still active (not failed)
        const missionActive = await page.evaluate(() => {
            const active = window.gameContext.activeMission;
            const failedInCompleted = window.gameContext.completedMissions?.some(
                m => m.missionId === 'ransomware-recovery' && m.status === 'failed'
            );
            return { isActive: active?.missionId === 'ransomware-recovery', isFailed: failedInCompleted };
        });
        expect(missionActive.isFailed).toBe(false);
        console.log(`Mission still active: ${missionActive.isActive}, failed: ${missionActive.isFailed}`);

        // Wait for confused manager message (evt-ransomware-decrypted fires with 3s delay)
        await page.waitForFunction(
            () => {
                const messages = window.gameContext.messages || [];
                return messages.some(m => m.subject && m.subject.includes('How Are You Back Online'));
            },
            { timeout: 30000 }
        );
        console.log('Confused manager message received');

        // Read the confused manager message
        await openMail(page);
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'How Are You Back Online');
        await readMessage(page, 'How Are You Back Online');
        await closeWindow(page, 'SNet Mail');
        console.log('Read confused manager message');

        // Wait for mission to complete
        await page.waitForFunction(
            () => window.gameContext.activeMission === null,
            { timeout: 30000 }
        );
        console.log('Mission completed (activeMission is null)');

        // Verify mission completed as success
        const isSuccess = await page.evaluate(() =>
            window.gameContext.completedMissions.some(
                m => m.missionId === 'ransomware-recovery' && m.status === 'success'
            )
        );
        expect(isSuccess).toBe(true);
        console.log('Mission verified as success');

        // Dismiss forced disconnection overlay (network revoked on complete)
        try {
            await dismissForcedDisconnectionOverlay(page, 10000);
            console.log('Forced disconnection dismissed');
        } catch {
            console.log('No forced disconnection overlay (may have been too fast)');
        }

        // Wait for payment message
        await page.waitForFunction(
            () => {
                const messages = window.gameContext.messages || [];
                return messages.some(m => m.subject && m.subject.includes('Payment for Ransomware'));
            },
            { timeout: 30000 }
        );
        console.log('Payment message received');

        // Open mail, deposit cheque
        await openMail(page);
        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'Payment for Ransomware');
        await readMessage(page, 'Payment for Ransomware');
        await depositCheque(page);
        console.log('Cheque deposited');

        // Verify credits increased
        const finalCredits = await page.evaluate(() => window.gameContext.getTotalCredits());
        expect(finalCredits).toBeGreaterThan(initialCredits);
        console.log(`Credits: ${initialCredits} → ${finalCredits}`);

        await closeWindow(page, 'SNet Mail');
    });
});

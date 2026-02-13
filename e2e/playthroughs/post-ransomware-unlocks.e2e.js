/**
 * Post-Ransomware Unlock E2E Tests
 *
 * Verifies the post-ransomware progression flow:
 * - After ransomware-recovery completes: decryption-algorithms + decryption-missions unlocked
 * - CPU unlock message arrives (15s game delay), algorithm info message arrives (25s game delay)
 * - Reading CPU message unlocks cpu-upgrades (processors visible in Portal)
 * - Algorithm packs (Blowfish, RSA-2048) appear in Portal and can be purchased/installed
 * - Decryption missions appear on the Mission Board
 *
 * Uses the pre-ransomware-trap fixture and completes the mission via the antivirus path.
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
 * Helper: Load fixture and complete ransomware-recovery via antivirus path.
 * Returns with mission complete, payment deposited, speed at 1x.
 */
async function completeRansomwareMission(page) {
    // Capture page errors for debugging
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`CONSOLE ERROR: ${msg.text()}`);
    });

    // Load fixture
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?scenario=pre-ransomware-trap&debug=true');
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => window.gameContext?.setSpecificTimeSpeed, { timeout: 10000 });

    // Verify mission state
    const missionState = await page.evaluate(() => {
        const mission = window.gameContext.activeMission;
        return mission?.missionId;
    });
    expect(missionState).toBe('ransomware-recovery');

    // 100x speed for file operations
    await setSpecificTimeSpeed(page, 100);

    // Connect to MetroLink-Operations (disconnected on save/sleep)
    await connectToNetwork(page, 'MetroLink-Operations');

    // Decrypt trap file
    await openApp(page, 'Decryption Tool');
    const dtWindow = page.locator('.window:has-text("Decryption Tool")');
    await page.waitForTimeout(300);
    await dtWindow.locator('select').selectOption('fs-metro-ticketing');
    await page.waitForTimeout(500);

    const trapFile = dtWindow.locator('.decryption-file-item:has-text("passenger-data.dat.enc")');
    await expect(trapFile).toBeVisible({ timeout: 5000 });
    await trapFile.click();

    await dtWindow.locator('button:has-text("Download")').click();
    await page.waitForFunction(
        () => (window.gameContext.localSSDFiles || []).some(f => f.name === 'passenger-data.dat.enc'),
        { timeout: 60000 }
    );

    await dtWindow.locator('button:has-text("Decrypt")').click();
    await page.waitForFunction(
        () => (window.gameContext.localSSDFiles || []).some(f => f.name === 'passenger-data.dat'),
        { timeout: 120000 }
    );
    await closeWindow(page, 'Decryption Tool');

    // Wait for ransomware overlay
    await expect(page.locator('.ransomware-overlay')).toBeVisible({ timeout: 15000 });

    // Slow down so we can install AV before ransomware completes
    await setSpecificTimeSpeed(page, 10);

    // Wait for rescue message
    await page.waitForFunction(
        () => (window.gameContext.messages || []).some(m => m.subject?.includes('EMERGENCY')),
        { timeout: 30000 }
    );

    // Move ransomware overlay aside
    const overlayHeader = page.locator('.ransomware-header');
    const headerBox = await overlayHeader.boundingBox();
    if (headerBox) {
        await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(800, 500, { steps: 5 });
        await page.mouse.up();
    }

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

    const licenseAttachment = page.locator('.attachment-item:has-text("Click to add")');
    await expect(licenseAttachment).toBeVisible({ timeout: 5000 });
    await licenseAttachment.click();
    await expect(page.locator('.attachment-item:has-text("Activated")')).toBeVisible({ timeout: 5000 });
    await closeWindow(page, 'SNet Mail');

    // Install antivirus from Portal
    await openApp(page, 'Portal');
    const portal = page.locator('.window:has-text("Portal")');
    const avItem = portal.locator('.portal-item:has-text("Advanced Firewall")');
    await expect(avItem).toBeVisible({ timeout: 5000 });
    await avItem.locator('.install-btn, .purchase-btn').click();
    await expect(avItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
    await closeWindow(page, 'Portal');

    // Activate antivirus
    await page.hover('text=☰');
    await page.click('.app-launcher-menu button:has-text("Advanced Firewall")');
    await page.waitForTimeout(300);

    // Speed up again
    await setSpecificTimeSpeed(page, 100);

    // Wait for ransomware to be halted
    await expect(page.locator('.ransomware-overlay.paused')).toBeVisible({ timeout: 10000 });

    // Wait for resolution message
    await page.waitForFunction(
        () => (window.gameContext.messages || []).some(m => m.subject?.includes('Crisis Averted')),
        { timeout: 30000 }
    );

    // Read resolution message (triggers mission complete)
    await openMail(page);
    const backBtn2 = mailWindow.locator('button:has-text("Back")');
    if (await backBtn2.isVisible().catch(() => false)) {
        await backBtn2.click();
        await page.waitForTimeout(200);
    }
    await waitForMessage(page, 'Crisis Averted');
    await readMessage(page, 'Crisis Averted');
    await closeWindow(page, 'SNet Mail');

    // Wait for mission to complete (defensive check for gameContext availability)
    await page.waitForFunction(
        () => window.gameContext?.activeMission === null,
        { timeout: 30000 }
    );

    // Verify success
    const isSuccess = await page.evaluate(() =>
        window.gameContext.completedMissions.some(
            m => m.missionId === 'ransomware-recovery' && m.status === 'success'
        )
    );
    expect(isSuccess).toBe(true);
    console.log('Ransomware-recovery mission completed successfully');

    // Dismiss forced disconnection overlay
    try {
        await dismissForcedDisconnectionOverlay(page, 10000);
    } catch {
        // May not appear at 100x
    }

    // Wait for ransomware overlay cleanup
    await expect(page.locator('.ransomware-overlay')).not.toBeVisible({ timeout: 30000 });

    // Deposit payment cheque
    await page.waitForFunction(
        () => (window.gameContext.messages || []).some(m => m.subject?.includes('Payment for Ransomware')),
        { timeout: 30000 }
    );
    await openMail(page);
    const backBtn3 = mailWindow.locator('button:has-text("Back")');
    if (await backBtn3.isVisible().catch(() => false)) {
        await backBtn3.click();
        await page.waitForTimeout(200);
    }
    await waitForMessage(page, 'Payment for Ransomware');
    await readMessage(page, 'Payment for Ransomware');
    await depositCheque(page);
    await closeWindow(page, 'SNet Mail');
    console.log('Payment deposited');

    await setSpecificTimeSpeed(page, 1);
}

test.describe('Post-Ransomware Unlocks', () => {
    test('unlocks messages, algorithm packs, CPU upgrades, and decryption missions', async ({ page }) => {
        test.setTimeout(300000);

        // Capture browser console errors for debugging
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => {
            consoleErrors.push(`PAGE ERROR: ${err.message}`);
        });

        // ============================================================
        // Phase 1: Complete ransomware mission
        // ============================================================
        await completeRansomwareMission(page);

        // Verify decryption features unlocked
        const features = await page.evaluate(() => window.gameContext.unlockedFeatures);
        expect(features).toContain('decryption-algorithms');
        expect(features).toContain('decryption-missions');
        console.log('Verified: decryption-algorithms and decryption-missions unlocked');

        // ============================================================
        // Phase 2: Wait for post-ransomware messages
        // ============================================================
        // CPU unlock message arrives after 15s game time delay
        // Algorithm info message arrives after 25s game time delay
        await setSpecificTimeSpeed(page, 100);

        await page.waitForFunction(
            () => (window.gameContext.messages || []).some(m => m.id === 'msg-cpu-unlock'),
            { timeout: 30000 }
        );
        console.log('CPU unlock message arrived');

        await page.waitForFunction(
            () => (window.gameContext.messages || []).some(m => m.id === 'msg-algorithm-info'),
            { timeout: 30000 }
        );
        console.log('Algorithm info message arrived');

        await setSpecificTimeSpeed(page, 1);

        // ============================================================
        // Phase 3: Read CPU message → unlock CPU upgrades
        // ============================================================
        await openMail(page);
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        const backBtn = mailWindow.locator('button:has-text("Back")');
        if (await backBtn.isVisible().catch(() => false)) {
            await backBtn.click();
            await page.waitForTimeout(200);
        }

        await waitForMessage(page, 'Hardware Upgrade - CPU Priority');
        await readMessage(page, 'Hardware Upgrade - CPU Priority');
        console.log('CPU message read');

        // Verify cpu-upgrades unlocked
        const featuresAfterCpu = await page.evaluate(() => window.gameContext.unlockedFeatures);
        expect(featuresAfterCpu).toContain('cpu-upgrades');
        console.log('Verified: cpu-upgrades unlocked');

        // Navigate back to inbox and read Algorithm Modules message
        const backBtn2 = mailWindow.locator('button:has-text("Back")');
        if (await backBtn2.isVisible().catch(() => false)) {
            await backBtn2.click();
            await page.waitForTimeout(200);
        }
        await waitForMessage(page, 'Algorithm Modules');
        await readMessage(page, 'Algorithm Modules');
        console.log('Algorithm info message read');
        await closeWindow(page, 'SNet Mail');

        // ============================================================
        // Phase 4: Verify CPU upgrades visible in Portal
        // ============================================================
        await openApp(page, 'Portal');
        const portal = page.locator('.window:has-text("Portal")');

        // Switch to Hardware section
        await portal.locator('.section-btn:has-text("Hardware")').click();
        await page.waitForTimeout(300);

        // Verify processor upgrades are visible (not locked)
        const cpuItem = portal.locator('.portal-item:has-text("2GHz Dual Core")');
        await expect(cpuItem).toBeVisible({ timeout: 5000 });
        console.log('Verified: CPU upgrades visible in Portal');

        // ============================================================
        // Phase 5: Verify algorithm packs in Portal (Software section)
        // ============================================================
        await portal.locator('.section-btn:has-text("Software")').click();
        await page.waitForTimeout(300);

        // Blowfish pack should be visible
        const blowfishItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'Blowfish Decryption Module' })
        });
        await expect(blowfishItem).toBeVisible({ timeout: 5000 });
        console.log('Verified: Blowfish Decryption Module visible in Portal');

        // RSA pack should be visible
        const rsaItem = portal.locator('.portal-item').filter({
            has: page.locator('.item-name', { hasText: 'RSA-2048 Decryption Module' })
        });
        await expect(rsaItem).toBeVisible({ timeout: 5000 });
        console.log('Verified: RSA-2048 Decryption Module visible in Portal');

        // ============================================================
        // Phase 6: Inject credits and purchase Blowfish pack
        // ============================================================
        // Inject enough credits for both packs
        await page.evaluate(() => {
            window.gameContext.updateBankBalance('account-first-bank', 60000, 'test-injection');
        });
        console.log('Injected 60,000 credits for algorithm purchases');

        // Purchase Blowfish
        await blowfishItem.locator('.purchase-btn').click();
        const modal = portal.locator('.modal-content');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await modal.locator('button:has-text("Confirm")').click();
        await page.waitForTimeout(200);

        // Wait for download and install
        await setSpecificTimeSpeed(page, 100);
        await expect(blowfishItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
        await setSpecificTimeSpeed(page, 1);
        console.log('Blowfish Decryption Module installed');

        // Verify algorithm added
        const algorithmsAfterBlowfish = await page.evaluate(() => window.gameContext.decryptionAlgorithms);
        expect(algorithmsAfterBlowfish).toContain('blowfish');
        console.log('Verified: blowfish added to decryptionAlgorithms');

        // ============================================================
        // Phase 7: Purchase RSA-2048 pack
        // ============================================================
        await rsaItem.locator('.purchase-btn').click();
        const modal2 = portal.locator('.modal-content');
        await expect(modal2).toBeVisible({ timeout: 3000 });
        await modal2.locator('button:has-text("Confirm")').click();
        await page.waitForTimeout(200);

        await setSpecificTimeSpeed(page, 100);
        await expect(rsaItem.locator('.status-badge.installed-badge')).toBeVisible({ timeout: 60000 });
        await setSpecificTimeSpeed(page, 1);
        console.log('RSA-2048 Decryption Module installed');

        // Verify algorithm added
        const algorithmsAfterRsa = await page.evaluate(() => window.gameContext.decryptionAlgorithms);
        expect(algorithmsAfterRsa).toContain('rsa-2048');
        console.log('Verified: rsa-2048 added to decryptionAlgorithms');

        await closeWindow(page, 'Portal');

        // ============================================================
        // Phase 8: Verify "Something Big" teaser message (both packs installed)
        // ============================================================
        await setSpecificTimeSpeed(page, 100);
        await page.waitForFunction(
            () => (window.gameContext.messages || []).some(m => m.id === 'msg-story-teaser-post-decryption'),
            { timeout: 30000 }
        );
        await setSpecificTimeSpeed(page, 1);
        console.log('Verified: "Something Big" teaser message arrived after both packs installed');

        // ============================================================
        // Phase 9: Verify decryption missions appear on Mission Board
        // ============================================================
        // Wait for pool to contain decryption missions
        await setSpecificTimeSpeed(page, 100);

        const decryptionTypes = [
            'decryption', 'decryption-repair', 'decryption-backup',
            'investigation-decryption', 'multi-layer-decryption',
            'decryption-malware', 'virus-hunt'
        ];

        let hasDecryptionMission = false;
        for (let attempt = 0; attempt < 30; attempt++) {
            await page.waitForTimeout(500);
            const pool = await page.evaluate(() => window.gameContext.missionPool);
            hasDecryptionMission = pool.some(m => decryptionTypes.includes(m.missionType));
            if (hasDecryptionMission) {
                const types = pool.filter(m => decryptionTypes.includes(m.missionType)).map(m => m.missionType);
                console.log(`Decryption missions found in pool after ${attempt + 1} attempts: ${types.join(', ')}`);
                break;
            }
        }
        expect(hasDecryptionMission).toBe(true);

        await setSpecificTimeSpeed(page, 1);

        // Open Mission Board and verify decryption missions visible
        await openApp(page, 'Mission Board');
        const missionBoard = page.locator('.window:has-text("Mission Board")');
        await missionBoard.locator('.tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        // Verify at least one mission card is visible
        const missionCards = missionBoard.locator('.mission-card');
        const cardCount = await missionCards.count();
        expect(cardCount).toBeGreaterThan(0);
        console.log(`Mission Board shows ${cardCount} available missions`);

        // Verify at least one card mentions decryption-related keywords
        const allCardTexts = [];
        for (let i = 0; i < cardCount; i++) {
            const text = await missionCards.nth(i).textContent();
            allCardTexts.push(text);
        }
        const hasDecryptionCard = allCardTexts.some(text =>
            text.toLowerCase().includes('decrypt') ||
            text.toLowerCase().includes('encrypted')
        );
        expect(hasDecryptionCard).toBe(true);
        console.log('Verified: decryption mission visible on Mission Board');

        await closeWindow(page, 'Mission Board');

        // ============================================================
        // Phase 10: Verify Decryption Tool shows installed algorithms
        // ============================================================
        await openApp(page, 'Decryption Tool');
        const decryptionTool = page.locator('.window:has-text("Decryption Tool")');

        // Verify algorithm tags in the header
        await expect(decryptionTool.locator('.algorithm-tag:has-text("AES-128")')).toBeVisible({ timeout: 5000 });
        await expect(decryptionTool.locator('.algorithm-tag:has-text("AES-256")')).toBeVisible({ timeout: 5000 });
        await expect(decryptionTool.locator('.algorithm-tag:has-text("Blowfish")')).toBeVisible({ timeout: 5000 });
        await expect(decryptionTool.locator('.algorithm-tag:has-text("RSA-2048")')).toBeVisible({ timeout: 5000 });
        console.log('Verified: Decryption Tool shows all 4 installed algorithms');

        await closeWindow(page, 'Decryption Tool');

        console.log('\n=== All post-ransomware unlock verifications passed ===');
    });
});

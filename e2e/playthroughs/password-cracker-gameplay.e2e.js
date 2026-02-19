/**
 * Password Cracker Gameplay Tests
 *
 * Verifies the Password Cracker app mechanics in detail:
 * - Source dropdown shows file systems with password-protected files
 * - File list shows files with hash type and size
 * - Attack method buttons: Brute Force always available, others context-dependent
 * - Progress bar advances during crack (driven by game time)
 * - Success message appears on completion
 * - Auto-clear after ~2 seconds (no manual "Crack Another File" button)
 * - Cracked file is no longer password-protected
 * - Second file can be cracked after first auto-clears
 *
 * Loads from: post-ransomware-recovery scenario (buys algorithm packs + cracker via setup)
 */

import { test, expect } from '@playwright/test';
import {
    loadScenario,
    addCredits,
    setSpecificTimeSpeed,
    openApp,
    closeWindow,
    readMessage,
    waitForMessage,
    purchaseFromPortal,
    waitForMission,
    acceptMission,
    activateNarFromMessage,
    connectToNetwork,
    scanNetwork,
    goToMailInbox,
    waitForAndDismissForcedDisconnection,
} from '../helpers/common-actions.js';

test.describe('Password Cracker Gameplay', () => {
    test('verifies cracker UI mechanics: progress, auto-clear, and sequential cracks', async ({ page }) => {
        test.setTimeout(300000);

        // ============================================================
        // Setup: Reach a state with Password Cracker + password-protected files
        // ============================================================
        await loadScenario(page, 'post-ransomware-recovery');
        await addCredits(page, 15000);

        // Read progression messages
        await goToMailInbox(page);
        await readMessage(page, 'Hardware Upgrade');
        await page.waitForTimeout(300);
        await goToMailInbox(page);
        await readMessage(page, 'Algorithm Modules');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        await setSpecificTimeSpeed(page, 100);

        // Buy algorithm packs and Password Cracker
        await purchaseFromPortal(page, 'Blowfish Decryption Module');
        await purchaseFromPortal(page, 'RSA-2048 Decryption Module');

        await goToMailInbox(page);
        await waitForMessage(page, 'Next Phase - Password Cracking', 60000);
        await readMessage(page, 'Next Phase - Password Cracking');
        await page.waitForTimeout(300);
        await goToMailInbox(page);
        await waitForMessage(page, 'Password Cracking Tools - Ready', 30000);
        await readMessage(page, 'Password Cracking Tools - Ready');
        await page.waitForTimeout(300);
        await closeWindow(page, 'SNet Mail');

        await purchaseFromPortal(page, 'Password Cracker');

        // Accept locked-out mission to get access to password-protected files
        await waitForMission(page, 'locked-out');
        await acceptMission(page, 'Locked Out');

        await setSpecificTimeSpeed(page, 10);
        await activateNarFromMessage(page, 'URGENT: Locked Out of Critical Systems');
        await setSpecificTimeSpeed(page, 100);

        await connectToNetwork(page, 'Meridian-Internal');
        await scanNetwork(page, 'Meridian-Internal', 'hr-server');

        // ============================================================
        // Test 1: Source dropdown shows available file systems
        // ============================================================
        await openApp(page, 'Password Cracker');
        const pc = page.locator('.window:has-text("Password Cracker")');

        // Verify source dropdown is populated
        const sourceOptions = pc.locator('.pc-dropdown option');
        const optionCount = await sourceOptions.count();
        expect(optionCount).toBeGreaterThanOrEqual(2); // hr-server + finance-server

        // ============================================================
        // Test 2: File list shows password-protected files with hash type
        // ============================================================
        await pc.locator('.pc-dropdown').selectOption('fs-meridian-hr');
        await page.waitForTimeout(500);

        const fileItems = pc.locator('.pc-file-item');
        const fileCount = await fileItems.count();
        expect(fileCount).toBeGreaterThanOrEqual(1);

        // Verify file has name, hash type, and size displayed
        const firstFile = fileItems.first();
        const fileName = await firstFile.locator('.pc-file-name').textContent();
        expect(fileName).toContain('personnel-records.db');

        const hashType = await firstFile.locator('.pc-file-hash').textContent();
        expect(hashType).toBeTruthy(); // Should show "MD5" or similar

        const fileSize = await firstFile.locator('.pc-file-size').textContent();
        expect(fileSize).toBeTruthy();

        // ============================================================
        // Test 3: Attack methods - Brute Force is always available
        // ============================================================
        await firstFile.click();
        await page.waitForTimeout(300);

        // Method buttons should be visible
        const bruteForceBtn = pc.locator('.pc-method-btn:has-text("Brute Force")');
        await expect(bruteForceBtn).toBeVisible();
        await expect(bruteForceBtn).toBeEnabled();

        // Dictionary button visible (may or may not be enabled depending on hash)
        const dictionaryBtn = pc.locator('.pc-method-btn:has-text("Dictionary")');
        await expect(dictionaryBtn).toBeVisible();

        // Rainbow button visible
        const rainbowBtn = pc.locator('.pc-method-btn:has-text("Rainbow")');
        await expect(rainbowBtn).toBeVisible();

        // ============================================================
        // Test 4: Progress bar advances during crack (game-time driven)
        // ============================================================
        await bruteForceBtn.click();
        await page.waitForTimeout(200);

        // Set speed to 10x for observable progress
        await setSpecificTimeSpeed(page, 10);

        await pc.locator('.pc-start-btn').click();

        // Verify progress section appears
        const progressSection = pc.locator('.pc-progress-section');
        await expect(progressSection).toBeVisible({ timeout: 5000 });

        // Verify progress bar is advancing (wait for it to reach at least 10%)
        await page.waitForFunction(
            () => {
                const text = document.querySelector('.window:has(.password-cracker) .pc-progress-text')?.textContent;
                return text && parseInt(text) > 10;
            },
            { timeout: 30000 }
        );

        // Verify combinations counter is displayed (for brute force)
        const combinationsText = pc.locator('.pc-combinations');
        await expect(combinationsText).toBeVisible();

        // Verify CPU info is displayed
        const cpuInfo = pc.locator('.pc-cpu-info');
        await expect(cpuInfo).toBeVisible();

        // Speed up to finish the crack
        await setSpecificTimeSpeed(page, 100);

        // Wait for success
        await expect(pc.locator('.pc-status.success')).toBeVisible({ timeout: 60000 });

        // Verify progress reached 100%
        const finalProgress = await pc.locator('.pc-progress-text').textContent();
        expect(finalProgress).toBe('100%');

        // Verify success message mentions the file
        const successMessage = await pc.locator('.pc-status.success').textContent();
        expect(successMessage).toContain('personnel-records.db');

        // ============================================================
        // Test 5: Auto-clear after success (no "Crack Another File" button)
        // ============================================================
        // Verify there is NO "Crack Another File" button
        const crackAnotherBtn = pc.locator('button:has-text("Crack Another")');
        await expect(crackAnotherBtn).not.toBeVisible();

        // Wait for auto-clear (~2 seconds)
        await page.waitForTimeout(3000);

        // After auto-clear, the success message should be gone
        await expect(pc.locator('.pc-status.success')).not.toBeVisible({ timeout: 5000 });

        // The file system fs-meridian-hr should no longer appear in dropdown
        // (its only protected file was cracked, so it's filtered out)
        const hrOptionExists = await pc.locator('.pc-dropdown option[value="fs-meridian-hr"]').count();
        expect(hrOptionExists).toBe(0);

        // ============================================================
        // Test 6: Second file can be cracked after auto-clear
        // ============================================================
        // Switch to finance server to crack payroll file
        await pc.locator('.pc-dropdown').selectOption('fs-meridian-finance');
        await page.waitForTimeout(500);

        const payrollFile = pc.locator('.pc-file-item:has-text("payroll-Q4-2019.zip")');
        await expect(payrollFile).toBeVisible({ timeout: 5000 });
        await payrollFile.click();
        await page.waitForTimeout(300);

        // Select method and start
        await bruteForceBtn.click();
        await page.waitForTimeout(200);
        await pc.locator('.pc-start-btn').click();

        // Verify progress bar appears and advances
        await expect(pc.locator('.pc-progress-section')).toBeVisible({ timeout: 5000 });

        // Wait for second crack to succeed
        await expect(pc.locator('.pc-status.success')).toBeVisible({ timeout: 120000 });

        const secondSuccessMessage = await pc.locator('.pc-status.success').textContent();
        expect(secondSuccessMessage).toContain('payroll-Q4-2019.zip');

        // Both cracks complete triggers the intrusion attack (forced disconnect overlay)
        // Dismiss it before closing the cracker
        await waitForAndDismissForcedDisconnection(page, 30000);
        await closeWindow(page, 'Password Cracker');

        console.log('\n=== Password Cracker Gameplay Tests Complete ===');
        console.log('Verified: source dropdown, file list, attack methods');
        console.log('Verified: progress bar, success message, auto-clear');
        console.log('Verified: sequential crack flow (no "Crack Another" button)');
    });
});

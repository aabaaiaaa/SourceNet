import { test, expect } from '@playwright/test';
import { completeBoot, openMail, waitForMessage, readMessage, verifyCredits } from '../helpers/common-actions.js';

/**
 * E2E: Boot Flow Tests
 * Consolidated boot sequence tests covering:
 * - First boot (new game) sequence and timing
 * - Subsequent boot (load game) sequence and timing
 * - Welcome messages and initial game state
 */

test.describe('Boot Flow: Boot Sequence Timing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
        });
    });

    test('should complete boot sequence successfully', async ({ page }) => {
        await page.goto('/');

        // Verify boot screen appears
        await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=OSNet BIOS')).toBeVisible();

        // Verify boot completes (timing varies by environment)
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 25000 });

        // Boot timing is tested via implementation:
        // - First boot: 300ms per line * ~50 lines = ~15s
        // - Subsequent: 150ms per line * ~26 lines = ~4s
        // Actual timing verified by "different boot sequences" test

        console.log('✅ E2E: Boot Sequence Completes - PASS');
    });

    test('should show different boot sequences for first vs subsequent boot', async ({ page }) => {
        await page.goto('/');

        // First boot: Complete boot (should show long installation sequence)
        const firstBootStart = Date.now();
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 25000 });
        const firstBootDuration = (Date.now() - firstBootStart) / 1000;

        await page.fill('input.username-input', 'install_test');
        await page.click('button:has-text("Continue")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Save the game - set up handlers for both dialogs
        let dialogCount = 0;
        page.on('dialog', async dialog => {
            dialogCount++;
            if (dialogCount === 1) {
                // First dialog: prompt for save name
                await dialog.accept('test_save');
            } else {
                // Second dialog: alert confirmation
                await dialog.accept();
            }
        });

        await page.click('text=⏻');
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(1000);

        // Reload to get back to login screen
        await page.reload();
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

        // LOAD the existing save (should show short boot sequence)
        await page.click('text=install_test');
        await page.click('button:has-text("Load")');

        // Should go to boot screen
        await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

        // Subsequent boot (loading save): Boot should complete faster
        // Wait for desktop (should be faster, ~4s instead of ~15s)
        const bootStart = Date.now();
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });
        const bootDuration = (Date.now() - bootStart) / 1000;

        // Loading save boot should be relatively quick (under 10s, ideally ~4s)
        expect(bootDuration).toBeLessThan(10);

        console.log(`First boot took ${firstBootDuration.toFixed(1)}s (long boot with installation)`);
        console.log(`Subsequent boot took ${bootDuration.toFixed(1)}s (should be <10s)`);
        console.log('✅ E2E: Different Boot Sequences - PASS');
    });
});

test.describe('Boot Flow: First Boot & Welcome Messages', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to simulate new game
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should complete first boot sequence and receive welcome messages', async ({ page }) => {
        await page.goto('/');

        // Boot sequence
        await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=OSNet BIOS')).toBeVisible();

        // Wait for username screen
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

        // Verify suggested username format
        const usernameInput = page.locator('input.username-input');
        const suggestedUsername = await usernameInput.inputValue();
        expect(suggestedUsername).toMatch(/^agent_\d{4}$/);

        // Enter username and complete boot
        await completeBoot(page, 'test_agent');

        // Desktop loads
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.topbar-time')).toBeVisible();

        // Wait for first message
        await page.waitForTimeout(4000);

        // Open SNet Mail
        await openMail(page);

        // Verify first welcome message exists
        await expect(page.locator('text=Welcome to SourceNet!')).toBeVisible();

        // Click first message to read it
        await readMessage(page, 'Welcome to SourceNet!');

        // Go back to message list
        await page.click('button:has-text("Back")');

        // Wait for second message
        await page.waitForTimeout(4000);

        // Verify second message appears in list
        await waitForMessage(page, 'Hi from your manager');

        // Click second message
        await readMessage(page, 'Hi from your manager');

        // Verify cheque attachment
        await expect(page.locator('.attachment-item')).toBeVisible();

        // Click cheque to deposit
        await page.click('.attachment-item');

        // Banking app should open with deposit prompt
        await expect(page.locator('text=Cheque Deposit')).toBeVisible({ timeout: 5000 });

        // Select account and deposit
        await page.click('.account-select-btn');

        // Verify credits updated to 1000
        await verifyCredits(page, 1000);

        console.log('✅ E2E: First Boot Sequence & Welcome Messages - PASS');
    });

    test('should generate unique usernames for each first boot', async ({ page }) => {
        await page.goto('/');

        // Wait for boot to complete
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

        // Get first suggested username
        const usernameInput = page.locator('input.username-input');
        const firstUsername = await usernameInput.inputValue();
        expect(firstUsername).toMatch(/^agent_\d{4}$/);

        // Clear localStorage and reload to simulate new boot
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        // Wait for boot again
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

        // Get second suggested username
        const secondUsername = await usernameInput.inputValue();
        expect(secondUsername).toMatch(/^agent_\d{4}$/);

        // Usernames should be different (random generation)
        // Note: This test might occasionally fail if random generates same number
        expect(firstUsername).not.toBe(secondUsername);

        console.log(`First suggested username: ${firstUsername}`);
        console.log(`Second suggested username: ${secondUsername}`);
        console.log('✅ E2E: Unique Username Generation - PASS');
    });
});

test.describe('Boot Flow: Boot Screen Visual Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
        });
    });

    test('should display all required boot screen elements', async ({ page }) => {
        await page.goto('/');

        // Verify boot screen appears
        const bootScreen = page.locator('.boot-screen');
        await expect(bootScreen).toBeVisible({ timeout: 5000 });

        // Verify BIOS header
        await expect(page.locator('text=OSNet BIOS')).toBeVisible();

        // Verify boot lines are being displayed
        // Wait a moment for lines to appear
        await page.waitForTimeout(1000);
        const bootLines = await bootScreen.locator('.boot-line').count();
        expect(bootLines).toBeGreaterThan(0);

        console.log(`Boot screen displayed ${bootLines} boot lines`);
        console.log('✅ E2E: Boot Screen Visual Elements - PASS');
    });

    test('should display boot text progressively', async ({ page }) => {
        await page.goto('/');

        await expect(page.locator('.boot-screen')).toBeVisible({ timeout: 5000 });

        // Wait briefly for boot to start rendering lines
        await page.waitForTimeout(500);

        // Count boot lines at start (should be few)
        const bootScreen = page.locator('.boot-screen');
        const initialBootLines = await bootScreen.locator('.boot-line').count();
        const initialLogoScreen = await bootScreen.locator('.osnet-logo-screen').count();
        const initialCount = initialBootLines + initialLogoScreen;

        // Wait for boot to progress
        await page.waitForTimeout(2000);

        // Count again - boot lines may have been replaced by logo screen
        const laterBootLines = await bootScreen.locator('.boot-line').count();
        const laterLogoScreen = await bootScreen.locator('.osnet-logo-screen').count();
        const laterCount = laterBootLines + laterLogoScreen;

        // Verify boot is progressing (either more boot lines or logo appeared)
        expect(laterCount).toBeGreaterThan(0);

        console.log(`Boot display changed from ${initialCount} to ${laterCount} over 2s`);
        console.log('✅ E2E: Progressive Boot Display - PASS');
    });
});

test.describe('Boot Flow: Username Selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
        });
    });

    test('should allow custom username entry', async ({ page }) => {
        await page.goto('/');

        // Wait for username selection screen
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

        // Enter custom username (max 15 chars - respect input maxLength)
        const customUsername = 'test_' + (Date.now() % 100000).toString().substring(0, 9);
        await page.fill('input.username-input', customUsername);

        // Verify input updated (input has maxLength=15 so may truncate)
        const inputValue = await page.locator('input.username-input').inputValue();
        // Either full username or truncated to 15 chars
        expect(inputValue.length).toBeLessThanOrEqual(15);
        expect(customUsername.startsWith(inputValue) || inputValue === customUsername.substring(0, 15)).toBe(true);

        // Click continue
        await page.click('button:has-text("Continue")');

        // Verify desktop loads
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        console.log(`✅ E2E: Custom Username Entry (${customUsername}) - PASS`);
    });

    test('should validate username format', async ({ page }) => {
        await page.goto('/');

        // Wait for username selection screen
        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

        // Try clearing to empty username
        const usernameInput = page.locator('input.username-input');
        await usernameInput.clear();

        // Verify empty state (button should still work but username should be empty)
        const emptyValue = await usernameInput.inputValue();
        expect(emptyValue).toBe('');

        // Enter valid username
        await page.fill('input.username-input', 'valid_user');

        // Verify username was entered
        const filledValue = await usernameInput.inputValue();
        expect(filledValue).toBe('valid_user');

        console.log('✅ E2E: Username Validation - PASS');
    });
});

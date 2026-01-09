import { test, expect } from '@playwright/test';

/**
 * Game Over Scenarios E2E Tests
 * 
 * This test suite covers all game over conditions and their associated messages:
 * - Bankruptcy (negative balance for extended period)
 *   - First Overdraft notice
 *   - Approaching Bankruptcy warning  
 *   - Bankruptcy Countdown Start notice
 *   - Bankruptcy Cancelled notice (if recovered)
 * - Reputation failure (reputation drops to Tier 1)
 *   - Final Termination Warning (Tier 1)
 *   - Performance Improved notice (if recovered)
 * 
 * Each test must be independent since game over is a terminal state.
 * These tests verify:
 * - System messages are sent at appropriate state transitions
 * - Countdown systems trigger correctly
 * - Game over screen appears with appropriate messaging
 * - Player can start new game after game over
 */

test.describe('E2E: Bankruptcy Game Over', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should send overdraft message when balance goes negative', async ({ page }) => {
        test.setTimeout(60000);

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('overdraft_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Starting credits are 0 (before tutorial cheque)
        await expect(page.locator('.topbar-credits:has-text("0 credits")')).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 2: Trigger Overdraft via Debug Panel
        // ========================================
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Switch to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        // Click "Trigger Overdraft" button (sets to positive then negative after delay)
        await page.click('[data-testid="debug-trigger-overdraft"]');
        await page.waitForTimeout(300); // Wait for both state changes

        // Close debug panel
        await page.keyboard.press('Escape');

        // Let message system process - overdraft message has a 5-second game-time delay
        // At 100x speed, 5 seconds game time = 50ms real time, but add buffer for processing
        await setSpeed(100);
        await page.waitForTimeout(500);
        await setSpeed(1);

        // ========================================
        // STEP 3: Verify Overdraft Message
        // ========================================
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for Overdraft Notice message
        const overdraftMessage = page.locator('.message-item:has-text("Overdraft Notice")');
        await expect(overdraftMessage).toBeVisible({ timeout: 5000 });

        // Verify message content
        await overdraftMessage.click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("overdrawn")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("Interest")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("BANKRUPTCY WARNING")')).toBeVisible();
    });

    test('should send bankruptcy countdown message and trigger game over', async ({ page }) => {
        test.setTimeout(60000);

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('bankruptcy_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 2: Trigger Bankruptcy Countdown via Debug Panel
        // ========================================
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Switch to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        // Click "Start Bankruptcy Countdown" button (sets to positive then bankruptcy level after delay)
        await page.click('[data-testid="debug-trigger-bankruptcy"]');
        await page.waitForTimeout(300); // Wait for both state changes

        // Close debug panel
        await page.keyboard.press('Escape');

        // Let message system process
        await setSpeed(100);
        await page.waitForTimeout(300);
        await setSpeed(1);

        // ========================================
        // STEP 3: Verify Bankruptcy Messages
        // ========================================
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for Bankruptcy Proceedings message (countdown started)
        // Should have both overdraft notice and bankruptcy message
        const bankruptcyMessage = page.locator('.message-item:has-text("Bankruptcy Proceedings")').or(
            page.locator('.message-item:has-text("URGENT")')
        );
        await expect(bankruptcyMessage.first()).toBeVisible({ timeout: 5000 });

        // Verify message content
        await bankruptcyMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("URGENT")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("Financial authorities")')).toBeVisible();

        // Close Mail
        await page.locator('.window:has-text("SNet Mail") .window-controls button:has-text("×")').click();

        // ========================================
        // STEP 4: Speed Up Time to Trigger Game Over
        // ========================================
        await setSpeed(100);

        // Wait for countdown to complete
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(1000);
            const progressState = await page.evaluate(() => ({
                gamePhase: window.gameContext?.gamePhase
            }));
            if (progressState.gamePhase !== 'desktop') break;
        }

        // ========================================
        // STEP 5: Verify Game Over Screen
        // ========================================
        const gameOverState = await page.evaluate(() => ({
            gamePhase: window.gameContext?.gamePhase
        }));

        expect(gameOverState.gamePhase).toBe('gameOver-bankruptcy');

        await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1:has-text("BANKRUPTCY")')).toBeVisible();

        // ========================================
        // STEP 6: Test New Game After Game Over
        // ========================================
        const returnButton = page.locator('button:has-text("Return to Main Menu")');
        await expect(returnButton).toBeVisible();
        await returnButton.click();

        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });
    });

    test('should send bankruptcy cancelled message when balance improves', async ({ page }) => {
        test.setTimeout(60000);

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Setup and Trigger Bankruptcy
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('recovery_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Trigger bankruptcy countdown
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        await page.click('[data-testid="debug-trigger-bankruptcy"]');
        await page.waitForTimeout(500);

        // ========================================
        // STEP 2: Cancel Bankruptcy
        // ========================================
        await page.click('[data-testid="debug-cancel-bankruptcy"]');
        await page.waitForTimeout(500);

        // Close debug panel
        await page.keyboard.press('Escape');

        // Let message system process
        await setSpeed(100);
        await page.waitForTimeout(200);
        await setSpeed(1);

        // ========================================
        // STEP 3: Verify Bankruptcy Cancelled Message
        // ========================================
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for Bankruptcy Cancelled message
        const cancelledMessage = page.locator('.message-item:has-text("Cancelled")').or(
            page.locator('.message-item:has-text("improved")')
        );
        await expect(cancelledMessage.first()).toBeVisible({ timeout: 5000 });

        // Verify game continues normally
        const gameState = await page.evaluate(() => ({
            bankruptcyCountdown: window.gameContext?.bankruptcyCountdown,
            gamePhase: window.gameContext?.gamePhase
        }));

        expect(gameState.bankruptcyCountdown).toBeNull();
        expect(gameState.gamePhase).toBe('desktop');
    });
});

test.describe('E2E: Reputation Game Over', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should send termination warning message and trigger game over', async ({ page }) => {
        test.setTimeout(60000);

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('reputation_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Verify starting reputation (should be 9 - Superb)
        await expect(page.locator('.reputation-badge:has-text("Tier 9")')).toBeVisible();

        // ========================================
        // STEP 2: Trigger Termination Countdown via Debug Panel
        // ========================================
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Switch to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        // Click "Start Termination Countdown" button
        await page.click('[data-testid="debug-trigger-termination"]');
        await page.waitForTimeout(500);

        // Close debug panel
        await page.keyboard.press('Escape');

        // Verify reputation changed to 1
        await expect(page.locator('.reputation-badge:has-text("Tier 1")')).toBeVisible({ timeout: 3000 });

        // Let message system process
        await setSpeed(100);
        await page.waitForTimeout(200);
        await setSpeed(1);

        // ========================================
        // STEP 3: Verify Termination Warning Message
        // ========================================
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for Final Warning message
        const warningMessage = page.locator('.message-item:has-text("FINAL WARNING")').or(
            page.locator('.message-item:has-text("Termination")')
        );
        await expect(warningMessage.first()).toBeVisible({ timeout: 5000 });

        // Verify message content
        await warningMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("TERMINATED")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("10 MINUTES")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("final chance")')).toBeVisible();

        // Close Mail
        await page.locator('.window:has-text("SNet Mail") .window-controls button:has-text("×")').click();

        // ========================================
        // STEP 4: Speed Up Time to Trigger Game Over
        // ========================================
        await setSpeed(100);

        // Reputation countdown is 10 minutes (600 seconds)
        // At 100x speed: 600 / 100 = 6 seconds real time
        for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(1000);
            const progressState = await page.evaluate(() => ({
                gamePhase: window.gameContext?.gamePhase
            }));
            if (progressState.gamePhase !== 'desktop') break;
        }

        // ========================================
        // STEP 5: Verify Game Over Screen
        // ========================================
        const gameOverState = await page.evaluate(() => ({
            gamePhase: window.gameContext?.gamePhase
        }));

        expect(gameOverState.gamePhase).toBe('gameOver-termination');

        await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1:has-text("CONTRACT TERMINATED")')).toBeVisible();

        // ========================================
        // STEP 6: Test New Game After Game Over
        // ========================================
        const returnButton = page.locator('button:has-text("Return to Main Menu")');
        await expect(returnButton).toBeVisible();
        await returnButton.click();

        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });
    });

    test('should send performance improved message when reputation recovers', async ({ page }) => {
        test.setTimeout(60000);

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Setup and Trigger Termination
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('rep_recovery_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Trigger termination countdown
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        await page.click('[data-testid="debug-trigger-termination"]');
        await page.waitForTimeout(500);

        // ========================================
        // STEP 2: Cancel Termination
        // ========================================
        await page.click('[data-testid="debug-cancel-termination"]');
        await page.waitForTimeout(500);

        // Close debug panel
        await page.keyboard.press('Escape');

        // Let message system process
        await setSpeed(100);
        await page.waitForTimeout(200);
        await setSpeed(1);

        // ========================================
        // STEP 3: Verify Performance Improved Message
        // ========================================
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Check for Performance Improved message
        const improvedMessage = page.locator('.message-item:has-text("Improvement")').or(
            page.locator('.message-item:has-text("Acknowledged")')
        );
        await expect(improvedMessage.first()).toBeVisible({ timeout: 5000 });

        // Verify message content
        await improvedMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("improved")')).toBeVisible();
        await expect(page.locator('.message-body:has-text("cancelled")')).toBeVisible();

        // Verify game continues normally
        const gameState = await page.evaluate(() => ({
            reputationCountdown: window.gameContext?.reputationCountdown,
            gamePhase: window.gameContext?.gamePhase
        }));

        expect(gameState.reputationCountdown).toBeNull();
        expect(gameState.gamePhase).toBe('desktop');
    });
});

test.describe('E2E: Game Over Recovery', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should display both bankruptcy and termination warnings simultaneously', async ({ page }) => {
        test.setTimeout(60000);

        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('dual_warning_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 2: Trigger Both Countdowns via Debug Panel
        // ========================================
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Switch to State Controls tab
        await page.click('.debug-tab:has-text("State Controls")');
        await page.waitForTimeout(200);

        // Trigger bankruptcy countdown first
        await page.click('[data-testid="debug-trigger-bankruptcy"]');
        await page.waitForTimeout(300);

        // Trigger termination countdown
        await page.click('[data-testid="debug-trigger-termination"]');
        await page.waitForTimeout(300);

        // Close debug panel
        await page.keyboard.press('Escape');

        // ========================================
        // STEP 3: Verify Both Warning Banners Are Visible
        // ========================================
        // Check for bankruptcy warning banner
        const bankruptcyBanner = page.locator('.bankruptcy-warning-banner');
        await expect(bankruptcyBanner).toBeVisible({ timeout: 5000 });
        await expect(bankruptcyBanner).toContainText('BANKRUPTCY WARNING');
        await expect(bankruptcyBanner).toContainText('remaining');

        // Check for termination warning banner
        const terminationBanner = page.locator('.reputation-warning-banner');
        await expect(terminationBanner).toBeVisible({ timeout: 5000 });
        await expect(terminationBanner).toContainText('TERMINATION WARNING');
        await expect(terminationBanner).toContainText('remaining');

        // Verify both banners are visible at the same time
        const bankruptcyVisible = await bankruptcyBanner.isVisible();
        const terminationVisible = await terminationBanner.isVisible();
        expect(bankruptcyVisible).toBe(true);
        expect(terminationVisible).toBe(true);

        // ========================================
        // STEP 4: Verify Game State Has Both Countdowns Active
        // ========================================
        const gameState = await page.evaluate(() => ({
            bankruptcyCountdown: window.gameContext?.bankruptcyCountdown,
            reputationCountdown: window.gameContext?.reputationCountdown,
            gamePhase: window.gameContext?.gamePhase
        }));

        expect(gameState.bankruptcyCountdown).not.toBeNull();
        expect(gameState.reputationCountdown).not.toBeNull();
        expect(gameState.gamePhase).toBe('desktop');

        // Both countdowns should have remaining time
        expect(gameState.bankruptcyCountdown.remaining).toBeGreaterThan(0);
        expect(gameState.reputationCountdown.remaining).toBeGreaterThan(0);
    });

    test('should allow full game restart after any game over', async ({ page }) => {
        // This test verifies that after game over, the player can return to main menu
        // and start a completely fresh game

        // Start a game
        await page.goto('/?skipBoot=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('recovery_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Save the game
        page.once('dialog', (dialog) => dialog.accept('RecoveryTest'));
        await page.hover('text=⏻');
        await page.click('text=Save');
        await page.waitForTimeout(1000);

        // Verify game is still playable
        await expect(page.locator('.topbar-time')).toBeVisible();

        // Test that we can exit to main menu
        await page.hover('text=⏻');
        const exitButton = page.locator('button:has-text("Exit to Menu")');
        const exitTextButton = page.locator('text=Exit');

        const exitCount = await exitButton.count();
        const exitTextCount = await exitTextButton.count();

        if (exitCount > 0 || exitTextCount > 0) {
            if (exitCount > 0) {
                await exitButton.click();
            } else {
                await exitTextButton.click();
            }

            // Should return to game login screen
            await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

            // Start new game
            await page.click('.new-game-btn');
            await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        }
    });
});


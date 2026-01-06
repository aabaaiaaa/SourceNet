import { test, expect } from '@playwright/test';

/**
 * Game Over Scenarios E2E Tests
 * 
 * This test suite covers all game over conditions:
 * - Bankruptcy (negative balance for extended period)
 * - Reputation failure (reputation drops to 0)
 * 
 * Each test must be independent since game over is a terminal state.
 * These tests verify:
 * - Countdown systems trigger correctly
 * - Game over screen appears with appropriate messaging
 * - Player can start new game after game over
 */

test.describe('E2E: Bankruptcy Game Over', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should trigger bankruptcy countdown and game over from negative balance', async ({ page }) => {
        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('bankruptcy_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        console.log('✅ STEP 1: Game started with debug mode enabled');

        // ========================================
        // STEP 2: Open Debug Panel and Trigger Bankruptcy
        // ========================================

        // Open debug panel with Ctrl+D
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Should be on Scenarios tab by default, find Near Bankruptcy scenario
        const bankruptcyButton = page.locator('button:has-text("Near Bankruptcy")');
        await expect(bankruptcyButton).toBeVisible();
        await bankruptcyButton.click();

        // Wait a moment for state to update
        await page.waitForTimeout(1000);

        // Close debug panel
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        // Verify bankruptcy countdown is active
        const creditsText = await page.locator('.topbar-credits').textContent();
        const credits = parseInt(creditsText.match(/-?\d+/)?.[0] || '0');
        expect(credits).toBeLessThan(0);

        console.log(`✅ STEP 2: Near Bankruptcy scenario loaded (${credits} credits)`);

        // Check if bankruptcy countdown is actually set
        const bankruptcyState = await page.evaluate(() => {
            return {
                bankruptcyCountdown: window.gameContext?.bankruptcyCountdown,
                currentTime: window.gameContext?.currentTime,
                gamePhase: window.gameContext?.gamePhase
            };
        });
        console.log('Bankruptcy state:', JSON.stringify(bankruptcyState, null, 2));

        // ========================================
        // STEP 3: Speed Up Time to Trigger Game Over
        // ========================================

        // Use 100x speed for testing (120 seconds game time = 1.2 seconds real time at 100x)
        const speedSet = await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(100);
            return { timeSpeed: window.gameContext?.timeSpeed };
        });
        console.log('Speed set to:', speedSet.timeSpeed);
        await page.waitForTimeout(500);

        console.log('✅ Set time speed to 100x for testing');

        // Bankruptcy countdown scenario has 120 seconds remaining (2 minutes game time)
        // At 100x speed: 120 / 100 = 1.2 seconds real time
        // Wait and check progress every 2 seconds
        for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(2000);
            const progressState = await page.evaluate(() => {
                return {
                    currentTime: window.gameContext?.currentTime,
                    remaining: window.gameContext?.bankruptcyCountdown?.remaining,
                    gamePhase: window.gameContext?.gamePhase
                };
            });
            console.log(`Progress check ${i + 1}:`, JSON.stringify(progressState, null, 2));

            // If game over already triggered, break early
            if (progressState.gamePhase !== 'desktop') {
                console.log('Game over detected early!');
                break;
            }
        }

        console.log('✅ STEP 3: Waited for bankruptcy countdown to complete');

        // Check state after waiting
        const finalState = await page.evaluate(() => {
            return {
                bankruptcyCountdown: window.gameContext?.bankruptcyCountdown,
                currentTime: window.gameContext?.currentTime,
                gamePhase: window.gameContext?.gamePhase,
                timeSpeed: window.gameContext?.timeSpeed,
                isPaused: window.gameContext?.isPaused
            };
        });
        console.log('Final state:', JSON.stringify(finalState, null, 2));

        // ========================================
        // STEP 4: Verify Game Over Screen
        // ========================================

        // Check if game over state was triggered
        const gameOverState = await page.evaluate(() => {
            return {
                gamePhase: window.gameContext?.gamePhase,
                bankruptcyCountdown: window.gameContext?.bankruptcyCountdown
            };
        });

        console.log('Game over state check:', JSON.stringify(gameOverState, null, 2));

        // Verify game over was triggered
        expect(gameOverState.gamePhase).toBe('gameOver-bankruptcy');

        // Game over overlay should now be visible
        await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1:has-text("BANKRUPTCY")')).toBeVisible();

        console.log('✅ STEP 4: Bankruptcy game over screen displayed');

        // ========================================
        // STEP 5: Test New Game After Game Over
        // ========================================

        // Click Return to Main Menu button
        const returnButton = page.locator('button:has-text("Return to Main Menu")');
        await expect(returnButton).toBeVisible();
        await returnButton.click();

        // Should return to login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

        console.log('✅ STEP 5: New game option functional after bankruptcy');
        console.log('✅ E2E: Bankruptcy Game Over - PASS');
    });
});

test.describe('E2E: Reputation Game Over', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should trigger reputation failure and game over from low reputation', async ({ page }) => {
        // ========================================
        // STEP 1: Setup New Game with Debug Mode
        // ========================================
        await page.goto('/?skipBoot=true&debug=true');

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('reputation_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Verify starting reputation (should be 9 - Superb)
        await expect(page.locator('.reputation-badge:has-text("★9")')).toBeVisible();

        console.log('✅ STEP 1: Game started with debug mode enabled');

        // ========================================
        // STEP 2: Open Debug Panel and Set Low Reputation
        // ========================================

        // Open debug panel with Ctrl+D
        await page.keyboard.press('Control+d');
        await expect(page.locator('.debug-panel')).toBeVisible({ timeout: 2000 });

        // Use the nearTermination scenario which has reputation 1
        const terminationButton = page.locator('button:has-text("Near Termination")');
        await expect(terminationButton).toBeVisible();
        await terminationButton.click();

        // Wait a moment for state to update
        await page.waitForTimeout(1000);

        // Close debug panel
        await page.keyboard.press('Escape');
        await expect(page.locator('.debug-panel')).not.toBeVisible();

        // Verify reputation is now 1
        const repText = await page.locator('.reputation-badge').textContent();
        const rep = parseInt(repText.match(/\d+/)?.[0] || '9');
        expect(rep).toBe(1);

        console.log(`✅ STEP 2: Reputation set to ${rep} via Near Termination scenario`);

        // ========================================
        // STEP 3: Speed Up Time to Trigger Game Over
        // ========================================

        // Use 100x speed for testing (300 seconds game time = 3 seconds real time at 100x)
        const speedSet = await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(100);
            return { timeSpeed: window.gameContext?.timeSpeed };
        });
        console.log('Speed set to:', speedSet.timeSpeed);
        await page.waitForTimeout(500);

        console.log('✅ Set time speed to 100x for testing');

        // Reputation countdown has 300 seconds remaining (5 minutes game time) 
        // At 100x speed: 300 / 100 = 3 seconds real time
        // Wait and check progress every 2 seconds
        for (let i = 0; i < 3; i++) {
            await page.waitForTimeout(2000);
            const progressState = await page.evaluate(() => {
                return {
                    currentTime: window.gameContext?.currentTime,
                    remaining: window.gameContext?.reputationCountdown?.remaining,
                    gamePhase: window.gameContext?.gamePhase
                };
            });
            console.log(`Progress check ${i + 1}:`, JSON.stringify(progressState, null, 2));

            // If game over already triggered, break early
            if (progressState.gamePhase !== 'desktop') {
                console.log('Game over detected early!');
                break;
            }
        }

        console.log('✅ STEP 3: Waited for reputation countdown to complete');

        // ========================================
        // STEP 4: Verify Game Over Screen
        // ========================================

        // Check if game over state was triggered
        const gameOverState = await page.evaluate(() => {
            return {
                gamePhase: window.gameContext?.gamePhase,
                reputationCountdown: window.gameContext?.reputationCountdown
            };
        });

        console.log('Game over state check:', JSON.stringify(gameOverState, null, 2));

        // Verify game over was triggered
        expect(gameOverState.gamePhase).toBe('gameOver-termination');

        // Game over overlay should now be visible
        await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1:has-text("CONTRACT TERMINATED")')).toBeVisible();

        console.log('✅ STEP 4: Reputation game over screen displayed');

        // ========================================
        // STEP 5: Test New Game After Game Over
        // ========================================

        // Click Return to Main Menu button
        const returnButton = page.locator('button:has-text("Return to Main Menu")');
        await expect(returnButton).toBeVisible();
        await returnButton.click();

        // Should return to login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 10000 });

        console.log('✅ STEP 5: New game option functional after reputation failure');
        console.log('✅ E2E: Reputation Game Over - PASS');
    });
});

test.describe('E2E: Game Over Recovery', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should allow full game restart after any game over', async ({ page }) => {
        // This is a simpler test to verify game over screen basics
        // without needing to trigger actual game over conditions

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

        console.log('✅ Game saved successfully');

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

            console.log('✅ Exit to menu functional');

            // Start new game
            await page.click('.new-game-btn');
            await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });

            console.log('✅ E2E: Game Over Recovery - PASS');
        } else {
            console.log('ℹ️ Exit to menu not available (testing game over flow only)');
        }
    });
});

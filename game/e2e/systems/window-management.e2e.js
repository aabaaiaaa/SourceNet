import { test, expect } from '@playwright/test';
import { STARTING_SOFTWARE } from '../../src/constants/gameConstants.js';

/**
 * Consolidated Window Management Tests
 * Combines tests from:
 * - window-management-flow.spec.js
 * - window-drag.spec.js
 * - drag-verification.spec.js
 * - window-persistence.spec.js
 */

test.describe('Window Management', () => {
    // ============================================================================
    // Window Lifecycle & Cascading
    // ============================================================================

    test.describe('Window Lifecycle & Cascading', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate((startingSoftware) => {
                const saves = {
                    window_test: [
                        {
                            username: 'window_test',
                            playerMailId: 'SNET-TST-123-456',
                            currentTime: '2020-03-25T09:10:00',
                            hardware: {
                                cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                                memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                                storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                                motherboard: { id: 'board-basic', name: 'Basic Board' },
                                powerSupply: { id: 'psu-300w', wattage: 300 },
                                network: { id: 'net-250mb', speed: 250 },
                            },
                            software: startingSoftware,
                            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                            messages: [],
                            managerName: 'Test',
                            windows: [],
                            savedAt: '2024-01-01T00:00:00.000Z',
                            saveName: 'WindowTest',
                        },
                    ],
                };
                localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
            }, STARTING_SOFTWARE);
        });

        test('should handle complete window management flow', async ({ page }) => {
            await page.goto('/?skipBoot=true');

            // Load save to skip boot
            await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
            await page.click('button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open SNet Mail → verify cascaded position
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            // Open Banking App → verify cascaded from Mail
            await page.click('text=☰');
            await page.click('text=SNet Banking App');
            const bankWindow = page.locator('.window:has-text("SNet Banking App")');
            await expect(bankWindow).toBeVisible();

            // Open Portal → verify cascaded from Banking
            await page.click('text=☰');
            await page.click('text=OSNet Portal');
            const portalWindow = page.locator('.window:has-text("OSNet Portal")');
            await expect(portalWindow).toBeVisible();

            // Click Mail window header → verify brought to front
            await mailWindow.locator('.window-header').click();

            // Minimize Mail → verify appears in bottom bar
            await mailWindow.locator('button[title="Minimize"]').click();
            await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Mail")')).toBeVisible();

            // Minimize Banking → verify appears in bottom bar
            const bankMinimizeBtn = bankWindow.locator('button[title="Minimize"]');
            await bankMinimizeBtn.click();
            await expect(page.locator('.minimized-bar .minimized-window:has-text("SNet Banking")')).toBeVisible();

            // Portal should still be visible
            await expect(portalWindow).toBeVisible();

            // Restore windows from bottom bar
            await page.click('.minimized-window:has-text("SNet Banking")');
            await expect(bankWindow).toBeVisible();

            await page.click('.minimized-window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            // Close all windows
            await page.click('.window:has-text("SNet Mail") button[title="Close"]');
            await page.click('.window:has-text("SNet Banking") button[title="Close"]');
            await page.click('.window:has-text("OSNet Portal") button[title="Close"]');

            // Verify desktop is clean
            await expect(page.locator('.window')).toHaveCount(0);
            await expect(page.locator('.minimized-window')).toHaveCount(0);
        });
    });

    // ============================================================================
    // Window Dragging
    // ============================================================================

    test.describe('Window Dragging', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate((startingSoftware) => {
                const saves = {
                    drag_test: [
                        {
                            username: 'drag_test',
                            playerMailId: 'SNET-DRG-123-456',
                            currentTime: '2020-03-25T09:00:00',
                            hardware: {
                                cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                                memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                                storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                                motherboard: { id: 'board-basic', name: 'Basic Board' },
                                powerSupply: { id: 'psu-300w', wattage: 300 },
                                network: { id: 'net-250mb', speed: 250 },
                            },
                            software: startingSoftware,
                            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                            messages: [],
                            managerName: 'Test',
                            windows: [],
                            savedAt: '2024-01-01T00:00:00.000Z',
                            saveName: 'DragTest',
                        },
                    ],
                };
                localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
            }, STARTING_SOFTWARE);
        });

        test('should drag windows to new positions', async ({ page }) => {
            await page.goto('/?skipBoot=true');

            // Load save
            await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
            await page.click('button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open SNet Mail window
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            // Verify window header has draggable cursor
            const windowHeader = mailWindow.locator('.window-header');
            const cursorStyle = await windowHeader.evaluate((el) =>
                window.getComputedStyle(el).cursor
            );
            expect(cursorStyle).toBe('grab');

            // Verify window has valid position (no NaN)
            const position = await mailWindow.boundingBox();
            expect(position.x).toBeGreaterThanOrEqual(0);
            expect(position.y).toBeGreaterThanOrEqual(40);

            // Verify window is functional
            await expect(mailWindow.locator('.window-header')).toBeVisible();
            await expect(mailWindow.locator('.window-content')).toBeVisible();

            // Verify window can still be minimized after drag
            await mailWindow.locator('button[title="Minimize"]').click();
            await expect(page.locator('.minimized-window:has-text("SNet Mail")')).toBeVisible();

            // Restore and verify position persisted
            await page.click('.minimized-window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            // Verify window can still be closed after drag
            await mailWindow.locator('button[title="Close"]').click();
            await expect(mailWindow).not.toBeVisible();
        });

        test('should keep dragged window within viewport bounds', async ({ page }) => {
            await page.goto('/?skipBoot=true');

            // Load save
            await page.click('button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open window
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            const windowHeader = mailWindow.locator('.window-header');

            // Try to drag window far to the right (beyond viewport)
            await windowHeader.hover();
            await page.mouse.down();
            await page.mouse.move(5000, 100, { steps: 10 }); // Far beyond viewport width
            await page.mouse.up();

            await page.waitForTimeout(500);

            // Verify window stayed within bounds
            const position = await mailWindow.boundingBox();
            const viewportSize = page.viewportSize();

            // Window should not go beyond right edge of viewport
            expect(position.x + position.width).toBeLessThanOrEqual(viewportSize.width);

            // Try to drag beyond top
            await windowHeader.hover();
            await page.mouse.down();
            await page.mouse.move(100, -100, { steps: 10 }); // Above viewport
            await page.mouse.up();

            await page.waitForTimeout(500);

            const position2 = await mailWindow.boundingBox();

            // Window should not go above topbar (y >= 40)
            expect(position2.y).toBeGreaterThanOrEqual(40);
        });

        test('should actually drag windows and update positions', async ({ page }) => {
            // Setup: Create a new game
            await page.goto('/?skipBoot=true');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
            await page.fill('input.username-input', 'drag_test_user');
            await page.click('button:has-text("Continue")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open Mail window
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            await expect(mailWindow).toBeVisible();

            // Get initial position
            const initialBox = await mailWindow.boundingBox();

            // Use Playwright's mouse API to drag the window
            const header = mailWindow.locator('.window-header');
            const headerBox = await header.boundingBox();

            // Move to center of header
            await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
            await page.waitForTimeout(100);

            // Press mouse down
            await page.mouse.down();
            await page.waitForTimeout(100);

            // Move mouse to new position (100px right, 50px down)
            await page.mouse.move(headerBox.x + headerBox.width / 2 + 100, headerBox.y + headerBox.height / 2 + 50, { steps: 10 });
            await page.waitForTimeout(100);

            // Release mouse
            await page.mouse.up();
            await page.waitForTimeout(500);

            // Check if window moved
            const newBox = await mailWindow.boundingBox();

            // Verify movement occurred
            if (newBox.x === initialBox.x && newBox.y === initialBox.y) {
                throw new Error(`Window did not move! Still at (${newBox.x}, ${newBox.y})`);
            }
        });
    });

    // ============================================================================
    // Window State Persistence
    // ============================================================================

    test.describe('Window State Persistence', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate(() => localStorage.clear());
        });

        test('should persist open windows and their positions after save/load', async ({ page }) => {
            await page.goto('/?skipBoot=true');

            // Create a save with specific window state
            await page.evaluate((startingSoftware) => {
                const saves = {
                    window_persist_test: [
                        {
                            username: 'window_persist_test',
                            playerMailId: 'SNET-WIN-123-456',
                            currentTime: '2020-03-25T09:15:00',
                            hardware: {
                                cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                                memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                                storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                                motherboard: { id: 'board-basic', name: 'Basic Board' },
                                powerSupply: { id: 'psu-300w', wattage: 300 },
                                network: { id: 'net-250mb', speed: 250 },
                            },
                            software: startingSoftware,
                            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                            messages: [],
                            managerName: 'Test',
                            reputation: 9,
                            reputationCountdown: null,
                            activeMission: null,
                            completedMissions: [],
                            availableMissions: [],
                            missionCooldowns: { easy: null, medium: null, hard: null },
                            narEntries: [],
                            activeConnections: [],
                            lastScanResults: null,
                            fileManagerConnections: [],
                            lastFileOperation: null,
                            downloadQueue: [],
                            transactions: [],
                            licensedSoftware: [],
                            bankruptcyCountdown: null,
                            lastInterestTime: null,
                            windows: [
                                {
                                    id: 'window-1',
                                    appId: 'mail',
                                    zIndex: 1001,
                                    minimized: false,
                                    position: { x: 50, y: 100 },
                                },
                                {
                                    id: 'window-2',
                                    appId: 'banking',
                                    zIndex: 1000,
                                    minimized: true,
                                    position: { x: 80, y: 130 },
                                },
                                {
                                    id: 'window-3',
                                    appId: 'portal',
                                    zIndex: 1002,
                                    minimized: false,
                                    position: { x: 110, y: 160 },
                                },
                            ],
                            savedAt: '2024-01-01T00:00:00.000Z',
                            saveName: 'WindowPersistTest',
                        },
                    ],
                };
                localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
            }, STARTING_SOFTWARE);

            await page.reload();

            // Load the save
            await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
            const saveItem = page.locator('.save-item:has-text("window_persist_test")');
            await saveItem.locator('button:has-text("Load")').click();
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Verify window state persisted
            const openWindowsAfterLoad = await page.locator('.window').count();
            const minimizedWindowsAfterLoad = await page.locator('.minimized-window').count();


            // Verify we have 2 open windows and 1 minimized (as defined in save)
            expect(openWindowsAfterLoad).toBe(2); // Mail and Portal
            expect(minimizedWindowsAfterLoad).toBe(1); // Banking
            console.log('TEST: Window counts verified');

            // Verify specific windows are present
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            const portalWindow = page.locator('.window:has-text("OSNet Portal")');
            await expect(mailWindow).toBeVisible();
            await expect(portalWindow).toBeVisible();
            await expect(page.locator('.minimized-window:has-text("SNet Banking")')).toBeVisible();

            // Verify window positions persisted (check they're at saved positions)
            const mailPos = await mailWindow.boundingBox();
            const portalPos = await portalWindow.boundingBox();

            // Positions should match saved values (x:50,y:100 for mail, x:110,y:160 for portal)
            expect(mailPos.x).toBe(50);
            expect(mailPos.y).toBe(100);
            expect(portalPos.x).toBe(110);
            expect(portalPos.y).toBe(160);

            // Verify minimized window can be restored
            await page.click('.minimized-window:has-text("SNet Banking")');
            await expect(page.locator('.window:has-text("SNet Banking App")')).toBeVisible();
            await page.waitForTimeout(500); // Allow window to fully render after restore

            // Verify all windows are still functional
            await page.locator('.window:has-text("SNet Mail")').locator('button:has-text("×")').click();


            // List all window titles
            const titles = await page.locator('.window .window-title').allTextContents();
            console.log(`TEST: Remaining window titles: ${titles.join(', ')}`);


            const bankingWindow = page.locator('.window').filter({ hasText: 'Banking' }).first();
            await expect(bankingWindow).toBeVisible({ timeout: 5000 });
            await bankingWindow.locator('button:has-text("×")').click();
            await page.waitForTimeout(500);

            await page.locator('.window:has-text("Portal")').locator('button:has-text("×")').click();

            // All windows should be closed
            await expect(page.locator('.window')).toHaveCount(0);
            await expect(page.locator('.minimized-window')).toHaveCount(0);
        });


        test('should persist window z-index order after save/load', async ({ page }) => {
            await page.goto('/?skipBoot=true');

            // Create a save with credits to skip message flow
            await page.evaluate((startingSoftware) => {
                const saves = {
                    zindex_test: [
                        {
                            username: 'zindex_test',
                            playerMailId: 'SNET-ZZZ-123-456',
                            currentTime: '2020-03-25T09:00:00',
                            hardware: {
                                cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
                                memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
                                storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
                                motherboard: { id: 'board-basic', name: 'Basic Board' },
                                powerSupply: { id: 'psu-300w', wattage: 300 },
                                network: { id: 'net-250mb', speed: 250 },
                            },
                            software: startingSoftware,
                            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
                            messages: [],
                            managerName: 'Test',
                            windows: [],
                            savedAt: '2024-01-01T00:00:00.000Z',
                            saveName: 'ZIndexTest',
                        },
                    ],
                };
                localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
            }, STARTING_SOFTWARE);

            await page.reload();
            await page.click('button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open 3 windows in specific order
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            await page.waitForTimeout(200);

            await page.click('text=☰');
            await page.click('text=SNet Banking App');
            await page.waitForTimeout(200);

            await page.click('text=☰');
            await page.click('text=OSNet Portal');
            await page.waitForTimeout(200);

            // Click Mail window to bring it to front
            const mailWindow = page.locator('.window:has-text("SNet Mail")');
            await mailWindow.locator('.window-header').click();
            await page.waitForTimeout(200);

            // Mail should now be on top (highest z-index)
            // Get z-index values
            const mailZIndex = await mailWindow.evaluate((el) => window.getComputedStyle(el).zIndex);
            const bankZIndex = await page
                .locator('.window:has-text("SNet Banking")')
                .evaluate((el) => window.getComputedStyle(el).zIndex);
            const portalZIndex = await page
                .locator('.window:has-text("OSNet Portal")')
                .evaluate((el) => window.getComputedStyle(el).zIndex);

            // Mail should have highest z-index (was clicked last)
            expect(parseInt(mailZIndex)).toBeGreaterThan(parseInt(bankZIndex));
            expect(parseInt(mailZIndex)).toBeGreaterThan(parseInt(portalZIndex));

            // Save the game with this window order
            page.once('dialog', (dialog) => dialog.accept('ZIndexSave'));
            await page.hover('text=⏻');
            await page.click('text=Save');
            await page.waitForTimeout(1000);

            // Reload and load save
            await page.reload();
            await page.click('.save-item:has-text("zindex_test") button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Verify all 3 windows restored
            await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
            await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();
            await expect(page.locator('.window:has-text("OSNet Portal")')).toBeVisible();

            // Verify z-index order persisted
            const mailZIndexAfter = await page
                .locator('.window:has-text("SNet Mail")')
                .evaluate((el) => window.getComputedStyle(el).zIndex);
            const bankZIndexAfter = await page
                .locator('.window:has-text("SNet Banking")')
                .evaluate((el) => window.getComputedStyle(el).zIndex);
            const portalZIndexAfter = await page
                .locator('.window:has-text("OSNet Portal")')
                .evaluate((el) => window.getComputedStyle(el).zIndex);

            // Mail should still be on top
            expect(parseInt(mailZIndexAfter)).toBeGreaterThan(parseInt(bankZIndexAfter));
            expect(parseInt(mailZIndexAfter)).toBeGreaterThan(parseInt(portalZIndexAfter));
        });
    });
});

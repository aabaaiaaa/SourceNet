import { test, expect } from '@playwright/test';

/**
 * Concurrent Paste E2E Tests
 * 
 * Tests that multiple File Manager instances can paste files to the same
 * destination simultaneously without losing files.
 * 
 * Bug scenario: When two File Manager instances paste to the same location,
 * one paste operation can overwrite or lose files from the other due to
 * race conditions in the file system update mechanism.
 */

/**
 * Create test state with two source file systems and one destination file system
 */
const setupTestState = async (page) => {
    await page.evaluate(() => {
        const testSave = {
            username: 'concurrent_paste_test',
            playerMailId: 'concurrent_paste_test@sourcenet.local',
            currentTime: '2020-03-25T09:00:00.000Z',
            timeSpeed: 1,
            hardware: {
                cpu: { id: 'cpu-1ghz-single', name: '1GHz Single Core', specs: '1GHz, 1 core', price: 200, power: 65 },
                memory: [{ id: 'ram-2gb', name: '2GB RAM', capacity: '2GB', price: 150, power: 3 }],
                storage: [{ id: 'ssd-90gb', name: '90GB SSD', capacity: '90GB', price: 100, power: 2 }],
                motherboard: { id: 'board-basic', name: 'Basic Board', cpuSlots: 1, memorySlots: 2, storageSlots: 2, networkSlots: 1, price: 150, power: 5 },
                powerSupply: { id: 'psu-300w', name: '300W PSU', wattage: 300, price: 80 },
                network: { id: 'net-250mb', name: '250Mb Network Card', speed: 250, price: 100, power: 5 }
            },
            software: [
                { id: 'osnet', name: 'OSNet', type: 'os', canRemove: false },
                { id: 'portal', name: 'OSNet Software/Hardware Portal', type: 'system', canRemove: false },
                { id: 'mail', name: 'SNet Mail', type: 'system', canRemove: false },
                { id: 'banking', name: 'SNet Banking App', type: 'system', canRemove: false },
                { id: 'file-manager', name: 'File Manager', type: 'utility', canRemove: false },
            ],
            bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 2000 }],
            messages: [],
            managerName: 'Test Manager',
            windows: [],
            reputation: 10,
            activeMission: null,
            completedMissions: [],
            activeConnections: [],  // Will be set after load
            discoveredDevices: {
                'test-network-1': ['10.0.1.10'],
                'test-network-2': ['10.0.2.10'],
                'destination-network': ['10.0.3.10'],
            },
            networkRegistry: {
                networks: [
                    { networkId: 'test-network-1', networkName: 'Source Network 1', address: '10.0.1.0/24', bandwidth: 100, accessible: true, discovered: true },
                    { networkId: 'test-network-2', networkName: 'Source Network 2', address: '10.0.2.0/24', bandwidth: 100, accessible: true, discovered: true },
                    { networkId: 'destination-network', networkName: 'Destination Network', address: '10.0.3.0/24', bandwidth: 100, accessible: true, discovered: true },
                ],
                devices: [
                    { ip: '10.0.1.10', hostname: 'source-1', networkId: 'test-network-1', fileSystemId: 'fs-source-1', accessible: true },
                    { ip: '10.0.2.10', hostname: 'source-2', networkId: 'test-network-2', fileSystemId: 'fs-source-2', accessible: true },
                    { ip: '10.0.3.10', hostname: 'destination', networkId: 'destination-network', fileSystemId: 'fs-destination', accessible: true },
                ],
                fileSystems: [
                    {
                        id: 'fs-source-1',
                        files: [
                            { name: 'file_from_source_1.txt', size: '1.0 KB', corrupted: false },
                        ]
                    },
                    {
                        id: 'fs-source-2',
                        files: [
                            { name: 'file_from_source_2.txt', size: '1.0 KB', corrupted: false },
                        ]
                    },
                    {
                        id: 'fs-destination',
                        files: [] // Empty destination
                    },
                ]
            },
            savedAt: new Date().toISOString(),
        };

        const saves = { concurrent_paste_test: [testSave] };
        localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });
};

/**
 * Open File Manager app and return the window locator
 */
const openFileManager = async (page, instanceNumber = 1) => {
    await page.hover('text=☰');
    await page.waitForTimeout(100);
    await page.click('button:has-text("File Manager")');
    await page.waitForTimeout(300);

    // Get all File Manager windows
    const windows = page.locator('.window:has(.file-manager)');
    const count = await windows.count();

    if (count < instanceNumber) {
        throw new Error(`Expected at least ${instanceNumber} File Manager windows, found ${count}`);
    }

    return windows.nth(instanceNumber - 1);
};

/**
 * Select a file system in a File Manager window
 */
const selectFileSystem = async (fileManagerWindow, fileSystemId) => {
    const dropdown = fileManagerWindow.locator('select');
    await expect(dropdown).toBeVisible();
    await dropdown.selectOption(fileSystemId);
    await expect(dropdown).toHaveValue(fileSystemId);
};

/**
 * Select all files in a File Manager window by window index (1-based)
 */
const selectAllFilesInWindow = async (page, windowIndex) => {
    const count = await page.evaluate((idx) => {
        const windows = document.querySelectorAll('.window:has(.file-manager)');
        const win = windows[idx - 1];
        if (!win) return 0;
        const fileItems = win.querySelectorAll('.file-item');
        fileItems.forEach(item => item.click());
        return fileItems.length;
    }, windowIndex);
    return count;
};

/**
 * Click copy button in a File Manager window by window index (1-based)
 */
const clickCopyInWindow = async (page, windowIndex) => {
    await page.evaluate((idx) => {
        const windows = document.querySelectorAll('.window:has(.file-manager)');
        const win = windows[idx - 1];
        if (!win) return;
        const buttons = win.querySelectorAll('.fm-toolbar button');
        for (const btn of buttons) {
            if (btn.textContent.includes('Copy')) {
                btn.click();
                return;
            }
        }
    }, windowIndex);
};

/**
 * Click paste button in a File Manager window by window index (1-based)
 */
const clickPasteInWindow = async (page, windowIndex) => {
    await page.evaluate((idx) => {
        const windows = document.querySelectorAll('.window:has(.file-manager)');
        const win = windows[idx - 1];
        if (!win) return;
        const buttons = win.querySelectorAll('.fm-toolbar button');
        for (const btn of buttons) {
            if (btn.textContent.includes('Paste')) {
                btn.click();
                return;
            }
        }
    }, windowIndex);
};

/**
 * Get file names in a File Manager window
 */
const getFileNames = async (fileManagerWindow) => {
    const fileItems = fileManagerWindow.locator('.file-item .file-name');
    const count = await fileItems.count();
    const names = [];

    for (let i = 0; i < count; i++) {
        names.push(await fileItems.nth(i).textContent());
    }

    return names;
};

/**
 * Wait for file transfer to complete (no more transferring files)
 */
const waitForTransferComplete = async (fileManagerWindow, timeout = 10000) => {
    // Wait for any transferring indicators to disappear
    await expect(fileManagerWindow.locator('.file-item.transferring')).toHaveCount(0, { timeout });
};


test.describe('Concurrent Paste Operations', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate first, then clear localStorage
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should preserve files when two File Manager instances paste to same destination', async ({ page }) => {
        // ========================================
        // SETUP: Create test state with source files
        // ========================================
        await setupTestState(page);
        await page.reload();
        await page.waitForTimeout(500);

        // Load the save
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Establish network connections (can't be in save data)
        await page.evaluate(() => {
            window.gameContext.setActiveConnections([
                { networkId: 'test-network-1', networkName: 'Source Network 1', connectedAt: new Date().toISOString() },
                { networkId: 'test-network-2', networkName: 'Source Network 2', connectedAt: new Date().toISOString() },
                { networkId: 'destination-network', networkName: 'Destination Network', connectedAt: new Date().toISOString() },
            ]);
        });
        await page.waitForTimeout(300);

        // ========================================
        // STEP 1: Open first File Manager, select source 1, copy file
        // ========================================
        const fm1 = await openFileManager(page, 1);
        await selectFileSystem(fm1, 'fs-source-1');
        await page.waitForTimeout(300);

        // Verify file is visible
        const fm1Files = await getFileNames(fm1);
        expect(fm1Files).toContain('file_from_source_1.txt');

        await selectAllFilesInWindow(page, 1);
        await page.waitForTimeout(100);
        await clickCopyInWindow(page, 1);

        // ========================================
        // STEP 2: Open second File Manager, select source 2, copy different file
        // (This will overwrite the clipboard - that's expected behavior)
        // ========================================
        const fm2 = await openFileManager(page, 2);
        await selectFileSystem(fm2, 'fs-source-2');
        await page.waitForTimeout(300);

        const fm2Files = await getFileNames(fm2);
        expect(fm2Files).toContain('file_from_source_2.txt');

        // ========================================
        // STEP 3: Change FM1 to destination, paste (file_from_source_1 was copied)
        // ========================================
        // First, re-copy from source 1 in FM1
        await selectFileSystem(fm1, 'fs-source-1');
        await page.waitForTimeout(300);
        await selectAllFilesInWindow(page, 1);
        await page.waitForTimeout(100);
        await clickCopyInWindow(page, 1);

        // Now switch FM1 to destination and paste
        await selectFileSystem(fm1, 'fs-destination');
        await page.waitForTimeout(300);
        await clickPasteInWindow(page, 1);

        // ========================================
        // STEP 4: Copy from source 2 in FM2
        // ========================================
        await selectAllFilesInWindow(page, 2);
        await page.waitForTimeout(100);
        await clickCopyInWindow(page, 2);

        // ========================================
        // STEP 5: Change FM2 to destination, paste
        // ========================================
        await selectFileSystem(fm2, 'fs-destination');
        await page.waitForTimeout(300);
        await clickPasteInWindow(page, 2);

        // ========================================
        // STEP 6: Wait for transfers to complete
        // ========================================
        // Wait longer for file transfers to complete
        await page.waitForTimeout(3000);

        await waitForTransferComplete(fm1);
        await waitForTransferComplete(fm2);

        // Give a moment for state to settle
        await page.waitForTimeout(1000);

        // Debug: Check NetworkRegistry state
        const registryState = await page.evaluate(() => {
            const fs = window.networkRegistry?.getFileSystem('fs-destination');
            return {
                files: fs?.files || [],
                fileNames: fs?.files?.map(f => f.name) || []
            };
        });
        console.log('Registry state for fs-destination:', registryState);

        // ========================================
        // STEP 7: Verify BOTH files exist at destination
        // ========================================
        // Refresh FM1's view of destination
        await selectFileSystem(fm1, 'fs-source-1');
        await page.waitForTimeout(200);
        await selectFileSystem(fm1, 'fs-destination');
        await page.waitForTimeout(300);

        const destinationFiles = await getFileNames(fm1);

        console.log('Files at destination:', destinationFiles);

        // CRITICAL ASSERTION: Both files should exist
        expect(destinationFiles).toContain('file_from_source_1.txt');
        expect(destinationFiles).toContain('file_from_source_2.txt');
        expect(destinationFiles.length).toBe(2);

        console.log('✅ Both files preserved after concurrent paste operations');
    });

    test('should handle rapid sequential pastes from different sources to same destination', async ({ page }) => {
        // ========================================
        // SETUP: Create test state
        // ========================================
        await setupTestState(page);
        await page.reload();
        await page.waitForTimeout(500);

        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Establish network connections (can't be in save data)
        await page.evaluate(() => {
            window.gameContext.setActiveConnections([
                { networkId: 'test-network-1', networkName: 'Source Network 1', connectedAt: new Date().toISOString() },
                { networkId: 'test-network-2', networkName: 'Source Network 2', connectedAt: new Date().toISOString() },
                { networkId: 'destination-network', networkName: 'Destination Network', connectedAt: new Date().toISOString() },
            ]);
        });
        await page.waitForTimeout(300);

        // ========================================
        // STEP 1: Open two File Manager instances
        // ========================================
        const fm1 = await openFileManager(page, 1);
        const fm2 = await openFileManager(page, 2);

        // ========================================
        // STEP 2: Set up FM1 on source 1, FM2 on source 2
        // ========================================
        await selectFileSystem(fm1, 'fs-source-1');
        await selectFileSystem(fm2, 'fs-source-2');
        await page.waitForTimeout(300);

        // ========================================
        // STEP 3: Copy in FM1, switch to destination, paste
        // ========================================
        await selectAllFilesInWindow(page, 1);
        await page.waitForTimeout(100);
        await clickCopyInWindow(page, 1);
        await selectFileSystem(fm1, 'fs-destination');
        await page.waitForTimeout(200);
        await clickPasteInWindow(page, 1);

        // ========================================
        // STEP 4: Immediately copy in FM2, switch to destination, paste
        // ========================================
        await selectAllFilesInWindow(page, 2);
        await page.waitForTimeout(100);
        await clickCopyInWindow(page, 2);
        await selectFileSystem(fm2, 'fs-destination');
        await page.waitForTimeout(200);
        await clickPasteInWindow(page, 2);

        // ========================================
        // STEP 6: Wait for transfers to complete
        // ========================================
        // Wait longer for file transfers to complete
        await page.waitForTimeout(3000);

        await waitForTransferComplete(fm1, 15000);
        await waitForTransferComplete(fm2, 15000);

        // Give a moment for state to settle
        await page.waitForTimeout(1000);

        // Debug: Check NetworkRegistry state
        const registryState2 = await page.evaluate(() => {
            const fs = window.networkRegistry?.getFileSystem('fs-destination');
            return {
                files: fs?.files || [],
                fileNames: fs?.files?.map(f => f.name) || []
            };
        });
        console.log('Registry state for fs-destination (test 2):', registryState2);

        // ========================================
        // STEP 6: Verify both files at destination
        // ========================================
        // Refresh view
        await selectFileSystem(fm1, 'fs-source-1');
        await page.waitForTimeout(200);
        await selectFileSystem(fm1, 'fs-destination');
        await page.waitForTimeout(300);

        const destinationFiles = await getFileNames(fm1);

        console.log('Files at destination after rapid paste:', destinationFiles);

        expect(destinationFiles).toContain('file_from_source_1.txt');
        expect(destinationFiles).toContain('file_from_source_2.txt');
        expect(destinationFiles.length).toBe(2);

        console.log('✅ Rapid sequential pastes preserved all files');
    });
});

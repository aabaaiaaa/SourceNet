/**
 * Data Recovery Tool E2E Tests
 *
 * Tests the Data Recovery Tool's ability to discover and display deleted files
 * when scanning file systems.
 */

import { test, expect } from '@playwright/test';
import { openApp, setSpecificTimeSpeed } from '../helpers/common-actions.js';

test.describe('Data Recovery Tool', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('discovers deleted files when scanning', async ({ page }) => {
        // Use post-hardware-unlock scenario which has investigation-tooling unlocked
        // This makes the Data Recovery Tool available in the software store
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with file system containing deleted files
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            // Register the test network
            registry.registerNetwork({
                networkId: 'test-recovery-net',
                networkName: 'Test Recovery Network',
                address: '192.168.100.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            // Register file system FIRST with mix of normal and deleted files
            registry.registerFileSystem({
                id: 'fs-test-recovery',
                files: [
                    { name: 'normal-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'deleted-file-1.pdf', size: '5 MB', status: 'deleted' },
                    { name: 'deleted-file-2.doc', size: '2 MB', status: 'deleted' },
                ],
            });

            // Register device directly (not addDevice which auto-creates file systems)
            registry.registerDevice({
                ip: '192.168.100.10',
                hostname: 'test-server',
                networkId: 'test-recovery-net',
                fileSystemId: 'fs-test-recovery',
                accessible: true,
            });

            // Connect to the network by adding to activeConnections
            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-recovery-net',
                    networkName: 'Test Recovery Network',
                    address: '192.168.100.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            // Mark the device as discovered (use array, will be converted to Set)
            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-recovery-net': ['192.168.100.10'],
            }));
        });

        // Install Data Recovery Tool (scenario has it unlocked but not installed)
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        // Wait for state to settle
        await page.waitForTimeout(500);

        // Speed up game time
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');

        // Wait a bit for the component to render with updated state
        await page.waitForTimeout(300);

        // Select the file system using the value (file system ID)
        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-recovery');

        // Click scan button
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();

        // Wait for scan to complete (button text changes back from "Scanning...")
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify deleted files appear in the list
        await expect(drtWindow.locator('text=deleted-file-1.pdf')).toBeVisible();
        await expect(drtWindow.locator('text=deleted-file-2.doc')).toBeVisible();

        // Verify the deleted files have the DELETED status badge
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(2);

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('shows empty state when no deleted files exist', async ({ page }) => {
        // Use post-hardware-unlock scenario which has investigation-tooling unlocked
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up a test network with file system containing NO deleted files
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            // Register the test network
            registry.registerNetwork({
                networkId: 'test-no-deleted-net',
                networkName: 'Test Clean Network',
                address: '192.168.101.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            // Register file system FIRST with only normal files (no deleted files)
            registry.registerFileSystem({
                id: 'fs-test-clean',
                files: [
                    { name: 'normal-file-1.txt', size: '1 KB' },
                    { name: 'normal-file-2.txt', size: '2 KB' },
                ],
            });

            // Register device directly
            registry.registerDevice({
                ip: '192.168.101.10',
                hostname: 'clean-server',
                networkId: 'test-no-deleted-net',
                fileSystemId: 'fs-test-clean',
                accessible: true,
            });

            // Connect to the network
            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-no-deleted-net',
                    networkName: 'Test Clean Network',
                    address: '192.168.101.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            // Mark the device as discovered (use array)
            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-no-deleted-net': ['192.168.101.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        // Wait for state to settle
        await page.waitForTimeout(500);

        // Speed up game time
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');

        // Wait a bit for the component to render
        await page.waitForTimeout(300);

        // Select the file system
        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-clean');

        // Click scan button
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();

        // Wait for scan to complete
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify no deleted files are listed (only normal files should show)
        // The scan should complete but no files with "DELETED" status should appear
        const deletedFiles = drtWindow.locator('.file-status.deleted');
        await expect(deletedFiles).toHaveCount(0);

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('restores a single deleted file', async ({ page }) => {
        // Use post-hardware-unlock scenario
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with deleted files
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            registry.registerNetwork({
                networkId: 'test-restore-net',
                networkName: 'Test Restore Network',
                address: '192.168.102.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            registry.registerFileSystem({
                id: 'fs-test-restore',
                files: [
                    { name: 'normal-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'recoverable-file.pdf', size: '2 MB', status: 'deleted' },
                ],
            });

            registry.registerDevice({
                ip: '192.168.102.10',
                hostname: 'restore-server',
                networkId: 'test-restore-net',
                fileSystemId: 'fs-test-restore',
                accessible: true,
            });

            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-restore-net',
                    networkName: 'Test Restore Network',
                    address: '192.168.102.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-restore-net': ['192.168.102.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');
        await page.waitForTimeout(300);

        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-restore');

        // Scan for deleted files
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify deleted file is discovered
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(1);
        await expect(drtWindow.locator('text=recoverable-file.pdf')).toBeVisible();

        // Verify Restore button shows (0) initially
        await expect(drtWindow.locator('button.restore')).toContainText('Restore (0)');

        // Click on the deleted file to select it
        await drtWindow.locator('.data-recovery-file-item.deleted').click();

        // Verify file is selected and Restore button updates
        await expect(drtWindow.locator('.data-recovery-file-item.deleted.selected')).toBeVisible();
        await expect(drtWindow.locator('button.restore')).toContainText('Restore (1)');

        // Click Restore button
        await drtWindow.locator('button.restore').click();

        // Wait for restore operation to complete (file should no longer have deleted status)
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 15000 });

        // Verify the file now has NORMAL status instead of DELETED
        const restoredFileItem = drtWindow.locator('.data-recovery-file-item:has-text("recoverable-file.pdf")');
        await expect(restoredFileItem.locator('.file-status.normal')).toBeVisible();
        await expect(restoredFileItem.locator('.file-status.deleted')).toHaveCount(0);

        // Verify no more deleted files in the list
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(0);

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('restores multiple deleted files at once', async ({ page }) => {
        // Use post-hardware-unlock scenario
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with multiple deleted files
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            registry.registerNetwork({
                networkId: 'test-multi-restore-net',
                networkName: 'Test Multi-Restore Network',
                address: '192.168.103.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            registry.registerFileSystem({
                id: 'fs-test-multi-restore',
                files: [
                    { name: 'normal-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'deleted-doc-1.pdf', size: '1 MB', status: 'deleted' },
                    { name: 'deleted-doc-2.pdf', size: '1 MB', status: 'deleted' },
                    { name: 'deleted-doc-3.pdf', size: '1 MB', status: 'deleted' },
                ],
            });

            registry.registerDevice({
                ip: '192.168.103.10',
                hostname: 'multi-restore-server',
                networkId: 'test-multi-restore-net',
                fileSystemId: 'fs-test-multi-restore',
                accessible: true,
            });

            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-multi-restore-net',
                    networkName: 'Test Multi-Restore Network',
                    address: '192.168.103.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-multi-restore-net': ['192.168.103.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');
        await page.waitForTimeout(300);

        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-multi-restore');

        // Scan for deleted files
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify all 3 deleted files are discovered
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(3);

        // Select all deleted files by clicking each one
        const deletedItems = drtWindow.locator('.data-recovery-file-item.deleted');
        const count = await deletedItems.count();
        for (let i = 0; i < count; i++) {
            await deletedItems.nth(i).click();
        }

        // Verify Restore button shows correct count
        await expect(drtWindow.locator('button.restore')).toContainText('Restore (3)');

        // Click Restore button
        await drtWindow.locator('button.restore').click();

        // Wait for all restore operations to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 30000 });

        // Verify all files now have NORMAL status
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(0);
        await expect(drtWindow.locator('.file-status.normal')).toHaveCount(4); // 1 original + 3 restored

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('securely deletes a normal file', async ({ page }) => {
        // Use post-hardware-unlock scenario
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with normal files only
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            registry.registerNetwork({
                networkId: 'test-secure-delete-net',
                networkName: 'Test Secure Delete Network',
                address: '192.168.104.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            registry.registerFileSystem({
                id: 'fs-test-secure-delete',
                files: [
                    { name: 'keep-this-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'delete-this-file.txt', size: '1 KB', status: 'normal' },
                ],
            });

            registry.registerDevice({
                ip: '192.168.104.10',
                hostname: 'secure-delete-server',
                networkId: 'test-secure-delete-net',
                fileSystemId: 'fs-test-secure-delete',
                accessible: true,
            });

            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-secure-delete-net',
                    networkName: 'Test Secure Delete Network',
                    address: '192.168.104.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-secure-delete-net': ['192.168.104.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');
        await page.waitForTimeout(300);

        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-secure-delete');

        // Verify both normal files are visible (no scan needed for normal files)
        await expect(drtWindow.locator('.file-status.normal')).toHaveCount(2);

        // Verify Secure Delete button shows (0) initially
        await expect(drtWindow.locator('button.secure-delete')).toContainText('Secure Delete (0)');

        // Click on the file to delete to select it
        await drtWindow.locator('.data-recovery-file-item:has-text("delete-this-file.txt")').click();

        // Verify file is selected and Secure Delete button updates
        await expect(drtWindow.locator('.data-recovery-file-item.selected:has-text("delete-this-file.txt")')).toBeVisible();
        await expect(drtWindow.locator('button.secure-delete')).toContainText('Secure Delete (1)');

        // Click Secure Delete button
        await drtWindow.locator('button.secure-delete').click();

        // Wait for secure delete operation to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 15000 });

        // Verify the file is completely removed from the list
        await expect(drtWindow.locator('text=delete-this-file.txt')).toHaveCount(0);

        // Verify only the kept file remains
        await expect(drtWindow.locator('.file-status.normal')).toHaveCount(1);
        await expect(drtWindow.locator('text=keep-this-file.txt')).toBeVisible();

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('securely deletes a discovered deleted file', async ({ page }) => {
        // Use post-hardware-unlock scenario
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with a deleted file
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            registry.registerNetwork({
                networkId: 'test-secure-delete-deleted-net',
                networkName: 'Test Secure Delete Deleted Network',
                address: '192.168.105.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            registry.registerFileSystem({
                id: 'fs-test-secure-delete-deleted',
                files: [
                    { name: 'normal-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'deleted-to-destroy.pdf', size: '2 MB', status: 'deleted' },
                ],
            });

            registry.registerDevice({
                ip: '192.168.105.10',
                hostname: 'secure-delete-deleted-server',
                networkId: 'test-secure-delete-deleted-net',
                fileSystemId: 'fs-test-secure-delete-deleted',
                accessible: true,
            });

            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-secure-delete-deleted-net',
                    networkName: 'Test Secure Delete Deleted Network',
                    address: '192.168.105.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-secure-delete-deleted-net': ['192.168.105.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');
        await page.waitForTimeout(300);

        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-secure-delete-deleted');

        // Scan for deleted files first (required to see and operate on deleted files)
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify deleted file is discovered
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(1);
        await expect(drtWindow.locator('text=deleted-to-destroy.pdf')).toBeVisible();

        // Click on the deleted file to select it
        await drtWindow.locator('.data-recovery-file-item.deleted').click();

        // Verify Secure Delete button shows (1) - can secure delete discovered deleted files
        await expect(drtWindow.locator('button.secure-delete')).toContainText('Secure Delete (1)');

        // Click Secure Delete button
        await drtWindow.locator('button.secure-delete').click();

        // Wait for secure delete operation to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 15000 });

        // Verify the deleted file is permanently removed (not just marked deleted, but gone)
        await expect(drtWindow.locator('text=deleted-to-destroy.pdf')).toHaveCount(0);

        // Verify only the normal file remains
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(0);
        await expect(drtWindow.locator('.file-status.normal')).toHaveCount(1);
        await expect(drtWindow.locator('text=normal-file.txt')).toBeVisible();

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });

    test('securely deletes multiple files at once', async ({ page }) => {
        // Use post-hardware-unlock scenario
        await page.goto('/?scenario=post-hardware-unlock&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Set up test network with mix of normal and deleted files
        await page.evaluate(() => {
            const registry = window.gameContext.networkRegistry;

            registry.registerNetwork({
                networkId: 'test-multi-secure-delete-net',
                networkName: 'Test Multi Secure Delete Network',
                address: '192.168.106.0/24',
                bandwidth: 100,
                accessible: true,
                discovered: true,
            });

            registry.registerFileSystem({
                id: 'fs-test-multi-secure-delete',
                files: [
                    { name: 'keep-file.txt', size: '1 KB', status: 'normal' },
                    { name: 'normal-to-delete.txt', size: '1 KB', status: 'normal' },
                    { name: 'deleted-to-destroy-1.pdf', size: '1 MB', status: 'deleted' },
                    { name: 'deleted-to-destroy-2.pdf', size: '1 MB', status: 'deleted' },
                ],
            });

            registry.registerDevice({
                ip: '192.168.106.10',
                hostname: 'multi-secure-delete-server',
                networkId: 'test-multi-secure-delete-net',
                fileSystemId: 'fs-test-multi-secure-delete',
                accessible: true,
            });

            window.gameContext.setActiveConnections(prev => [
                ...prev,
                {
                    networkId: 'test-multi-secure-delete-net',
                    networkName: 'Test Multi Secure Delete Network',
                    address: '192.168.106.0/24',
                    connectedAt: new Date().toISOString(),
                }
            ]);

            window.gameContext.setDiscoveredDevices(prev => ({
                ...prev,
                'test-multi-secure-delete-net': ['192.168.106.10'],
            }));
        });

        // Install Data Recovery Tool
        await page.evaluate(() => {
            const currentSoftware = window.gameContext.software || [];
            if (!currentSoftware.includes('data-recovery-tool')) {
                window.gameContext.setSoftware([...currentSoftware, 'data-recovery-tool']);
            }
        });

        await page.waitForTimeout(500);
        await setSpecificTimeSpeed(page, 100);

        // Open Data Recovery Tool
        await openApp(page, 'Data Recovery Tool');
        await page.waitForTimeout(300);

        const drtWindow = page.locator('.window:has-text("Data Recovery Tool")');
        await drtWindow.locator('select').selectOption('fs-test-multi-secure-delete');

        // Scan for deleted files first
        await drtWindow.locator('button:has-text("Scan for Deleted Files")').click();
        await expect(drtWindow.locator('button:has-text("Scan for Deleted Files")')).toBeVisible({ timeout: 10000 });

        // Verify initial state: 2 normal files visible, 2 deleted files discovered
        await expect(drtWindow.locator('.file-status.normal')).toHaveCount(2);
        await expect(drtWindow.locator('.file-status.deleted')).toHaveCount(2);

        // Select the normal file to delete
        await drtWindow.locator('.data-recovery-file-item:has-text("normal-to-delete.txt")').click();

        // Select both deleted files
        await drtWindow.locator('.data-recovery-file-item:has-text("deleted-to-destroy-1.pdf")').click();
        await drtWindow.locator('.data-recovery-file-item:has-text("deleted-to-destroy-2.pdf")').click();

        // Verify Secure Delete button shows (3) - 1 normal + 2 deleted
        await expect(drtWindow.locator('button.secure-delete')).toContainText('Secure Delete (3)');

        // Click Secure Delete button
        await drtWindow.locator('button.secure-delete').click();

        // Wait for all secure delete operations to complete
        await expect(drtWindow.locator('.data-recovery-file-item.operating')).toHaveCount(0, { timeout: 30000 });

        // Verify all 3 files are permanently removed
        await expect(drtWindow.locator('text=normal-to-delete.txt')).toHaveCount(0);
        await expect(drtWindow.locator('text=deleted-to-destroy-1.pdf')).toHaveCount(0);
        await expect(drtWindow.locator('text=deleted-to-destroy-2.pdf')).toHaveCount(0);

        // Verify only the kept file remains
        await expect(drtWindow.locator('.data-recovery-file-item')).toHaveCount(1);
        await expect(drtWindow.locator('text=keep-file.txt')).toBeVisible();

        // Reset time speed
        await setSpecificTimeSpeed(page, 1);
    });
});

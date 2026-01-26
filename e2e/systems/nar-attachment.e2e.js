import { test, expect } from '@playwright/test';

test.describe('E2E: Network Address Attachment Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Start with a fresh state
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should activate network address attachment when NAR is installed', async ({ page }) => {
        // ========================================
        // SETUP: Create test save with NAR installed and network address message
        // ========================================

        await page.goto('/?skipBoot=true');

        // Create a save state with NAR already installed and a message containing network address attachment
        await page.evaluate(() => {
            const testSave = {
                username: 'nar_test',
                playerMailId: 'nar_test@sourcenet.local',
                currentTime: '2020-03-25T09:00:00.000Z',
                timeSpeed: 1,
                hardware: [
                    { id: 'cpu-1', type: 'cpu', name: 'Standard CPU', specs: '2.4 GHz' },
                    { id: 'ram-1', type: 'ram', name: 'Standard RAM', specs: '4 GB' },
                    { id: 'storage-1', type: 'storage', name: 'Standard HDD', specs: '500 GB' },
                ],
                software: [
                    { id: 'osnet', type: 'os' },
                    { id: 'portal', type: 'system' },
                    { id: 'mail', type: 'system' },
                    { id: 'banking', type: 'system' },
                    { id: 'network-address-register', type: 'utility' }, // NAR is installed
                ],
                bankAccounts: [
                    {
                        id: 'acc-1',
                        bankName: 'First Bank Ltd',
                        accountNumber: 'FB-001',
                        balance: 2000,
                        type: 'checking',
                    },
                ],
                messages: [
                    {
                        id: 'msg-welcome',
                        from: 'SourceNet System <system@sourcenet.local>',
                        to: 'nar_test@sourcenet.local',
                        subject: 'Welcome to SourceNet!',
                        body: 'Welcome to SourceNet. Your journey begins now.',
                        timestamp: '2020-03-25T09:00:00.000Z',
                        read: false,
                        archived: false,
                    },
                    {
                        id: 'msg-network-access',
                        from: 'Network Admin <admin@corp.local>',
                        to: 'nar_test@sourcenet.local',
                        subject: 'VPN Access Credentials',
                        body: 'You have been granted access to our corporate VPN network. Use the attached credentials to connect.',
                        timestamp: '2020-03-25T09:01:00.000Z',
                        read: false,
                        archived: false,
                        attachments: [
                            {
                                type: 'networkAddress',
                                networkId: 'corporate-vpn-1',
                                networkName: 'Corporate VPN Network',
                                address: '10.50.100.0/24',
                            },
                        ],
                    },
                ],
                narEntries: [],
                managerName: 'Test Manager',
                windows: [],
                reputation: 10,
                activeMission: null,
                completedMissions: [],
                transactions: [],
                savedAt: new Date().toISOString(),
            };

            const saves = { nar_test: [testSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        });

        // ========================================
        // STEP 1: Load the game
        // ========================================

        await page.reload();
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 2: Open Mail and verify network attachment is clickable
        // ========================================

        await page.hover('text=☰');
        await page.click('text=SNet Mail');

        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        await expect(mailWindow).toBeVisible();

        // Click on the VPN message
        await page.click('.message-item:has-text("VPN Access Credentials")');

        // Verify message is displayed
        await expect(page.locator('text=You have been granted access')).toBeVisible();

        // Verify network attachment shows "Click to add" (NAR is installed)
        await expect(page.locator('text=Network Credentials: Corporate VPN Network')).toBeVisible();
        await expect(page.locator('text=Click to add to Network Address Register')).toBeVisible();

        // Verify attachment is NOT disabled
        const attachment = page.locator('[data-testid="network-attachment-corporate-vpn-1"]');
        await expect(attachment).not.toHaveClass(/disabled/);

        // ========================================
        // STEP 3: Click attachment to add to NAR
        // ========================================

        await attachment.click();

        // Verify status changed to show credentials used
        await expect(page.locator('text=✓ Network credentials used')).toBeVisible({ timeout: 2000 });
        await expect(page.locator('text=Click to add to Network Address Register')).not.toBeVisible();

        // Verify attachment has activated class
        await expect(attachment).toHaveClass(/activated/);

        // ========================================
        // STEP 4: Verify clicking again doesn't duplicate
        // ========================================

        await attachment.click();

        // Should still show "Network credentials used" (no change)
        await expect(page.locator('text=✓ Network credentials used')).toBeVisible();
    });

    test('should show install requirement when NAR is not installed', async ({ page }) => {
        // Create a save WITHOUT NAR installed
        await page.evaluate(() => {
            const testSave = {
                username: 'no_nar_test',
                playerMailId: 'no_nar_test@sourcenet.local',
                currentTime: '2020-03-25T09:00:00.000Z',
                timeSpeed: 1,
                hardware: [
                    { id: 'cpu-1', type: 'cpu', name: 'Standard CPU', specs: '2.4 GHz' },
                    { id: 'ram-1', type: 'ram', name: 'Standard RAM', specs: '4 GB' },
                    { id: 'storage-1', type: 'storage', name: 'Standard HDD', specs: '500 GB' },
                ],
                software: [
                    { id: 'osnet', type: 'os' },
                    { id: 'portal', type: 'system' },
                    { id: 'mail', type: 'system' },
                    { id: 'banking', type: 'system' },
                    // NAR NOT installed
                ],
                bankAccounts: [],
                messages: [
                    {
                        id: 'msg-network-access',
                        from: 'Network Admin <admin@corp.local>',
                        to: 'no_nar_test@sourcenet.local',
                        subject: 'VPN Access Credentials',
                        body: 'You have been granted access to our corporate VPN network.',
                        timestamp: '2020-03-25T09:01:00.000Z',
                        read: false,
                        archived: false,
                        attachments: [
                            {
                                type: 'networkAddress',
                                networkId: 'corporate-vpn-1',
                                networkName: 'Corporate VPN Network',
                                address: '10.50.100.0/24',
                            },
                        ],
                    },
                ],
                narEntries: [],
                managerName: 'Test Manager',
                windows: [],
                reputation: 10,
                activeMission: null,
                completedMissions: [],
                transactions: [],
                savedAt: new Date().toISOString(),
            };

            const saves = { no_nar_test: [testSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        });

        await page.reload();
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Load")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open Mail
        await page.hover('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Click on the VPN message
        await page.click('.message-item:has-text("VPN Access Credentials")');

        // Verify attachment shows install requirement message
        await expect(page.locator('text=Install Network Address Register to use this attachment')).toBeVisible();

        // Verify the attachment is disabled
        const attachment = page.locator('[data-testid="network-attachment-corporate-vpn-1"]');
        await expect(attachment).toHaveClass(/disabled/);

        // Click it - should do nothing
        await attachment.click();

        // Should still show install requirement
        await expect(page.locator('text=Install Network Address Register to use this attachment')).toBeVisible();
        await expect(page.locator('text=✓ Network credentials used')).not.toBeVisible();
    });

    test('should register network and file systems from mission extension NAR attachment', async ({ page }) => {
        // This test verifies that mission extension NAR attachments with the correct structure
        // (type, networkId, networkName, address, bandwidth, fileSystems) properly register
        // the network and file systems when the attachment is activated.

        await page.evaluate(() => {
            const testSave = {
                username: 'extension_nar_test',
                playerMailId: 'extension_nar_test@sourcenet.local',
                currentTime: '2020-03-25T09:00:00.000Z',
                timeSpeed: 1,
                hardware: [
                    { id: 'cpu-1', type: 'cpu', name: 'Standard CPU', specs: '2.4 GHz' },
                    { id: 'ram-1', type: 'ram', name: 'Standard RAM', specs: '4 GB' },
                    { id: 'storage-1', type: 'storage', name: 'Standard HDD', specs: '500 GB' },
                ],
                software: [
                    { id: 'osnet', type: 'os' },
                    { id: 'portal', type: 'system' },
                    { id: 'mail', type: 'system' },
                    { id: 'banking', type: 'system' },
                    { id: 'network-address-register', type: 'utility' },
                    { id: 'file-manager', type: 'utility' },
                    { id: 'network-scanner', type: 'utility' },  // Needed to discover devices
                ],
                bankAccounts: [
                    { id: 'acc-1', bankName: 'First Bank Ltd', accountNumber: 'FB-001', balance: 2000, type: 'checking' },
                ],
                messages: [
                    {
                        id: 'msg-extension-nar',
                        from: 'Mission Control <missions@sourcenet.local>',
                        to: 'extension_nar_test@sourcenet.local',
                        subject: 'Mission Extension: Archive Server Access',
                        body: 'We need you to also archive files to ACME-archive (192.168.50.30). Use the attached credentials.',
                        timestamp: '2020-03-25T09:01:00.000Z',
                        read: false,
                        archived: false,
                        attachments: [
                            {
                                // This is the CORRECT structure for mission extension NAR attachments
                                type: 'networkAddress',
                                networkId: 'acme-corp-net',
                                networkName: 'ACME Corporate Network',
                                address: '192.168.50.0/24',
                                bandwidth: 100,
                                fileSystems: [{
                                    id: 'fs-archive-1',
                                    ip: '192.168.50.30',
                                    name: 'ACME-archive',
                                    files: []
                                }]
                            },
                        ],
                    },
                ],
                narEntries: [],
                managerName: 'Test Manager',
                windows: [],
                reputation: 10,
                activeMission: null,
                completedMissions: [],
                transactions: [],
                // activeConnections must be empty in saves (can't save while connected)
                activeConnections: [],
                // Discovered devices - required for File Manager to display them
                discoveredDevices: {
                    'acme-corp-net': ['192.168.50.30'],
                },
                savedAt: new Date().toISOString(),
                // NetworkRegistry must include the network structure for NAR attachments to work
                // Note: networkRegistry snapshot format uses arrays, not objects with ID keys
                networkRegistry: {
                    networks: [
                        {
                            networkId: 'acme-corp-net',
                            networkName: 'ACME Corporate Network',
                            address: '192.168.50.0/24',
                            bandwidth: 100,
                            accessible: false,  // Not accessible until NAR attachment clicked
                            discovered: true,
                        }
                    ],
                    devices: [
                        {
                            ip: '192.168.50.30',
                            hostname: 'ACME-archive',
                            networkId: 'acme-corp-net',
                            fileSystemId: 'fs-archive-1',
                            accessible: false,  // Not accessible until NAR attachment clicked
                        }
                    ],
                    fileSystems: [
                        {
                            id: 'fs-archive-1',
                            files: [],
                        }
                    ],
                },
            };

            const saves = { extension_nar_test: [testSave] };
            localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
        });

        // Load the game
        await page.reload();
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });
        await page.click('button:has-text("Load Latest")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open Mail and click the extension message
        await page.hover('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
        await page.click('.message-item:has-text("Mission Extension: Archive Server Access")');

        // Verify message content shows the server name (not placeholder)
        await expect(page.locator('text=ACME-archive')).toBeVisible();

        // Click the NAR attachment to add it
        const attachment = page.locator('[data-testid="network-attachment-acme-corp-net"]');
        await expect(attachment).toBeVisible();
        await attachment.click();

        // Verify the attachment was activated
        await expect(page.locator('text=✓ Network credentials used')).toBeVisible({ timeout: 2000 });

        // Open NAR to verify the network was registered
        await page.hover('text=☰');
        await page.click('text=Network Address Register');
        const narWindow = page.locator('.window:has-text("Network Address Register")');
        await expect(narWindow).toBeVisible();

        // Verify network entry exists with correct data
        await expect(narWindow.locator('text=ACME Corporate Network')).toBeVisible();
        await expect(narWindow.locator('text=192.168.50.0/24')).toBeVisible();

        // Establish connection to the network programmatically (can't be in save data)
        await page.evaluate(() => {
            window.gameContext.setActiveConnections([{
                networkId: 'acme-corp-net',
                networkName: 'ACME Corporate Network',
                connectedAt: new Date().toISOString(),
            }]);
        });

        // Open File Manager to verify server is connectable
        await page.hover('text=☰');
        await page.click('text=File Manager');
        const fileManagerWindow = page.locator('.window:has-text("File Manager")');
        await expect(fileManagerWindow).toBeVisible();

        // The archive server should be available in the filesystem dropdown
        // Find the select dropdown and verify the option exists
        const fileSystemDropdown = fileManagerWindow.locator('select');
        await expect(fileSystemDropdown).toBeVisible();

        // Select the archive server to verify it's accessible
        await fileSystemDropdown.selectOption('fs-archive-1');

        // After selecting, the dropdown should show this value is selected
        await expect(fileSystemDropdown).toHaveValue('fs-archive-1');
    });
});

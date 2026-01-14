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
});

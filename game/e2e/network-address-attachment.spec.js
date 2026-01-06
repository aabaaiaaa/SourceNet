import { test, expect } from '@playwright/test';

test.describe('E2E: Network Address Attachment Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Start with a fresh state
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
    });

    test('should install NAR software then activate network address attachment', async ({ page }) => {
        // ========================================
        // SETUP: Create test save with network address message
        // ========================================

        await page.goto('/?skipBoot=true');

        // Create a save state with a message containing network address attachment
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
                    // NAR NOT installed yet
                ],
                bankAccounts: [
                    {
                        id: 'acc-1',
                        bankName: 'First Bank Ltd',
                        accountNumber: 'FB-001',
                        balance: 2000, // Enough to buy NAR
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

        // Wait for login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

        // Load the save
        await page.click('button:has-text("Load")');

        // Wait for desktop
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Verify credits (2000)
        await expect(page.locator('.topbar-credits:has-text("2000")')).toBeVisible();

        // ========================================
        // STEP 2: Open Mail and verify network attachment shows install requirement
        // ========================================

        await page.hover('text=☰');
        await page.click('text=SNet Mail');

        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        await expect(mailWindow).toBeVisible();

        // Click on the VPN message
        await page.click('.message-item:has-text("VPN Access Credentials")');

        // Verify message is displayed
        await expect(page.locator('text=You have been granted access')).toBeVisible();

        // Verify network attachment shows install requirement message
        await expect(page.locator('text=Network Credentials: Corporate VPN Network')).toBeVisible();
        await expect(page.locator('text=Install Network Address Register to use this attachment')).toBeVisible();

        // Verify the attachment is disabled (has disabled class)
        const attachment = page.locator('[data-testid="network-attachment-corporate-vpn-1"]');
        await expect(attachment).toHaveClass(/disabled/);

        // Try clicking it - should do nothing
        await attachment.click();

        // Should still show install requirement (not changed to "Added to NAR")
        await expect(page.locator('text=Install Network Address Register to use this attachment')).toBeVisible();
        await expect(page.locator('text=✓ Added to NAR')).not.toBeVisible();

        // ========================================
        // STEP 3: Open Portal and purchase NAR
        // ========================================

        await page.hover('text=☰');
        await page.click('text=OSNet Portal');

        const portalWindow = page.locator('.window:has-text("OSNet Portal")');
        await expect(portalWindow).toBeVisible();

        // Navigate to Software tab (should be default)
        await page.click('button:has-text("Software")');

        // Wait for software list to load
        await page.waitForTimeout(1000);

        // Look for Network Address Register in the portal
        await expect(portalWindow.locator('text=Network Address Register')).toBeVisible({ timeout: 5000 });

        // Click the Purchase button for NAR
        // The purchase button should be within the same item container as the NAR name
        await portalWindow.locator('text=Network Address Register').locator('..').locator('..').locator('button:has-text("Purchase")').click();

        // Handle purchase confirmation modal if it appears
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
        }

        // Wait for download and installation to complete
        // Installation takes time based on bandwidth and file size
        // NAR is 15MB at 50 Mbps = ~2.5 seconds download + installation time
        await page.waitForTimeout(5000);

        // Close any modal overlays that might be open (installation queue, etc.)
        const modalOverlay = page.locator('.modal-overlay');
        if (await modalOverlay.isVisible().catch(() => false)) {
            await modalOverlay.click();
        }

        // ========================================
        // STEP 4: Go back to Mail and verify attachment is now usable
        // ========================================

        // Click on mail window to bring it to front
        await mailWindow.locator('.window-header').click();

        // Verify the message is still selected (or re-select it)
        if (!(await page.locator('text=You have been granted access').isVisible())) {
            await page.click('.message-item:has-text("VPN Access Credentials")');
        }

        // Verify network attachment now shows "Click to add" instead of "Install NAR"
        await expect(page.locator('text=Click to add to Network Address Register')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('text=Install Network Address Register to use this attachment')).not.toBeVisible();

        // Verify attachment is no longer disabled
        const attachmentAfter = page.locator('[data-testid="network-attachment-corporate-vpn-1"]');
        await expect(attachmentAfter).not.toHaveClass(/disabled/);

        // ========================================
        // STEP 5: Click attachment to add to NAR
        // ========================================

        await attachmentAfter.click();

        // Verify status changed to "Added to NAR"
        await expect(page.locator('text=✓ Added to NAR')).toBeVisible({ timeout: 2000 });

        // Verify "Click to add" message is gone
        await expect(page.locator('text=Click to add to Network Address Register')).not.toBeVisible();

        // Verify attachment has activated class
        await expect(attachmentAfter).toHaveClass(/activated/);

        // ========================================
        // STEP 6: Verify clicking again doesn't duplicate
        // ========================================

        // Click the attachment again
        await attachmentAfter.click();

        // Should still show "Added to NAR" (no change)
        await expect(page.locator('text=✓ Added to NAR')).toBeVisible();

        // ========================================
        // STEP 7: Save and reload to verify NAR entry persists
        // ========================================

        // Open power menu and save
        page.once('dialog', (dialog) => dialog.accept('nar_test_save'));
        await page.hover('text=⏻');
        await page.click('text=Save');
        await page.waitForTimeout(1000);

        // Reload page
        await page.reload();

        // Wait for login screen
        await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 5000 });

        // Load the save
        await page.click('button:has-text("Load")');

        // Wait for desktop
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Open mail
        await page.hover('text=☰');
        await page.click('text=SNet Mail');
        await expect(mailWindow).toBeVisible();

        // Open the VPN message
        await page.click('.message-item:has-text("VPN Access Credentials")');

        // Verify NAR entry persisted - should show "Added to NAR"
        await expect(page.locator('text=✓ Added to NAR')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('text=Click to add to Network Address Register')).not.toBeVisible();
    });
});

import { test, expect } from '@playwright/test';

/**
 * Tutorial & Mission System E2E Tests
 * 
 * This test suite covers the complete tutorial mission flow and mission system:
 * - Tutorial missions (including File Manager operations)
 * - Mission Board software purchase and installation
 * - Mission acceptance and completion workflow
 * - Network operations (Scanner, NAR, VPN, connections)
 * - Software download and installation system
 */

test.describe('E2E: Tutorial Mission Flow', () => {
    test('should complete 2-part tutorial missions with all objectives', async ({ page }) => {
        test.setTimeout(120000);

        // Capture console logs
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        // Helper to set game speed
        const setSpeed = async (speed) => {
            await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
        };

        // ========================================
        // STEP 1: Initial Setup & Welcome Messages
        // ========================================
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('tutorial_test');
        await page.click('button:has-text("Continue")');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        // Set 100x speed for story delays
        await setSpeed(100);
        await page.waitForTimeout(100); // Wait for HR welcome message (2s game time)

        // Open Mail and read welcome messages
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        await page.click('.message-item:has-text("Welcome to SourceNet!")');
        await expect(page.locator('.message-view')).toBeVisible();
        // Verify message has body content
        const hrMessageBody = await page.locator('.message-body').textContent();
        expect(hrMessageBody.length).toBeGreaterThan(50);
        await page.click('button:has-text("Back")');

        await page.waitForTimeout(100); // Wait for manager message (2s game time)

        // Read manager message and deposit cheque
        await page.click('.message-item:has-text("Hi from your manager")');
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body')).toBeVisible();
        // Verify message has body content and correct sender
        const managerMessageBody = await page.locator('.message-body').textContent();
        expect(managerMessageBody.length).toBeGreaterThan(50);
        await expect(page.locator('.detail-row:has-text("From:") >> text=SourceNet Manager')).toBeVisible();

        await page.click('.attachment-item');
        await page.click('.account-select-btn:has-text("First Bank Ltd")');
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 2: Mission Board License
        // ========================================
        await page.waitForTimeout(300); // 20s game time at 100x

        await setSpeed(1);

        // Close Banking window if open
        const bankingWindow = page.locator('.window:has-text("SNet Banking")');
        if (await bankingWindow.isVisible()) {
            await bankingWindow.locator('.window-controls button:has-text("×")').click();
            await page.waitForTimeout(100);
        }

        // Ensure we're in Mail inbox
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        if (await mailWindow.isVisible()) {
            await page.click('.window:has-text("SNet Mail") .window-header');
            await page.waitForTimeout(100);
            const backButton = page.locator('button:has-text("Back to inbox")');
            if (await backButton.isVisible()) {
                await backButton.click();
                await page.waitForTimeout(200);
            }
        } else {
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
        }

        // Read Mission Board license message
        const missionBoardMessage = page.locator('.message-item:has-text("Get Ready")').or(page.locator('.message-item:has-text("First Mission")'));
        await expect(missionBoardMessage.first()).toBeVisible({ timeout: 10000 });
        await missionBoardMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("Mission Board")')).toBeVisible();
        // Verify message has body content
        const missionBoardMsgBody = await page.locator('.message-body').textContent();
        expect(missionBoardMsgBody.length).toBeGreaterThan(50);

        // Activate license
        const licenseBadge = page.locator('.attachment-item:has-text("Software License")').or(page.locator('.attachment-item:has-text("Mission Board")'));
        await licenseBadge.click();
        await expect(page.locator('text=Activated').or(page.locator('text=✓'))).toBeVisible({ timeout: 2000 });

        // ========================================
        // STEP 3: Install Mission Board
        // ========================================
        await page.click('button:has-text("Back")');
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(100);
        await page.click('text=OSNet Portal');
        await expect(page.locator('.window:has-text("OSNet Portal")').or(page.locator('.window:has-text("Portal")'))).toBeVisible();

        await page.click('button:has-text("Software")');
        await page.waitForTimeout(100);

        await expect(page.locator('text=SourceNet Mission Board').or(page.locator('text=Mission Board'))).toBeVisible();
        await page.locator('button:has-text("Install")').first().click();

        // Speed up for installation
        await setSpeed(100);
        await page.waitForTimeout(500);
        await setSpeed(1);

        // Verify Mission Board installed
        await page.click('text=☰');
        await expect(page.locator('.app-launcher-menu >> text=Mission Board')).toBeVisible();

        // ========================================
        // STEP 4: Verify Mission in Mission Board
        // ========================================
        await page.waitForTimeout(500);

        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        const availableTab = page.locator('button:has-text("Available")');
        if (await availableTab.count() > 0) {
            await availableTab.click();
        }

        await page.waitForTimeout(1000);

        const missionCard = page.locator('.mission-card:has-text("Log File Repair")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 5: Verify Missing Requirements
        // ========================================
        const missingIndicators = missionCard.locator('.requirement-missing');
        const missingCount = await missingIndicators.count();
        expect(missingCount).toBeGreaterThan(0);

        const acceptButton = missionCard.locator('.accept-mission-btn');
        await expect(acceptButton).toBeVisible();
        await expect(acceptButton).toBeDisabled();

        // ========================================
        // STEP 6: Get Software Licenses
        // ========================================
        await setSpeed(100);
        await page.waitForTimeout(100); // 5s game time
        await setSpeed(1);

        await page.click('text=☰');
        await page.click('text=SNet Mail');

        const backButton = page.locator('button:has-text("Back")');
        if (await backButton.isVisible()) {
            await backButton.click();
            await page.waitForTimeout(100);
        }

        const softwareMsg = page.locator('.message-item:has-text("Mission Software")').first();
        await expect(softwareMsg).toBeVisible({ timeout: 3000 });
        await softwareMsg.click();
        await expect(page.locator('text=VPN Client').or(page.locator('text=software')).first()).toBeVisible();
        // Verify message has body content
        const softwareMsgBody = await page.locator('.message-body').textContent();
        expect(softwareMsgBody.length).toBeGreaterThan(50);

        // Activate software licenses
        const licenseAttachments = page.locator('.attachment-item:has-text("Software License")');
        const licenseCount = await licenseAttachments.count();
        for (let i = 0; i < licenseCount; i++) {
            await licenseAttachments.nth(i).click();
            await page.waitForTimeout(100);
        }

        // ========================================
        // STEP 7: Install Required Software
        // ========================================
        const mailWindowAfterLicenses = page.locator('.window:has(.window-header:has-text("Mail"))');
        await mailWindowAfterLicenses.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        const portalMenuItem = page.locator('.app-launcher-menu >> text=OSNet Portal');
        await expect(portalMenuItem).toBeVisible({ timeout: 5000 });
        await portalMenuItem.click();
        await expect(page.locator('.window:has-text("OSNet Portal")').or(page.locator('.window:has-text("Portal")')).first()).toBeVisible();

        await page.click('button:has-text("Software")');
        await page.waitForTimeout(100);

        const softwareToInstall = ['VPN Client', 'Network Scanner', 'File Manager', 'Network Address Register'];
        for (const software of softwareToInstall) {
            const installButton = page.locator(`.portal-item:has-text("${software}") button:has-text("Install")`).first();
            if (await installButton.count() > 0) {
                await expect(installButton).toBeEnabled({ timeout: 2000 }).catch(() => { });
                await installButton.click({ timeout: 5000 });
            }
        }

        await page.waitForTimeout(500);
        await setSpeed(100);
        await page.waitForTimeout(200);
        await page.waitForTimeout(2000); // Downloads
        await setSpeed(1);

        // ========================================
        // STEP 8: Accept Mission
        // ========================================
        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))')).toBeVisible();

        const missionCardToAccept = page.locator('.mission-card:has-text("Log File Repair")');
        await expect(missionCardToAccept).toBeVisible();

        const acceptBtn = missionCardToAccept.locator('.accept-mission-btn');
        await expect(acceptBtn).toBeEnabled({ timeout: 2000 });
        await acceptBtn.click();

        // ========================================
        // STEP 8.5: Receive Network Credentials
        // ========================================
        await setSpeed(100);
        await page.waitForTimeout(100); // 3s game time
        await setSpeed(1);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        const backToInboxBtn = page.locator('button:has-text("Back")');
        if (await backToInboxBtn.isVisible()) {
            await backToInboxBtn.click();
            await page.waitForTimeout(100);
        }

        const credentialsMsg = page.locator('.message-item:has-text("ClientA")').or(
            page.locator('.message-item:has-text("Network Credentials")')
        );
        await expect(credentialsMsg.first()).toBeVisible({ timeout: 3000 });
        await credentialsMsg.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        // Verify message has body content
        const credentialsMsgBody = await page.locator('.message-body').textContent();
        expect(credentialsMsgBody.length).toBeGreaterThan(50);

        const networkAttachment = page.locator('[data-testid^="network-attachment-"]').first();
        await expect(networkAttachment).toBeVisible({ timeout: 2000 });
        await expect(page.locator('text=Click to add to Network Address Register')).toBeVisible({ timeout: 2000 });

        await networkAttachment.click();
        await page.waitForTimeout(200);
        await expect(page.locator('text=✓ Network credentials used')).toBeVisible({ timeout: 2000 });

        // Close Mail
        const mailWindow2 = page.locator('.window:has(.window-header:has-text("Mail"))');
        await mailWindow2.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // ========================================
        // STEP 9: Verify Objectives Displayed (including new NAR objective)
        // ========================================
        const activeTab = page.locator('.tab:has-text("Active")');
        await expect(activeTab).toBeVisible();
        await activeTab.click();

        const activeMissionCard = page.locator('.mission-card:has-text("Log File Repair")').or(page.locator('h3:has-text("Log File Repair")')).first();
        await expect(activeMissionCard).toBeVisible();

        // Verify NAR objective is visible AND already complete (was completed when we clicked attachment)
        const narObjective = page.locator('.objective-item:has-text("Add ClientA-Corporate credentials to NAR")').first();
        await expect(narObjective).toBeVisible();
        // Just check for the complete class on the objective item
        await expect(narObjective).toHaveClass(/objective-complete/, { timeout: 3000 });

        await expect(page.locator('text=Connect to ClientA-Corporate network').first()).toBeVisible();
        await expect(page.locator('text=Scan network to find fileserver-01').first()).toBeVisible();
        await expect(page.locator('text=Connect to fileserver-01 file system').first()).toBeVisible();
        await expect(page.locator('text=Repair all corrupted files').first()).toBeVisible();

        // ========================================
        // STEP 10: Complete Objective 1 - Connect to Network
        // ========================================
        const missionBoardWindowAfterScanner = page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))');
        await missionBoardWindowAfterScanner.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);

        const vpnMenuItem = page.locator('.app-launcher-menu >> text=VPN Client').or(
            page.locator('.app-launcher-menu >> text=SourceNet VPN')
        );
        await expect(vpnMenuItem).toBeVisible();
        await vpnMenuItem.click();

        const vpnWindow = page.locator('.window').filter({ hasText: 'SourceNet VPN Client' }).filter({ hasText: 'Secure Network Access' });
        await expect(vpnWindow).toBeVisible();

        const hasEmptyState = await vpnWindow.locator('text=No network credentials available').count() > 0;
        if (hasEmptyState) {
            throw new Error('No network credentials found in NAR.');
        }

        const networkDropdown = vpnWindow.locator('.network-dropdown');
        await expect(networkDropdown).toBeVisible();
        await networkDropdown.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        const connectBtn = page.locator('button:has-text("Connect")');
        await expect(connectBtn).toBeEnabled();
        await connectBtn.click();

        await expect(page.locator('text=Connecting').first()).toBeVisible({ timeout: 2000 });
        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });

        await expect(page.locator('text=Connected').first()).toBeVisible();
        await expect(page.locator('text=ClientA-Corporate').first()).toBeVisible();

        // Verify objective complete
        const vpnWindowAfterConnect = page.locator('.window:has(.window-header:has-text("VPN Client"))');
        await vpnWindowAfterConnect.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Active")').click();

        const objectiveContainer = page.locator('.objective-item:has-text("Connect to ClientA-Corporate")').first();
        await expect(objectiveContainer.locator('.objective-complete').or(
            objectiveContainer.locator('text=✓')
        ).or(
            objectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        // ========================================
        // STEP 11: Complete Objective 2 - Scan Network
        // ========================================
        const missionBoardWindow2 = page.locator('.window:has(.window-header:has-text("Mission Board"))');
        await missionBoardWindow2.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);

        const scannerMenuItem = page.locator('.app-launcher-menu >> text=Network Scanner').or(
            page.locator('.app-launcher-menu >> text=Scanner')
        );
        await expect(scannerMenuItem).toBeVisible();
        await scannerMenuItem.click();

        const scannerWindow = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await expect(scannerWindow).toBeVisible();
        await page.waitForTimeout(200);

        const scannerNetworkDropdown = scannerWindow.locator('label:has-text("Network:") select');
        await scannerNetworkDropdown.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        const scanButton = scannerWindow.locator('button:has-text("Scan")').or(
            scannerWindow.locator('button:has-text("Start Scan")')
        );
        await expect(scanButton).toBeEnabled({ timeout: 2000 });
        await scanButton.click();

        await setSpeed(100);
        await expect(scannerWindow.locator('text=Scanning').or(
            scannerWindow.locator('text=Scan in progress')
        ).first()).toBeVisible({ timeout: 2000 });

        // Wait for scan to complete (uses game time, so completes quickly at 100x)
        await expect(scannerWindow.locator('text=fileserver-01').first()).toBeVisible({ timeout: 2000 });
        await setSpeed(1);

        // Verify objective complete
        const scannerWindow2 = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await scannerWindow2.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.locator('.app-launcher-menu >> text=Mission Board').click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Active")').click();

        const secondObjectiveContainer = page.locator('.objective-item:has-text("Scan network")').first();
        await expect(secondObjectiveContainer.locator('.objective-complete').or(
            secondObjectiveContainer.locator('text=✓')
        ).or(
            secondObjectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        // ========================================
        // STEP 12: Complete Objective 3 - Connect to File System
        // ========================================
        const missionBoardWindow = page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))');
        await missionBoardWindow.locator('.window-close-btn, .close-btn, button:has-text("×")').first().click();
        await expect(missionBoardWindow).not.toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100);

        await page.locator('text=☰').click();
        await page.waitForTimeout(200);
        const fileManagerMenuItem = page.locator('.app-launcher-menu >> text=File Manager');
        await expect(fileManagerMenuItem).toBeVisible();
        await fileManagerMenuItem.click();
        await page.waitForTimeout(200);

        const fileManagerWindow = page.locator('.window:has(.window-header:has-text("File Manager"))');
        await expect(fileManagerWindow).toBeVisible();

        const fileSystemDropdown = fileManagerWindow.locator('select');
        await fileSystemDropdown.selectOption('fs-clienta-01');
        await page.waitForTimeout(200);

        await expect(fileManagerWindow.locator('text=log_2024').first()).toBeVisible({ timeout: 3000 });

        // Verify objective complete
        const fileManagerWindowAfterConnect = page.locator('.window:has(.window-header:has-text("File Manager"))');
        await fileManagerWindowAfterConnect.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.locator('.app-launcher-menu >> text=Mission Board').click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Active")').click();

        const thirdObjectiveContainer = page.locator('.objective-item:has-text("Connect to fileserver-01")').first();
        await expect(thirdObjectiveContainer.locator('.objective-complete').or(
            thirdObjectiveContainer.locator('text=✓')
        ).or(
            thirdObjectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        // ========================================
        // STEP 13: Complete Objective 4 - Repair Files
        // ========================================
        const missionBoardWindowStep15 = page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))');
        await missionBoardWindowStep15.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.locator('.app-launcher-menu >> text=File Manager').click();

        const fileManagerWindowStep15 = page.locator('.window:has(.window-header:has-text("File Manager"))').first();
        await expect(fileManagerWindowStep15).toBeVisible();

        await fileManagerWindowStep15.locator('select').first().selectOption('fs-clienta-01');
        await page.waitForTimeout(300);

        const corruptedFiles = await fileManagerWindowStep15.locator('.file-corrupted').count();
        expect(corruptedFiles).toBe(8);

        const fileItems = fileManagerWindowStep15.locator('.file-corrupted');
        for (let i = 0; i < 8; i++) {
            await fileItems.nth(i).click();
            await page.waitForTimeout(50);
        }

        const repairButton = fileManagerWindowStep15.locator('button:has-text("Repair (8)")');
        await expect(repairButton).toBeEnabled();

        // Use 10x speed for repair to ensure objective completion triggers properly
        await setSpeed(10);
        await repairButton.click();

        // Perform these actions below because it seems that sometimes the sabotage triggering doesn't trigger without some interaction
        await page.waitForTimeout(1000);
        await setSpeed(1);
        await page.click('text=☰');
        await setSpeed(10);

        // Wait for forced disconnection overlay - it will appear after sabotage completes
        const forcedDisconnectOverlay = page.locator('.forced-disconnect-overlay');
        await expect(forcedDisconnectOverlay).toBeVisible({ timeout: 30000 });
        await page.locator('.acknowledge-btn').click();
        await expect(forcedDisconnectOverlay).not.toBeVisible({ timeout: 2000 });

        // Now safe to set back to 1x and continue test
        await setSpeed(1);

        // ========================================
        // STEP 14: Verify Repair Complete
        // ========================================
        await fileManagerWindowStep15.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        const portalWindow = page.locator('.window:has(.window-header:has-text("OSNet Portal"))');
        if (await portalWindow.isVisible()) {
            await portalWindow.locator('.window-controls button:has-text("×")').click();
            await page.waitForTimeout(100);
        }

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        const missionStillActive = await page.evaluate(() => {
            return window.gameContext?.activeMission?.missionId === 'tutorial-part-1';
        });

        if (missionStillActive) {
            await page.locator('.tab:has-text("Active")').click();
            await page.waitForTimeout(300);

            const fourthObjectiveContainer = page.locator('.objective-item:has-text("Repair all corrupted")').first();
            await expect(fourthObjectiveContainer.locator('.objective-complete').or(
                fourthObjectiveContainer.locator('text=✓')
            ).or(
                fourthObjectiveContainer.locator('.checkmark')
            )).toBeVisible({ timeout: 3000 });
        }

        // ========================================
        // STEP 15: Verify Sabotage Consequences
        // ========================================
        // Sabotage has already been dismissed in STEP 13 after clicking Repair
        // Now just verify the consequences: VPN disconnected and mission failed

        await page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // Verify VPN disconnected
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const vpnMenuItem2 = page.locator('.app-launcher-menu >> text=VPN Client').or(
            page.locator('.app-launcher-menu >> text=SourceNet VPN')
        );
        await vpnMenuItem2.click();

        const vpnWindow2 = page.locator('.window').filter({ hasText: 'SourceNet VPN Client' });
        await expect(vpnWindow2).toBeVisible();

        await expect(page.locator('text=No active connections').or(
            page.locator('text=Disconnected')
        ).first()).toBeVisible({ timeout: 2000 });

        // ========================================
        // STEP 16: Verify Mission Failure
        // ========================================
        await vpnWindow2.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Failed")').click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=Log File Repair').first()).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Files deleted instead of repaired').or(
            page.locator('text=deleted')
        ).first()).toBeVisible();

        await expect(page.locator('.topbar-credits:has-text("-9")').or(
            page.locator('.topbar-credits:has-text("9,000")')
        ).first()).toBeVisible({ timeout: 3000 });

        await expect(page.locator('text=Tier 3').or(
            page.locator('text=Accident Prone')
        ).first()).toBeVisible({ timeout: 3000 });

        // ========================================
        // STEP 17: Read Failure Messages
        // ========================================
        await page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await setSpeed(100);
        await page.waitForTimeout(150); // 10s game time for angry manager message
        await setSpeed(1);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        const backBtn = page.locator('button:has-text("Back")');
        if (await backBtn.isVisible()) {
            await backBtn.click();
            await page.waitForTimeout(100);
        }

        // Read angry manager message
        const angryMessage = page.locator('.message-item:has-text("What happened")').or(
            page.locator('.message-item:has-text("happened?!")').or(
                page.locator('.message-item:has-text("What")').filter({ hasText: 'happened' })
            )
        );
        await expect(angryMessage.first()).toBeVisible({ timeout: 3000 });
        await angryMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        // Verify message has body content and correct sender (SourceNet Manager like other manager messages)
        const angryMsgBody = await page.locator('.message-body').textContent();
        expect(angryMsgBody.length).toBeGreaterThan(100); // Should have substantial content
        await expect(page.locator('.detail-row:has-text("From:") >> text=SourceNet Manager')).toBeVisible();

        // ========================================
        // STEP 18: Trigger Part 2
        // ========================================
        await page.click('button:has-text("Back")');
        await page.waitForTimeout(100);

        await setSpeed(100);
        await page.waitForTimeout(350); // 30s game time for "simpler" message
        await setSpeed(1);

        const simplerMessage = page.locator('.message-item:has-text("simpler")').or(
            page.locator('.message-item:has-text("try something")').or(
                page.locator('.message-item:has-text("another mission")')
            )
        );
        await expect(simplerMessage.first()).toBeVisible({ timeout: 3000 });
        await simplerMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('text=Mission Board').or(page.locator('text=mission')).first()).toBeVisible();
        // Verify message has body content
        const simplerMsgBody = await page.locator('.message-body').textContent();
        expect(simplerMsgBody.length).toBeGreaterThan(50);

        // ========================================
        // STEP 19: Accept Tutorial Part 2
        // ========================================
        await page.locator('.window:has(.window-header:has-text("Mail"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        await expect(page.locator('.tab:has-text("Active Mission●")')).not.toBeVisible({ timeout: 5000 });

        const part2Mission = page.locator('.mission-card:has-text("Log File Restoration")');
        await expect(part2Mission).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(200);

        const acceptBtn2 = part2Mission.locator('button').first();
        await expect(acceptBtn2).toBeEnabled({ timeout: 5000 });
        await acceptBtn2.click();

        // ========================================
        // STEP 20: Activate New Network Credentials
        // ========================================
        await setSpeed(100);
        await page.waitForTimeout(100); // 3s game time
        await setSpeed(1);

        await page.waitForTimeout(500);

        // Verify old NAR entry was revoked via NetworkRegistry
        const revokedStatus = await page.evaluate(() => {
            const registry = window.gameContext?.networkRegistry;
            const network = registry?.getNetwork('clienta-corporate');
            return {
                exists: !!network,
                authorized: network?.accessible === true,
                revoked: network?.accessible === false
            };
        });
        expect(revokedStatus.revoked).toBe(true);

        await page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(200);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mail');
        await page.waitForTimeout(500);

        const mailWindow3 = page.locator('.window').filter({ hasText: 'Mail' });
        await expect(mailWindow3).toBeVisible({ timeout: 3000 });

        await page.waitForTimeout(500);

        const networkMsg = page.locator('.message-item').filter({ hasText: /Updated.*Access|Backup.*Server/i }).first();
        await expect(networkMsg).toBeVisible({ timeout: 5000 });
        await networkMsg.click();
        await page.waitForTimeout(500);

        await expect(page.locator('.message-view')).toBeVisible();
        // Verify message has body content
        const networkUpdateMsgBody = await page.locator('.message-body').textContent();
        expect(networkUpdateMsgBody.length).toBeGreaterThan(50);
        await page.waitForTimeout(500);

        const networkAttachment3 = page.locator('.attachment-item').filter({ hasText: /network|ClientA|Credentials/i }).first();
        await expect(networkAttachment3).toBeVisible({ timeout: 3000 });
        await networkAttachment3.click();
        await page.waitForTimeout(500);

        // Verify new NAR entry is authorized via NetworkRegistry
        const newNarStatus = await page.evaluate(() => {
            const registry = window.gameContext?.networkRegistry;
            const network = registry?.getNetwork('clienta-corporate');
            const fileSystems = registry?.getNetworkFileSystems('clienta-corporate') || [];
            return {
                exists: !!network,
                authorized: network?.accessible === true,
                fileSystemCount: fileSystems.length
            };
        });
        expect(newNarStatus.exists).toBe(true);
        expect(newNarStatus.authorized).toBe(true);
        expect(newNarStatus.fileSystemCount).toBeGreaterThan(0);

        await mailWindow3.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(200);

        // Verify objectives
        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Active")').click();

        await expect(page.locator('text=Reconnect to ClientA-Corporate').first()).toBeVisible();
        await expect(page.locator('text=Scan network').or(page.locator('text=backup-server')).first()).toBeVisible();
        await expect(page.locator('text=Connect').and(page.locator('text=backup')).first()).toBeVisible();
        await expect(page.locator('text=Connect').and(page.locator('text=fileserver')).first()).toBeVisible();
        await expect(page.locator('text=Copy all files').or(page.locator('text=Copy')).first()).toBeVisible();

        // ========================================
        // STEP 21: Complete Part 2 Objectives 1-2
        // ========================================
        await page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // Reconnect VPN
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const vpnMenuItem3 = page.locator('.app-launcher-menu >> text=VPN Client').or(
            page.locator('.app-launcher-menu >> text=SourceNet VPN')
        );
        await vpnMenuItem3.click();

        const vpnWindow3 = page.locator('.window').filter({ hasText: 'SourceNet VPN Client' });
        await expect(vpnWindow3).toBeVisible();

        const networkDropdown2 = vpnWindow3.locator('.network-dropdown');
        await networkDropdown2.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        const connectBtn2 = page.locator('button:has-text("Connect")');
        await expect(connectBtn2).toBeEnabled();
        await connectBtn2.click();

        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible({ timeout: 5000 });

        await expect(page.locator('text=Connected').first()).toBeVisible();

        await vpnWindow3.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // Deep scan
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const scannerMenuItem2 = page.locator('.app-launcher-menu >> text=Network Scanner').or(
            page.locator('.app-launcher-menu >> text=Scanner')
        );
        await scannerMenuItem2.click();

        const scannerWindow3 = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await expect(scannerWindow3).toBeVisible();

        const scannerNetworkDropdown2 = scannerWindow3.locator('label:has-text("Network:") select');
        await scannerNetworkDropdown2.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        const scanTypeDropdown = scannerWindow3.locator('label:has-text("Scan Type:") select');
        await scanTypeDropdown.selectOption('deep');
        await page.waitForTimeout(100);

        const scanButton2 = scannerWindow3.locator('button:has-text("Scan")').or(
            scannerWindow3.locator('button:has-text("Start Scan")')
        );
        await expect(scanButton2).toBeEnabled();
        await scanButton2.click();

        await setSpeed(100);
        // Wait for scan to complete (uses game time, so completes quickly at 100x)
        await expect(scannerWindow3.locator('text=fileserver-01').first()).toBeVisible({ timeout: 2000 });
        await setSpeed(1);

        await expect(scannerWindow3.locator('text=backup-server').first()).toBeVisible({ timeout: 1000 });
        await expect(scannerWindow3.locator('text=192.168.50.10').first()).toBeVisible();
        await expect(scannerWindow3.locator('text=192.168.50.20').first()).toBeVisible();

        // ========================================
        // STEP 22: Complete Part 2 Objectives 3-4 (Multi-Window)
        // ========================================
        await scannerWindow3.locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        // Close existing File Manager windows
        const existingFileManagers = page.locator('.window:has(.window-header:has-text("File Manager"))');
        const existingCount = await existingFileManagers.count();
        for (let i = 0; i < existingCount; i++) {
            const closeBtn = existingFileManagers.first().locator('.window-controls button:has-text("×")');
            if (await closeBtn.isVisible().catch(() => false)) {
                await closeBtn.click();
                await page.waitForTimeout(100);
            }
        }

        // Open File Manager #1 (backup-server)
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const fileManagerMenuItem2 = page.locator('.app-launcher-menu >> text=File Manager');
        await fileManagerMenuItem2.click();
        await page.waitForTimeout(200);

        const fileManagerWindows = page.locator('.window:has(.window-header:has-text("File Manager"))');
        await expect(fileManagerWindows.first()).toBeVisible();

        const fm1 = fileManagerWindows.first();
        await fm1.locator('select').first().selectOption('fs-clienta-backup');
        await page.waitForTimeout(200);

        const fm1Files = await fm1.locator('.file-item').count();
        expect(fm1Files).toBe(8);

        // Open File Manager #2 (fileserver-01)
        await page.click('text=☰');
        await page.waitForTimeout(200);
        await fileManagerMenuItem2.click();
        await page.waitForTimeout(200);

        await expect(fileManagerWindows).toHaveCount(2);

        const fm2 = fileManagerWindows.nth(1);
        await fm2.locator('select').first().selectOption('fs-clienta-01');
        await page.waitForTimeout(200);

        // ========================================
        // STEP 23: Complete Part 2 Objective 5 (Copy/Paste)
        // ========================================
        // Select files in FM #1
        await page.evaluate(() => {
            const windows = document.querySelectorAll('.window');
            for (const win of windows) {
                const header = win.querySelector('.window-header');
                if (header && header.textContent.includes('File Manager')) {
                    const fileItems = win.querySelectorAll('.file-item');
                    fileItems.forEach(item => item.click());
                    break;
                }
            }
        });
        await page.waitForTimeout(200);

        // Copy files
        await page.evaluate(() => {
            const windows = document.querySelectorAll('.window');
            for (const win of windows) {
                const header = win.querySelector('.window-header');
                if (header && header.textContent.includes('File Manager')) {
                    const buttons = win.querySelectorAll('.fm-toolbar button');
                    for (const btn of buttons) {
                        if (btn.textContent.includes('Copy') && btn.textContent.includes('8')) {
                            btn.click();
                            return;
                        }
                    }
                    break;
                }
            }
        });
        await page.waitForTimeout(300);

        // Verify clipboard
        const clipboardVisible = await page.evaluate(() => {
            const windows = document.querySelectorAll('.window');
            for (const win of windows) {
                const header = win.querySelector('.window-header');
                if (header && header.textContent.includes('File Manager')) {
                    const clipboard = win.querySelector('.clipboard-panel');
                    if (clipboard) {
                        return clipboard.textContent.includes('8 files') || clipboard.textContent.includes('(8)');
                    }
                }
            }
            return false;
        });
        expect(clipboardVisible).toBe(true);

        // Paste in FM #2
        await page.evaluate(() => {
            const windows = document.querySelectorAll('.window');
            let count = 0;
            for (const win of windows) {
                const header = win.querySelector('.window-header');
                if (header && header.textContent.includes('File Manager')) {
                    count++;
                    if (count === 2) {
                        const buttons = win.querySelectorAll('.fm-toolbar button');
                        for (const btn of buttons) {
                            if (btn.textContent.includes('Paste') && btn.textContent.includes('8')) {
                                btn.click();
                                return;
                            }
                        }
                    }
                }
            }
        });

        await setSpeed(100);
        await page.waitForTimeout(1500); // File transfer
        await setSpeed(1);

        const fm2FilesAfterPaste = await fm2.locator('.file-item').count();
        expect(fm2FilesAfterPaste).toBeGreaterThanOrEqual(8);

        // Wait for verification objective
        await page.waitForTimeout(200);

        await setSpeed(100);
        await page.waitForTimeout(200); // Verification delay (3s game time)
        await setSpeed(1);
        await page.waitForTimeout(100);

        // Verify mission completed
        const missionStatus = await page.evaluate(() => {
            return {
                activeMission: window.gameContext?.activeMission?.missionId,
                missionStatus: window.gameContext?.activeMission?.status,
                completedMissions: window.gameContext?.completedMissions?.map(m => m.missionId) || []
            };
        });

        expect(missionStatus.completedMissions).toContain('tutorial-part-2');
        expect(missionStatus.activeMission).not.toBe('tutorial-part-2');

        // ========================================
        // STEP 24: Verify Mission Success
        // ========================================
        // Minimize File Managers
        await page.evaluate(() => {
            const windows = document.querySelectorAll('.window');
            for (const win of windows) {
                const header = win.querySelector('.window-header');
                if (header && header.textContent.includes('File Manager')) {
                    const minimizeBtn = win.querySelector('.window-controls button');
                    if (minimizeBtn && minimizeBtn.textContent.includes('_')) {
                        minimizeBtn.click();
                    }
                }
            }
        });
        await page.waitForTimeout(200);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Completed")').click();

        await expect(page.locator('text=Log File Restoration').first()).toBeVisible({ timeout: 3000 });

        // Balance should still be -9000 because payment is now via cheque (not automatic)
        await expect(page.locator('.topbar-credits:has-text("-9")').or(
            page.locator('.topbar-credits:has-text("9,000")')
        ).first()).toBeVisible({ timeout: 3000 });

        // ========================================
        // STEP 25: Wait for Client Payment Message and Deposit Cheque
        // ========================================
        await page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await setSpeed(100);
        await page.waitForTimeout(100); // 5s game time for payment message (3s delay)
        await setSpeed(1);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        const backBtnPayment = page.locator('button:has-text("Back")');
        if (await backBtnPayment.isVisible()) {
            await backBtnPayment.click();
            await page.waitForTimeout(100);
        }

        // Check for client payment message
        const paymentMessage = page.locator('.message-item:has-text("Payment for Log File Restoration")');
        await expect(paymentMessage.first()).toBeVisible({ timeout: 5000 });
        await paymentMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();

        // Verify it's from the client and has a cheque
        await expect(page.locator('.detail-row:has-text("From:") >> text=TechCorp')).toBeVisible();
        const chequeAttachment = page.locator('.attachment-item:has-text("Cheque")').or(
            page.locator('.attachment-item:has-text("1,000")')
        );
        await expect(chequeAttachment.first()).toBeVisible();

        // Deposit the cheque
        await chequeAttachment.first().click();
        await page.click('.account-select-btn:has-text("First Bank Ltd")');

        // Verify balance is now -8000 after depositing cheque
        await expect(page.locator('.topbar-credits:has-text("-8")').or(
            page.locator('.topbar-credits:has-text("8,000")')
        ).first()).toBeVisible({ timeout: 5000 });

        // ========================================
        // STEP 26: Read Final Messages (Better + NAR Info)
        // ========================================
        // Speed up time for manager messages (5s and 15s delays)
        await setSpeed(100);
        await page.waitForTimeout(200); // 15s game time for both "Better" and "About Network Access" messages
        await setSpeed(1);

        // Close Banking window if open
        const bankingWindowAfterCheque = page.locator('.window:has-text("SNet Banking")');
        if (await bankingWindowAfterCheque.isVisible()) {
            await bankingWindowAfterCheque.locator('.window-controls button:has-text("×")').click();
            await page.waitForTimeout(100);
        }

        // Go back to inbox in mail
        const backBtnFinal = page.locator('button:has-text("Back")');
        if (await backBtnFinal.isVisible()) {
            await backBtnFinal.click();
            await page.waitForTimeout(100);
        }

        // Check for "Better" message
        const betterMessage = page.locator('.message-item:has-text("Better")').or(
            page.locator('.message-item:has-text("more like it")')
        );
        await expect(betterMessage.first()).toBeVisible({ timeout: 3000 });
        await betterMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        // Verify message has body content
        const betterMsgBody = await page.locator('.message-body').textContent();
        expect(betterMsgBody.length).toBeGreaterThan(50);

        await page.waitForTimeout(5000);

        // ========================================
        // STEP 26.5: Verify Procedural Missions Generated
        // ========================================
        // Reading the "Better" message triggers procedural mission generation
        // Close Mail and check Mission Board for generated missions
        await page.locator('.window:has(.window-header:has-text("Mail"))').locator('.window-controls button:has-text("×")').click({ force: true });
        await page.waitForTimeout(300);

        await page.click('text=☰');
        await page.waitForTimeout(500);
        const missionBoardMenuItem = page.locator('.app-launcher-menu >> text=Mission Board').or(
            page.locator('.app-launcher-menu >> text=SourceNet Mission Board')
        );
        await expect(missionBoardMenuItem).toBeVisible({ timeout: 5000 });
        await missionBoardMenuItem.click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Available")').click();
        await page.waitForTimeout(500);

        // Verify procedural missions were generated (should be at least 4)
        const proceduralMissionCards = page.locator('.mission-card');
        const missionCount = await proceduralMissionCards.count();
        expect(missionCount).toBeGreaterThanOrEqual(4);
        console.log(`✅ Procedural missions generated: ${missionCount} available`);

        // Verify mission card structure on first procedural mission
        const firstProceduralMission = proceduralMissionCards.first();
        await expect(firstProceduralMission.locator('h3')).toBeVisible();
        await expect(firstProceduralMission.locator('.difficulty-badge')).toBeVisible();
        await expect(firstProceduralMission.locator('.mission-client')).toBeVisible();
        await expect(firstProceduralMission.locator('.mission-payout')).toBeVisible();
        await expect(firstProceduralMission.locator('.mission-expiration')).toBeVisible();
        console.log('✅ Procedural mission cards have proper structure');

        // Close Mission Board and reopen Mail to continue with NAR info message check
        await page.locator('.window:has(.window-header:has-text("Mission Board"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Go back to inbox if needed
        const backBtnForNar = page.locator('button:has-text("Back")');
        if (await backBtnForNar.isVisible()) {
            await backBtnForNar.click();
            await page.waitForTimeout(100);
        }

        // Check for "About Network Access" NAR info message
        const narInfoMessage = page.locator('.message-item').filter({ hasText: 'About Network Access' });
        await expect(narInfoMessage.first()).toBeVisible({ timeout: 3000 });
        await narInfoMessage.first().click();
        await expect(page.locator('.message-view')).toBeVisible();
        // Verify NAR info message mentions revocation
        const narMsgBody = await page.locator('.message-body').textContent();
        expect(narMsgBody).toContain('revoked');
        expect(narMsgBody).toContain('Network Address Register');

        // ========================================
        // STEP 27: Final Validation
        // ========================================
        await page.locator('.window:has(.window-header:has-text("Mail"))').locator('.window-controls button:has-text("×")').click();
        await page.waitForTimeout(100);

        await expect(page.locator('.topbar-credits:has-text("-8")').or(
            page.locator('.topbar-credits:has-text("8,000")')
        ).first()).toBeVisible();

        await expect(page.locator('.topbar-reputation:has-text("Tier 3")').or(
            page.locator('.reputation-badge:has-text("Tier 3")')
        ).first()).toBeVisible();

        // Verify installed apps
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const appMenuItems = await page.locator('.app-launcher-menu button').count();
        expect(appMenuItems).toBeGreaterThanOrEqual(8);

        // Verify mission history
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        await page.locator('.tab:has-text("Failed")').click();
        const failedMissions = await page.locator('.mission-card').count();
        expect(failedMissions).toBe(1);

        await page.locator('.tab:has-text("Completed")').click();
        const completedMissions = await page.locator('.mission-card').count();
        expect(completedMissions).toBe(1);
    });
});


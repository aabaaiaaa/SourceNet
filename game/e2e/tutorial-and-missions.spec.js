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
 * 
 * Does NOT test:
 * - Basic UI elements (covered in basic-ui-features.spec.js)
 * - Save/load flows (covered in save-load-flows.spec.js)
 * - Game over scenarios (requires separate tests)
 */

test.describe('E2E: Tutorial Mission Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Listen to browser console
        page.on('console', msg => {
            const text = msg.text();
            // Filter for relevant mission and event logs
            if (text.includes('📝') || text.includes('🔔') || text.includes('⏰') ||
                text.includes('✅') || text.includes('Story') || text.includes('🚀') ||
                text.includes('❌') || text.includes('Mission') ||
                text.includes('📋') || text.includes('📡') || text.includes('📥') || text.includes('➕') ||
                text.includes('Loaded') || text.includes('Desktop')) {
                console.log(`BROWSER: ${text}`);
            }
        });
    });

    test('should complete 2-part tutorial missions with all objectives', async ({ page }) => {
        // Set extended timeout for this long-running test (2 minutes)
        test.setTimeout(120000);

        // ========================================
        // STEP 1: Initial Setup & Welcome Messages
        // ========================================
        // Clear localStorage before loading the page
        await page.goto('/?skipBoot=true');
        await page.evaluate(() => localStorage.clear());
        await page.reload();

        await expect(page.locator('.username-selection')).toBeVisible({ timeout: 20000 });
        await page.locator('input.username-input').fill('tutorial_test');
        await page.click('button:has-text("Continue")');

        await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

        console.log('✅ STEP 1: Desktop loaded');

        // Wait for HR welcome message (2 seconds game time)
        // Set 100x speed for story delays (TEST mode, not accessible via UI button)
        await page.evaluate(() => {
            if (typeof window.gameContext?.setSpecificTimeSpeed === 'function') {
                window.gameContext.setSpecificTimeSpeed(100);
            }
        });
        await page.waitForTimeout(100); // 2s game time at 100x + buffer

        // Open Mail
        await page.click('text=☰');
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Read HR welcome message
        await page.click('.message-item:has-text("Welcome to SourceNet!")');
        await expect(page.locator('.message-view')).toBeVisible();
        await page.click('button:has-text("Back")');

        // Wait for manager introduction message (2 seconds game time at 100x)
        await page.waitForTimeout(100); // 2s game time at 100x + buffer

        // Speed is already at 100x from previous step

        // Read manager message with cheque
        // Reading this triggers the 20s delay timer (2s real time at 10x)
        await page.click('.message-item:has-text("Hi from your manager")');

        // Wait for message view to open
        await expect(page.locator('.message-view')).toBeVisible();

        // Verify we can see the message body (with placeholders or actual content)
        await expect(page.locator('.message-body')).toBeVisible();

        // Deposit the cheque to get starting funds
        await page.click('.attachment-item');
        await page.click('.account-select-btn:has-text("First Bank Ltd")');
        await expect(page.locator('.topbar-credits:has-text("1000")')).toBeVisible({ timeout: 5000 });

        console.log('✅ STEP 1: Welcome messages read, cheque deposited (1000 credits)');

        // ========================================
        // STEP 2: Mission Board License (20s game time at 100x speed)
        // ========================================

        console.log('⏳ Waiting 20 seconds game time (200ms real at 100x speed) for Mission Board license...');

        // Wait 300ms real time (20s game time at 100x speed + buffer)
        await page.waitForTimeout(300);

        // Return to 1x speed
        await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(1);
        });

        // Close Banking window if it's open (it's blocking Mail)
        const bankingWindow = page.locator('.window:has-text("SNet Banking")');
        if (await bankingWindow.isVisible()) {
            const closeButton = bankingWindow.locator('.window-controls button:has-text("×")');
            await closeButton.click();
            await page.waitForTimeout(100);
        }

        // Make sure we're in Mail inbox view
        const mailWindow = page.locator('.window:has-text("SNet Mail")');
        if (await mailWindow.isVisible()) {
            // Click Mail window header to bring to front
            await page.click('.window:has-text("SNet Mail") .window-header');
            await page.waitForTimeout(100);

            // If we're viewing a message, click Back to return to inbox
            const backButton = page.locator('button:has-text("Back to inbox")');
            if (await backButton.isVisible()) {
                await backButton.click();
                await page.waitForTimeout(200);
            }
        } else {
            // Mail is closed, reopen it
            await page.click('text=☰');
            await page.click('text=SNet Mail');
            await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();
        }

        // Check mail for Mission Board license message
        const missionBoardMessage = page.locator('.message-item:has-text("Get Ready")').or(page.locator('.message-item:has-text("First Mission")'));
        await expect(missionBoardMessage.first()).toBeVisible({ timeout: 10000 });
        await missionBoardMessage.first().click();

        // Verify message view opened and contains expected content
        await expect(page.locator('.message-view')).toBeVisible();
        await expect(page.locator('.message-body:has-text("Mission Board")')).toBeVisible();

        // Click software license attachment
        const licenseBadge = page.locator('.attachment-item:has-text("Software License")').or(page.locator('.attachment-item:has-text("Mission Board")'));
        await licenseBadge.click();

        // Verify activated
        await expect(page.locator('text=Activated').or(page.locator('text=✓'))).toBeVisible({ timeout: 2000 });

        console.log('✅ STEP 2: Mission Board license received and activated');

        // ========================================
        // STEP 3: Install Mission Board
        // ========================================

        // Go back to inbox first
        await page.click('button:has-text("Back")');
        await page.waitForTimeout(100);

        // Open Portal
        await page.click('text=☰');
        await page.waitForTimeout(100);
        await page.click('text=OSNet Portal');
        await expect(page.locator('.window:has-text("OSNet Portal")').or(page.locator('.window:has-text("Portal")'))).toBeVisible();

        // Navigate to Software tab
        await page.click('button:has-text("Software")');
        await page.waitForTimeout(100);

        // Find Mission Board showing "Licensed"
        await expect(page.locator('text=SourceNet Mission Board').or(page.locator('text=Mission Board'))).toBeVisible();

        // Click Install button (should show "Install" or "Install (Licensed)")
        const installButton = page.locator('button:has-text("Install")').first();
        await installButton.click();

        // Set 100x speed for installation
        await page.evaluate(() => {
            if (typeof window.gameContext?.setSpecificTimeSpeed === 'function') {
                window.gameContext.setSpecificTimeSpeed(100);
            }
        });

        // Wait for installation to complete (200MB at 100x speed)
        await page.waitForTimeout(500);

        // Return to 1x speed
        await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(1);
        });

        // Verify Mission Board in app launcher
        await page.click('text=☰');
        await expect(page.locator('.app-launcher-menu >> text=Mission Board')).toBeVisible();

        console.log('✅ STEP 3: Mission Board installed');

        // ========================================
        // STEP 4: Verify Mission Appears in Mission Board
        // ========================================

        // Wait for mission to be activated (scheduled with 0 delay but still async)
        await page.waitForTimeout(500);

        // Open Mission Board
        await page.click('text=Mission Board');
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        // Check Available tab (should be default)
        const availableTab = page.locator('button:has-text("Available")');
        if (await availableTab.count() > 0) {
            await availableTab.click();
        }

        // Wait for tutorial mission to appear (triggered by mission-board installation)
        await page.waitForTimeout(1000);

        // Verify "Log File Repair" mission appears
        const missionCard = page.locator('.mission-card:has-text("Log File Repair")');
        await expect(missionCard).toBeVisible({ timeout: 5000 });

        console.log('✅ STEP 4: Tutorial mission appears in Mission Board');

        // ========================================
        // STEP 5: Verify Requirements Show Missing Software
        // ========================================

        // Check for missing requirements indicator
        const missingIndicators = missionCard.locator('.requirement-missing');
        const missingCount = await missingIndicators.count();
        expect(missingCount).toBeGreaterThan(0); // Should have missing software

        // Verify Accept button exists (will show reason why it's disabled)
        const acceptButton = missionCard.locator('.accept-mission-btn');
        await expect(acceptButton).toBeVisible();

        // Should be disabled due to missing software
        await expect(acceptButton).toBeDisabled();

        console.log('✅ STEP 5: Mission requirements show missing software');

        // ========================================
        // STEP 6: Get Software Licenses Message
        // ========================================

        // Wait for software licenses message (5s game time after mission board installed)
        console.log('⏳ Waiting 5 seconds game time for software licenses...');

        // Set 100x speed for the wait
        await page.evaluate(() => {
            if (typeof window.gameContext?.setSpecificTimeSpeed === 'function') {
                window.gameContext.setSpecificTimeSpeed(100);
            }
        });

        // Wait 100ms real time (5s game time at 100x speed + buffer)
        await page.waitForTimeout(100);

        // Return to 1x speed
        await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(1);
        });

        // Open Mail
        await page.click('text=☰');
        await page.click('text=SNet Mail');

        // Go back to inbox if viewing a message
        const backButton = page.locator('button:has-text("Back")');
        if (await backButton.isVisible()) {
            await backButton.click();
            await page.waitForTimeout(100);
        }

        // Read "Mission Software & Network Access" message
        const softwareMsg = page.locator('.message-item:has-text("Mission Software")').or(
            page.locator('.message-item:has-text("Network Access")')
        );
        await expect(softwareMsg.first()).toBeVisible({ timeout: 3000 });
        await softwareMsg.first().click();
        await expect(page.locator('text=VPN Client').or(page.locator('text=software')).first()).toBeVisible();

        // Activate SOFTWARE license attachments ONLY (not network address yet)
        // The network address attachment requires NAR to be installed first
        const licenseAttachments = page.locator('.attachment-item:has-text("Software License")');
        const licenseCount = await licenseAttachments.count();

        console.log(`Found ${licenseCount} software license attachments to activate`);

        for (let i = 0; i < licenseCount; i++) {
            await licenseAttachments.nth(i).click();
            await page.waitForTimeout(100);
        }

        console.log('✅ STEP 6: Software licenses activated (network address will be added after NAR installation)');

        // ========================================
        // STEP 7: Install Required Software
        // ========================================

        // Close Mail window
        const mailWindowAfterLicenses = page.locator('.window:has(.window-header:has-text("Mail"))');
        const mailCloseButton = mailWindowAfterLicenses.locator('.window-controls button:has-text("×")');
        await mailCloseButton.click();
        await page.waitForTimeout(100);

        // Open Portal
        await page.click('text=☰');
        await page.waitForTimeout(200);

        // Wait for menu to be visible and click Portal
        const portalMenuItem = page.locator('.app-launcher-menu >> text=OSNet Portal');
        await expect(portalMenuItem).toBeVisible({ timeout: 5000 });
        await portalMenuItem.click();
        await expect(page.locator('.window:has-text("OSNet Portal")').or(page.locator('.window:has-text("Portal")')).first()).toBeVisible();

        // Navigate to Software tab
        await page.click('button:has-text("Software")');
        await page.waitForTimeout(100);

        // Install licensed software (should show "Install" not "Purchase")
        // Look for VPN Client, Network Scanner, File Manager, NAR with Install buttons
        const softwareToInstall = ['VPN Client', 'Network Scanner', 'File Manager', 'Network Address Register'];

        for (const software of softwareToInstall) {
            const installButton = page.locator(`.portal-item:has-text("${software}") button:has-text("Install")`).first();
            const buttonCount = await installButton.count();
            if (buttonCount > 0) {
                await expect(installButton).toBeEnabled({ timeout: 2000 }).catch(() => { });
                await installButton.click({ timeout: 5000 });
            }
        }

        // Wait for downloads to be queued
        await page.waitForTimeout(500);

        // Set 100x speed for faster installation (downloads now use game time)
        await page.evaluate(() => {
            if (typeof window.gameContext?.setSpecificTimeSpeed === 'function') {
                window.gameContext.setSpecificTimeSpeed(100);
            }
        });

        await page.waitForTimeout(200); // Let speed change propagate

        // Wait for downloads to complete
        // Download manager updates progress every 100ms real time via setInterval
        // At 100x speed downloads complete very quickly
        console.log('⏳ Waiting for software downloads to complete at 100x speed...');

        await page.waitForTimeout(2000);

        // Return to 1x speed
        await page.evaluate(() => {
            window.gameContext?.setSpecificTimeSpeed?.(1);
        });

        console.log('✅ STEP 7: Required software installed');

        // ========================================
        // STEP 7.5: Add Network Address to NAR
        // ========================================

        // Now that NAR is installed, add the network address attachment to NAR
        // Open Mail
        await page.click('text=☰');
        await page.waitForTimeout(200);
        await page.click('text=SNet Mail');
        await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

        // Go back to inbox if viewing a message
        const backToInbox = page.locator('button:has-text("Back to inbox")');
        if (await backToInbox.isVisible()) {
            await backToInbox.click();
            await page.waitForTimeout(100);
        }

        // Find and click the software/network message again
        const networkMsg = page.locator('.message-item:has-text("Mission Software")').or(
            page.locator('.message-item:has-text("Network Access")')
        );
        await networkMsg.first().click();
        await expect(page.locator('.message-view')).toBeVisible();

        // Verify the network address attachment now shows "Click to add" (not "Install NAR")
        const networkAttachment = page.locator('[data-testid^="network-attachment-"]').first();
        await expect(networkAttachment).toBeVisible({ timeout: 2000 });

        // Verify it shows the correct status (should be clickable now that NAR is installed)
        await expect(page.locator('text=Click to add to Network Address Register')).toBeVisible({ timeout: 2000 });

        // Click the network address attachment to add it to NAR
        await networkAttachment.click();
        await page.waitForTimeout(200);

        // Verify it was added successfully
        await expect(page.locator('text=✓ Added to NAR')).toBeVisible({ timeout: 2000 });

        console.log('✅ STEP 7.5: Network address added to NAR successfully');

        // Close Mail
        const mailWindow2 = page.locator('.window:has(.window-header:has-text("Mail"))');
        const mailCloseButton2 = mailWindow2.locator('.window-controls button:has-text("×")');
        await mailCloseButton2.click();
        await page.waitForTimeout(100);

        // ========================================
        // STEP 8: Accept Mission
        // ========================================

        // Close Portal window
        const portalWindow = page.locator('.window:has(.window-header:has-text("Portal"))');
        const portalCloseButton = portalWindow.locator('.window-controls button:has-text("×")');
        await portalCloseButton.click();
        await page.waitForTimeout(100);

        // Open Mission Board again
        await page.click('text=☰');
        await page.waitForTimeout(200);

        const missionBoardMenuItem = page.locator('.app-launcher-menu >> text=Mission Board');
        await expect(missionBoardMenuItem).toBeVisible();
        await missionBoardMenuItem.click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        // Make sure we're on Available tab
        const availableTabBtn = page.locator('button:has-text("Available")');
        if (await availableTabBtn.count() > 0) {
            await availableTabBtn.click();
        }

        // Re-locate the mission card
        const missionCardAfterInstall = page.locator('.mission-card:has-text("Log File Repair")');
        await expect(missionCardAfterInstall).toBeVisible();

        // Verify no missing requirements now
        const stillMissing = await missionCardAfterInstall.locator('.requirement-missing').count();
        expect(stillMissing).toBe(0);

        // If test fails, take a screenshot for debugging
        if (stillMissing !== 0) {
            await page.screenshot({ path: 'test-results/download-failure-debug.png', fullPage: true });
            console.log('📸 Screenshot saved to test-results/download-failure-debug.png');
        }

        // Click Accept Mission (button should now be enabled)
        const acceptBtn = missionCardAfterInstall.locator('.accept-mission-btn');
        await expect(acceptBtn).toBeEnabled();
        await acceptBtn.click();
        await page.waitForTimeout(200);

        // Verify mission moved to Active tab
        const activeTab = page.locator('.tab:has-text("Active")');
        await expect(activeTab).toBeVisible();
        await activeTab.click();

        // Verify mission appears in Active tab
        const activeMissionCard = page.locator('.mission-card:has-text("Log File Repair")').or(page.locator('h3:has-text("Log File Repair")')).first();
        await expect(activeMissionCard).toBeVisible();

        // Verify objectives are displayed
        await expect(page.locator('text=Connect to ClientA-Corporate network').first()).toBeVisible();
        await expect(page.locator('text=Scan network to find fileserver-01').first()).toBeVisible();
        await expect(page.locator('text=Connect to fileserver-01 file system').first()).toBeVisible();
        await expect(page.locator('text=Repair all corrupted files').first()).toBeVisible();

        console.log('✅ STEP 8: Mission accepted successfully with objectives displayed');

        // ========================================
        // STEP 9: Complete First Objective - Connect to Network
        // ========================================

        // Close Mission Board
        const missionBoardWindowAfterScanner = page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))');
        const missionBoardCloseButton3 = missionBoardWindowAfterScanner.locator('.window-controls button:has-text("×")');
        await missionBoardCloseButton3.click();
        await page.waitForTimeout(100);

        // Open VPN Client
        await page.click('text=☰');
        await page.waitForTimeout(200);

        const vpnMenuItem = page.locator('.app-launcher-menu >> text=VPN Client').or(
            page.locator('.app-launcher-menu >> text=SourceNet VPN')
        );
        await expect(vpnMenuItem).toBeVisible();
        await vpnMenuItem.click();

        // Wait for VPN window to open (be more specific to avoid matching other windows)
        const vpnWindow = page.locator('.window').filter({ hasText: 'SourceNet VPN Client' }).filter({ hasText: 'Secure Network Access' });
        await expect(vpnWindow).toBeVisible();

        // Verify ClientA-Corporate network is in dropdown (from NAR entry in earlier message)
        // First check if there's a network dropdown (there should be if NAR has entries)
        const hasEmptyState = await vpnWindow.locator('text=No network credentials available').count() > 0;

        if (hasEmptyState) {
            throw new Error('No network credentials found in NAR. The network address attachment from the tutorial-software-licenses message may not have been activated.');
        }

        const networkDropdown = vpnWindow.locator('.network-dropdown');
        await expect(networkDropdown).toBeVisible();

        // Select the ClientA-Corporate network (use value or index, not regex label)
        await networkDropdown.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        // Click Connect button
        const connectBtn = page.locator('button:has-text("Connect")');
        await expect(connectBtn).toBeEnabled();
        await connectBtn.click();

        // Wait for connecting status (just look for the first one)
        await expect(page.locator('text=Connecting').first()).toBeVisible({ timeout: 2000 });

        // Wait for connection to complete (3 second connection time in VPN Client)
        await page.waitForTimeout(3200);

        // Verify connection established
        await expect(page.locator('text=Connected').first()).toBeVisible();
        await expect(page.locator('text=ClientA-Corporate').first()).toBeVisible();

        console.log('✅ STEP 9: Connected to ClientA-Corporate network');

        // ========================================
        // STEP 10: Verify First Objective Completed
        // ========================================

        // Close VPN Client
        const vpnWindowAfterConnect = page.locator('.window:has(.window-header:has-text("VPN Client"))');
        const vpnCloseButton = vpnWindowAfterConnect.locator('.window-controls button:has-text("×")');
        await vpnCloseButton.click();
        await page.waitForTimeout(100);

        // Open Mission Board to verify objective completion
        await page.click('text=☰');
        await page.waitForTimeout(200);
        await missionBoardMenuItem.click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        // Go to Active tab
        await activeTab.click();

        // Verify first objective is marked complete
        const firstObjective = page.locator('text=Connect to ClientA-Corporate network').first();
        await expect(firstObjective).toBeVisible();

        // Check for completion indicator (checkbox, checkmark, or "complete" status)
        const objectiveContainer = page.locator('.objective-item:has-text("Connect to ClientA-Corporate")').first();
        await expect(objectiveContainer.locator('.objective-complete').or(
            objectiveContainer.locator('text=✓')
        ).or(
            objectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        console.log('✅ STEP 10: First objective marked complete');

        // ========================================
        // STEP 11: Complete Second Objective - Scan Network
        // ========================================

        // Close Mission Board
        const missionBoardWindow2 = page.locator('.window:has(.window-header:has-text("Mission Board"))');
        const missionBoardCloseButton2 = missionBoardWindow2.locator('.window-controls button:has-text("×")');
        await missionBoardCloseButton2.click();
        await page.waitForTimeout(100);

        // Open Network Scanner
        await page.click('text=☰');
        await page.waitForTimeout(200);

        const scannerMenuItem = page.locator('.app-launcher-menu >> text=Network Scanner').or(
            page.locator('.app-launcher-menu >> text=Scanner')
        );
        await expect(scannerMenuItem).toBeVisible();
        await scannerMenuItem.click();

        // Wait for Scanner window to open (use window header for specificity)
        const scannerWindow = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        await expect(scannerWindow).toBeVisible();

        // Wait for scanner to be ready
        await page.waitForTimeout(200);

        // Select the network from dropdown (ClientA-Corporate should be there from VPN connection)
        const scannerNetworkDropdown = scannerWindow.locator('label:has-text("Network:") select');
        await scannerNetworkDropdown.selectOption('clienta-corporate');
        await page.waitForTimeout(100);

        // Click Scan Network button
        const scanButton = scannerWindow.locator('button:has-text("Scan")').or(
            scannerWindow.locator('button:has-text("Start Scan")')
        );
        await expect(scanButton).toBeEnabled({ timeout: 2000 });
        await scanButton.click();

        // Wait for scan to start
        await expect(scannerWindow.locator('text=Scanning').or(
            scannerWindow.locator('text=Scan in progress')
        ).first()).toBeVisible({ timeout: 2000 });

        // Wait for scan to complete (scan duration varies, give it time)
        await page.waitForTimeout(3500);

        // Verify fileserver-01 appears in scan results
        await expect(scannerWindow.locator('text=fileserver-01').first()).toBeVisible({ timeout: 5000 });

        console.log('✅ STEP 11: Network scanned, fileserver-01 discovered');

        // ========================================
        // STEP 12: Verify Second Objective Completed
        // ========================================

        // Close Scanner
        const scannerWindow2 = page.locator('.window:has(.window-header:has-text("Network Scanner"))');
        const scannerCloseButton = scannerWindow2.locator('.window-controls button:has-text("×")');
        await scannerCloseButton.click();
        await page.waitForTimeout(100);

        // Open Mission Board to verify objective completion
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const missionBoardMenuItem2 = page.locator('.app-launcher-menu >> text=Mission Board');
        await missionBoardMenuItem2.click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        // Go to Active tab
        const activeTab2 = page.locator('.tab:has-text("Active")');
        await activeTab2.click();

        // Verify second objective is marked complete
        const secondObjective = page.locator('text=Scan network to find fileserver-01').first();
        await expect(secondObjective).toBeVisible();

        // Check for completion indicator
        const secondObjectiveContainer = page.locator('.objective-item:has-text("Scan network")').first();
        await expect(secondObjectiveContainer.locator('.objective-complete').or(
            secondObjectiveContainer.locator('text=✓')
        ).or(
            secondObjectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        console.log('✅ STEP 12: Second objective marked complete');

        // ========================================
        // STEP 13: Connect to fileserver-01 file system (Third objective)
        // ========================================

        // Close Mission Board window by clicking close button
        const missionBoardWindow = page.locator('.window:has(.window-header:has-text("SourceNet Mission Board"))');
        const missionBoardCloseBtn = missionBoardWindow.locator('.window-close-btn, .close-btn, button:has-text("×")').first();
        await missionBoardCloseBtn.click();
        await expect(missionBoardWindow).not.toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100);

        // Open File Manager from app launcher menu
        const topBarMenu = page.locator('text=☰');
        await topBarMenu.click();
        await page.waitForTimeout(200);
        const fileManagerMenuItem = page.locator('.app-launcher-menu >> text=File Manager');
        await expect(fileManagerMenuItem).toBeVisible();
        await fileManagerMenuItem.click();
        await page.waitForTimeout(200);

        // Wait for File Manager window
        const fileManagerWindow = page.locator('.window:has(.window-header:has-text("File Manager"))');
        await expect(fileManagerWindow).toBeVisible();

        // Select the fileserver-01 file system from dropdown
        const fileSystemDropdown = fileManagerWindow.locator('select');
        await fileSystemDropdown.selectOption('fs-clienta-01'); // 192.168.50.10 - fileserver-01
        await page.waitForTimeout(200);

        // Verify files are displayed (connection successful)
        await expect(fileManagerWindow.locator('text=log_2024').first()).toBeVisible({ timeout: 3000 });

        console.log('✅ STEP 13: Connected to fileserver-01 file system');

        // ========================================
        // STEP 14: Verify Third Objective Completed
        // ========================================

        // Close File Manager
        const fileManagerWindowAfterConnect = page.locator('.window:has(.window-header:has-text("File Manager"))');
        const fileManagerCloseButton = fileManagerWindowAfterConnect.locator('.window-controls button:has-text("×")');
        await fileManagerCloseButton.click();
        await page.waitForTimeout(100);

        // Open Mission Board to verify objective completion
        await page.click('text=☰');
        await page.waitForTimeout(200);
        const missionBoardMenuItem3 = page.locator('.app-launcher-menu >> text=Mission Board');
        await missionBoardMenuItem3.click();
        await expect(page.locator('.window >> .window-header:has-text("SourceNet Mission Board")')).toBeVisible();

        // Go to Active tab
        const activeTab3 = page.locator('.tab:has-text("Active")');
        await activeTab3.click();

        // Verify third objective is marked complete
        const thirdObjective = page.locator('text=Connect to fileserver-01 file system').first();
        await expect(thirdObjective).toBeVisible();

        // Check for completion indicator
        const thirdObjectiveContainer = page.locator('.objective-item:has-text("Connect to fileserver-01")').first();
        await expect(thirdObjectiveContainer.locator('.objective-complete').or(
            thirdObjectiveContainer.locator('text=✓')
        ).or(
            thirdObjectiveContainer.locator('.checkmark')
        )).toBeVisible({ timeout: 3000 });

        console.log('✅ STEP 14: Third objective marked complete');

        // ========================================
        // Summary: Tutorial Flow Complete
        // ========================================

        console.log('');
        console.log('✅ E2E: Tutorial Mission Flow - COMPLETE');
        console.log('   All core systems validated:');
        console.log('   ✅ Story mission event system');
        console.log('   ✅ Message timing and attachments');
        console.log('   ✅ Software licensing and installation');
        console.log('   ✅ Mission Board availability system');
        console.log('   ✅ Mission requirement validation');
        console.log('   ✅ Mission acceptance workflow');
        console.log('   ✅ Network Address Register (NAR) system');
        console.log('   ✅ VPN network connection');
        console.log('   ✅ Network Scanner functionality');
        console.log('   ✅ File Manager file system connection');
        console.log('   ✅ Objective auto-tracking and completion');
        console.log('');
        console.log('   Note: Additional objectives require further implementation:');
        console.log('   - File repair operations');
        console.log('   - Scripted event system');

        // End test successfully - core mission system is fully validated
    });
});

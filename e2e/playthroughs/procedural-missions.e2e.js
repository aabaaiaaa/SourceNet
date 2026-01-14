/**
 * Procedural Mission System E2E Tests
 * 
 * Tests that reading the "Better" message triggers procedural mission generation.
 * Uses the post-tutorial-part-2 scenario which has tutorial completed and the
 * "Better" message already received but unread.
 * 
 * Reading it enables procedural missions.
 */

import { test, expect } from '@playwright/test';

test.describe('Procedural Mission Generation', () => {
    test('should generate procedural missions after reading "Better" message', async ({ page }) => {
        // Clear state and load scenario (tutorial complete, "Better" message unread)
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-tutorial-part-2');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Open Mail app - "Better" message should already be there (unread)
        await page.locator('text=☰').click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=SNet Mail');
        const mailWindow = page.locator('.window:has(.window-header:has-text("SNet Mail"))');
        await expect(mailWindow).toBeVisible();

        // The "Better" message should already be in the inbox (scenario has it unread)
        const betterMessage = mailWindow.locator('.message-item:has-text("Better"):has-text("SourceNet Manager")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        console.log('✅ "Better" message found from SourceNet Manager');

        // Click to read the message (this triggers procedural mission generation)
        await betterMessage.click();
        await expect(mailWindow.locator('.message-body:has-text("that\'s more like it")')).toBeVisible({ timeout: 5000 });
        console.log('✅ "Better" message read - procedural missions should now be enabled');

        await page.waitForTimeout(1000);

        // Close the Mail window before opening Mission Board
        const closeBtn = mailWindow.locator('button.window-control-btn[title="Close"]');
        await expect(closeBtn).toBeVisible({ timeout: 5000 });
        await closeBtn.click();
        await expect(mailWindow).not.toBeVisible();

        // Open Mission Board and verify procedural missions are available
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();

        // Check Available Missions tab for procedural missions
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        const missionCards = page.locator('.mission-board .missions-list .mission-card');
        const missionCount = await missionCards.count();
        expect(missionCount).toBeGreaterThanOrEqual(4);
        console.log(`✅ Mission Board shows ${missionCount} available procedural missions`);

        // Verify mission card structure
        const firstMission = missionCards.first();

        const missionTitle = firstMission.locator('h3');
        await expect(missionTitle).toBeVisible();
        const titleText = await missionTitle.textContent();
        expect(titleText.length).toBeGreaterThan(5);
        console.log(`✅ First mission title: "${titleText}"`);

        const difficultyBadge = firstMission.locator('.difficulty-badge');
        await expect(difficultyBadge).toBeVisible();
        const difficultyText = await difficultyBadge.textContent();
        expect(['Easy', 'Medium', 'Hard', 'Expert']).toContain(difficultyText);
        console.log(`✅ Difficulty: ${difficultyText}`);

        const clientInfo = firstMission.locator('.mission-client');
        await expect(clientInfo).toBeVisible();
        const clientText = await clientInfo.textContent();
        expect(clientText).toContain('Client:');
        console.log(`✅ ${clientText}`);

        const payoutInfo = firstMission.locator('.mission-payout');
        await expect(payoutInfo).toBeVisible();
        const payoutText = await payoutInfo.textContent();
        expect(payoutText).toContain('Payout:');
        expect(payoutText).toContain('credits');
        console.log(`✅ ${payoutText}`);

        const expirationInfo = firstMission.locator('.mission-expiration');
        await expect(expirationInfo).toBeVisible();
        const expirationText = await expirationInfo.textContent();
        expect(expirationText).toContain('remaining');
        console.log(`✅ Expiration: ${expirationText}`);

        // Find a mission with an enabled Accept button (some missions may require unavailable software)
        const acceptableMission = page.locator('.mission-board .missions-list .mission-card:has(button:has-text("Accept"):not([disabled]))').first();
        const acceptButton = acceptableMission.locator('button:has-text("Accept")');
        await expect(acceptButton).toBeVisible({ timeout: 5000 });
        await expect(acceptButton).toBeEnabled();
        console.log('✅ Found mission with enabled Accept button');

        // Accept mission and verify it moves to Active tab
        const acceptedMissionTitle = await acceptableMission.locator('h3').textContent();
        await acceptButton.click();
        await page.locator('.mission-board .tab:has-text("Active Mission")').click();

        const activeMissionTitle = page.locator('.mission-board .active-mission h3');
        await expect(activeMissionTitle).toBeVisible({ timeout: 5000 });
        const activeTitle = await activeMissionTitle.textContent();
        expect(activeTitle).toBe(acceptedMissionTitle);
        console.log(`✅ Accepted mission is now active: "${activeTitle}"`);

        const objectives = page.locator('.mission-board .active-mission .objectives-section');
        await expect(objectives).toBeVisible();
        console.log('✅ Active mission shows objectives');
    });
});

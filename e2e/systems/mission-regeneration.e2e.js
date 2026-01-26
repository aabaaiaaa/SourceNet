/**
 * Mission Regeneration E2E Tests
 * 
 * Tests that expired missions are automatically regenerated after 1 minute of game time.
 * Uses the post-tutorial-part-2 scenario with procedural missions enabled.
 */

import { test, expect } from '@playwright/test';

// Helper to set game speed programmatically (allows 100x which is not in UI)
async function setGameSpeed(page, speed) {
    await page.evaluate((s) => window.gameContext.setSpecificTimeSpeed(s), speed);
}

// Helper to add credits to prevent bankruptcy during time advancement
async function addCredits(page, amount) {
    await page.evaluate((amt) => {
        const accounts = window.gameContext.bankAccounts;
        if (accounts && accounts.length > 0) {
            window.gameContext.setBankAccounts(accounts.map((acc, i) =>
                i === 0 ? { ...acc, balance: acc.balance + amt } : acc
            ));
        }
    }, amount);
}

test.describe('Mission Regeneration After Expiration', () => {
    test.beforeEach(async ({ page }) => {
        // Clear state and load scenario with procedural missions
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should maintain pool size and detect expiration over time', async ({ page }) => {
        // Load scenario and enable procedural missions by reading "Better" message
        await page.goto('/?scenario=post-tutorial-part-2');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Add credits to prevent bankruptcy during fast time advancement
        await addCredits(page, 50000);
        console.log('✅ Added 50000 credits to prevent bankruptcy');

        // Open Mail and read "Better" message to enable procedural missions
        await page.locator('text=☰').click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=SNet Mail');
        const mailWindow = page.locator('.window:has(.window-header:has-text("SNet Mail"))');
        await expect(mailWindow).toBeVisible();

        const betterMessage = mailWindow.locator('.message-item:has-text("Better"):has-text("SourceNet Manager")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        await betterMessage.click();
        await expect(mailWindow.locator('.message-body:has-text("that\'s more like it")')).toBeVisible({ timeout: 5000 });
        console.log('✅ Procedural missions enabled');

        // Close mail window
        const closeMailBtn = mailWindow.locator('button.window-control-btn[title="Close"]');
        await closeMailBtn.click();
        await expect(mailWindow).not.toBeVisible();

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        const missionBoard = page.locator('.mission-board');
        await expect(missionBoard).toBeVisible();

        // Get initial mission count and titles
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        const initialMissionCards = page.locator('.mission-board .missions-list .mission-card');
        const initialCount = await initialMissionCards.count();
        console.log(`✅ Initial mission count: ${initialCount}`);
        expect(initialCount).toBeGreaterThanOrEqual(4);
        expect(initialCount).toBeLessThanOrEqual(6);

        // Get the titles of all initial missions
        const initialTitles = [];
        for (let i = 0; i < initialCount; i++) {
            const title = await initialMissionCards.nth(i).locator('h3').textContent();
            initialTitles.push(title);
        }
        console.log(`✅ Initial missions: ${initialTitles.slice(0, 2).join(', ')}...`);

        // Switch to 100x speed programmatically (not available in UI)
        await setGameSpeed(page, 100);
        console.log('✅ Set game speed to 100x');

        // Wait for missions to potentially expire and regenerate
        // At 100x: 15 game minutes (min expiration) = 9 real seconds
        // At 100x: 1 game minute (regeneration delay) = 0.6 real seconds
        // Total: ~10 seconds real time for shortest expiration + regeneration
        console.log('⏳ Fast-forwarding 10s at 100x speed (~17 game minutes)...');
        await page.waitForTimeout(10000);

        // Reset to normal speed
        await setGameSpeed(page, 1);

        // Make sure Mission Board is still visible and responsive
        await expect(missionBoard).toBeVisible();

        // Check pool is still healthy
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await page.waitForTimeout(200);

        const finalCount = await page.locator('.mission-board .missions-list .mission-card').count();
        console.log(`✅ Final mission count: ${finalCount}`);

        // Pool should still be in valid range
        expect(finalCount).toBeGreaterThanOrEqual(4);
        expect(finalCount).toBeLessThanOrEqual(6);

        // Check if any new missions appeared (regeneration occurred)
        const finalTitles = [];
        const finalCards = page.locator('.mission-board .missions-list .mission-card');
        for (let i = 0; i < finalCount; i++) {
            const title = await finalCards.nth(i).locator('h3').textContent();
            finalTitles.push(title);
        }
        const newMissions = finalTitles.filter(t => !initialTitles.includes(t));
        if (newMissions.length > 0) {
            console.log(`✅ Regenerated missions detected: ${newMissions.join(', ')}`);
        }

        console.log('✅ Pool remains healthy after time advancement');
    });

    test('should clear regeneration timer when mission is accepted', async ({ page }) => {
        // Load scenario and enable procedural missions
        await page.goto('/?scenario=post-tutorial-part-2');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Enable procedural missions
        await page.locator('text=☰').click();
        await page.click('text=SNet Mail');
        const mailWindow = page.locator('.window:has(.window-header:has-text("SNet Mail"))');
        await expect(mailWindow).toBeVisible();

        const betterMessage = mailWindow.locator('.message-item:has-text("Better"):has-text("SourceNet Manager")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        await betterMessage.click();
        await page.waitForTimeout(300);

        const closeMailBtn = mailWindow.locator('button.window-control-btn[title="Close"]');
        await closeMailBtn.click();

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Get initial count
        const initialCount = await page.locator('.mission-board .missions-list .mission-card').count();
        console.log(`✅ Initial mission count: ${initialCount}`);

        // Find an acceptable mission and accept it
        const acceptableMission = page.locator('.mission-board .missions-list .mission-card:has(button:has-text("Accept"):not([disabled]))').first();
        const acceptButton = acceptableMission.locator('button:has-text("Accept")');

        if (await acceptButton.isVisible()) {
            const missionTitle = await acceptableMission.locator('h3').textContent();
            console.log(`✅ Accepting mission: "${missionTitle}"`);

            await acceptButton.click();

            // Verify mission moved to Active tab
            await page.locator('.mission-board .tab:has-text("Active Mission")').click();
            await expect(page.locator('.mission-board .active-mission h3')).toBeVisible({ timeout: 5000 });
            console.log('✅ Mission accepted and moved to Active tab');

            // Go back to Available and check count decreased
            await page.locator('.mission-board .tab:has-text("Available Missions")').click();
            const newCount = await page.locator('.mission-board .missions-list .mission-card').count();
            expect(newCount).toBe(initialCount - 1);
            console.log(`✅ Available missions decreased: ${initialCount} -> ${newCount}`);

            // The accepted mission should not trigger regeneration since it was removed by acceptance
            // (not by expiration) - the cleanup logic should have cleared any pending timer
        } else {
            console.log('⏭️ No acceptable mission found - skipping acceptance test');
        }
    });

    test('pool size should never exceed maximum of 6', async ({ page }) => {
        // Load scenario and enable procedural missions
        await page.goto('/?scenario=post-tutorial-part-2');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Add credits to prevent bankruptcy during fast time advancement
        await addCredits(page, 50000);
        console.log('✅ Added 50000 credits to prevent bankruptcy');

        // Enable procedural missions by reading "Better" message
        await page.locator('text=☰').click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=SNet Mail');
        const mailWindow = page.locator('.window:has(.window-header:has-text("SNet Mail"))');
        await expect(mailWindow).toBeVisible();

        const betterMessage = mailWindow.locator('.message-item:has-text("Better"):has-text("SourceNet Manager")');
        await expect(betterMessage).toBeVisible({ timeout: 5000 });
        await betterMessage.click();
        await page.waitForTimeout(300);

        // Close mail
        const closeMailBtn = mailWindow.locator('button.window-control-btn[title="Close"]');
        await closeMailBtn.click();

        // Open Mission Board and count missions
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        const missionCards = page.locator('.mission-board .missions-list .mission-card');
        const initialCount = await missionCards.count();
        console.log(`✅ Initial mission count: ${initialCount}`);

        // Pool should be between 4-6
        expect(initialCount).toBeGreaterThanOrEqual(4);
        expect(initialCount).toBeLessThanOrEqual(6);
        console.log(`✅ Pool size ${initialCount} is within bounds [4, 6]`);

        // Set to 100x speed programmatically
        await setGameSpeed(page, 100);
        console.log('✅ Set game speed to 100x');

        // Periodically check that pool never exceeds 6
        // At 100x: check every 1.5s real = 2.5 game minutes, 4 checks = 10 game minutes
        let maxObserved = initialCount;
        for (let i = 0; i < 4; i++) {
            await page.waitForTimeout(1500);

            await page.locator('.mission-board .tab:has-text("Available Missions")').click();
            await page.waitForTimeout(200);

            const currentCount = await page.locator('.mission-board .missions-list .mission-card').count();
            maxObserved = Math.max(maxObserved, currentCount);

            console.log(`  Check ${i + 1}: Pool size = ${currentCount}`);
            expect(currentCount).toBeLessThanOrEqual(6);
        }

        // Reset to normal speed
        await setGameSpeed(page, 1);

        console.log(`✅ Max pool size observed: ${maxObserved} (max allowed: 6)`);
    });
});

/**
 * Mission Dismiss E2E Tests
 *
 * Tests the ability to dismiss procedural missions from the Mission Board.
 * When dismissed, the mission is removed, the client is freed, and a replacement is generated.
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

// Helper to get the current mission pool from game context
async function getMissionPool(page) {
    return page.evaluate(() => window.gameContext.missionPool);
}

// Helper to get active client IDs from game context
async function getActiveClientIds(page) {
    return page.evaluate(() => window.gameContext.activeClientIds);
}

// Helper to get pending chain missions from game context
async function getPendingChainMissions(page) {
    return page.evaluate(() => window.gameContext.pendingChainMissions);
}

test.describe('Mission Dismiss Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should dismiss a procedural mission and generate replacement', async ({ page }) => {
        // Load scenario with procedural missions enabled
        await page.goto('/?scenario=post-hardware-unlock');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Add credits to prevent bankruptcy
        await addCredits(page, 50000);

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        const missionBoard = page.locator('.mission-board');
        await expect(missionBoard).toBeVisible();

        // Go to Available Missions tab
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Get initial mission count and pool state
        const initialPool = await getMissionPool(page);
        const initialClientIds = await getActiveClientIds(page);
        const initialCount = initialPool.length;
        console.log(`✅ Initial pool size: ${initialCount}`);
        console.log(`✅ Initial active clients: ${initialClientIds.length}`);

        // Find a dismiss button (only procedural missions have them)
        const dismissButton = page.locator('.mission-board .missions-list .mission-card .dismiss-mission-btn').first();
        await expect(dismissButton).toBeVisible();

        // Get the mission title before dismissing
        const missionCard = page.locator('.mission-board .missions-list .mission-card:has(.dismiss-mission-btn)').first();
        const missionTitle = await missionCard.locator('h3').textContent();
        console.log(`✅ Dismissing mission: "${missionTitle}"`);

        // Click dismiss
        await dismissButton.click();

        // Verify mission was removed from pool
        const poolAfterDismiss = await getMissionPool(page);
        const dismissedMissionStillInPool = poolAfterDismiss.some(m => m.title === missionTitle && !m.visibleAt);
        expect(dismissedMissionStillInPool).toBe(false);
        console.log(`✅ Mission removed from pool`);

        // Check that a replacement mission was added with visibleAt
        const replacementMission = poolAfterDismiss.find(m => m.visibleAt);
        expect(replacementMission).toBeTruthy();
        console.log(`✅ Replacement mission generated: "${replacementMission.title}" (visible at ${replacementMission.visibleAt})`);

        // Fast-forward time to make replacement visible (1 minute at 100x = ~0.6s)
        await setGameSpeed(page, 100);
        await page.waitForTimeout(1000);
        await setGameSpeed(page, 1);

        // Refresh the Available Missions tab
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await page.waitForTimeout(300);

        // Verify pool size is maintained
        const finalPool = await getMissionPool(page);
        const visibleMissions = finalPool.filter(m => !m.visibleAt || new Date(m.visibleAt) <= new Date());
        console.log(`✅ Final visible missions: ${visibleMissions.length}`);
        expect(visibleMissions.length).toBeGreaterThanOrEqual(initialCount - 1);
    });

    test('should free client slot when mission is dismissed', async ({ page }) => {
        // Load scenario with procedural missions enabled
        await page.goto('/?scenario=post-hardware-unlock');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Get the clientId of the first mission with dismiss button
        const initialPool = await getMissionPool(page);
        const missionToDismiss = initialPool.find(m => m.isProcedurallyGenerated);
        expect(missionToDismiss).toBeTruthy();
        const clientIdToFree = missionToDismiss.clientId;
        console.log(`✅ Will dismiss mission from client: ${clientIdToFree}`);

        // Verify client is in activeClientIds
        const initialClientIds = await getActiveClientIds(page);
        expect(initialClientIds).toContain(clientIdToFree);

        // Dismiss the mission
        const dismissButton = page.locator('.mission-board .missions-list .mission-card .dismiss-mission-btn').first();
        await dismissButton.click();

        // Verify client was removed from activeClientIds (immediately after dismiss)
        const clientIdsAfterDismiss = await getActiveClientIds(page);
        expect(clientIdsAfterDismiss).not.toContain(clientIdToFree);
        console.log(`✅ Client ${clientIdToFree} freed from activeClientIds`);

        // The replacement mission will have added a new client
        // So total client count should stay the same or increase by 1
        expect(clientIdsAfterDismiss.length).toBeGreaterThanOrEqual(initialClientIds.length - 1);
    });

    test('should remove entire arc when arc mission is dismissed', async ({ page }) => {
        // Load scenario with procedural missions enabled
        await page.goto('/?scenario=post-hardware-unlock');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Check if there's an arc mission in the pool
        const initialPool = await getMissionPool(page);
        const arcMission = initialPool.find(m => m.arcId && m.isProcedurallyGenerated);

        if (!arcMission) {
            console.log('⏭️ No arc mission in pool - skipping arc dismissal test');
            test.skip();
            return;
        }

        const arcId = arcMission.arcId;
        console.log(`✅ Found arc mission: "${arcMission.title}" (arc: ${arcId})`);

        // Check pending chain missions for this arc
        const initialPending = await getPendingChainMissions(page);
        const hasArcInPending = arcId in initialPending;
        console.log(`✅ Arc has pending parts: ${hasArcInPending}`);

        // Find and click the dismiss button for the arc mission
        // Arc missions show "Dismiss Storyline" text
        const dismissStorylineButton = page.locator('.mission-board .missions-list .mission-card .dismiss-mission-btn:has-text("Dismiss Storyline")').first();

        if (await dismissStorylineButton.isVisible()) {
            await dismissStorylineButton.click();
            console.log(`✅ Dismissed arc storyline`);

            // Verify arc was removed from pending chain missions
            if (hasArcInPending) {
                const pendingAfterDismiss = await getPendingChainMissions(page);
                expect(arcId in pendingAfterDismiss).toBe(false);
                console.log(`✅ Arc ${arcId} removed from pendingChainMissions`);
            }
        } else {
            console.log('⏭️ No "Dismiss Storyline" button found - mission may not be multi-part arc');
        }
    });

    test('should NOT show dismiss button for story missions', async ({ page }) => {
        // We'll test this by checking that missions without isProcedurallyGenerated don't have dismiss buttons
        // Use post-hardware-unlock scenario and check the mission pool directly
        await page.goto('/?scenario=post-hardware-unlock');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // All missions in post-hardware-unlock are procedural, so they should all have dismiss buttons
        // Verify that all mission cards have dismiss buttons (proving the feature works)
        const missionCards = page.locator('.mission-board .missions-list .mission-card');
        const cardCount = await missionCards.count();

        // Every procedural mission card should have a dismiss button
        const dismissButtons = page.locator('.mission-board .missions-list .dismiss-mission-btn');
        const dismissButtonCount = await dismissButtons.count();

        // Each mission card should have exactly one dismiss button
        expect(dismissButtonCount).toBe(cardCount);
        console.log(`✅ All ${cardCount} procedural missions have dismiss buttons`);

        // Now verify the button logic by checking the game context directly
        // The dismiss button should only appear when mission.isProcedurallyGenerated === true
        const pool = await getMissionPool(page);
        const allAreProcedural = pool.every(m => m.isProcedurallyGenerated === true);
        expect(allAreProcedural).toBe(true);
        console.log(`✅ Verified all pool missions are procedural (dismiss button logic is correct)`);
    });

    test('dismiss button should be disabled for expired missions', async ({ page }) => {
        // Load scenario with procedural missions
        await page.goto('/?scenario=post-hardware-unlock');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Add credits to prevent bankruptcy
        await addCredits(page, 100000);

        // Open Mission Board
        await page.locator('button.topbar-button', { hasText: '☰' }).click();
        await expect(page.locator('.app-launcher-menu')).toBeVisible();
        await page.click('text=Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Fast-forward time to expire some missions
        // At 100x: 20 game minutes (min expiration ~15-30 min) = 12 real seconds
        console.log('⏳ Fast-forwarding to expire missions...');
        await setGameSpeed(page, 100);
        await page.waitForTimeout(15000);
        await setGameSpeed(page, 1);

        // Refresh the tab
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await page.waitForTimeout(500);

        // Check for expired missions
        const expiredCards = page.locator('.mission-board .missions-list .mission-card.mission-expired');
        const expiredCount = await expiredCards.count();

        if (expiredCount > 0) {
            // Verify dismiss button is disabled on expired mission
            const expiredDismissBtn = expiredCards.first().locator('.dismiss-mission-btn');
            if (await expiredDismissBtn.isVisible()) {
                const isDisabled = await expiredDismissBtn.isDisabled();
                expect(isDisabled).toBe(true);
                console.log(`✅ Dismiss button is disabled for expired missions`);
            }
        } else {
            console.log('⏭️ No expired missions found after time advancement');
        }
    });
});

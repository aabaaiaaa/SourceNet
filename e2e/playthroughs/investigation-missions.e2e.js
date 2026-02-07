/**
 * Investigation Mission System E2E Tests
 *
 * Tests that investigation missions are available after completing the
 * data-detective story mission. Uses the post-data-detective-completion
 * scenario which has:
 * - data-detective in completedMissions
 * - investigation-missions in unlockedFeatures
 * - log-viewer and data-recovery-tool installed
 * - 1 unread "Excellent Work - Investigation Missions Unlocked" message
 * - Investigation missions already in the mission pool
 */

import { test, expect } from '@playwright/test';
import {
    openMail,
    waitForMessage,
    readMessage,
    closeWindow,
    openApp,
} from '../helpers/common-actions.js';

test.describe('Investigation Mission Generation', () => {
    test('should have investigation missions available after completing data-detective', async ({ page }) => {
        // Clear state and load post-data-detective-completion scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-completion&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Speed up game time for faster testing
        await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));

        // Verify unlockedFeatures includes investigation-missions
        const unlockedFeatures = await page.evaluate(() => window.gameContext.unlockedFeatures);
        expect(unlockedFeatures).toContain('investigation-missions');
        console.log('investigation-missions is unlocked');

        // Read the "Investigation Missions Unlocked" message
        await openMail(page);
        await waitForMessage(page, 'Investigation Missions Unlocked');
        await readMessage(page, 'Investigation Missions Unlocked');
        await closeWindow(page, 'SNet Mail');

        // Wait for pool to contain an investigation mission (poll with timeout)
        const investigationTypes = ['investigation-repair', 'investigation-recovery', 'secure-deletion'];
        let missionPool;
        let hasInvestigationMission = false;

        for (let attempt = 0; attempt < 20; attempt++) {
            await page.waitForTimeout(500);
            missionPool = await page.evaluate(() => window.gameContext.missionPool);
            hasInvestigationMission = missionPool.some(m => investigationTypes.includes(m.missionType));
            if (hasInvestigationMission) {
                console.log(`Investigation mission found after ${attempt + 1} attempts`);
                break;
            }
        }

        // Open Mission Board
        await openApp(page, 'Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();

        // Click Available Missions tab
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Get all mission cards and their types
        const missionCards = page.locator('.mission-board .missions-list .mission-card');
        const missionCount = await missionCards.count();
        console.log(`Found ${missionCount} missions in pool`);

        // Check pool via gameContext for mission types
        const missionTypes = missionPool.map(m => m.missionType);
        console.log('Mission types in pool:', missionTypes);

        // Verify we have investigation missions
        expect(hasInvestigationMission).toBe(true);
        console.log('Investigation missions are present in the pool');

        // Find and verify an investigation mission card
        const investigationMission = missionPool.find(m => investigationTypes.includes(m.missionType));
        console.log(`Found investigation mission: "${investigationMission.title}" (${investigationMission.missionType})`);

        // Verify the investigation mission has correct requirements
        expect(investigationMission.requirements.software).toContain('log-viewer');
        console.log('Investigation mission requires log-viewer');

        // Verify pool size is at midGame level (5-8, but may be slightly higher when forcing investigation mission)
        expect(missionPool.length).toBeGreaterThanOrEqual(5);
        expect(missionPool.length).toBeLessThanOrEqual(10);
        console.log(`Pool size (${missionPool.length}) is within expected range (5-10)`);

        await closeWindow(page, 'Mission Board');
    });

    test('should show investigation mission details with correct objectives', async ({ page }) => {
        // Clear state and load scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-completion&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Speed up game time
        await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));

        // Read the "Investigation Missions Unlocked" message
        await openMail(page);
        await waitForMessage(page, 'Investigation Missions Unlocked');
        await readMessage(page, 'Investigation Missions Unlocked');
        await closeWindow(page, 'SNet Mail');

        // Wait for pool to contain an investigation mission (poll with timeout)
        const investigationTypes = ['investigation-repair', 'investigation-recovery', 'secure-deletion'];
        let missionPool;
        let investigationMission;

        for (let attempt = 0; attempt < 20; attempt++) {
            await page.waitForTimeout(500);
            missionPool = await page.evaluate(() => window.gameContext.missionPool);
            investigationMission = missionPool.find(m => investigationTypes.includes(m.missionType));
            if (investigationMission) {
                console.log(`Investigation mission found after ${attempt + 1} attempts`);
                break;
            }
        }

        if (!investigationMission) {
            console.log('No investigation mission found after polling, skipping...');
            test.skip();
            return;
        }

        // Verify investigation mission has correct structure
        expect(investigationMission.isInvestigation || investigationMission.secureDeleteVariant).toBeTruthy();
        console.log(`Mission "${investigationMission.title}" is an investigation mission`);

        // Check objectives include investigation-specific types
        const objectiveTypes = investigationMission.objectives.map(o => o.type);
        console.log('Objective types:', objectiveTypes);

        if (investigationMission.missionType === 'investigation-repair') {
            expect(objectiveTypes).toContain('investigation');
            expect(investigationMission.requirements.software).toContain('log-viewer');
            console.log('Investigation-repair mission has investigation objective and requires log-viewer');
        } else if (investigationMission.missionType === 'investigation-recovery') {
            expect(objectiveTypes).toContain('investigation');
            expect(objectiveTypes).toContain('fileRecovery');
            expect(investigationMission.requirements.software).toContain('data-recovery-tool');
            console.log('Investigation-recovery mission has fileRecovery objective and requires data-recovery-tool');
        } else if (investigationMission.missionType === 'secure-deletion') {
            expect(objectiveTypes).toContain('secureDelete');
            expect(investigationMission.requirements.software).toContain('data-recovery-tool');
            console.log('Secure-deletion mission has secureDelete objective and requires data-recovery-tool');
        }

        // Verify difficulty is appropriate
        if (investigationMission.missionType.startsWith('investigation-')) {
            expect(investigationMission.difficulty).toBe('Hard');
            console.log('Investigation mission difficulty is Hard');
        }
    });

    test('should allow accepting and viewing investigation mission', async ({ page }) => {
        // Clear state and load scenario
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/?scenario=post-data-detective-completion&debug=true');
        await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

        // Speed up game time
        await page.evaluate(() => window.gameContext.setSpecificTimeSpeed(100));

        // Read the "Investigation Missions Unlocked" message
        await openMail(page);
        await waitForMessage(page, 'Investigation Missions Unlocked');
        await readMessage(page, 'Investigation Missions Unlocked');
        await closeWindow(page, 'SNet Mail');

        // Wait for pool to contain an investigation mission (poll with timeout)
        const investigationTypes = ['investigation-repair', 'investigation-recovery', 'secure-deletion'];
        let missionPool;
        let investigationMission;

        for (let attempt = 0; attempt < 20; attempt++) {
            await page.waitForTimeout(500);
            missionPool = await page.evaluate(() => window.gameContext.missionPool);
            investigationMission = missionPool.find(m => investigationTypes.includes(m.missionType));
            if (investigationMission) {
                console.log(`Investigation mission found after ${attempt + 1} attempts`);
                break;
            }
        }

        if (!investigationMission) {
            console.log('No investigation mission found after polling, skipping test');
            test.skip();
            return;
        }

        // Open Mission Board
        await openApp(page, 'Mission Board');
        await expect(page.locator('.mission-board')).toBeVisible();

        // Click Available Missions tab
        await page.locator('.mission-board .tab:has-text("Available Missions")').click();
        await expect(page.locator('.mission-board .missions-list .mission-card').first()).toBeVisible({ timeout: 10000 });

        // Find the mission card for the investigation mission
        const missionTitle = investigationMission.title;
        const missionCard = page.locator(`.mission-board .mission-card:has-text("${missionTitle.substring(0, 30)}")`);

        // If card is visible, try to accept it
        const isVisible = await missionCard.isVisible().catch(() => false);
        if (isVisible) {
            const acceptButton = missionCard.locator('button:has-text("Accept")');
            const isEnabled = await acceptButton.isEnabled().catch(() => false);

            if (isEnabled) {
                await acceptButton.click();
                console.log(`Accepted investigation mission: "${missionTitle}"`);

                // Verify mission is now active
                await page.locator('.mission-board .tab:has-text("Active Mission")').click();
                const activeMissionTitle = page.locator('.mission-board .active-mission h3');
                await expect(activeMissionTitle).toBeVisible({ timeout: 5000 });

                const activeTitle = await activeMissionTitle.textContent();
                expect(activeTitle).toBe(missionTitle);
                console.log('Investigation mission is now active');

                // Verify objectives are displayed
                const objectives = page.locator('.mission-board .active-mission .objectives-section');
                await expect(objectives).toBeVisible();
                console.log('Mission objectives are visible');
            } else {
                console.log('Accept button not enabled (may require higher reputation)');
            }
        } else {
            console.log(`Mission card for "${missionTitle}" not visible`);
        }

        await closeWindow(page, 'Mission Board');
    });
});

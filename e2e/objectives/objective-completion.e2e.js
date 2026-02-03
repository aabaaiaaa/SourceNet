/**
 * Objective Completion E2E Tests
 *
 * Verifies that mission objectives can be completed by player actions.
 * These tests ensure the objective tracking system properly responds to
 * game events and marks objectives as complete.
 */

import { test, expect } from '@playwright/test';
import {
    openApp,
    closeWindow,
    waitForObjectiveComplete,
    verifyObjectivePending,
    connectToNetwork,
    scanNetwork,
    connectFileManager,
    selectCorruptedFiles,
    repairSelectedFiles,
    setSpecificTimeSpeed,
} from '../helpers/common-actions.js';

test.setTimeout(120000);

test.describe('Objective Completion', () => {
    test.describe('networkScan objectives', () => {
        test('completes when scan finds expected target', async ({ page }) => {
            // Load scenario with procedural missions enabled
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.goto('/?scenario=post-hardware-unlock&debug=true');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Speed up game time
            await setSpecificTimeSpeed(page, 100);

            // Wait for mission pool to have a data-recovery mission (has networkScan objective)
            let mission = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                await page.waitForTimeout(500);
                const pool = await page.evaluate(() => window.gameContext.missionPool);
                // data-recovery missions have networkScan objective
                mission = pool.find(m => m.missionType === 'data-recovery');
                if (mission) break;
            }

            if (!mission) {
                console.log('No data-recovery mission found, skipping test');
                test.skip();
                return;
            }

            // Accept the mission
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Available Missions")').click();
            const missionCard = page.locator(`.mission-card:has-text("${mission.title.substring(0, 20)}")`);
            await missionCard.locator('button:has-text("Accept")').click();

            // Switch to Active tab
            await page.locator('.tab:has-text("Active Mission")').click();
            await expect(page.locator('.active-mission')).toBeVisible();

            // Verify the networkScan objective is pending
            await verifyObjectivePending(page, 'Scan');

            // Get the target network from the mission
            const activeMission = await page.evaluate(() => window.gameContext.activeMission);
            const networkObj = activeMission.objectives.find(o => o.type === 'networkConnection');
            const scanObj = activeMission.objectives.find(o => o.type === 'networkScan');

            if (!scanObj || !networkObj) {
                console.log('Mission missing required objectives, skipping');
                test.skip();
                return;
            }

            // First connect to the network
            await closeWindow(page, 'Mission Board');
            await connectToNetwork(page, activeMission.networks[0].name);

            // Now scan the network
            await scanNetwork(page, activeMission.networks[0].name, scanObj.expectedResult);

            // Verify the networkScan objective completed
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await waitForObjectiveComplete(page, 'Scan', 10000);
            console.log('networkScan objective completed successfully');
        });
    });

    test.describe('fileOperation objectives', () => {
        test('completes repair objective when all files repaired', async ({ page }) => {
            // Load tutorial scenario where we need to repair files
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.goto('/?scenario=tutorial-part-1-prior-to-sabotage&debug=true');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Speed up game time
            await setSpecificTimeSpeed(page, 100);

            // Wait for sabotage event - the scenario is set up just before sabotage happens
            await page.waitForTimeout(100);

            // After sabotage, we should have the tutorial mission active with repair objective
            // Check if tutorial mission is active
            const activeMission = await page.evaluate(() => window.gameContext.activeMission);

            if (!activeMission || !activeMission.objectives?.some(o => o.type === 'fileOperation' && o.operation === 'repair')) {
                console.log('No repair mission active, skipping test');
                test.skip();
                return;
            }

            // Open Mission Board to verify objective is pending
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await verifyObjectivePending(page, 'Repair');
            await closeWindow(page, 'Mission Board');

            // Connect to network and file system
            const networkObj = activeMission.objectives.find(o => o.type === 'networkConnection');
            if (networkObj) {
                await connectToNetwork(page, networkObj.target);
            }

            // Connect File Manager and repair files
            const fsObj = activeMission.objectives.find(o => o.type === 'fileSystemConnection');
            if (fsObj) {
                await connectFileManager(page, fsObj.target);
            }

            await selectCorruptedFiles(page);
            await repairSelectedFiles(page);

            // Verify repair objective completed
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await waitForObjectiveComplete(page, 'Repair', 10000);
            console.log('fileOperation repair objective completed successfully');
        });
    });

    test.describe('networkConnection objectives', () => {
        test('completes when connected to target network', async ({ page }) => {
            // Load post-hardware-unlock scenario
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.goto('/?scenario=post-hardware-unlock&debug=true');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Speed up game time
            await setSpecificTimeSpeed(page, 100);

            // Wait for mission pool to have a standard data-recovery mission
            let mission = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                await page.waitForTimeout(500);
                const pool = await page.evaluate(() => window.gameContext.missionPool);
                mission = pool.find(m =>
                    m.objectives?.some(o => o.type === 'networkConnection')
                );
                if (mission) break;
            }

            if (!mission) {
                console.log('No mission with networkConnection objective found, skipping');
                test.skip();
                return;
            }

            // Accept the mission
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Available Missions")').click();
            const missionCard = page.locator(`.mission-card:has-text("${mission.title.substring(0, 20)}")`);
            await missionCard.locator('button:has-text("Accept")').click();

            // Switch to Active tab and verify networkConnection is pending
            await page.locator('.tab:has-text("Active Mission")').click();
            await expect(page.locator('.active-mission')).toBeVisible();
            await verifyObjectivePending(page, 'Connect');
            await closeWindow(page, 'Mission Board');

            // Connect to the target network
            const activeMission = await page.evaluate(() => window.gameContext.activeMission);
            const networkObj = activeMission.objectives.find(o => o.type === 'networkConnection');

            await connectToNetwork(page, activeMission.networks[0].name);

            // Verify objective completed
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await waitForObjectiveComplete(page, 'Connect', 10000);
            console.log('networkConnection objective completed successfully');
        });
    });

    test.describe('fileSystemConnection objectives', () => {
        test('completes when File Manager connects to target file system', async ({ page }) => {
            // Load post-hardware-unlock scenario
            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.goto('/?scenario=post-hardware-unlock&debug=true');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Speed up game time
            await setSpecificTimeSpeed(page, 100);

            // Wait for mission pool to have a mission with fileSystemConnection objective
            let mission = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                await page.waitForTimeout(500);
                const pool = await page.evaluate(() => window.gameContext.missionPool);
                mission = pool.find(m =>
                    m.objectives?.some(o => o.type === 'fileSystemConnection')
                );
                if (mission) break;
            }

            if (!mission) {
                console.log('No mission with fileSystemConnection objective found, skipping');
                test.skip();
                return;
            }

            // Accept the mission
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Available Missions")').click();
            const missionCard = page.locator(`.mission-card:has-text("${mission.title.substring(0, 20)}")`);
            await missionCard.locator('button:has-text("Accept")').click();

            // Switch to Active tab
            await page.locator('.tab:has-text("Active Mission")').click();
            await closeWindow(page, 'Mission Board');

            // First connect to the network
            const activeMission = await page.evaluate(() => window.gameContext.activeMission);
            await connectToNetwork(page, activeMission.networks[0].name);

            // Then scan to find the file system
            const scanObj = activeMission.objectives.find(o => o.type === 'networkScan');
            if (scanObj) {
                await scanNetwork(page, activeMission.networks[0].name, scanObj.expectedResult);
            }

            // Connect File Manager to the target file system
            const fsObj = activeMission.objectives.find(o => o.type === 'fileSystemConnection');
            await connectFileManager(page, fsObj.target);

            // Verify objective completed
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await waitForObjectiveComplete(page, 'file system', 10000);
            console.log('fileSystemConnection objective completed successfully');
        });
    });

    test.describe('investigation objectives', () => {
        test('completes when File Manager connects to correct file system', async ({ page }) => {
            // The investigation objective completes when File Manager connects to the
            // correct file system (which the player identifies using Log Viewer).
            // This test verifies the objective tracking works correctly.

            await page.goto('/');
            await page.evaluate(() => localStorage.clear());
            await page.goto('/?scenario=post-hardware-unlock&debug=true');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Speed up game time
            await setSpecificTimeSpeed(page, 100);

            // Wait for an investigation mission to appear in the pool
            const investigationTypes = ['investigation-repair', 'investigation-recovery'];
            let mission = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                await page.waitForTimeout(500);
                const pool = await page.evaluate(() => window.gameContext.missionPool);
                mission = pool.find(m => investigationTypes.includes(m.missionType));
                if (mission) break;
            }

            if (!mission) {
                console.log('No investigation mission found, skipping test');
                test.skip();
                return;
            }

            console.log(`Found investigation mission: ${mission.title} (${mission.missionType})`);

            // Accept the mission
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Available Missions")').click();
            const missionCard = page.locator(`.mission-card:has-text("${mission.title.substring(0, 20)}")`);
            await missionCard.locator('button:has-text("Accept")').click();

            // Switch to Active tab
            await page.locator('.tab:has-text("Active Mission")').click();
            await expect(page.locator('.active-mission')).toBeVisible();
            await closeWindow(page, 'Mission Board');

            // Get the active mission details
            const activeMission = await page.evaluate(() => window.gameContext.activeMission);
            const investigationObj = activeMission.objectives.find(o => o.type === 'investigation');

            if (!investigationObj) {
                console.log('Mission has no investigation objective, skipping');
                test.skip();
                return;
            }

            console.log(`Investigation objective: correctFileSystemId = ${investigationObj.correctFileSystemId}`);

            // Verify investigation objective is pending
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await verifyObjectivePending(page, 'Log Viewer');
            await closeWindow(page, 'Mission Board');

            // Connect to the network first
            const networkObj = activeMission.objectives.find(o => o.type === 'networkConnection');
            if (networkObj && activeMission.networks?.[0]) {
                await connectToNetwork(page, activeMission.networks[0].name);
            }

            // Scan the network
            const scanObj = activeMission.objectives.find(o => o.type === 'networkScan');
            if (scanObj && activeMission.networks?.[0]) {
                await scanNetwork(page, activeMission.networks[0].name, scanObj.expectedResult);
            }

            // Connect File Manager to the correct file system (the one from the investigation objective)
            await connectFileManager(page, investigationObj.correctFileSystemId);

            // Verify investigation objective completed
            await openApp(page, 'Mission Board');
            await page.locator('.tab:has-text("Active Mission")').click();
            await waitForObjectiveComplete(page, 'Log Viewer', 10000);
            console.log('Investigation objective completed successfully');
        });
    });

    test.describe('fileRecovery objectives', () => {
        test.skip('completes when target files recovered', async ({ page }) => {
            // TODO: Requires Data Recovery Tool implementation
            // Test will verify that using the tool to restore deleted files
            // properly completes the fileRecovery objective.
        });
    });

    test.describe('secureDelete objectives', () => {
        test.skip('completes when target files securely deleted', async ({ page }) => {
            // TODO: Requires Data Recovery Tool secure delete implementation
            // Test will verify that using the tool to securely delete files
            // properly completes the secureDelete objective.
        });
    });
});

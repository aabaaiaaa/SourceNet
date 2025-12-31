import { test, expect } from '@playwright/test';
import { completeBoot, openMail, readMessage } from './helpers/common-actions.js';
import { createSaveWithCheque } from './helpers/test-data.js';

/**
 * Banking & Cheque Flow E2E Tests
 * Tests for banking app, cheque deposits, and account management
 * Merged from: cheque-manual-deposit.spec.js, cheque-status-update.spec.js
 */

test.describe('Banking & Cheque Flow', () => {

    test.describe('Cheque Deposit Manual Flow', () => {
        test('should only show deposit prompt when user clicks attachment, not auto-deposit', async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            // Complete boot
            await completeBoot(page, 'cheque_test');

            // Wait for first message
            await page.waitForTimeout(4000);

            // Open Mail and read first message (triggers second message)
            await openMail(page);
            await readMessage(page, 'Welcome to SourceNet!');
            await page.click('button:has-text("Back")');

            // Wait for second message to arrive
            await page.waitForTimeout(4000);
            await expect(page.locator('.message-item:has-text("Hi from your manager")')).toBeVisible();

            // Close Mail
            await page.click('.window:has-text("SNet Mail") button[title="Close"]');

            // CRITICAL TEST: Open Banking app BEFORE clicking cheque attachment
            await page.click('text=☰');
            await page.click('text=SNet Banking App');
            await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();

            // Banking should show accounts but NO deposit prompt (cheque not clicked yet)
            await expect(page.locator('.accounts-list')).toBeVisible();
            await expect(page.locator('.bank-name')).toBeVisible();

            // CRITICAL: Deposit prompt should NOT be visible
            await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();

            // Close Banking
            await page.click('.window:has-text("SNet Banking") button[title="Close"]');

            // NOW open Mail again and click the cheque attachment
            await openMail(page);

            // Click second message to view it
            await readMessage(page, 'Hi from your manager');

            // Click cheque attachment
            await page.click('.attachment-item');

            // NOW Banking should open with deposit prompt
            await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();
            await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();
            await expect(page.locator('text=1,000 credits')).toBeVisible();

            // Test Cancel button
            await page.click('.cancel-deposit-btn');
            await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();

            // Click attachment again to retry
            await page.click('.window:has-text("SNet Mail") .window-header');
            await page.click('.attachment-item');

            // Deposit prompt should appear again
            await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

            // Select account and deposit
            await page.click('.account-select-btn');

            // Prompt should disappear and credits should update
            await expect(page.locator('.cheque-deposit-prompt')).not.toBeVisible();

            console.log('✅ Manual cheque deposit flow verified');
        });
    });

    test.describe('Cheque Status Updates', () => {
        test('should update attachment status to deposited when cheque is deposited', async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            // Complete boot
            await completeBoot(page, 'cheque_status_test');

            // Wait for first message and read it
            await page.waitForTimeout(4000);
            await openMail(page);
            await page.click('.message-item:has-text("Welcome")');
            await page.click('button:has-text("Back")');

            // Wait for second message with cheque
            await page.waitForTimeout(4000);
            await readMessage(page, 'Hi from your manager');

            // Verify attachment shows "Click to deposit"
            await expect(page.locator('.attachment-status:has-text("Click to deposit")')).toBeVisible();

            // Click attachment to initiate deposit
            await page.click('.attachment-item');

            // Banking opens with deposit prompt
            await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

            // Select account and deposit
            await page.click('.account-select-btn');

            // Wait for deposit to complete
            await page.waitForTimeout(500);

            // CRITICAL: Go back to Mail window (it should still be open)
            await page.click('.window:has-text("SNet Mail") .window-header');

            // Verify attachment now shows "✓ Deposited" instead of "Click to deposit"
            await expect(page.locator('.attachment-status:has-text("✓ Deposited")')).toBeVisible();
            await expect(page.locator('.attachment-status:has-text("Click to deposit")')).not.toBeVisible();

            // Verify attachment has deposited styling (grayed out)
            const attachment = page.locator('.attachment-item.deposited');
            await expect(attachment).toBeVisible();

            console.log('✅ Cheque status update verified');
        });

        test('should persist deposited status after save/load', async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate(() => localStorage.clear());
            await page.reload();

            // Complete boot
            await completeBoot(page, 'persist_test');

            // Wait for messages
            await page.waitForTimeout(4000);
            await openMail(page);
            await page.click('.message-item:has-text("Welcome")');
            await page.click('button:has-text("Back")');

            await page.waitForTimeout(4000);
            await readMessage(page, 'Hi from your manager');

            // Deposit the cheque
            await page.click('.attachment-item');
            await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();
            await page.click('.account-select-btn');
            await page.waitForTimeout(500);

            // Save the game - handle both dialogs in sequence
            let promptHandled = false;
            page.on('dialog', async dialog => {
                if (!promptHandled) {
                    // First dialog is the prompt for save name
                    expect(dialog.type()).toBe('prompt');
                    await dialog.accept('test_save');
                    promptHandled = true;
                } else {
                    // Second dialog is the alert confirmation
                    expect(dialog.message()).toBe('Game saved!');
                    await dialog.accept();
                }
            });

            await page.click('text=⏻');
            await page.click('button:has-text("Save")');
            await page.waitForTimeout(1000);

            // Reload and load the save
            await page.goto('/?skipBoot=true');
            await expect(page.locator('.game-login-screen')).toBeVisible({ timeout: 20000 });
            await page.locator('text=persist_test').locator('..').locator('button:has-text("Load")').click();
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 5000 });

            // Open mail and verify cheque is still marked as deposited
            await openMail(page);
            await readMessage(page, 'Hi from your manager');

            // Verify attachment shows deposited status
            await expect(page.locator('.attachment-status:has-text("✓ Deposited")')).toBeVisible();
            await expect(page.locator('.attachment-item.deposited')).toBeVisible();

            console.log('✅ Cheque deposited status persists across save/load');
        });
    });

    test.describe('Banking App Functionality', () => {
        test('should display account information correctly', async ({ page }) => {
            await page.goto('/?skipBoot=true');
            await page.evaluate((saveData) => {
                localStorage.clear();
                const saves = { banking_test: [saveData] };
                localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
            }, createSaveWithCheque('banking_test', 5000, {
                bankAccounts: [
                    { id: 'acc-1', bankName: 'Current Account', balance: 2500 },
                    { id: 'acc-2', bankName: 'Savings Account', balance: 10000 },
                ],
            }));

            await page.reload();

            // Load game
            await page.click('button:has-text("Load")');
            await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

            // Open Banking app
            await page.click('text=☰');
            await page.click('text=SNet Banking App');
            await expect(page.locator('.window:has-text("SNet Banking")')).toBeVisible();

            // Verify accounts are displayed
            const bankingWindow = page.locator('.window:has-text("SNet Banking")');
            await expect(bankingWindow.locator('text=Current Account')).toBeVisible();
            await expect(bankingWindow.locator('text=Savings Account')).toBeVisible();

            // Verify balances are displayed
            await expect(bankingWindow).toContainText('2500 credits');
            await expect(bankingWindow).toContainText('10000 credits');

            console.log('✅ Banking app displays account information correctly');
        });
    });
});

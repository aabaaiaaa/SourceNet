import { test, expect } from '@playwright/test';

test.describe('All Apps Text Visibility', () => {
  test('should display all text visibly in all apps', async ({ page }) => {
    // Setup game with messages
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      const saves = {
        visibility_full_test: [{
          username: 'visibility_full_test',
          playerMailId: 'SNET-ALL-123-456',
          currentTime: '2020-03-25T09:00:00',
          hardware: {
            cpu: { id: 'cpu-1ghz', name: '1GHz CPU' },
            memory: [{ id: 'ram-2gb', name: '2GB RAM' }],
            storage: [{ id: 'ssd-90gb', name: '90GB SSD' }],
            motherboard: { id: 'board-basic', name: 'Basic Board' },
            powerSupply: { id: 'psu-300w', wattage: 300 },
            network: { id: 'net-250mb', speed: 250 },
          },
          software: [],
          bankAccounts: [
            { id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 },
            { id: 'acc-2', bankName: 'Second Bank Corp', balance: 2500 }
          ],
          messages: [
            {
              id: 'msg-1',
              from: 'Test Sender',
              fromId: 'SNET-TST-001-XXX',
              subject: 'First Test Message',
              body: 'This is the first test message body.',
              timestamp: '2020-03-25T09:05:00',
              read: true,
              archived: false,
            },
            {
              id: 'msg-2',
              from: 'Manager Name',
              fromId: 'SNET-MGR-002-YYY',
              subject: 'Second Test Message with Attachment',
              body: 'This message has a cheque attachment.',
              timestamp: '2020-03-25T09:10:00',
              read: false,
              archived: false,
              attachment: {
                amount: 1000,
                deposited: false
              }
            }
          ],
          managerName: 'TestManager',
          windows: [],
          savedAt: new Date().toISOString(),
        }]
      };
      localStorage.setItem('sourcenet_saves', JSON.stringify(saves));
    });

    await page.reload();

    // Load game
    await page.click('button:has-text("Load")');
    await expect(page.locator('.boot-screen')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('.desktop')).toBeVisible({ timeout: 15000 });

    // === Test 1: SNet Mail App ===
    console.log('Testing SNet Mail...');
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    const mailWindow = page.locator('.window:has-text("SNet Mail")');
    await expect(mailWindow).toBeVisible();

    // Screenshot: Mail inbox view
    await page.screenshot({ path: 'game/test-results/screenshot-mail-inbox.png', fullPage: true });
    console.log('Screenshot saved: mail inbox');

    // Verify message list text is visible
    const message1Subject = page.locator('.message-subject:has-text("First Test Message")');
    await expect(message1Subject).toBeVisible();
    const msg1Text = await message1Subject.textContent();
    expect(msg1Text).toBe('First Test Message');

    const message2Subject = page.locator('.message-subject:has-text("Second Test Message")');
    await expect(message2Subject).toBeVisible();
    const msg2Text = await message2Subject.textContent();
    expect(msg2Text).toContain('Second Test Message');

    // Verify sender names visible
    await expect(page.locator('strong:has-text("Test Sender")')).toBeVisible();
    await expect(page.locator('strong:has-text("Manager Name")')).toBeVisible();

    // Verify dates visible
    const dates = await page.locator('.message-date').all();
    for (const date of dates) {
      const dateText = await date.textContent();
      expect(dateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }

    // Click message with attachment to test attachment text visibility
    await page.click('.message-item:has-text("Second Test Message")');
    await expect(page.locator('.message-view')).toBeVisible();

    // Screenshot: Message with attachment
    await page.screenshot({ path: 'game/test-results/screenshot-attachment.png', fullPage: true });
    console.log('Screenshot saved: attachment view');

    // CRITICAL: Verify ALL attachment text is visible
    await expect(page.locator('.attachment-header:has-text("Attachment:")')).toBeVisible();

    const attachmentName = page.locator('.attachment-name');
    await expect(attachmentName).toBeVisible();
    const attachNameText = await attachmentName.textContent();
    console.log('Attachment name text:', attachNameText);
    expect(attachNameText).toContain('Digital Cheque');
    expect(attachNameText).toContain('1000 credits');

    const attachmentStatus = page.locator('.attachment-status');
    await expect(attachmentStatus).toBeVisible();
    const statusText = await attachmentStatus.textContent();
    console.log('Attachment status text:', statusText);
    expect(statusText).toBe('Click to deposit');

    // Click attachment to test Banking deposit prompt text
    await page.click('.attachment-item');

    // Banking should open with deposit prompt
    await expect(page.locator('.cheque-deposit-prompt')).toBeVisible();

    // Screenshot: Banking deposit prompt
    await page.screenshot({ path: 'game/test-results/screenshot-deposit-prompt.png', fullPage: true });
    console.log('Screenshot saved: deposit prompt');

    // CRITICAL: Verify all deposit prompt text visible
    await expect(page.locator('.prompt-header:has-text("💰 Cheque Deposit")')).toBeVisible();

    const promptText1 = page.locator('text=You have a cheque for 1000 credits');
    await expect(promptText1).toBeVisible();
    const text1 = await promptText1.textContent();
    console.log('Deposit prompt text:', text1);

    const promptText2 = page.locator('text=Select an account to deposit into');
    await expect(promptText2).toBeVisible();

    // Verify account selection buttons have visible text
    const accountBtn = page.locator('.account-select-btn').first();
    await expect(accountBtn).toBeVisible();

    const accountName = accountBtn.locator('.account-name');
    await expect(accountName).toBeVisible();
    const accNameText = await accountName.textContent();
    console.log('Account name in deposit:', accNameText);
    expect(accNameText).toBeTruthy();

    const accountBalance = accountBtn.locator('.account-balance');
    await expect(accountBalance).toBeVisible();
    const accBalText = await accountBalance.textContent();
    console.log('Account balance in deposit:', accBalText);
    expect(accBalText).toContain('Current');

    // Cancel deposit and close windows
    await page.click('.window:has-text("SNet Mail") button[title="Close"]');

    // === Test 2: Banking App ===
    console.log('Testing Banking App...');
    await page.click('text=☰');
    await page.click('text=SNet Banking App');
    const bankWindow = page.locator('.window:has-text("SNet Banking")');
    await expect(bankWindow).toBeVisible();

    // Screenshot: Banking app
    await page.screenshot({ path: 'game/test-results/screenshot-banking.png', fullPage: true });
    console.log('Screenshot saved: banking');

    // Verify account names visible
    await expect(page.locator('.bank-name:has-text("First Bank Ltd")')).toBeVisible();
    await expect(page.locator('.bank-name:has-text("Second Bank Corp")')).toBeVisible();

    // Verify balances visible
    await expect(page.locator('.account-balance-large:has-text("1000")')).toBeVisible();
    await expect(page.locator('.account-balance-large:has-text("2500")')).toBeVisible();

    // Verify total visible
    await expect(page.locator('text=Total across all accounts: 3500 credits')).toBeVisible();

    // Close Banking
    await page.click('.window:has-text("SNet Banking") button[title="Close"]');

    // === Test 3: Portal App ===
    console.log('Testing Portal...');
    await page.click('text=☰');
    await page.click('text=OSNet Portal');
    const portalWindow = page.locator('.window:has-text("OSNet Portal")');
    await expect(portalWindow).toBeVisible();

    // Screenshot: Portal
    await page.screenshot({ path: 'game/test-results/screenshot-portal.png', fullPage: true });
    console.log('Screenshot saved: portal');

    // Verify section buttons visible with text
    await expect(page.locator('button:has-text("Hardware")')).toBeVisible();
    await expect(page.locator('button:has-text("Software")')).toBeVisible();

    // Check all category buttons
    await expect(page.locator('button:has-text("Processors")')).toBeVisible();
    await expect(page.locator('button:has-text("Memory")')).toBeVisible();
    await expect(page.locator('button:has-text("Storage")')).toBeVisible();
    await expect(page.locator('button:has-text("Motherboards")')).toBeVisible();

    // Verify first item has all text visible
    const firstItem = page.locator('.portal-item').first();
    await expect(firstItem).toBeVisible();

    const itemName = firstItem.locator('.item-name');
    await expect(itemName).toBeVisible();
    const nameText = await itemName.textContent();
    console.log('Portal item name:', nameText);
    expect(nameText).toBeTruthy();

    const itemSpecs = firstItem.locator('.item-specs');
    await expect(itemSpecs).toBeVisible();
    const specsText = await itemSpecs.textContent();
    console.log('Portal item specs:', specsText);
    expect(specsText).toBeTruthy();

    const itemPrice = firstItem.locator('.item-price');
    await expect(itemPrice).toBeVisible();
    const priceText = await itemPrice.textContent();
    console.log('Portal item price:', priceText);
    expect(priceText).toMatch(/\$/);

    // Check for installed badge
    const badge = firstItem.locator('.installed-badge, .unavailable-badge');
    if (await badge.count() > 0) {
      await expect(badge.first()).toBeVisible();
      const badgeText = await badge.first().textContent();
      console.log('Portal badge text:', badgeText);
      expect(badgeText).toBeTruthy();
    }

    console.log('✅ All Apps Text Visibility - PASS');
  });
});

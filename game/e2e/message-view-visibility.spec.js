import { test, expect } from '@playwright/test';

test.describe('Message View Text Visibility', () => {
  test('should display all message details with readable text', async ({ page }) => {
    // Setup game with messages
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      const saves = {
        visibility_test: [{
          username: 'visibility_test',
          playerMailId: 'SNET-VIS-123-456',
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
          bankAccounts: [{ id: 'acc-1', bankName: 'First Bank Ltd', balance: 1000 }],
          messages: [
            {
              id: 'msg-1',
              from: 'Test Sender Name',
              fromId: 'SNET-TST-001-XXX',
              subject: 'Test Subject Line',
              body: 'This is the test message body text.',
              timestamp: '2020-03-25T09:05:00',
              read: false,
              archived: false,
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

    // Open Mail
    await page.click('text=☰');
    await page.click('text=SNet Mail');
    await expect(page.locator('.window:has-text("SNet Mail")')).toBeVisible();

    // Click message to view details
    await page.click('.message-item:has-text("Test Subject Line")');
    await expect(page.locator('.message-view')).toBeVisible();

    // CRITICAL: Verify all detail values are visible and have text
    const fromValue = page.locator('.detail-row:has-text("From:") span').last();
    await expect(fromValue).toBeVisible();
    const fromText = await fromValue.textContent();
    console.log('From text:', fromText);
    expect(fromText).toContain('Test Sender Name');
    expect(fromText).toContain('SNET-TST-001-XXX');

    const subjectValue = page.locator('.detail-row:has-text("Subject:") span').last();
    await expect(subjectValue).toBeVisible();
    const subjectText = await subjectValue.textContent();
    console.log('Subject text:', subjectText);
    expect(subjectText).toBe('Test Subject Line');

    const dateValue = page.locator('.detail-row:has-text("Date:") span').last();
    await expect(dateValue).toBeVisible();
    const dateText = await dateValue.textContent();
    console.log('Date text:', dateText);
    expect(dateText).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // Verify message body is visible
    const messageBody = page.locator('.message-body pre');
    await expect(messageBody).toBeVisible();
    const bodyText = await messageBody.textContent();
    console.log('Body text:', bodyText);
    expect(bodyText).toBe('This is the test message body text.');

    console.log('✅ Message View Visibility - PASS');
  });
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.js$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // 1 retry locally for flaky tests under parallel load
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }]
  ],
  timeout: 60000, // 60 second timeout for E2E tests
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'generators',
      testDir: './e2e/generators',
      fullyParallel: false, // Generators must run sequentially (they depend on each other)
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testDir: './e2e',
      testIgnore: /generators\//,  // Exclude generators from main project
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  },
});

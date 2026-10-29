import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: '/api' },
  },
});

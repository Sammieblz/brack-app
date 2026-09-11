import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'shell-scroll*.spec.ts',
  timeout: 45_000,
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:8082', trace: 'retain-on-failure', screenshot: 'off' },
  webServer: {
    command: 'npx vite --config tests/fixtures/shell-scroll/vite.config.ts',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

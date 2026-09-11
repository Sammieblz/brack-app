import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'loading-layout.spec.ts',
  timeout: 45_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: 'test-results/loading-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8084',
    serviceWorkers: 'block',
    trace: { mode: 'retain-on-failure', screenshots: false },
    screenshot: 'off',
  },
  webServer: {
    command: 'npx vite --config tests/fixtures/loading/vite.config.ts',
    url: 'http://127.0.0.1:8084',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

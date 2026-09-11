import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'shell-scroll*.spec.ts',
  timeout: 45_000,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:8082',
    serviceWorkers: 'block',
    trace: { mode: 'retain-on-failure', screenshots: false },
    screenshot: 'off',
  },
  webServer: {
    command: 'npx vite --config tests/fixtures/shell-scroll/vite.config.ts',
    cwd: repositoryRoot,
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

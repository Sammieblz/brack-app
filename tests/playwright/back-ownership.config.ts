import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '../e2e', testMatch: 'back-ownership.spec.ts', timeout: 45_000, fullyParallel: true, workers: 2,
  outputDir: '../../test-results/back-ownership',
  reporter: [['list'], ['json', { outputFile: 'test-results/back-ownership-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:8091', serviceWorkers: 'block', reducedMotion: 'reduce',
    trace: { mode: 'retain-on-failure', screenshots: false }, screenshot: 'off' },
  webServer: { command: 'npx vite --config tests/fixtures/back-ownership/vite.config.ts',
    cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:8091', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

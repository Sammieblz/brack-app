import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '../e2e', testMatch: ['ionic-fit.spec.ts', 'ionic-navigation.spec.ts'], timeout: 45_000,
  fullyParallel: true, workers: 2, outputDir: '../../test-results/ionic-fit',
  reporter: [['list'], ['json', { outputFile: 'test-results/ionic-fit-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:8090', serviceWorkers: 'block', reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 }, trace: { mode: 'retain-on-failure', screenshots: true }, screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/ionic-fit/vite.config.ts',
    cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:8090', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

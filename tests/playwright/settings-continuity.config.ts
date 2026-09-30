import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  testDir: '../e2e', testMatch: 'settings-continuity.spec.ts', timeout: 60_000, fullyParallel: false, workers: 1,
  outputDir: '../../test-results/cr03-settings-continuity',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/cr03-settings-continuity-summary.json', import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8096', actionTimeout: 15_000, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/settings-continuity/vite.config.ts', cwd: root,
    url: 'http://127.0.0.1:8096', reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
});

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  testDir: '../e2e', testMatch: 'library-tasks.spec.ts', timeout: 60_000, fullyParallel: false, workers: 1,
  outputDir: '../../test-results/cr04-library-tasks',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/cr04-library-tasks-summary.json', import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8097', actionTimeout: 15_000, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/library-tasks/vite.config.ts', cwd: root, url: 'http://127.0.0.1:8097', reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
});

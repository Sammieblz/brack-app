import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  testDir: '../e2e', testMatch: 'adaptive-shell.spec.ts', timeout: 45_000, fullyParallel: false, workers: 1,
  outputDir: '../../test-results/f09-adaptive-shell',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/f09-adaptive-shell-summary.json', import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8093', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/adaptive-shell/vite.config.ts', cwd: repositoryRoot,
    url: 'http://127.0.0.1:8093', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

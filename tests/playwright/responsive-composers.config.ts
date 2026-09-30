import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
export default defineConfig({
  testDir: '../e2e', testMatch: 'responsive-composers.spec.ts', timeout: 60_000, fullyParallel: false, workers: 1,
  outputDir: '../../test-results/cr02-responsive-composers',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../test-results/cr02-responsive-composers-summary.json', import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8095', actionTimeout: 15_000, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/responsive-composers/vite.config.ts', cwd: repositoryRoot,
    url: 'http://127.0.0.1:8095', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

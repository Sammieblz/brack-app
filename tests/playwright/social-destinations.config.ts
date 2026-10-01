import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const run = process.env.CR06_RUN ?? 'cr06-destinations';
export default defineConfig({
  testDir: '../e2e', testMatch: 'social-destinations.spec.ts', timeout: 45_000, fullyParallel: false, workers: 1,
  outputDir: `../../test-results/${run}`,
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL(`../../test-results/${run}-summary.json`, import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8099', serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/social-destinations/vite.config.ts', cwd: repositoryRoot,
    url: 'http://127.0.0.1:8099', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

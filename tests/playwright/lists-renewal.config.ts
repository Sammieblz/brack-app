import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const run = process.env.F10B_RUN ?? 'f10b-lists';
export default defineConfig({
  testDir: '../e2e', testMatch: 'lists-renewal.spec.ts', timeout: 60_000, workers: 1,
  outputDir: `../../test-results/${run}`,
  reporter: [['line'], ['json', { outputFile: `${root}/test-results/${run}-summary.json` }]],
  use: { baseURL: 'http://127.0.0.1:8102', actionTimeout: 15_000, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/library-tasks/lists-renewal.config.ts', cwd: root, url: 'http://127.0.0.1:8102', reuseExistingServer: false, timeout: 120_000 },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'webkit' | 'firefox' } })),
});

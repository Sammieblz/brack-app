import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const run = process.env.F11C_RUN ?? 'final';
export default defineConfig({
  testDir: '../e2e', testMatch: run.startsWith('baseline') ? 'reading-session-baseline.spec.ts' : /reading-session(?:-editor|-entries)?\.spec\.ts/, timeout: 60_000, fullyParallel: false, workers: 1,
  outputDir: `../../test-results/f11c-${run}`,
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL(`../../test-results/f11c-${run}.json`, import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:8106', actionTimeout: 12_000, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --config tests/fixtures/reading-session/vite.config.ts', cwd: root, url: 'http://127.0.0.1:8106', reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
});

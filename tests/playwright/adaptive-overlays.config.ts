import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '../e2e', testMatch: 'adaptive-overlays.spec.ts', timeout: 45_000, fullyParallel: true, workers: 2,
  outputDir: '../../test-results/adaptive-overlays',
  reporter: [['list'], ['json', { outputFile: 'test-results/adaptive-overlays-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:8092', serviceWorkers: 'block', reducedMotion: 'reduce',
    trace: { mode: 'retain-on-failure', screenshots: false }, screenshot: 'off' },
  webServer: { command: 'npx vite --config tests/fixtures/adaptive-overlays/vite.config.ts',
    cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:8092', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});

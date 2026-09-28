import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "../e2e", testMatch: "ui-environment.spec.ts", timeout: 30_000, fullyParallel: true, workers: 2,
  outputDir: "../../test-results-ui-environment/artifacts",
  reporter: [["list"], ["json", { outputFile: "../../test-results-ui-environment/report.json" }]],
  use: { baseURL: "http://127.0.0.1:8089", serviceWorkers: "block", reducedMotion: "reduce",
    trace: { mode: "retain-on-failure", screenshots: false }, screenshot: "off", viewport: { width: 390, height: 844 } },
  webServer: { command: "npx vite --config tests/fixtures/ui-environment/vite.config.ts",
    cwd: fileURLToPath(new URL("../..", import.meta.url)), url: "http://127.0.0.1:8089", reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
});

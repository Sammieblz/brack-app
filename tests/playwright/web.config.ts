import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  testDir: "../e2e",
  // Deterministic component suites have their own data-isolated Vite servers.
  testIgnore: ["shell-scroll*.spec.ts", "date-picker.spec.ts", "loading-layout.spec.ts", "library-interactions.spec.ts"],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm --workspace @brack/client run preview -- --host 127.0.0.1 --port 4173",
    cwd: repositoryRoot,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});

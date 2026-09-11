import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../electron",
  timeout: 60_000,
  workers: 1,
});

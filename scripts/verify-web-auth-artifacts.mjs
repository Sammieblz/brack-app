import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "apps", "client", "dist");

const manifest = JSON.parse(
  await readFile(path.join(distRoot, "manifest.webmanifest"), "utf8"),
);
const serviceWorker = await readFile(path.join(distRoot, "sw.js"), "utf8");
const compactServiceWorker = serviceWorker.replace(/\s+/g, "");

assert.equal(
  manifest.handle_links,
  "not-preferred",
  "The PWA manifest must ask browsers to leave ordinary web links in the browser.",
);
assert.equal(
  manifest.launch_handler?.client_mode,
  "navigate-existing",
  "The installed PWA must reuse its existing window when explicitly launched.",
);
assert.ok(
  compactServiceWorker.includes("denylist:[/^\\/auth"),
  "The service worker must exclude /auth navigations from its app-shell fallback.",
);
assert.ok(
  !serviceWorker.includes("env.VITE_SUPABASE_URL"),
  "The generated service worker contains an unresolved build-time env reference.",
);

console.log("Verified web Auth/PWA build artifacts.");

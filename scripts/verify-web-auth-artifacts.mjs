import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "apps", "client", "dist");

const manifest = JSON.parse(
  await readFile(path.join(distRoot, "manifest.webmanifest"), "utf8"),
);
const serviceWorker = await readFile(path.join(distRoot, "sw.js"), "utf8");
const turnstileBridge = await readFile(
  path.join(distRoot, "turnstile.html"),
  "utf8",
);
const pagesHeaders = await readFile(path.join(distRoot, "_headers"), "utf8");
const indexHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
const compactServiceWorker = serviceWorker.replace(/\s+/g, "");
const fileEnv = loadEnv("production", repoRoot, "");
const configuredSupabaseUrl = (
  process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL
)?.replace(/\/$/, "");

assert.ok(
  configuredSupabaseUrl,
  "VITE_SUPABASE_URL is required to verify the generated web artifacts.",
);
assert.ok(
  indexHtml.includes(`rel="preconnect" href="${configuredSupabaseUrl}"`) ||
    indexHtml.includes(`rel="preconnect" href="${configuredSupabaseUrl}/"`),
  "The generated HTML must preconnect to the Supabase origin selected for this build.",
);
assert.ok(
  !indexHtml.includes("%VITE_SUPABASE_URL%"),
  "The generated HTML contains an unresolved Supabase URL placeholder.",
);

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
assert.ok(
  !serviceWorker.includes("turnstile.html"),
  "The one-time Turnstile bridge must not be precached by the service worker.",
);
assert.match(
  turnstileBridge,
  /Brack security check/,
  "The dedicated Turnstile bridge was not emitted by the client build.",
);
assert.match(
  pagesHeaders,
  /\/turnstile\.html[\s\S]*Cache-Control: no-store/,
  "The Turnstile bridge must be served with a no-store policy.",
);
assert.match(
  pagesHeaders,
  /frame-ancestors http:\/\/localhost:8080 http:\/\/127\.0\.0\.1:8080 http:\/\/\[::1\]:8080 https:\/\/localhost capacitor:\/\/localhost brack-app:\/\/brack/,
  "The Turnstile bridge must restrict framing to explicit loopback and packaged Brack origins.",
);

console.log("Verified web Auth/PWA build artifacts.");

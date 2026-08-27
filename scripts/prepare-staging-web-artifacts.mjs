import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "apps", "client", "dist");
const indexPath = path.join(distRoot, "index.html");
const headersPath = path.join(distRoot, "_headers");
const robotsPath = path.join(distRoot, "robots.txt");
const stagingMarker = "# Brack staging crawl policy";
const stagingHeaderRule = [
  stagingMarker,
  "/*",
  "  X-Robots-Tag: noindex, nofollow, noarchive",
].join("\n");
const stagingRobots = "User-agent: *\nDisallow: /\n";

await readFile(indexPath, "utf8");
const originalHeaders = await readFile(headersPath, "utf8");
const stagedHeaders = originalHeaders.includes(stagingMarker)
  ? originalHeaders
  : `${originalHeaders.trimEnd()}\n\n${stagingHeaderRule}\n`;

await Promise.all([
  writeFile(headersPath, stagedHeaders, "utf8"),
  writeFile(robotsPath, stagingRobots, "utf8"),
]);

const [verifiedHeaders, verifiedRobots] = await Promise.all([
  readFile(headersPath, "utf8"),
  readFile(robotsPath, "utf8"),
]);

assert.match(
  verifiedHeaders,
  /# Brack staging crawl policy\s+\/\*\s+X-Robots-Tag: noindex, nofollow, noarchive/,
  "The staging bundle must send a global noindex response header.",
);
assert.equal(
  verifiedRobots,
  stagingRobots,
  "The staging bundle must disallow all search-engine crawling.",
);

console.log("Prepared non-indexable staging web artifacts.");

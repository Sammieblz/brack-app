import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = process.cwd();
const packagePath = path.join(repoRoot, "package.json");
const publicRoot = path.join(repoRoot, "apps", "client", "public");
const badgeRoot = path.join(publicRoot, "achievement-badges");
const dashboardArtwork = [
  "brack-streak/brack-streak-image-happy.webp",
  "brack-streak/brack-streak-image-sad.webp",
  "brack-trophy/brack-goals.webp",
  "brack-trophy/brack-trophy.webp",
];
const manifestPath = path.join(repoRoot, "assets", "media-assets-manifest.json");
const scriptPath = fileURLToPath(import.meta.url);
const checkOnly = process.argv.includes("--check");
const transparentBackground = { r: 0, g: 0, b: 0, alpha: 0 };
const manifestVersion = 2;

const brandAssets = [
  { name: "brack-mark.webp", width: 256, height: 256 },
  { name: "brack-wordmark.webp", width: 418, height: 123 },
];

const emptyStateIconNames = [
  "3dicons-boy-front-clay",
  "3dicons-chart-front-clay",
  "3dicons-chat-bubble-front-clay",
  "3dicons-chat-front-clay",
  "3dicons-chat-text-front-clay",
  "3dicons-file-front-clay",
  "3dicons-notebook-front-clay",
  "3dicons-pencil-front-clay",
  "3dicons-target-front-clay",
  "3dicons-tick-front-clay",
  "3dicons-wifi-front-clay",
];

const obsoleteFiles = [
  "apps/client/public/brack-logo.png",
  "apps/client/public/brack-icon-transparent-bg-dark.png",
  "apps/client/public/brack-icon-transparent-bg-dark.webp",
  "apps/client/public/brack-icon-transparent-bg-light.png",
  "apps/client/public/brack-icon-transparent-bg-light.webp",
  "apps/client/public/brack-logo-transparent-bg-dark-text.png",
  "apps/client/public/brack-logo-transparent-bg-dark-text.webp",
  "apps/client/public/brack-logo-transparent-bg-orange-text.png",
  "apps/client/public/brack-logo-transparent-bg-orange-text.webp",
  "apps/client/public/brack-logo-transparent-bg-white-text.png",
  "apps/client/public/brack-logo-transparent-bg-white-text.webp",
  "apps/client/public/brack-currency/gold_leaves.png",
  "apps/client/public/brack-currency/lifetime_ink.png",
  "apps/client/public/brack-favicon/favicon.svg",
  "apps/client/public/brack-favicon/site.webmanifest",
  "apps/client/public/brack-streak/brack-streak-image-happy.png",
  "apps/client/public/brack-streak/brack-streak-image-sad.png",
  "apps/client/public/brack-streak/brack-streak-image-happy-128.webp",
  "apps/client/public/brack-streak/brack-streak-image-happy-256.webp",
  "apps/client/public/brack-streak/brack-streak-image-sad-128.webp",
  "apps/client/public/brack-streak/brack-streak-image-sad-256.webp",
  "apps/client/public/brack-trophy/brack-goals.png",
  "apps/client/public/brack-trophy/brack-trophy.png",
  "apps/client/public/brack-trophy/brack-goals-128.webp",
  "apps/client/public/brack-trophy/brack-goals-256.webp",
  "apps/client/public/brack-trophy/brack-trophy-128.webp",
  "apps/client/public/brack-trophy/brack-trophy-256.webp",
  "apps/client/public/manifest.webmanifest",
  "apps/client/public/3dicons/3dicons-file-new-front-clay.png",
  "apps/client/public/3dicons/3dicons-file-new-front-clay.webp",
  "apps/client/public/3dicons/3dicons-plus-front-clay.png",
  "apps/client/public/3dicons/3dicons-plus-front-clay.webp",
  "apps/client/public/3dicons/3dicons-setting-front-clay.png",
  "apps/client/public/3dicons/3dicons-setting-front-clay.webp",
  "apps/client/public/3dicons/3dicons-shield-front-clay.png",
  "apps/client/public/3dicons/3dicons-shield-front-clay.webp",
  "assets/logo.png",
  "assets/logo-dark.png",
  "assets/icon-only.png",
  "assets/icon-foreground.png",
  "assets/icon-background.png",
  "resources/splash.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
];

const obsoleteDirectories = [
  "apps/client/public/icons",
  "apps/client/public/achievement-badges/detail",
  "apps/client/public/achievement-badges/thumb",
];
const requiredPublicPngs = new Set([
  "apps/client/public/brack-favicon/apple-touch-icon.png",
  "apps/client/public/brack-favicon/favicon-96x96.png",
  "apps/client/public/brack-favicon/web-app-manifest-192x192.png",
  "apps/client/public/brack-favicon/web-app-manifest-512x512.png",
]);

const mediaExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".icns",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".png",
  ".svg",
  ".webm",
  ".webp",
]);
const sharpExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const toRepoPath = (target) =>
  path.relative(repoRoot, target).split(path.sep).join("/");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256File = async (target) => sha256(await readFile(target));

const exists = async (target) => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const assertSafeRepoTarget = (target) => {
  const relative = path.relative(repoRoot, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify unsafe path: ${target}`);
  }
};

const ensureRepositoryRoot = async () => {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  if (packageJson.name !== "brack-monorepo") {
    throw new Error("Run the media pipeline from the Brack repository root.");
  }
};

const writeBufferIfChanged = async (target, value) => {
  assertSafeRepoTarget(target);
  await mkdir(path.dirname(target), { recursive: true });
  if (await exists(target)) {
    const current = await readFile(target);
    if (sha256(current) === sha256(value)) return false;
  }
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.tmp`,
  );
  await writeFile(temporary, value);
  try {
    await rm(target, { force: true });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};

const removeExactTarget = async (relativeTarget, directory = false) => {
  const target = path.join(repoRoot, ...relativeTarget.split("/"));
  assertSafeRepoTarget(target);
  if (checkOnly) {
    if (await exists(target)) {
      throw new Error(`Obsolete media is still present: ${relativeTarget}`);
    }
    return;
  }
  await rm(target, { force: true, recursive: directory });
};

const walkFiles = async (directory, options = {}) => {
  if (!(await exists(directory))) return [];
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    const relative = toRepoPath(target);
    if (options.exclude?.(relative, entry)) continue;
    if (entry.isDirectory()) results.push(...await walkFiles(target, options));
    else if (entry.isFile()) results.push(target);
  }
  return results;
};

const assertImage = async (
  target,
  { format, width, height, maximumDimension } = {},
) => {
  const metadata = await sharp(target, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error(`Invalid image: ${toRepoPath(target)}`);
  }
  if (format && metadata.format !== format) {
    throw new Error(`Expected ${format} at ${toRepoPath(target)}, found ${metadata.format}.`);
  }
  if (
    (width !== undefined && metadata.width !== width)
    || (height !== undefined && metadata.height !== height)
  ) {
    throw new Error(
      `Unexpected dimensions at ${toRepoPath(target)}: ${metadata.width}x${metadata.height}.`,
    );
  }
  if (
    maximumDimension !== undefined
    && (metadata.width > maximumDimension || metadata.height > maximumDimension)
  ) {
    throw new Error(
      `${toRepoPath(target)} exceeds ${maximumDimension}px: ${metadata.width}x${metadata.height}.`,
    );
  }
  return metadata;
};

const assertTransparentImage = async (target, options = {}) => {
  const metadata = await assertImage(target, options);
  if (!metadata.hasAlpha) {
    throw new Error(`Brand artwork must have an alpha channel: ${toRepoPath(target)}.`);
  }
  const { channels } = await sharp(target, { failOn: "error" }).ensureAlpha().stats();
  if (channels[3].min !== 0) {
    throw new Error(`Brand artwork must include transparent pixels: ${toRepoPath(target)}.`);
  }
  return metadata;
};

const pixelDigest = async (input) => {
  const { data, info } = await sharp(input, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return sha256(Buffer.concat([
    Buffer.from(`${info.width}:${info.height}:${info.channels}:`),
    data,
  ]));
};

const optimizePngIfSmaller = async (target) => {
  const original = await readFile(target);
  const candidate = await sharp(original, { failOn: "error" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  if (candidate.length >= original.length) return false;
  if (await pixelDigest(original) !== await pixelDigest(candidate)) {
    throw new Error(`Lossless PNG verification failed: ${toRepoPath(target)}`);
  }
  if (checkOnly) {
    throw new Error(
      `PNG can be losslessly reduced: ${toRepoPath(target)}. Run npm run media:assets.`,
    );
  }
  return writeBufferIfChanged(target, candidate);
};

const convertLosslessWebp = async ({ input, output, maxDimension }) => {
  if (await exists(input)) {
    if (checkOnly) {
      throw new Error(`Unoptimized PNG remains at ${toRepoPath(input)}. Run npm run media:assets.`);
    }
    const candidate = await sharp(input, { failOn: "error" })
      .resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ lossless: true, effort: 6 })
      .toBuffer();
    await writeBufferIfChanged(output, candidate);
    await assertImage(output, { format: "webp", maximumDimension: maxDimension });
    await rm(input, { force: true });
  }
  if (!(await exists(output))) {
    throw new Error(`Missing optimized media: ${toRepoPath(output)}`);
  }
  await assertImage(output, { format: "webp", maximumDimension: maxDimension });
};

const convertConfiguredMedia = async () => {
  for (const item of brandAssets) {
    const target = path.join(publicRoot, item.name);
    if (!(await exists(target))) {
      throw new Error(`Missing canonical brand artwork: ${toRepoPath(target)}`);
    }
    await assertTransparentImage(target, {
      format: "webp",
      width: item.width,
      height: item.height,
    });
  }
  const iconRoot = path.join(publicRoot, "3dicons");
  for (const name of emptyStateIconNames) {
    await convertLosslessWebp({
      input: path.join(iconRoot, `${name}.png`),
      output: path.join(iconRoot, `${name}.webp`),
      maxDimension: 500,
    });
  }
};

const parseImportBadge = () => {
  const inline = process.argv.find((argument) => argument.startsWith("--import-badge="));
  if (inline) return inline.slice("--import-badge=".length);
  const index = process.argv.indexOf("--import-badge");
  return index >= 0 ? process.argv[index + 1] : null;
};

const importBadge = async (sourceValue) => {
  if (!sourceValue) return;
  if (checkOnly) throw new Error("--import-badge cannot be combined with --check.");
  const source = path.resolve(repoRoot, sourceValue);
  if (!(await exists(source))) throw new Error(`Badge source not found: ${source}`);
  const stem = path.parse(source).name.toLowerCase().replaceAll("-", "_");
  if (!/^[a-z0-9_]+$/.test(stem)) {
    throw new Error("Badge filenames may contain only letters, numbers, underscores, or hyphens.");
  }
  await writeBufferIfChanged(
    path.join(badgeRoot, `${stem}.webp`),
    await sharp(source, { failOn: "error" })
      .resize(256, 256, { fit: "contain", background: transparentBackground })
      .webp({ quality: 85, effort: 5 })
      .toBuffer(),
  );
};

const removeObsoleteBadgePngs = async () => {
  const entries = await readdir(badgeRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".png") continue;
    const target = path.join(badgeRoot, entry.name);
    if (checkOnly) throw new Error(`Obsolete badge duplicate: ${toRepoPath(target)}`);
    await rm(target, { force: true });
  }
};

const validateBadgeArtwork = async () => {
  const entries = await readdir(badgeRoot, { withFileTypes: true });
  const unexpected = entries.filter(
    (entry) => entry.isDirectory() || !entry.name.endsWith(".webp"),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unmanaged badge media: ${unexpected.map((entry) => entry.name).join(", ")}`,
    );
  }
  const badges = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => path.join(badgeRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));
  if (badges.length === 0) throw new Error("No canonical badge artwork was found.");
  for (const target of badges) {
    await assertTransparentImage(target, {
      format: "webp",
      width: 256,
      height: 256,
    });
  }
  return badges;
};

const validateDashboardArtwork = async () => {
  const artwork = dashboardArtwork.map((relative) => path.join(publicRoot, relative));
  const expected = new Set(artwork.map(toRepoPath));
  for (const collection of ["brack-streak", "brack-trophy"]) {
    const directory = path.join(publicRoot, collection);
    const entries = await readdir(directory, { withFileTypes: true });
    const unexpected = entries.filter(
      (entry) => entry.isDirectory() || !expected.has(toRepoPath(path.join(directory, entry.name))),
    );
    if (unexpected.length > 0) {
      throw new Error(
        `Unmanaged ${collection} media: ${unexpected.map((entry) => entry.name).join(", ")}`,
      );
    }
  }
  for (const target of artwork) {
    if (!(await exists(target))) throw new Error(`Missing artwork: ${toRepoPath(target)}`);
    await assertTransparentImage(target, {
      format: "webp",
      width: 256,
      height: 256,
    });
  }
  return artwork;
};

const optimizeRequiredPngs = async () => {
  const publicPngs = (await walkFiles(publicRoot))
    .filter((target) => path.extname(target).toLowerCase() === ".png");
  for (const target of publicPngs) {
    const relative = toRepoPath(target);
    if (!requiredPublicPngs.has(relative)) {
      throw new Error(`Unmanaged public PNG: ${relative}`);
    }
    await optimizePngIfSmaller(target);
  }

  const nativeRoots = [
    path.join(repoRoot, "assets"),
    path.join(repoRoot, "resources"),
    path.join(repoRoot, "android", "app", "src", "main", "res"),
    path.join(repoRoot, "ios", "App", "App", "Assets.xcassets"),
  ];
  for (const root of nativeRoots) {
    const pngs = (await walkFiles(root, {
      exclude: (relative, entry) =>
        entry.isDirectory() && relative === "assets/gamification-source",
    })).filter((target) => path.extname(target).toLowerCase() === ".png");
    for (const target of pngs) await optimizePngIfSmaller(target);
  }
};

const assertMp4 = async (target) => {
  const value = await readFile(target);
  if (value.length < 12 || !value.subarray(4, 12).toString("ascii").includes("ftyp")) {
    throw new Error(`Invalid MP4 container: ${toRepoPath(target)}`);
  }
};

const roleFor = (relative) => {
  if (/^apps\/client\/public\/achievement-badges\/[^/]+\.webp$/.test(relative)) return "canonical";
  if (/^apps\/client\/public\/(brack-streak|brack-trophy)\/[^/]+\.webp$/.test(relative)) return "canonical";
  if (relative.startsWith("apps/client/public/")) return "runtime";
  return "platform";
};

const describeMedia = async (target) => {
  const fileStats = await stat(target);
  const relative = toRepoPath(target);
  const extension = path.extname(target).toLowerCase();
  const result = {
    path: relative,
    role: roleFor(relative),
    sha256: await sha256File(target),
    bytes: fileStats.size,
    format: extension.slice(1),
    width: null,
    height: null,
  };
  if (sharpExtensions.has(extension)) {
    const metadata = await sharp(target, { failOn: "error" }).metadata();
    result.format = metadata.format ?? result.format;
    result.width = metadata.width ?? null;
    result.height = metadata.height ?? null;
  } else if (extension === ".mp4") await assertMp4(target);
  return result;
};

const sumBytes = (items) => items.reduce((sum, item) => sum + item.bytes, 0);
const largestBytes = (items, count) => items
  .map((item) => item.bytes)
  .sort((left, right) => right - left)
  .slice(0, count)
  .reduce((sum, value) => sum + value, 0);

const assertBudget = (label, actual, maximum) => {
  if (actual > maximum) {
    throw new Error(
      `${label} is ${(actual / 1024 / 1024).toFixed(2)} MiB; budget is `
        + `${(maximum / 1024 / 1024).toFixed(2)} MiB.`,
    );
  }
};

const buildManifest = async () => {
  const publicFiles = (await walkFiles(publicRoot))
    .filter((target) => mediaExtensions.has(path.extname(target).toLowerCase()));
  const nativeRoots = [
    path.join(repoRoot, "assets"),
    path.join(repoRoot, "resources"),
    path.join(repoRoot, "android", "app", "src", "main", "res"),
    path.join(repoRoot, "ios", "App", "App", "Assets.xcassets"),
  ];
  const nativeFiles = [];
  for (const root of nativeRoots) {
    nativeFiles.push(...(await walkFiles(root, {
      exclude: (relative, entry) =>
        entry.isDirectory() && relative === "assets/gamification-source",
    })).filter((target) => mediaExtensions.has(path.extname(target).toLowerCase())));
  }
  const allFiles = [...new Set([...publicFiles, ...nativeFiles])]
    .sort((left, right) => toRepoPath(left).localeCompare(toRepoPath(right)));
  const inventory = await Promise.all(allFiles.map(describeMedia));
  const publicInventory = inventory.filter((item) => item.path.startsWith("apps/client/public/"));
  const nativeInventory = inventory.filter((item) => item.role === "platform");
  const badges = publicInventory.filter((item) => /^apps\/client\/public\/achievement-badges\/[^/]+\.webp$/.test(item.path));
  const dashboard = publicInventory.filter((item) => /^apps\/client\/public\/(brack-streak|brack-trophy)\/[^/]+\.webp$/.test(item.path));
  const brandPaths = new Set(brandAssets.map((item) => `apps/client/public/${item.name}`));
  const brand = publicInventory.filter((item) => brandPaths.has(item.path));
  const emptyStates = publicInventory.filter((item) => item.path.startsWith("apps/client/public/3dicons/"));
  const videos = publicInventory.filter((item) => item.format === "mp4" || item.format === "webm");
  const journeyShell = publicInventory.filter(
    (item) => item.path === "apps/client/public/brack-currency/gold_leaves_icon.webp",
  );
  const journeyShellBytes = sumBytes(journeyShell);
  const budgets = {
    public_static_bytes: sumBytes(publicInventory),
    native_static_bytes: sumBytes(nativeInventory),
    journey_largest_twelve_badges_bytes: largestBytes(badges, 12),
    journey_shell_bytes: journeyShellBytes,
    journey_worst_case_viewport_bytes: journeyShellBytes + largestBytes(badges, 12),
    dashboard_initial_bytes: sumBytes(dashboard),
    brand_runtime_bytes: sumBytes(brand),
    empty_state_runtime_bytes: sumBytes(emptyStates),
    video_runtime_bytes: sumBytes(videos),
  };

  assertBudget("Public static media", budgets.public_static_bytes, 22 * 1024 * 1024);
  assertBudget("Native static media", budgets.native_static_bytes, 10 * 1024 * 1024);
  assertBudget("Journey initial artwork", budgets.journey_worst_case_viewport_bytes, 500 * 1024);
  assertBudget("Dashboard initial artwork", budgets.dashboard_initial_bytes, 250 * 1024);
  assertBudget("Brand runtime artwork", budgets.brand_runtime_bytes, 512 * 1024);
  assertBudget("Empty-state artwork", budgets.empty_state_runtime_bytes, 750 * 1024);
  for (const video of videos) {
    assertBudget(video.path, video.bytes, 5 * 1024 * 1024);
  }

  return {
    schema_version: manifestVersion,
    generator: {
      path: toRepoPath(scriptPath),
      sha256: await sha256File(scriptPath),
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
    },
    transformations: {
      badge_fit: "contain",
      badge_size: 256,
      dashboard_artwork_size: 256,
      webp_lossless_collections: ["brand", "3dicons"],
      brand_background: "transparent",
      canonical_brand_assets: brandAssets.map((item) => item.name),
      canonical_assets_are_never_recompressed: true,
    },
    excluded_generated_mirrors: [
      "android/app/src/main/assets/public",
      "ios/App/App/public",
    ],
    budgets,
    inventory,
  };
};

const verifyManifest = async (current) => {
  if (!(await exists(manifestPath))) {
    throw new Error("Media manifest is missing; run npm run media:assets.");
  }
  const recorded = JSON.parse(await readFile(manifestPath, "utf8"));
  if (JSON.stringify(recorded) !== JSON.stringify(current)) {
    throw new Error("Media manifest is stale; run npm run media:assets.");
  }
};

await ensureRepositoryRoot();
for (const target of obsoleteFiles) await removeExactTarget(target);
for (const target of obsoleteDirectories) await removeExactTarget(target, true);
await convertConfiguredMedia();
await removeObsoleteBadgePngs();
await importBadge(parseImportBadge());
const badges = await validateBadgeArtwork();
const dashboardCanonicals = await validateDashboardArtwork();
await optimizeRequiredPngs();

if (await exists(path.join(repoRoot, "assets", "gamification-source"))) {
  throw new Error(
    "Raw gamification source artwork must not remain in the repository. "
      + "Remove assets/gamification-source and rerun the media pipeline.",
  );
}

const manifest = await buildManifest();
if (!checkOnly) {
  await writeBufferIfChanged(
    manifestPath,
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  );
}
await verifyManifest(manifest);

console.log(
  `Verified ${badges.length} badges and ${dashboardCanonicals.length} dashboard artworks; `
    + `public media ${(manifest.budgets.public_static_bytes / 1024 / 1024).toFixed(1)} MiB, `
    + `native media ${(manifest.budgets.native_static_bytes / 1024 / 1024).toFixed(1)} MiB, `
    + `Journey viewport ${Math.round(manifest.budgets.journey_worst_case_viewport_bytes / 1024)} KiB.`,
);

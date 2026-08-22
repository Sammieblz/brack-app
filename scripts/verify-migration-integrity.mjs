#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LOCK_SCHEMA_VERSION = 1;
const HASH_ALGORITHM = "sha256";
const CONTENT_NORMALIZATION = "utf8-lf";
const DEFAULT_MIGRATIONS_DIRECTORY = "supabase/migrations";
const DEFAULT_LOCK_FILE = "supabase/migrations.lock.json";
const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-z0-9]+(?:[_-][a-z0-9]+)*)\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 24 * 60 * 60 * 1000;
const LEGACY_NON_CALENDAR_MIGRATIONS = new Set([
  "20260505106000_prevent_public_storage_listing.sql",
  "20260505107000_advisor_performance_indexes.sql",
  "20260505108000_add_book_inspired_theme_presets.sql",
  "20260505109000_add_library_view_mode.sql",
]);

export class MigrationIntegrityError extends Error {
  constructor(errors) {
    const normalizedErrors = Array.isArray(errors) ? errors : [String(errors)];
    super(`Migration integrity verification failed:\n- ${normalizedErrors.join("\n- ")}`);
    this.name = "MigrationIntegrityError";
    this.errors = normalizedErrors;
  }
}

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(contents) {
  const normalizedContents = Buffer.isBuffer(contents)
    ? contents.toString("utf8").replace(/\r\n/gu, "\n")
    : String(contents).replace(/\r\n/gu, "\n");
  return createHash(HASH_ALGORITHM).update(normalizedContents, "utf8").digest("hex");
}

function isRealUtcTimestamp(version) {
  const year = Number(version.slice(0, 4));
  const month = Number(version.slice(4, 6));
  const day = Number(version.slice(6, 8));
  const hour = Number(version.slice(8, 10));
  const minute = Number(version.slice(10, 12));
  const second = Number(version.slice(12, 14));
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const timestamp = new Date(0);
  timestamp.setUTCFullYear(year, month - 1, day);
  timestamp.setUTCHours(hour, minute, second, 0);
  return timestamp.getUTCFullYear() === year
    && timestamp.getUTCMonth() === month - 1
    && timestamp.getUTCDate() === day
    && timestamp.getUTCHours() === hour
    && timestamp.getUTCMinutes() === minute
    && timestamp.getUTCSeconds() === second;
}

function migrationTimestampMs(version) {
  return Date.UTC(
    Number(version.slice(0, 4)),
    Number(version.slice(4, 6)) - 1,
    Number(version.slice(6, 8)),
    Number(version.slice(8, 10)),
    Number(version.slice(10, 12)),
    Number(version.slice(12, 14)),
  );
}

export function parseMigrationFilename(file) {
  const match = MIGRATION_FILENAME_PATTERN.exec(file);
  if (!match) {
    throw new MigrationIntegrityError(
      `Invalid migration filename "${file}". Expected <14-digit version>_<lowercase-description>.sql.`,
    );
  }

  const [, version, description] = match;
  if (!isRealUtcTimestamp(version) && !LEGACY_NON_CALENDAR_MIGRATIONS.has(file)) {
    throw new MigrationIntegrityError(
      `Invalid migration timestamp "${version}" in "${file}". New versions must be real UTC calendar timestamps.`,
    );
  }
  if (
    isRealUtcTimestamp(version)
    && migrationTimestampMs(version) > Date.now() + MAX_FUTURE_TIMESTAMP_SKEW_MS
  ) {
    throw new MigrationIntegrityError(
      `Migration timestamp "${version}" in "${file}" is more than 24 hours in the future. Check the UTC system clock.`,
    );
  }
  return { version, description, file };
}

function validateMigrationCollection(migrations, label) {
  const errors = [];
  const versions = new Map();
  const descriptions = new Map();
  let previousVersion = null;

  for (const migration of migrations) {
    if (previousVersion !== null && migration.version <= previousVersion) {
      errors.push(
        `${label} is not strictly ordered: ${migration.file} follows version ${previousVersion}.`,
      );
    }
    previousVersion = migration.version;

    const versionOwner = versions.get(migration.version);
    if (versionOwner) {
      errors.push(`Duplicate migration version ${migration.version}: ${versionOwner} and ${migration.file}.`);
    } else {
      versions.set(migration.version, migration.file);
    }

    const descriptionOwner = descriptions.get(migration.description);
    if (descriptionOwner) {
      errors.push(
        `Duplicate migration description "${migration.description}": ${descriptionOwner} and ${migration.file}.`,
      );
    } else {
      descriptions.set(migration.description, migration.file);
    }
  }

  return errors;
}

async function readCurrentMigrations(migrationsPath) {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const errors = [];
  const migrations = [];

  for (const entry of entries.sort((left, right) => compareAscii(left.name, right.name))) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      errors.push(`Unexpected entry in the migrations directory: ${entry.name}. Only regular .sql files are allowed.`);
      continue;
    }

    let parsed;
    try {
      parsed = parseMigrationFilename(entry.name);
    } catch (error) {
      if (error instanceof MigrationIntegrityError) {
        errors.push(...error.errors);
        continue;
      }
      throw error;
    }

    const contents = await readFile(path.join(migrationsPath, entry.name));
    if (contents.toString("utf8").trim().length === 0) {
      errors.push(`Migration ${entry.name} is empty.`);
    }
    migrations.push({ ...parsed, sha256: sha256(contents) });
  }

  errors.push(...validateMigrationCollection(migrations, "Migration filenames"));
  return { migrations, errors };
}

export function buildLockManifest(migrations) {
  return {
    schema_version: LOCK_SCHEMA_VERSION,
    hash_algorithm: HASH_ALGORITHM,
    content_normalization: CONTENT_NORMALIZATION,
    migrations: migrations.map(({ version, description, file, sha256: digest }) => ({
      version,
      description,
      file,
      sha256: digest,
    })),
  };
}

export function serializeLockManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseLockManifest(contents, source) {
  let manifest;
  try {
    manifest = JSON.parse(contents);
  } catch (error) {
    throw new MigrationIntegrityError(`${source} is not valid JSON: ${error.message}`);
  }

  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new MigrationIntegrityError(`${source} must contain a JSON object.`);
  }
  if (manifest.schema_version !== LOCK_SCHEMA_VERSION) {
    errors.push(`${source} has unsupported schema_version ${JSON.stringify(manifest.schema_version)}.`);
  }
  if (manifest.hash_algorithm !== HASH_ALGORITHM) {
    errors.push(`${source} must use ${HASH_ALGORITHM}.`);
  }
  if (manifest.content_normalization !== CONTENT_NORMALIZATION) {
    errors.push(`${source} must use ${CONTENT_NORMALIZATION} content normalization.`);
  }
  if (!Array.isArray(manifest.migrations)) {
    errors.push(`${source} must contain a migrations array.`);
  }

  const parsedMigrations = [];
  if (Array.isArray(manifest.migrations)) {
    for (const [index, entry] of manifest.migrations.entries()) {
      const entryLabel = `${source} migrations[${index}]`;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`${entryLabel} must be an object.`);
        continue;
      }

      const expectedKeys = ["description", "file", "sha256", "version"];
      const actualKeys = Object.keys(entry).sort(compareAscii);
      if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
        errors.push(`${entryLabel} must contain exactly: version, description, file, sha256.`);
      }

      let parsedFilename;
      if (typeof entry.file !== "string") {
        errors.push(`${entryLabel}.file must be a string.`);
      } else {
        try {
          parsedFilename = parseMigrationFilename(entry.file);
        } catch (error) {
          if (error instanceof MigrationIntegrityError) errors.push(...error.errors);
          else throw error;
        }
      }

      if (typeof entry.version !== "string" || entry.version !== parsedFilename?.version) {
        errors.push(`${entryLabel}.version must match the timestamp in its filename.`);
      }
      if (typeof entry.description !== "string" || entry.description !== parsedFilename?.description) {
        errors.push(`${entryLabel}.description must match the description in its filename.`);
      }
      if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
        errors.push(`${entryLabel}.sha256 must be a lowercase SHA-256 digest.`);
      }

      if (parsedFilename && typeof entry.sha256 === "string") {
        parsedMigrations.push({
          version: entry.version,
          description: entry.description,
          file: entry.file,
          sha256: entry.sha256,
        });
      }
    }
  }

  errors.push(...validateMigrationCollection(parsedMigrations, `${source} entries`));
  if (errors.length > 0) throw new MigrationIntegrityError(errors);
  return { ...manifest, migrations: parsedMigrations };
}

function verifyManifestAgainstMigrations(manifest, migrations, label) {
  const errors = [];
  const migrationByFile = new Map(migrations.map((migration) => [migration.file, migration]));
  const lockByFile = new Map(manifest.migrations.map((migration) => [migration.file, migration]));

  for (const lockedMigration of manifest.migrations) {
    const migration = migrationByFile.get(lockedMigration.file);
    if (!migration) {
      errors.push(`Deleted locked migration: ${lockedMigration.file} (${label}).`);
      continue;
    }
    if (migration.sha256 !== lockedMigration.sha256) {
      errors.push(
        `Modified locked migration: ${migration.file} (${label}; expected ${lockedMigration.sha256}, got ${migration.sha256}).`,
      );
    }
  }

  for (const migration of migrations) {
    if (!lockByFile.has(migration.file)) {
      errors.push(`Unlocked migration: ${migration.file} is missing from ${label}.`);
    }
  }

  return errors;
}

function runGit(repoRoot, args, { allowFailure = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new MigrationIntegrityError(`git ${args[0]} failed: ${String(stderr).trim() || `exit ${result.status}`}`);
  }
  return result;
}

function assertSafeBaseRef(baseRef) {
  if (typeof baseRef !== "string" || baseRef.length === 0 || baseRef.startsWith("-") || /[:\x00-\x20\x7f]/.test(baseRef)) {
    throw new MigrationIntegrityError(`Unsafe or invalid Git base ref: ${JSON.stringify(baseRef)}.`);
  }
}

function repoRelativePath(repoRoot, absolutePath, label) {
  const relative = path.relative(repoRoot, absolutePath).split(path.sep).join("/");
  if (relative === "" || relative === ".." || relative.startsWith("../")) {
    throw new MigrationIntegrityError(`${label} must be located inside the repository root.`);
  }
  return relative;
}

function gitBlobExists(repoRoot, commit, repoPath) {
  const result = runGit(repoRoot, ["cat-file", "-e", `${commit}:${repoPath}`], { allowFailure: true });
  return result.status === 0;
}

function readGitBlob(repoRoot, commit, repoPath) {
  return runGit(repoRoot, ["show", `${commit}:${repoPath}`], { encoding: null }).stdout;
}

function readBaseSnapshot(repoRoot, baseRef, migrationsRelativePath, lockRelativePath) {
  assertSafeBaseRef(baseRef);
  const resolved = runGit(repoRoot, ["rev-parse", "--verify", `${baseRef}^{commit}`]).stdout.trim();
  if (!/^[a-f0-9]{40,64}$/i.test(resolved)) {
    throw new MigrationIntegrityError(`Git returned an invalid commit for base ref ${baseRef}.`);
  }

  const tree = runGit(repoRoot, ["ls-tree", "-r", "--name-only", resolved, "--", migrationsRelativePath])
    .stdout.split(/\r?\n/u)
    .filter(Boolean)
    .sort(compareAscii);
  const errors = [];
  const migrations = [];

  for (const repoPath of tree) {
    const relativeToMigrations = path.posix.relative(migrationsRelativePath, repoPath);
    if (relativeToMigrations.startsWith("../") || relativeToMigrations.includes("/")) {
      errors.push(`Unexpected nested entry in base migrations: ${repoPath}.`);
      continue;
    }

    try {
      const parsed = parseMigrationFilename(relativeToMigrations);
      const contents = readGitBlob(repoRoot, resolved, repoPath);
      migrations.push({ ...parsed, sha256: sha256(contents) });
    } catch (error) {
      if (error instanceof MigrationIntegrityError) errors.push(...error.errors);
      else throw error;
    }
  }
  errors.push(...validateMigrationCollection(migrations, `Base migration filenames at ${baseRef}`));

  let lockManifest = null;
  if (gitBlobExists(repoRoot, resolved, lockRelativePath)) {
    lockManifest = parseLockManifest(
      readGitBlob(repoRoot, resolved, lockRelativePath).toString("utf8"),
      `${lockRelativePath} at ${baseRef}`,
    );
    errors.push(...verifyManifestAgainstMigrations(lockManifest, migrations, `${lockRelativePath} at ${baseRef}`));
  }

  return { commit: resolved, migrations, lockManifest, errors };
}

function sameLockEntry(left, right) {
  return left.version === right.version
    && left.description === right.description
    && left.file === right.file
    && left.sha256 === right.sha256;
}

function verifyAgainstBase(baseSnapshot, currentMigrations, currentManifest, diskManifest, writeLock, baseRef) {
  const errors = [...baseSnapshot.errors];
  const currentByFile = new Map(currentMigrations.map((migration) => [migration.file, migration]));
  const baseByFile = new Map(baseSnapshot.migrations.map((migration) => [migration.file, migration]));
  const baseMax = baseSnapshot.migrations.at(-1)?.version ?? null;

  for (const baseMigration of baseSnapshot.migrations) {
    const current = currentByFile.get(baseMigration.file);
    if (!current) {
      errors.push(`Base migration removed: ${baseMigration.file} exists at ${baseRef}.`);
    } else if (current.sha256 !== baseMigration.sha256) {
      errors.push(`Base migration modified: ${baseMigration.file} is immutable after merge.`);
    }
  }

  if (baseMax) {
    for (const migration of currentMigrations) {
      if (!baseByFile.has(migration.file) && migration.version <= baseMax) {
        errors.push(
          `Backdated migration rejected: ${migration.file} must be strictly newer than base maximum ${baseMax}.`,
        );
      }
    }
  }

  if (baseSnapshot.lockManifest) {
    const candidateByFile = new Map(currentManifest.migrations.map((entry) => [entry.file, entry]));
    const diskByFile = diskManifest
      ? new Map(diskManifest.migrations.map((entry) => [entry.file, entry]))
      : null;

    for (const baseEntry of baseSnapshot.lockManifest.migrations) {
      const candidate = candidateByFile.get(baseEntry.file);
      if (!candidate || !sameLockEntry(candidate, baseEntry)) {
        errors.push(`Base lock entry removed or changed: ${baseEntry.file}.`);
      }

      if (writeLock) {
        const diskEntry = diskByFile?.get(baseEntry.file);
        if (!diskEntry || !sameLockEntry(diskEntry, baseEntry)) {
          errors.push(`On-disk base lock entry removed or changed before --write-lock: ${baseEntry.file}.`);
        }
      }
    }
  }

  return errors;
}

export function parseSupabaseMigrationList(output) {
  const trimmedOutput = String(output).trim();
  let payload;
  try {
    payload = JSON.parse(trimmedOutput);
  } catch (error) {
    throw new MigrationIntegrityError(`Supabase migration-list JSON is invalid: ${error.message}`);
  }

  const isPlainObject = (value) => value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
  if (!isPlainObject(payload)) {
    throw new MigrationIntegrityError("Supabase migration-list JSON must be a plain object.");
  }

  const errors = [];
  if (!Object.hasOwn(payload, "message") || payload.message !== "Migrations listed") {
    errors.push('Supabase migration-list JSON message must equal "Migrations listed".');
  }
  if (!Object.hasOwn(payload, "migrations") || !Array.isArray(payload.migrations)) {
    errors.push("Supabase migration-list JSON must contain a migrations array.");
  }
  if (!Array.isArray(payload.migrations)) throw new MigrationIntegrityError(errors);

  const local = [];
  const remote = [];
  for (const [index, entry] of payload.migrations.entries()) {
    if (!isPlainObject(entry)) {
      errors.push(`Supabase migration-list JSON migrations[${index}] must be a plain object.`);
      continue;
    }

    let rowIsValid = true;
    for (const field of ["local", "remote", "time"]) {
      if (!Object.hasOwn(entry, field)) {
        errors.push(`Supabase migration-list JSON migrations[${index}] must own a ${field} field.`);
        rowIsValid = false;
      }
    }
    if (!Object.hasOwn(entry, "local") || !Object.hasOwn(entry, "remote") || !Object.hasOwn(entry, "time")) {
      continue;
    }

    for (const label of ["local", "remote"]) {
      const value = entry[label];
      if (typeof value !== "string" || (value !== "" && !/^\d{14}$/u.test(value))) {
        errors.push(
          `Invalid Supabase ${label.toUpperCase()} migration version at migrations[${index}]: ${JSON.stringify(value)}.`,
        );
        rowIsValid = false;
      }
    }
    if (typeof entry.time !== "string") {
      errors.push(`Supabase migration-list JSON migrations[${index}].time must be a string.`);
      rowIsValid = false;
    }

    if (typeof entry.local === "string" && typeof entry.remote === "string") {
      if (entry.local === "" && entry.remote === "") {
        errors.push(`Supabase migration-list JSON migrations[${index}] has neither a local nor remote version.`);
        rowIsValid = false;
      } else if (entry.local !== "" && entry.remote !== "" && entry.local !== entry.remote) {
        errors.push(
          `Supabase migration-list JSON migrations[${index}] pairs different local and remote versions.`,
        );
        rowIsValid = false;
      }
    }

    if (rowIsValid) {
      if (entry.local !== "") local.push(entry.local);
      if (entry.remote !== "") remote.push(entry.remote);
    }
  }

  if (errors.length > 0) throw new MigrationIntegrityError(errors);
  return { local, remote };
}

function compareVersionList(actual, expected, label) {
  const errors = [];
  const seen = new Set();
  for (const version of actual) {
    if (seen.has(version)) errors.push(`${label} contains duplicate migration version ${version}.`);
    seen.add(version);
  }

  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  for (const version of expected) {
    if (!actualSet.has(version)) errors.push(`${label} is missing migration ${version}.`);
  }
  for (const version of actual) {
    if (!expectedSet.has(version)) errors.push(`${label} contains unknown migration ${version}.`);
  }
  if (actual.length > 1 && actual.some((version, index) => index > 0 && version <= actual[index - 1])) {
    errors.push(`${label} is not strictly ordered.`);
  }
  return errors;
}

export function verifySupabaseMigrationList(output, migrations, { mode = "postflight" } = {}) {
  if (mode !== "preflight" && mode !== "postflight") {
    throw new MigrationIntegrityError(`Unsupported migration-list mode: ${JSON.stringify(mode)}.`);
  }

  const parsed = parseSupabaseMigrationList(output);
  const expected = migrations.map((migration) => migration.version);
  const errors = [...compareVersionList(parsed.local, expected, "Supabase LOCAL history")];

  if (mode === "postflight") {
    errors.push(...compareVersionList(parsed.remote, expected, "Supabase REMOTE history"));
  } else {
    const seenRemote = new Set();
    for (const [index, version] of parsed.remote.entries()) {
      if (seenRemote.has(version)) {
        errors.push(`Supabase REMOTE history contains duplicate migration version ${version}.`);
      }
      seenRemote.add(version);

      if (expected[index] !== version) {
        const expectedVersion = expected[index] ?? "no additional local migration";
        errors.push(
          `Supabase REMOTE history is not an exact ordered prefix of LOCAL history at position ${index + 1}: expected ${expectedVersion}, got ${version}.`,
        );
      }
    }
  }

  if (errors.length > 0) throw new MigrationIntegrityError(errors);
  return parsed;
}

async function readOptionalManifest(lockPath, label) {
  try {
    return parseLockManifest(await readFile(lockPath, "utf8"), label);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeLockAtomically(lockPath, manifest) {
  const temporaryPath = `${lockPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, serializeLockManifest(manifest), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, lockPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function verifyMigrationIntegrity({
  repoRoot = process.cwd(),
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  lockFile = DEFAULT_LOCK_FILE,
  writeLock = false,
  baseRef = null,
  migrationListOutput = null,
  migrationListMode = "postflight",
} = {}) {
  const resolvedRoot = path.resolve(repoRoot);
  const migrationsPath = path.resolve(resolvedRoot, migrationsDirectory);
  const lockPath = path.resolve(resolvedRoot, lockFile);
  const migrationsRelativePath = repoRelativePath(resolvedRoot, migrationsPath, "Migrations directory");
  const lockRelativePath = repoRelativePath(resolvedRoot, lockPath, "Migration lock file");
  const { migrations, errors } = await readCurrentMigrations(migrationsPath);

  const diskManifest = await readOptionalManifest(lockPath, lockRelativePath);
  const candidateManifest = writeLock ? buildLockManifest(migrations) : diskManifest;
  if (!candidateManifest) {
    errors.push(`${lockRelativePath} is missing. Generate it with --write-lock.`);
  } else if (!writeLock) {
    errors.push(...verifyManifestAgainstMigrations(candidateManifest, migrations, lockRelativePath));
  }

  let baseCommit = null;
  if (baseRef && candidateManifest) {
    const baseSnapshot = readBaseSnapshot(
      resolvedRoot,
      baseRef,
      migrationsRelativePath,
      lockRelativePath,
    );
    baseCommit = baseSnapshot.commit;
    errors.push(
      ...verifyAgainstBase(
        baseSnapshot,
        migrations,
        candidateManifest,
        diskManifest,
        writeLock,
        baseRef,
      ),
    );
  }

  if (migrationListOutput !== null) {
    try {
      verifySupabaseMigrationList(migrationListOutput, migrations, { mode: migrationListMode });
    } catch (error) {
      if (error instanceof MigrationIntegrityError) errors.push(...error.errors);
      else throw error;
    }
  }

  if (errors.length > 0) throw new MigrationIntegrityError(errors);
  if (writeLock) await writeLockAtomically(lockPath, candidateManifest);

  return {
    migrationCount: migrations.length,
    lockPath,
    wroteLock: writeLock,
    baseCommit,
    checkedMigrationList: migrationListOutput !== null,
  };
}

function usage() {
  return `Usage: node scripts/verify-migration-integrity.mjs [options]

Options:
  --write-lock                   Deterministically rewrite supabase/migrations.lock.json
  --base-ref <git-ref>           Enforce immutability and forward-only timestamps from a Git base
  --migration-list-file <path>   Verify saved Supabase migration-list JSON (use - for stdin)
  --migration-list-mode <mode>   preflight (REMOTE prefix) or postflight (exact; default)
  --repo-root <path>             Repository root (defaults to the current directory)
  --migrations-dir <path>        Migrations path relative to the repository root
  --lock-file <path>             Lock path relative to the repository root
  --quiet                        Suppress success output
  --help                         Show this help
`;
}

function parseArguments(argv) {
  const options = {
    repoRoot: process.cwd(),
    migrationsDirectory: DEFAULT_MIGRATIONS_DIRECTORY,
    lockFile: DEFAULT_LOCK_FILE,
    writeLock: false,
    baseRef: null,
    migrationListFile: null,
    migrationListMode: "postflight",
    quiet: false,
    help: false,
  };
  const valueOptions = new Map([
    ["--base-ref", "baseRef"],
    ["--migration-list-file", "migrationListFile"],
    ["--migration-list-mode", "migrationListMode"],
    ["--repo-root", "repoRoot"],
    ["--migrations-dir", "migrationsDirectory"],
    ["--lock-file", "lockFile"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write-lock") options.writeLock = true;
    else if (argument === "--quiet") options.quiet = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new MigrationIntegrityError(`${argument} requires a value.`);
      }
      options[valueOptions.get(argument)] = value;
      index += 1;
    } else {
      throw new MigrationIntegrityError(`Unknown argument: ${argument}`);
    }
  }
  if (options.migrationListMode !== "preflight" && options.migrationListMode !== "postflight") {
    throw new MigrationIntegrityError("--migration-list-mode must be preflight or postflight.");
  }
  if (options.migrationListMode !== "postflight" && options.migrationListFile === null) {
    throw new MigrationIntegrityError("--migration-list-mode requires --migration-list-file.");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  let migrationListOutput = null;
  if (options.migrationListFile === "-") {
    migrationListOutput = await new Promise((resolve, reject) => {
      let contents = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { contents += chunk; });
      process.stdin.on("end", () => resolve(contents));
      process.stdin.on("error", reject);
    });
  } else if (options.migrationListFile) {
    migrationListOutput = await readFile(options.migrationListFile, "utf8");
  }

  const result = await verifyMigrationIntegrity({ ...options, migrationListOutput });
  if (!options.quiet) {
    const action = result.wroteLock ? "wrote and verified" : "verified";
    const checks = [
      `${result.migrationCount} migrations`,
      result.baseCommit ? `base ${result.baseCommit.slice(0, 12)}` : null,
      result.checkedMigrationList ? "local/remote history" : null,
    ].filter(Boolean).join(", ");
    process.stdout.write(`Migration integrity ${action}: ${checks}.\n`);
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

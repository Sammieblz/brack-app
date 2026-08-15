#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LOCK_SCHEMA_VERSION = 1;
const HASH_ALGORITHM = "sha256";
const FINGERPRINT_QUERY = "supabase/contracts/public_schema_fingerprint.sql";
const DEFAULT_LOCK_FILE = "supabase/public-schema.lock.json";

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash(HASH_ALGORITHM).update(value, "utf8").digest("hex");
}

function resolveSupabaseCommand(repoRoot) {
  const localEntrypoint = path.resolve(repoRoot, "node_modules/supabase/dist/supabase.js");
  if (existsSync(localEntrypoint)) {
    return { command: process.execPath, prefix: [localEntrypoint] };
  }
  return { command: "supabase", prefix: [] };
}

function executeFingerprintQuery(target, repoRoot) {
  const { command, prefix } = resolveSupabaseCommand(repoRoot);
  return spawnSync(
    command,
    [...prefix, "db", "query", `--${target}`, "--file", FINGERPRINT_QUERY],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

export function parseSchemaFingerprintOutput(output) {
  let payload;
  try {
    payload = JSON.parse(String(output).trim());
  } catch (error) {
    throw new Error(`Schema fingerprint output is not valid JSON: ${error.message}`);
  }
  if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Schema fingerprint output does not contain any rows.");
  }

  const objects = [];
  const seen = new Set();
  for (const [index, row] of payload.rows.entries()) {
    if (
      !row
      || typeof row !== "object"
      || Array.isArray(row)
      || typeof row.object_type !== "string"
      || row.object_type.length === 0
      || typeof row.object_name !== "string"
      || row.object_name.length === 0
      || typeof row.definition !== "string"
    ) {
      throw new Error(`Schema fingerprint row ${index} is invalid.`);
    }
    const key = `${row.object_type}:${row.object_name}`;
    if (seen.has(key)) throw new Error(`Schema fingerprint contains duplicate object ${key}.`);
    seen.add(key);
    objects.push({
      type: row.object_type,
      name: row.object_name,
      sha256: sha256(row.definition),
    });
  }

  return objects.sort((left, right) => {
    const typeOrder = compareAscii(left.type, right.type);
    return typeOrder === 0 ? compareAscii(left.name, right.name) : typeOrder;
  });
}

export function buildSchemaLock(objects) {
  return {
    schema_version: LOCK_SCHEMA_VERSION,
    hash_algorithm: HASH_ALGORITHM,
    fingerprint_query: FINGERPRINT_QUERY,
    objects,
  };
}

function parseSchemaLock(contents, source = DEFAULT_LOCK_FILE) {
  let lock;
  try {
    lock = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${source} is not valid JSON: ${error.message}`);
  }
  if (
    !lock
    || typeof lock !== "object"
    || Array.isArray(lock)
    || lock.schema_version !== LOCK_SCHEMA_VERSION
    || lock.hash_algorithm !== HASH_ALGORITHM
    || lock.fingerprint_query !== FINGERPRINT_QUERY
    || !Array.isArray(lock.objects)
    || lock.objects.length === 0
  ) {
    throw new Error(`${source} has an invalid schema or metadata.`);
  }

  const seen = new Set();
  let previousKey = null;
  for (const [index, object] of lock.objects.entries()) {
    if (
      !object
      || typeof object !== "object"
      || Array.isArray(object)
      || JSON.stringify(Object.keys(object).sort(compareAscii)) !== JSON.stringify(["name", "sha256", "type"])
      || typeof object.type !== "string"
      || object.type.length === 0
      || typeof object.name !== "string"
      || object.name.length === 0
      || typeof object.sha256 !== "string"
      || !/^[a-f0-9]{64}$/u.test(object.sha256)
    ) {
      throw new Error(`${source} objects[${index}] is invalid.`);
    }
    const key = `${object.type}:${object.name}`;
    if (seen.has(key)) throw new Error(`${source} contains duplicate object ${key}.`);
    if (previousKey !== null && compareAscii(key, previousKey) <= 0) {
      throw new Error(`${source} objects are not strictly ordered at ${key}.`);
    }
    seen.add(key);
    previousKey = key;
  }
  return lock;
}

export function compareSchemaObjects(expected, actual) {
  const expectedByKey = new Map(expected.map((item) => [`${item.type}:${item.name}`, item]));
  const actualByKey = new Map(actual.map((item) => [`${item.type}:${item.name}`, item]));
  const missing = [];
  const unexpected = [];
  const changed = [];

  for (const [key, expectedObject] of expectedByKey) {
    const actualObject = actualByKey.get(key);
    if (!actualObject) missing.push(key);
    else if (actualObject.sha256 !== expectedObject.sha256) changed.push(key);
  }
  for (const key of actualByKey.keys()) {
    if (!expectedByKey.has(key)) unexpected.push(key);
  }

  return {
    missing: missing.sort(compareAscii),
    unexpected: unexpected.sort(compareAscii),
    changed: changed.sort(compareAscii),
  };
}

export function assertSchemaMatches(expected, actual, target) {
  const differences = compareSchemaObjects(expected, actual);
  if (differences.missing.length === 0
    && differences.unexpected.length === 0
    && differences.changed.length === 0) return;

  const lines = [];
  const append = (label, values) => {
    if (values.length === 0) return;
    lines.push(`${label} (${values.length}):`);
    for (const value of values.slice(0, 40)) lines.push(`  - ${value}`);
    if (values.length > 40) lines.push(`  - ... ${values.length - 40} more`);
  };
  append("Missing", differences.missing);
  append("Unexpected", differences.unexpected);
  append("Changed", differences.changed);
  throw new Error(
    `${target} public schema does not match the clean migration replay.\n${lines.join("\n")}`,
  );
}

async function writeLockAtomically(lockPath, lock) {
  const temporaryPath = `${lockPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(lock, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, lockPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function verifySchemaIntegrity({
  target = "local",
  writeLock = false,
  repoRoot = process.cwd(),
  lockFile = DEFAULT_LOCK_FILE,
  execute = executeFingerprintQuery,
  emitStderr = false,
} = {}) {
  if (target !== "local" && target !== "linked") {
    throw new Error("Schema integrity target must be local or linked.");
  }
  if (writeLock && target !== "local") {
    throw new Error("The schema lock can only be written from a clean local replay.");
  }

  const resolvedRoot = path.resolve(repoRoot);
  const lockPath = path.resolve(resolvedRoot, lockFile);
  const result = execute(target, resolvedRoot);
  if (emitStderr && result.stderr) process.stderr.write(String(result.stderr));
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "").trim();
    throw new Error(
      `Supabase schema fingerprint query failed with exit code ${result.status}`
      + `${detail ? `: ${detail}` : "."}`,
    );
  }

  const objects = parseSchemaFingerprintOutput(result.stdout ?? "");
  if (writeLock) {
    await writeLockAtomically(lockPath, buildSchemaLock(objects));
  } else {
    const lock = parseSchemaLock(await readFile(lockPath, "utf8"), lockFile);
    assertSchemaMatches(lock.objects, objects, target === "local" ? "Local" : "Linked");
  }
  return { objectCount: objects.length, lockPath, wroteLock: writeLock };
}

function parseArguments(argv) {
  const options = { target: "local", writeLock: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") options.target = argv[++index] ?? null;
    else if (argument === "--write-lock") options.writeLock = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await verifySchemaIntegrity({ ...options, emitStderr: true });
  const verb = result.wroteLock ? "written from" : "verified against";
  process.stdout.write(
    `Public schema lock ${verb} ${options.target}: ${result.objectCount} objects.\n`,
  );
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

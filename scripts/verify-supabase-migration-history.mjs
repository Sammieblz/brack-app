#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  MigrationIntegrityError,
  verifyMigrationIntegrity,
} from "./verify-migration-integrity.mjs";

function resolveSupabaseCommand(repoRoot) {
  const localEntrypoint = path.resolve(repoRoot, "node_modules/supabase/dist/supabase.js");
  if (existsSync(localEntrypoint)) {
    return { command: process.execPath, prefix: [localEntrypoint] };
  }
  return { command: "supabase", prefix: [] };
}

export function executeMigrationList(target, repoRoot, spawn = spawnSync) {
  const { command, prefix } = resolveSupabaseCommand(repoRoot);
  return spawn(
    command,
    [...prefix, "migration", "list", `--${target}`, "--output-format", "json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

export async function verifySupabaseMigrationHistory({
  target,
  mode,
  repoRoot = process.cwd(),
  execute = executeMigrationList,
  emitStderr = false,
} = {}) {
  if (target !== "local" && target !== "linked") {
    throw new MigrationIntegrityError("Migration history target must be local or linked.");
  }
  if (mode !== "preflight" && mode !== "postflight") {
    throw new MigrationIntegrityError("Migration history mode must be preflight or postflight.");
  }
  if (target === "local" && mode !== "postflight") {
    throw new MigrationIntegrityError("Local migration history supports postflight verification only.");
  }

  const result = execute(target, path.resolve(repoRoot));
  if (emitStderr && result.stderr) process.stderr.write(String(result.stderr));
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "").trim();
    throw new MigrationIntegrityError(
      `supabase migration list --${target} failed with exit code ${result.status}`
      + `${detail ? `: ${detail}` : "."}`,
    );
  }

  return verifyMigrationIntegrity({
    repoRoot,
    migrationListOutput: String(result.stdout ?? ""),
    migrationListMode: mode,
  });
}

function parseArguments(argv) {
  let target = null;
  let mode = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") target = argv[++index] ?? null;
    else if (argument === "--mode") mode = argv[++index] ?? null;
    else throw new MigrationIntegrityError(`Unknown argument: ${argument}`);
  }
  return { target, mode };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await verifySupabaseMigrationHistory({
    ...options,
    emitStderr: true,
  });
  process.stdout.write(
    `Supabase migration history verified: ${result.migrationCount} migrations (${options.target}).\n`,
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

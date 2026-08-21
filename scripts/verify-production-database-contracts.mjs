#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CONTRACT_FILE = "supabase/contracts/production_integrity.sql";

function resolveSupabaseCommand(repoRoot) {
  const localEntrypoint = path.resolve(repoRoot, "node_modules/supabase/dist/supabase.js");
  if (existsSync(localEntrypoint)) {
    return { command: process.execPath, prefix: [localEntrypoint] };
  }
  return { command: "supabase", prefix: [] };
}

export function executeContracts(target, repoRoot, spawn = spawnSync) {
  const { command, prefix } = resolveSupabaseCommand(repoRoot);
  return spawn(
    command,
    [
      ...prefix,
      "db",
      "query",
      `--${target}`,
      "--file",
      CONTRACT_FILE,
      "--output-format",
      "json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
}

export function verifyProductionContractOutput(output) {
  let payload;
  try {
    payload = JSON.parse(String(output).trim());
  } catch (error) {
    throw new Error(`Production contract output is not valid JSON: ${error.message}`);
  }
  const rows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Production contract output does not contain any result rows.");
  }

  const invalidRows = [];
  const failedContracts = [];
  for (const [index, row] of rows.entries()) {
    if (
      !row
      || typeof row !== "object"
      || Array.isArray(row)
      || typeof row.contract !== "string"
      || typeof row.ok !== "boolean"
      || typeof row.detail !== "string"
    ) {
      invalidRows.push(index);
    } else if (!row.ok) {
      failedContracts.push(`${row.contract}: ${row.detail}`);
    }
  }
  if (invalidRows.length > 0) {
    throw new Error(`Production contract output has invalid rows at indexes: ${invalidRows.join(", ")}.`);
  }
  if (failedContracts.length > 0) {
    throw new Error(`Production database contracts failed:\n- ${failedContracts.join("\n- ")}`);
  }
  return rows.map((row) => row.contract);
}

export function verifyProductionDatabaseContracts({
  target = "linked",
  repoRoot = process.cwd(),
  execute = executeContracts,
  emitStderr = false,
} = {}) {
  if (target !== "local" && target !== "linked") {
    throw new Error("Production contract target must be local or linked.");
  }
  const resolvedRoot = path.resolve(repoRoot);
  const result = execute(target, resolvedRoot);
  if (emitStderr && result.stderr) process.stderr.write(String(result.stderr));
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "").trim();
    throw new Error(
      `Supabase production contract query failed with exit code ${result.status}`
      + `${detail ? `: ${detail}` : "."}`,
    );
  }
  return verifyProductionContractOutput(result.stdout ?? "");
}

function parseArguments(argv) {
  if (argv.length === 0) return { target: "linked" };
  if (argv.length === 2 && argv[0] === "--target") return { target: argv[1] };
  throw new Error("Usage: node scripts/verify-production-database-contracts.mjs [--target local|linked]");
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const contracts = verifyProductionDatabaseContracts({ ...options, emitStderr: true });
  process.stdout.write(`Database contracts verified: ${contracts.length} (${options.target}).\n`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

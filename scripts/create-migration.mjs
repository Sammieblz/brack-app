#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const MIGRATIONS_DIRECTORY = path.resolve("supabase/migrations");
const MIGRATION_PATTERN = /^(\d{14})_([a-z0-9]+(?:[_-][a-z0-9]+)*)\.sql$/u;
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function migrationFiles() {
  return (await readdir(MIGRATIONS_DIRECTORY))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function main() {
  const [name, ...extra] = process.argv.slice(2);
  if (!name || extra.length > 0 || !NAME_PATTERN.test(name)) {
    fail("Usage: npm run db:migration:new -- lowercase_snake_case_name");
    return;
  }

  const before = await migrationFiles();
  const parsedBefore = before.map((file) => ({ file, match: MIGRATION_PATTERN.exec(file) }));
  const invalid = parsedBefore.find(({ match }) => !match);
  if (invalid) {
    fail(`Existing migration has an invalid filename: ${invalid.file}`);
    return;
  }

  const previousMaximum = parsedBefore.at(-1)?.match?.[1] ?? null;
  const cliEntrypoint = path.resolve("node_modules/supabase/dist/supabase.js");
  if (!existsSync(cliEntrypoint)) {
    fail("The pinned Supabase CLI is not installed. Run npm ci first.");
    return;
  }

  const result = spawnSync(process.execPath, [cliEntrypoint, "migration", "new", name], {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return;
  }

  const after = await migrationFiles();
  const priorFiles = new Set(before);
  const created = after.filter((file) => !priorFiles.has(file));
  if (created.length !== 1) {
    fail(`Expected the Supabase CLI to create one migration, but found ${created.length}.`);
    return;
  }

  const [createdFile] = created;
  const createdMatch = MIGRATION_PATTERN.exec(createdFile);
  if (!createdMatch || (previousMaximum && createdMatch[1] <= previousMaximum)) {
    await unlink(path.join(MIGRATIONS_DIRECTORY, createdFile));
    fail(
      `Rejected ${createdFile}: its timestamp must be newer than the current maximum ${previousMaximum ?? "(none)"}. `
      + "Check the system clock and try again.",
    );
    return;
  }

  process.stdout.write(
    `Created supabase/migrations/${createdFile}. Add pgTAP coverage, update the migration lock, clean-reset locally, then update the schema lock.\n`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

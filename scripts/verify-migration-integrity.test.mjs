import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MigrationIntegrityError,
  parseSupabaseMigrationList,
  verifyMigrationIntegrity,
  verifySupabaseMigrationList,
} from "./verify-migration-integrity.mjs";
import {
  assertSchemaMatches,
  buildSchemaLock,
  compareSchemaObjects,
  executeFingerprintQuery,
  parseSchemaFingerprintOutput,
  verifySchemaIntegrity,
} from "./verify-schema-integrity.mjs";
import {
  executeMigrationList,
  verifySupabaseMigrationHistory,
} from "./verify-supabase-migration-history.mjs";
import {
  executeContracts,
  verifyProductionContractOutput,
  verifyProductionDatabaseContracts,
} from "./verify-production-database-contracts.mjs";

async function createFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "brack-migrations-"));
  await mkdir(path.join(root, "supabase", "migrations"), { recursive: true });
  t.after(async () => rm(root, { force: true, recursive: true }));
  return root;
}

async function addMigration(root, filename, sql = "select 1;\n") {
  await writeFile(path.join(root, "supabase", "migrations", filename), sql, "utf8");
}

function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function commitFixture(root) {
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "migration-tests@brack.app");
  git(root, "config", "user.name", "Brack Migration Tests");
  git(root, "config", "core.autocrlf", "false");
  git(root, "add", "supabase");
  git(root, "commit", "--quiet", "-m", "migration baseline");
}

async function expectIntegrityFailure(operation, pattern) {
  await assert.rejects(
    operation,
    (error) => error instanceof MigrationIntegrityError && pattern.test(error.message),
  );
}

test("writes a deterministic complete SHA-256 lock and verifies it", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "20260101000000_create_readers.sql", "create table readers(id uuid);\n");
  await addMigration(root, "20260102000000_add_reader_name.sql", "alter table readers add column name text;\n");

  const firstResult = await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });
  const firstLock = await readFile(path.join(root, "supabase", "migrations.lock.json"), "utf8");
  await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });
  const secondLock = await readFile(path.join(root, "supabase", "migrations.lock.json"), "utf8");
  const manifest = JSON.parse(firstLock);

  assert.equal(firstResult.migrationCount, 2);
  assert.equal(firstLock, secondLock);
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.hash_algorithm, "sha256");
  assert.equal(manifest.content_normalization, "utf8-lf");
  assert.deepEqual(
    manifest.migrations.map((entry) => entry.file),
    ["20260101000000_create_readers.sql", "20260102000000_add_reader_name.sql"],
  );
  assert.ok(manifest.migrations.every((entry) => /^[a-f0-9]{64}$/u.test(entry.sha256)));
  await verifyMigrationIntegrity({ repoRoot: root });
});

test("normalizes Git CRLF checkouts to canonical LF without accepting bare CR changes", async (t) => {
  const root = await createFixture(t);
  const filename = "20260101000000_create_readers.sql";
  await addMigration(root, filename, "select 1;\nselect 2;\n");
  await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });

  await addMigration(root, filename, "select 1;\r\nselect 2;\r\n");
  await verifyMigrationIntegrity({ repoRoot: root });

  await addMigration(root, filename, "select 1;\rselect 2;\r");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: root }),
    /Modified locked migration/u,
  );
});

test("detects modified, deleted, and unlocked migrations", async (t) => {
  const modifiedRoot = await createFixture(t);
  await addMigration(modifiedRoot, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: modifiedRoot, writeLock: true });
  await addMigration(modifiedRoot, "20260101000000_create_readers.sql", "select 2;\n");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: modifiedRoot }),
    /Modified locked migration/u,
  );

  const deletedRoot = await createFixture(t);
  await addMigration(deletedRoot, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: deletedRoot, writeLock: true });
  await unlink(path.join(deletedRoot, "supabase", "migrations", "20260101000000_create_readers.sql"));
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: deletedRoot }),
    /Deleted locked migration/u,
  );

  const unlockedRoot = await createFixture(t);
  await addMigration(unlockedRoot, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: unlockedRoot, writeLock: true });
  await addMigration(unlockedRoot, "20260102000000_add_reader_name.sql");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: unlockedRoot }),
    /Unlocked migration/u,
  );
});

test("rejects non-14-digit or non-calendar versions, duplicate versions, and duplicate descriptions", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "2026023000000_short_version.sql");
  await addMigration(root, "20260230000000_impossible_date.sql");
  await addMigration(root, "20260101000000_duplicate_version_a.sql");
  await addMigration(root, "20260101000000_duplicate_version_b.sql");
  await addMigration(root, "20260102000000_same_description.sql");
  await addMigration(root, "20260103000000_same_description.sql");
  await addMigration(root, "not-a-migration.sql");

  await assert.rejects(
    () => verifyMigrationIntegrity({ repoRoot: root, writeLock: true }),
    (error) => error instanceof MigrationIntegrityError
      && /Invalid migration filename/u.test(error.message)
      && /Invalid migration timestamp/u.test(error.message)
      && /Duplicate migration version/u.test(error.message)
      && /Duplicate migration description/u.test(error.message),
  );
});

test("grandfathers only the exact historical non-calendar migration filenames", async (t) => {
  const allowedRoot = await createFixture(t);
  await addMigration(allowedRoot, "20260505106000_prevent_public_storage_listing.sql");
  await verifyMigrationIntegrity({ repoRoot: allowedRoot, writeLock: true });

  const rejectedRoot = await createFixture(t);
  await addMigration(rejectedRoot, "20260505106000_new_invalid_timestamp.sql");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: rejectedRoot, writeLock: true }),
    /Invalid migration timestamp/u,
  );
});

test("rejects a calendar-valid migration timestamp far in the future", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "29990101000000_future_clock.sql");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: root, writeLock: true }),
    /more than 24 hours in the future/u,
  );
});

test("base-ref rejects backdated additions and never rewrites the lock on failure", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "20260102000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });
  await commitFixture(root);
  const originalLock = await readFile(path.join(root, "supabase", "migrations.lock.json"), "utf8");

  await addMigration(root, "20260101000000_backdated_change.sql");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: root, writeLock: true, baseRef: "HEAD" }),
    /Backdated migration rejected/u,
  );
  assert.equal(
    await readFile(path.join(root, "supabase", "migrations.lock.json"), "utf8"),
    originalLock,
  );

  await unlink(path.join(root, "supabase", "migrations", "20260101000000_backdated_change.sql"));
  await addMigration(root, "20260103000000_forward_change.sql");
  const result = await verifyMigrationIntegrity({ repoRoot: root, writeLock: true, baseRef: "HEAD" });
  assert.match(result.baseCommit, /^[a-f0-9]{40}$/u);
});

test("base-ref rejects changes to merged migration content and lock entries", async (t) => {
  const contentRoot = await createFixture(t);
  await addMigration(contentRoot, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: contentRoot, writeLock: true });
  await commitFixture(contentRoot);
  await addMigration(contentRoot, "20260101000000_create_readers.sql", "select 42;\n");
  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: contentRoot, writeLock: true, baseRef: "HEAD" }),
    /Base migration modified/u,
  );

  const lockRoot = await createFixture(t);
  await addMigration(lockRoot, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: lockRoot, writeLock: true });
  await commitFixture(lockRoot);
  const lockPath = path.join(lockRoot, "supabase", "migrations.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  lock.migrations = [];
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  await expectIntegrityFailure(
    () => verifyMigrationIntegrity({ repoRoot: lockRoot, baseRef: "HEAD" }),
    /Base lock entry removed or changed/u,
  );
});

test("parses and verifies current Supabase migration-list JSON in preflight and postflight modes", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "20260101000000_create_readers.sql");
  await addMigration(root, "20260102000000_add_reader_name.sql");
  await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });

  const alignedJson = JSON.stringify({
    message: "Migrations listed",
    migrations: [
      { local: "20260101000000", remote: "20260101000000", time: "2026-01-01 00:00:00" },
      { local: "20260102000000", remote: "20260102000000", time: "2026-01-02 00:00:00" },
    ],
  });
  assert.deepEqual(parseSupabaseMigrationList(alignedJson), {
    local: ["20260101000000", "20260102000000"],
    remote: ["20260101000000", "20260102000000"],
  });
  assert.doesNotThrow(
    () => verifySupabaseMigrationList(alignedJson, [
      { version: "20260101000000" },
      { version: "20260102000000" },
    ]),
  );
  await verifyMigrationIntegrity({ repoRoot: root, migrationListOutput: alignedJson });

  const pendingJson = JSON.stringify({
    message: "Migrations listed",
    migrations: [
      { local: "20260101000000", remote: "20260101000000", time: "2026-01-01 00:00:00" },
      { local: "20260102000000", remote: "", time: "2026-01-02 00:00:00" },
    ],
  });
  const migrations = [
    { version: "20260101000000" },
    { version: "20260102000000" },
  ];
  assert.throws(
    () => verifySupabaseMigrationList(pendingJson, migrations),
    /Supabase REMOTE history is missing migration 20260102000000/u,
  );
  assert.doesNotThrow(
    () => verifySupabaseMigrationList(pendingJson, migrations, { mode: "preflight" }),
  );
});

test("preflight rejects malformed or incomplete Supabase migration-list JSON", () => {
  const expected = [{ version: "20260101000000" }];
  const validRow = {
    local: "20260101000000",
    remote: "20260101000000",
    time: "2026-01-01 00:00:00",
  };
  const validPayload = {
    message: "Migrations listed",
    migrations: [validRow],
  };
  const withoutField = (field) => {
    const row = { ...validRow };
    delete row[field];
    return row;
  };
  const cases = [
    {
      name: "missing message",
      output: JSON.stringify({ migrations: [validRow] }),
      pattern: /message must equal "Migrations listed"/u,
    },
    {
      name: "wrong message",
      output: JSON.stringify({ ...validPayload, message: "Migration list complete" }),
      pattern: /message must equal "Migrations listed"/u,
    },
    {
      name: "null message",
      output: JSON.stringify({ ...validPayload, message: null }),
      pattern: /message must equal "Migrations listed"/u,
    },
    {
      name: "missing migrations",
      output: JSON.stringify({ message: "Migrations listed" }),
      pattern: /must contain a migrations array/u,
    },
    {
      name: "null migrations",
      output: JSON.stringify({ message: "Migrations listed", migrations: null }),
      pattern: /must contain a migrations array/u,
    },
    {
      name: "non-object payload",
      output: JSON.stringify([validRow]),
      pattern: /must be a plain object/u,
    },
    {
      name: "null payload",
      output: "null",
      pattern: /must be a plain object/u,
    },
    {
      name: "non-object migration row",
      output: JSON.stringify({ ...validPayload, migrations: [[validRow.local]] }),
      pattern: /migrations\[0\] must be a plain object/u,
    },
    {
      name: "null migration row",
      output: JSON.stringify({ ...validPayload, migrations: [null] }),
      pattern: /migrations\[0\] must be a plain object/u,
    },
    {
      name: "missing local",
      output: JSON.stringify({ ...validPayload, migrations: [withoutField("local")] }),
      pattern: /must own a local field/u,
    },
    {
      name: "missing remote",
      output: JSON.stringify({ ...validPayload, migrations: [withoutField("remote")] }),
      pattern: /must own a remote field/u,
    },
    {
      name: "missing time",
      output: JSON.stringify({ ...validPayload, migrations: [withoutField("time")] }),
      pattern: /must own a time field/u,
    },
    {
      name: "null local",
      output: JSON.stringify({ ...validPayload, migrations: [{ ...validRow, local: null }] }),
      pattern: /Invalid Supabase LOCAL migration version/u,
    },
    {
      name: "null remote",
      output: JSON.stringify({ ...validPayload, migrations: [{ ...validRow, remote: null }] }),
      pattern: /Invalid Supabase REMOTE migration version/u,
    },
    {
      name: "null time",
      output: JSON.stringify({ ...validPayload, migrations: [{ ...validRow, time: null }] }),
      pattern: /time must be a string/u,
    },
    {
      name: "both versions empty",
      output: JSON.stringify({
        ...validPayload,
        migrations: [{ ...validRow, local: "", remote: "" }],
      }),
      pattern: /neither a local nor remote version/u,
    },
    {
      name: "mismatched row versions",
      output: JSON.stringify({
        ...validPayload,
        migrations: [{ ...validRow, remote: "20260102000000" }],
      }),
      pattern: /pairs different local and remote versions/u,
    },
    {
      name: "invalid local version",
      output: JSON.stringify({ ...validPayload, migrations: [{ ...validRow, local: "20260101" }] }),
      pattern: /Invalid Supabase LOCAL migration version/u,
    },
    {
      name: "invalid remote version",
      output: JSON.stringify({ ...validPayload, migrations: [{ ...validRow, remote: "bad-version" }] }),
      pattern: /Invalid Supabase REMOTE migration version/u,
    },
    {
      name: "truncated JSON",
      output: '{"message":"Migrations listed","migrations":[',
      pattern: /migration-list JSON is invalid/u,
    },
    {
      name: "extra text",
      output: `${JSON.stringify(validPayload)}\nfinished`,
      pattern: /migration-list JSON is invalid/u,
    },
    {
      name: "ANSI decoration",
      output: `\u001b[32m${JSON.stringify(validPayload)}\u001b[0m`,
      pattern: /migration-list JSON is invalid/u,
    },
  ];

  for (const { name, output, pattern } of cases) {
    assert.throws(
      () => verifySupabaseMigrationList(output, expected, { mode: "preflight" }),
      (error) => error instanceof MigrationIntegrityError && pattern.test(error.message),
      name,
    );
  }
});

test("post-deployment schema verification rejects typed object drift", () => {
  const rows = [
    { object_type: "column", object_name: "public.books.title", definition: '{"type":"text"}' },
    { object_type: "relation", object_name: "public.books", definition: '{"rls":true}' },
  ];
  const objects = parseSchemaFingerprintOutput(JSON.stringify(rows));
  assert.equal(objects.length, 2);
  assert.deepEqual(parseSchemaFingerprintOutput(JSON.stringify({ rows })), objects);
  assert.deepEqual(buildSchemaLock(objects).objects, objects);
  assert.deepEqual(compareSchemaObjects(objects, objects), {
    missing: [], unexpected: [], changed: [],
  });
  assert.doesNotThrow(() => assertSchemaMatches(objects, objects, "Linked"));

  const changed = objects.map((object, index) => index === 0
    ? { ...object, sha256: "0".repeat(64) }
    : object);
  assert.throws(
    () => assertSchemaMatches(objects, changed, "Linked"),
    /Linked public schema[\s\S]*Changed[\s\S]*column:public\.books\.title/u,
  );
  assert.throws(
    () => parseSchemaFingerprintOutput(JSON.stringify({ rows: [] })),
    /does not contain any rows/u,
  );
});

test("schema verification never masks a failed query and cannot write from linked", async (t) => {
  const validOutput = JSON.stringify([
    { object_type: "relation", object_name: "public.books", definition: "{}" },
  ]);
  const root = await createFixture(t);
  const success = await verifySchemaIntegrity({
    target: "local",
    writeLock: true,
    repoRoot: root,
    execute: () => ({
      status: 0,
      stdout: validOutput,
      stderr: "Connecting to local database...\n",
    }),
  });
  assert.equal(success.objectCount, 1);
  await assert.rejects(
    () => verifySchemaIntegrity({
      target: "local",
      execute: () => ({ status: 1, stdout: validOutput, stderr: "database unavailable" }),
    }),
    /failed with exit code 1: database unavailable/u,
  );
  await assert.rejects(
    () => verifySchemaIntegrity({ target: "linked", writeLock: true }),
    /only be written from a clean local replay/u,
  );
});

test("history wrapper never masks a failed Supabase CLI command", async (t) => {
  const root = await createFixture(t);
  await addMigration(root, "20260101000000_create_readers.sql");
  await verifyMigrationIntegrity({ repoRoot: root, writeLock: true });
  const validOutput = JSON.stringify({
    message: "Migrations listed",
    migrations: [{
      local: "20260101000000",
      remote: "20260101000000",
      time: "2026-01-01 00:00:00",
    }],
  });

  await assert.rejects(
    () => verifySupabaseMigrationHistory({
      target: "linked",
      mode: "preflight",
      repoRoot: root,
      execute: () => ({ status: 1, stdout: validOutput, stderr: "connection failed" }),
    }),
    (error) => error instanceof MigrationIntegrityError
      && /failed with exit code 1: connection failed/u.test(error.message),
  );

  const result = await verifySupabaseMigrationHistory({
    target: "linked",
    mode: "postflight",
    repoRoot: root,
    execute: () => ({
      status: 0,
      stdout: validOutput,
      stderr: "Connecting to remote database...\n",
    }),
  });
  assert.equal(result.migrationCount, 1);
});

test("history wrapper requests JSON from the Supabase CLI", async (t) => {
  const root = await createFixture(t);
  const invocation = {};
  const sentinel = { status: 0, stdout: "", stderr: "" };

  const result = executeMigrationList("local", root, (command, args, options) => {
    Object.assign(invocation, { command, args, options });
    return sentinel;
  });

  assert.equal(result, sentinel);
  assert.equal(invocation.command, "supabase");
  assert.deepEqual(invocation.args, [
    "migration",
    "list",
    "--local",
    "--output-format",
    "json",
  ]);
  assert.equal(invocation.options.cwd, path.resolve(root));
  assert.equal(invocation.options.encoding, "utf8");
});

test("database query wrappers request JSON from the Supabase CLI", async (t) => {
  const root = await createFixture(t);
  const invocations = [];
  const capture = (command, args, options) => {
    invocations.push({ command, args, options });
    return { status: 0, stdout: "", stderr: "" };
  };

  executeContracts("local", root, capture);
  executeFingerprintQuery("linked", root, capture);

  assert.deepEqual(invocations.map(({ command, args }) => ({ command, args })), [
    {
      command: "supabase",
      args: [
        "db",
        "query",
        "--local",
        "--file",
        "supabase/contracts/production_integrity.sql",
        "--output-format",
        "json",
      ],
    },
    {
      command: "supabase",
      args: [
        "db",
        "query",
        "--linked",
        "--file",
        "supabase/contracts/public_schema_fingerprint.sql",
        "--output-format",
        "json",
      ],
    },
  ]);
  assert.ok(invocations.every(({ options }) => options.cwd === path.resolve(root)));
  assert.ok(invocations.every(({ options }) => options.encoding === "utf8"));
});

test("production contracts require a successful CLI and all true typed rows", () => {
  const rows = [{ contract: "books shelf", ok: true, detail: "valid" }];
  const validOutput = JSON.stringify(rows);
  assert.deepEqual(verifyProductionContractOutput(validOutput), ["books shelf"]);
  assert.deepEqual(verifyProductionContractOutput(JSON.stringify({ rows })), ["books shelf"]);
  assert.deepEqual(verifyProductionDatabaseContracts({
    target: "local",
    execute: () => ({
      status: 0,
      stdout: validOutput,
      stderr: "Connecting to local database...\n",
    }),
  }), ["books shelf"]);
  assert.throws(
    () => verifyProductionContractOutput(JSON.stringify({
      rows: [{ contract: "books shelf", ok: false, detail: "missing index" }],
    })),
    /books shelf: missing index/u,
  );
  assert.throws(
    () => verifyProductionDatabaseContracts({
      execute: () => ({ status: 1, stdout: validOutput, stderr: "query connection failed" }),
    }),
    /failed with exit code 1: query connection failed/u,
  );
});

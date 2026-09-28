const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { DesktopLocalDb } = require("../dist/sqliteLocalDb.cjs");

// Build with `npm --workspace @brack/desktop run build` first. Run with the
// installed Electron executable and ELECTRON_RUN_AS_NODE=1, matching the native
// better-sqlite3 module's Electron ABI without rebuilding shared dependencies.
const timestamp = "2026-09-27T12:00:00.000Z";
const laterTimestamp = "2026-09-27T12:01:00.000Z";
const table = "journal_entries";
let directory;
let database;
let writer;

const record = (overrides = {}) => ({
  id: "entry-1",
  user_id: "reader-1",
  data: { id: "entry-1", content: "Original synced writing", photo_url: "original.png" },
  status: "synced",
  updated_at: timestamp,
  deleted_at: null,
  last_synced_at: timestamp,
  ...overrides,
});

const outboxItem = (localRecord) => ({
  id: `outbox-${localRecord.id}`,
  client_mutation_id: `mutation-${localRecord.id}`,
  client_entity_id: localRecord.id,
  user_id: localRecord.user_id,
  entity: table,
  operation: localRecord.status === "deleted" ? "delete" : "update",
  payload: localRecord.data,
  status: localRecord.status === "failed" ? "failed" : "pending",
  attempt_count: localRecord.status === "failed" ? 1 : 0,
  last_error: null,
  created_at: laterTimestamp,
  updated_at: laterTimestamp,
  next_attempt_at: null,
});

const getRecord = (id = "entry-1") => database.handle({ operation: "getRecord", table, id });
const hydrate = (records, options = { preserveUnsynced: true }) => database.handle({
  operation: "upsertRecords", table, records, options,
});

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "brack-journal-db-"));
  const file = path.join(directory, "local.sqlite3");
  database = new DesktopLocalDb(file);
  writer = new DesktopLocalDb(file);
});

afterEach(() => {
  writer.close();
  database.close();
  // Remove only this test's generated directory under the system temp root.
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.match(path.basename(directory), /^brack-journal-db-/);
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("desktop SQLite conditional remote hydration", () => {
  for (const status of ["pending", "failed", "deleted"]) {
    it(`preserves a ${status} write committed after hydration read, including its outbox item`, () => {
      database.handle({ operation: "upsertRecord", table, record: record() });
      // A hydration pass saw a safe synced row, then another connection wrote
      // offline changes before the stale remote result reached the cache.
      assert.equal(getRecord().status, "synced");
      const localRecord = record({
        status,
        data: { id: "entry-1", content: "My new writing", photo_url: null },
        updated_at: laterTimestamp,
        deleted_at: status === "deleted" ? laterTimestamp : null,
      });
      const item = outboxItem(localRecord);
      writer.handle({ operation: "commitMutation", records: [{ table, record: localRecord }], item });

      hydrate([record({ data: { id: "entry-1", content: "Stale remote writing", photo_url: "old.png" } })]);

      assert.deepEqual(getRecord(), localRecord);
      assert.deepEqual(database.handle({
        operation: "listOutbox", userId: "reader-1", statuses: ["pending", "failed", "syncing"],
      }), [item]);
    });
  }

  it("updates a same-reader synced record and inserts a missing record in one hydration batch", () => {
    database.handle({ operation: "upsertRecord", table, record: record() });
    const refreshed = record({
      data: { id: "entry-1", content: "New synced writing", photo_url: "new.png" },
      updated_at: laterTimestamp,
      last_synced_at: laterTimestamp,
    });
    const inserted = record({ id: "entry-2", data: { id: "entry-2", content: "New remote entry" } });
    hydrate([refreshed, inserted]);
    assert.deepEqual(getRecord(), refreshed);
    assert.deepEqual(getRecord("entry-2"), inserted);
  });

  it("does not replace a synced record belonging to another reader", () => {
    const original = record();
    database.handle({ operation: "upsertRecord", table, record: original });
    hydrate([record({ user_id: "reader-2", data: { content: "Other account" } })]);
    assert.deepEqual(getRecord(), original);
  });

  for (const options of [undefined, { preserveUnsynced: false }]) {
    it(`retains normal explicit write behavior with ${options ? "disabled" : "omitted"} preservation`, () => {
      database.handle({ operation: "upsertRecord", table, record: record({ status: "pending" }) });
      const committed = record({ data: { content: "Acknowledged server result" } });
      database.handle({ operation: "upsertRecords", table, records: [committed], options });
      assert.deepEqual(getRecord(), committed);
    });
  }

  it("rolls back the entire guarded batch when a later record is invalid", () => {
    const original = record();
    database.handle({ operation: "upsertRecord", table, record: original });
    assert.throws(() => hydrate([
      record({ data: { content: "Must roll back" } }),
      record({ id: "" }),
    ]), /record.id must be a non-empty string/);
    assert.deepEqual(getRecord(), original);
  });
});

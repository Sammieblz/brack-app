import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDriver } from "./driver";
import type { LocalRecord, OutboxItem } from "@/services/sync/types";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@/services/platform", () => ({ isDesktopRuntime: () => false }));
vi.mock("@capacitor-community/sqlite", () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    async createConnection() { return bridge; }
  },
}));

let database: DatabaseSync;
let driver: LocalDriver;

// Execute the production native adapter's SQL against real in-memory SQLite.
// This verifies statements and renderer serialization, not the Capacitor bridge.
const bridge = {
  open: async () => undefined,
  execute: async (sql: string) => { database.exec(sql); },
  run: async (sql: string, bindings: SQLInputValue[] = []) => database.prepare(sql).run(...bindings),
  query: async (sql: string, bindings: SQLInputValue[] = []) => ({ values: database.prepare(sql).all(...bindings) }),
  beginTransaction: async () => { database.exec("BEGIN TRANSACTION"); },
  commitTransaction: async () => { database.exec("COMMIT"); },
  rollbackTransaction: async () => { database.exec("ROLLBACK"); },
};

const makeRecord = (status: LocalRecord["status"], content: string, userId = "reader"): LocalRecord => ({
  id: "entry",
  user_id: userId,
  data: { id: "entry", user_id: userId, content },
  status,
  updated_at: "2026-09-27T12:00:00Z",
  deleted_at: status === "deleted" ? "2026-09-27T12:00:00Z" : null,
  last_synced_at: null,
});
const mutation: OutboxItem = {
  id: "mutation", client_mutation_id: "mutation", client_entity_id: "entry", user_id: "reader",
  entity: "journal_entries", operation: "update", payload: { content: "Local writing" },
  status: "pending", attempt_count: 0, created_at: "2026-09-27T12:00:00Z", updated_at: "2026-09-27T12:00:00Z",
};

beforeEach(async () => {
  vi.resetModules();
  database = new DatabaseSync(":memory:");
  driver = (await import("./driver")).localDriver;
  await driver.init();
});
afterEach(() => { database.close(); });

describe("native journal hydration SQL", () => {
  it.each(["pending", "failed", "deleted"] as const)("preserves %s local rows", async (status) => {
    const local = makeRecord(status, "Local writing");
    await driver.upsertRecord("journal_entries", local);
    await driver.upsertRecords("journal_entries", [makeRecord("synced", "Old remote writing")], { preserveUnsynced: true });
    expect(await driver.getRecord("journal_entries", "entry")).toEqual(local);
  });

  it("preserves a different reader's row with the same id", async () => {
    const local = makeRecord("synced", "Private writing", "other-reader");
    await driver.upsertRecord("journal_entries", local);
    await driver.upsertRecords("journal_entries", [makeRecord("synced", "Remote writing")], { preserveUnsynced: true });
    expect(await driver.getRecord("journal_entries", "entry")).toEqual(local);
  });

  it("hydrates absent/synced rows and keeps unconditional sync acknowledgement available", async () => {
    await driver.upsertRecords("journal_entries", [makeRecord("synced", "Initial remote")], { preserveUnsynced: true });
    const refreshed = makeRecord("synced", "Updated remote");
    await driver.upsertRecords("journal_entries", [refreshed], { preserveUnsynced: true });
    expect(await driver.getRecord("journal_entries", "entry")).toEqual(refreshed);
    await driver.upsertRecord("journal_entries", makeRecord("pending", "Local writing"));
    const acknowledged = makeRecord("synced", "Local writing");
    await driver.upsertRecords("journal_entries", [acknowledged]);
    expect(await driver.getRecord("journal_entries", "entry")).toEqual(acknowledged);
  });

  it.each(["hydrate-first", "save-first"] as const)("keeps committed words and outbox with concurrent %s operations", async (order) => {
    await driver.upsertRecord("journal_entries", makeRecord("synced", "Initial"));
    const local = makeRecord("pending", "Local writing");
    const save = () => driver.commitMutation([{ table: "journal_entries", record: local }], mutation);
    const hydrate = () => driver.upsertRecords("journal_entries", [makeRecord("synced", "Old remote")], { preserveUnsynced: true });
    await Promise.all(order === "hydrate-first" ? [hydrate(), save()] : [save(), hydrate()]);
    expect(await driver.getRecord("journal_entries", "entry")).toEqual(local);
    expect(await driver.listOutbox("reader")).toHaveLength(1);
  });
});

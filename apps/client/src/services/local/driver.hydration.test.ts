import Dexie from "dexie";
import { describe, expect, it, vi } from "vitest";
import type { LocalEntityStatus, LocalRecord, OutboxItem } from "@/services/sync/types";
import { localDriver } from "./driver";

// Exercise the real Dexie implementation. The shared Vitest setup supplies
// fake-indexeddb; only runtime selection is fixed to the browser boundary.
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("@/services/platform", () => ({ isDesktopRuntime: () => false }));

interface JournalData {
  id: string;
  user_id: string;
  content: string;
  content_html: string;
  photo_url: string | null;
}

const timestamp = "2026-09-27T12:00:00.000Z";
const record = (
  userId: string,
  id: string,
  content: string,
  status: LocalEntityStatus = "synced",
): LocalRecord<JournalData> => ({
  id,
  user_id: userId,
  data: { id, user_id: userId, content, content_html: `<p><strong>${content}</strong></p>`, photo_url: "fixture-photo" },
  status,
  updated_at: timestamp,
  deleted_at: status === "deleted" ? timestamp : null,
  last_synced_at: timestamp,
});

const mutation = (entry: LocalRecord<JournalData>): OutboxItem => ({
  id: crypto.randomUUID(),
  client_mutation_id: crypto.randomUUID(),
  client_entity_id: entry.id,
  user_id: entry.user_id,
  entity: "journal_entries",
  operation: "update",
  payload: entry.data,
  status: "pending",
  attempt_count: 0,
  created_at: timestamp,
  updated_at: timestamp,
});

describe("atomic IndexedDB remote hydration", () => {
  it.each(["pending", "failed", "deleted"] as const)(
    "retains the entire %s local record while hydrating other rows",
    async (status) => {
      const userId = crypto.randomUUID();
      const local = record(userId, crypto.randomUUID(), "Unsynced local writing", status);
      const remote = record(userId, local.id, "Older server writing");
      const fresh = record(userId, crypto.randomUUID(), "Another server entry");
      await localDriver.upsertRecord("journal_entries", local);

      await localDriver.upsertRecords("journal_entries", [remote, fresh], { preserveUnsynced: true });

      expect(await localDriver.getRecord("journal_entries", local.id)).toEqual(local);
      expect(await localDriver.getRecord("journal_entries", fresh.id)).toEqual(fresh);
    },
  );

  it("refreshes synced rows and inserts new remote rows", async () => {
    const userId = crypto.randomUUID();
    const existing = record(userId, crypto.randomUUID(), "Old synced content");
    const refreshed = record(userId, existing.id, "New server content");
    const fresh = record(userId, crypto.randomUUID(), "New remote entry");
    await localDriver.upsertRecord("journal_entries", existing);

    await localDriver.upsertRecords("journal_entries", [refreshed, fresh], { preserveUnsynced: true });

    expect(await localDriver.getRecord("journal_entries", existing.id)).toEqual(refreshed);
    expect(await localDriver.getRecord("journal_entries", fresh.id)).toEqual(fresh);
  });

  it("does not overwrite another reader's synced record on an ID collision", async () => {
    const local = record(crypto.randomUUID(), crypto.randomUUID(), "Other reader's writing");
    const remote = record(crypto.randomUUID(), local.id, "Colliding remote identity");
    await localDriver.upsertRecord("journal_entries", local);

    await localDriver.upsertRecords("journal_entries", [remote], { preserveUnsynced: true });

    expect(await localDriver.getRecord("journal_entries", local.id)).toEqual(local);
  });

  it("allows an explicit normal sync write to acknowledge a pending record", async () => {
    const userId = crypto.randomUUID();
    const local = record(userId, crypto.randomUUID(), "Local writing", "pending");
    const acknowledged = { ...local, status: "synced" as const, last_synced_at: "2026-09-27T12:01:00.000Z" };
    await localDriver.upsertRecord("journal_entries", local);

    await localDriver.upsertRecords("journal_entries", [acknowledged]);

    expect(await localDriver.getRecord("journal_entries", local.id)).toEqual(acknowledged);
  });

  it.each(["hydration", "save"] as const)(
    "keeps a concurrent local mutation and its outbox when %s starts first",
    async (first) => {
      const userId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const local = record(userId, id, "Writing saved during refresh", "pending");
      const outbox = mutation(local);
      const remote = record(userId, id, "Older server version");
      const otherRemote = record(userId, crypto.randomUUID(), "Unrelated hydrated entry");
      await localDriver.upsertRecord("journal_entries", record(userId, id, "Previously synced"));

      // Start both operations before awaiting either: IndexedDB transaction
      // boundaries, rather than a repository-side pre-read, must protect data.
      const hydrate = () => localDriver.upsertRecords("journal_entries", [remote, otherRemote], { preserveUnsynced: true });
      const save = () => localDriver.commitMutation([{ table: "journal_entries", record: local }], outbox);
      await Promise.all(first === "hydration" ? [hydrate(), save()] : [save(), hydrate()]);

      expect(await localDriver.getRecord("journal_entries", id)).toEqual(local);
      expect(await localDriver.getRecord("journal_entries", otherRemote.id)).toEqual(otherRemote);
      expect(await localDriver.listOutbox(userId, ["pending"])).toEqual([outbox]);
    },
  );

  it.each(["hydration", "other tab save"] as const)(
    "keeps edits from another IndexedDB connection when %s starts first",
    async (first) => {
      const userId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const local = record(userId, id, "Writing saved in another tab", "pending");
      const outbox = mutation(local);
      await localDriver.upsertRecord("journal_entries", record(userId, id, "Previously synced"));
      // A separate real Dexie connection prevents a process-local operation
      // queue from accidentally making this concurrency check pass.
      const otherTab = new Dexie("brack_offline");
      await otherTab.open();
      try {
        const journal = otherTab.table<LocalRecord<JournalData>, string>("journal_entries");
        const queue = otherTab.table<OutboxItem, string>("outbox");
        const hydrate = () => localDriver.upsertRecords("journal_entries", [record(userId, id, "Older server version")], { preserveUnsynced: true });
        const save = () => otherTab.transaction("rw", journal, queue, async () => {
          await journal.put(local);
          await queue.put(outbox);
        });
        await Promise.all(first === "hydration" ? [hydrate(), save()] : [save(), hydrate()]);

        expect(await localDriver.getRecord("journal_entries", id)).toEqual(local);
        expect(await localDriver.listOutbox(userId, ["pending"])).toEqual([outbox]);
      } finally {
        otherTab.close();
      }
    },
  );
});

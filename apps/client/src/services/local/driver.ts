import { Capacitor } from "@capacitor/core";
import Dexie, { type Table } from "dexie";
import type { SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { LocalRecord, OutboxItem, SyncState } from "@/services/sync/types";
import { isDesktopRuntime } from "@/services/platform";

export type LocalTableName =
  | "books"
  | "reading_sessions"
  | "progress_logs"
  | "journal_entries"
  | "goals"
  | "book_lists"
  | "book_list_items"
  | "profile_preferences"
  | "pending_book_imports"
  | "book_search_cache"
  | "content_snapshots";

const ENTITY_TABLES: LocalTableName[] = [
  "books",
  "reading_sessions",
  "progress_logs",
  "journal_entries",
  "goals",
  "book_lists",
  "book_list_items",
  "profile_preferences",
  "pending_book_imports",
  "book_search_cache",
  "content_snapshots",
];

export interface OutboxCounts {
  pending: number;
  failed: number;
  syncing: number;
}

export interface LocalMutationRecord {
  table: LocalTableName;
  record: LocalRecord<unknown>;
}

export interface LocalBookIdentityRemap {
  userId: string;
  staleBookId: string;
  canonicalBookRecord: LocalRecord<unknown>;
  sourceOutbox?: {
    id: string;
    clientMutationId: string;
    expectedStatus: OutboxItem["status"];
    expectedAttemptCount: number;
  };
  requireNoOtherUnsyncedReferences?: boolean;
}

const BOOK_REFERENCE_TABLES = [
  "reading_sessions",
  "progress_logs",
  "journal_entries",
  "book_list_items",
  "pending_book_imports",
] as const satisfies readonly LocalTableName[];

const OUTSTANDING_OUTBOX_STATUSES = new Set<OutboxItem["status"]>([
  "pending",
  "syncing",
  "failed",
]);

const bookAliasState = (userId: string, staleBookId: string, canonicalBookId: string): SyncState => ({
  key: `${userId}:book_alias:${staleBookId}`,
  user_id: userId,
  cursor: canonicalBookId,
  last_synced_at: new Date().toISOString(),
});

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const remapLocalBookReference = (
  table: (typeof BOOK_REFERENCE_TABLES)[number],
  record: LocalRecord,
  staleBookId: string,
  canonicalBookId: string,
): LocalRecord | null => {
  const data = asObject(record.data);
  if (!data) return null;

  const referenceKey = table === "pending_book_imports" ? "resolved_book_id" : "book_id";
  if (data[referenceKey] !== staleBookId) return null;

  return {
    ...record,
    data: {
      ...data,
      [referenceKey]: canonicalBookId,
    },
  };
};

const remapOutboxBookReference = (
  item: OutboxItem,
  staleBookId: string,
  canonicalBookId: string,
): OutboxItem => {
  const payload = asObject(item.payload);
  let clientEntityId = item.client_entity_id;
  let nextPayload = payload;
  let changed = false;

  if (item.entity === "books" && clientEntityId === staleBookId) {
    clientEntityId = canonicalBookId;
    changed = true;
  }

  if (payload) {
    if (payload.book_id === staleBookId) {
      nextPayload = { ...nextPayload, book_id: canonicalBookId };
      changed = true;
    }

    if (Array.isArray(payload.ordered_book_ids) && payload.ordered_book_ids.includes(staleBookId)) {
      nextPayload = {
        ...nextPayload,
        ordered_book_ids: payload.ordered_book_ids.map((bookId) =>
          bookId === staleBookId ? canonicalBookId : bookId
        ),
      };
      changed = true;
    }

    if (item.entity === "books") {
      if (payload.id === staleBookId) {
        nextPayload = { ...nextPayload, id: canonicalBookId };
        changed = true;
      }

      const snapshot = asObject(payload.__sync_snapshot);
      if (snapshot?.id === staleBookId) {
        nextPayload = {
          ...nextPayload,
          __sync_snapshot: {
            ...snapshot,
            id: canonicalBookId,
          },
        };
        changed = true;
      }
    }
  }

  return changed
    ? {
        ...item,
        client_entity_id: clientEntityId,
        payload: nextPayload,
      }
    : item;
};

const outboxReferencesBook = (item: OutboxItem, bookId: string) => {
  if (item.entity === "books" && item.client_entity_id === bookId) return true;
  const payload = asObject(item.payload);
  if (!payload) return false;
  if (payload.book_id === bookId) return true;
  if (Array.isArray(payload.ordered_book_ids) && payload.ordered_book_ids.includes(bookId)) {
    return true;
  }
  if (item.entity !== "books") return false;
  return payload.id === bookId || asObject(payload.__sync_snapshot)?.id === bookId;
};

const recordReferencesBook = (
  table: (typeof BOOK_REFERENCE_TABLES)[number],
  record: LocalRecord,
  bookId: string,
) => {
  const data = asObject(record.data);
  if (!data) return false;
  return table === "pending_book_imports"
    ? data.resolved_book_id === bookId
    : data.book_id === bookId;
};

const selectCanonicalBookRecord = (
  canonicalBookRecord: LocalRecord,
  staleBookRecord: LocalRecord | null,
  existingCanonicalRecord: LocalRecord | null,
  hasRemainingBookMutation: boolean,
  sourceBookIsCanonical: boolean,
): LocalRecord => {
  const unsyncedCanonical =
    existingCanonicalRecord &&
    existingCanonicalRecord.status !== "synced" &&
    (!sourceBookIsCanonical || hasRemainingBookMutation)
      ? existingCanonicalRecord
      : null;
  const localCandidate = unsyncedCanonical ?? (
    hasRemainingBookMutation && staleBookRecord && staleBookRecord.status !== "synced"
      ? staleBookRecord
      : null
  );
  if (!localCandidate) return canonicalBookRecord;

  const canonicalData = asObject(canonicalBookRecord.data) ?? {};
  const localData = asObject(localCandidate.data) ?? {};
  return {
    ...localCandidate,
    id: canonicalBookRecord.id,
    user_id: canonicalBookRecord.user_id,
    data: {
      ...canonicalData,
      ...localData,
      id: canonicalBookRecord.id,
      user_id: canonicalBookRecord.user_id,
    },
  };
};

const countBlockingBookReferences = (
  recordsByTable: Map<(typeof BOOK_REFERENCE_TABLES)[number], LocalRecord[]>,
  outboxItems: OutboxItem[],
  sourceOutboxId: string | undefined,
  staleBookId: string,
) => {
  const relatedOutbox = outboxItems.filter(
    (item) =>
      item.id !== sourceOutboxId &&
      OUTSTANDING_OUTBOX_STATUSES.has(item.status) &&
      outboxReferencesBook(item, staleBookId),
  );
  const representedLocalChanges = new Set(
    relatedOutbox.map((item) => `${item.entity}:${item.client_entity_id}`),
  );
  let orphanedLocalChangeCount = 0;

  for (const [table, records] of recordsByTable) {
    orphanedLocalChangeCount += records.filter(
      (record) =>
        (record.status !== "synced" || table === "pending_book_imports") &&
        recordReferencesBook(table, record, staleBookId) &&
        !representedLocalChanges.has(`${table}:${record.id}`),
    ).length;
  }

  return new Set(relatedOutbox.map((item) => item.id)).size + orphanedLocalChangeCount;
};

const assertBookRemapCanDiscardSourceOnly = (
  request: LocalBookIdentityRemap,
  recordsByTable: Map<(typeof BOOK_REFERENCE_TABLES)[number], LocalRecord[]>,
  outboxItems: OutboxItem[],
) => {
  if (!request.requireNoOtherUnsyncedReferences) return;
  const relatedChangeCount = countBlockingBookReferences(
    recordsByTable,
    outboxItems,
    request.sourceOutbox?.id,
    request.staleBookId,
  );
  if (relatedChangeCount > 0) {
    throw new Error(
      `${relatedChangeCount} other unsynced reading change${
        relatedChangeCount === 1 ? "" : "s"
      } appeared while the library copy was loading. Those changes were kept.`,
    );
  }
};

const assertBookRemapSourceIsCurrent = (
  request: LocalBookIdentityRemap,
  outboxItems: OutboxItem[],
) => {
  if (!request.sourceOutbox) return null;
  const source = outboxItems.find((item) => item.id === request.sourceOutbox?.id);
  if (
    !source ||
    source.client_mutation_id !== request.sourceOutbox.clientMutationId ||
    source.status !== request.sourceOutbox.expectedStatus ||
    source.attempt_count !== request.sourceOutbox.expectedAttemptCount
  ) {
    throw new Error(
      "This reading change was updated in another tab or sync pass. Its local data was kept; refresh and review it again.",
    );
  }
  return source;
};

export interface LocalDriver {
  init(): Promise<void>;
  upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>): Promise<void>;
  upsertRecords<T>(table: LocalTableName, records: LocalRecord<T>[]): Promise<void>;
  getRecord<T>(table: LocalTableName, id: string): Promise<LocalRecord<T> | null>;
  listRecords<T>(
    table: LocalTableName,
    userId: string,
    options?: { includeDeleted?: boolean }
  ): Promise<LocalRecord<T>[]>;
  removeRecord(table: LocalTableName, id: string): Promise<void>;
  enqueueOutbox(item: OutboxItem): Promise<void>;
  commitMutation(records: LocalMutationRecord[], item: OutboxItem): Promise<void>;
  remapBookIdentity(request: LocalBookIdentityRemap): Promise<LocalRecord<unknown>>;
  listOutbox(userId: string, statuses?: OutboxItem["status"][]): Promise<OutboxItem[]>;
  updateOutbox(id: string, updates: Partial<OutboxItem>): Promise<void>;
  deleteOutbox(id: string): Promise<void>;
  getOutboxCounts(userId: string): Promise<OutboxCounts>;
  getSyncState(userId: string, scope: string): Promise<SyncState | null>;
  setSyncState(state: SyncState): Promise<void>;
}

class BrackLocalDexie extends Dexie {
  books!: Table<LocalRecord, string>;
  reading_sessions!: Table<LocalRecord, string>;
  progress_logs!: Table<LocalRecord, string>;
  journal_entries!: Table<LocalRecord, string>;
  goals!: Table<LocalRecord, string>;
  book_lists!: Table<LocalRecord, string>;
  book_list_items!: Table<LocalRecord, string>;
  profile_preferences!: Table<LocalRecord, string>;
  pending_book_imports!: Table<LocalRecord, string>;
  book_search_cache!: Table<LocalRecord, string>;
  content_snapshots!: Table<LocalRecord, string>;
  outbox!: Table<OutboxItem, string>;
  sync_state!: Table<SyncState, string>;

  constructor() {
    super("brack_offline");
    this.version(1).stores({
      books: "id, user_id, status, updated_at, deleted_at",
      reading_sessions: "id, user_id, status, updated_at, deleted_at",
      progress_logs: "id, user_id, status, updated_at, deleted_at",
      journal_entries: "id, user_id, status, updated_at, deleted_at",
      goals: "id, user_id, status, updated_at, deleted_at",
      profile_preferences: "id, user_id, status, updated_at, deleted_at",
      outbox:
        "id, client_mutation_id, client_entity_id, user_id, entity, status, created_at, next_attempt_at",
      sync_state: "key, user_id",
    });
    this.version(2).stores({
      books: "id, user_id, status, updated_at, deleted_at",
      reading_sessions: "id, user_id, status, updated_at, deleted_at",
      progress_logs: "id, user_id, status, updated_at, deleted_at",
      journal_entries: "id, user_id, status, updated_at, deleted_at",
      goals: "id, user_id, status, updated_at, deleted_at",
      book_lists: "id, user_id, status, updated_at, deleted_at",
      book_list_items: "id, user_id, status, updated_at, deleted_at",
      profile_preferences: "id, user_id, status, updated_at, deleted_at",
      pending_book_imports: "id, user_id, status, updated_at, deleted_at",
      book_search_cache: "id, user_id, status, updated_at, deleted_at",
      content_snapshots: "id, user_id, status, updated_at, deleted_at",
      outbox:
        "id, client_mutation_id, client_entity_id, user_id, entity, status, created_at, next_attempt_at",
      sync_state: "key, user_id",
    });
  }
}

class DexieLocalDriver implements LocalDriver {
  private db = new BrackLocalDexie();
  private initialized = false;

  async init() {
    if (this.initialized) return;
    await this.db.open();
    this.initialized = true;
  }

  private table<T = unknown>(name: LocalTableName): Table<LocalRecord<T>, string> {
    return this.db.table(name);
  }

  async upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>) {
    await this.init();
    await this.table<T>(table).put(record);
  }

  async upsertRecords<T>(table: LocalTableName, records: LocalRecord<T>[]) {
    await this.init();
    if (records.length === 0) return;
    await this.table<T>(table).bulkPut(records);
  }

  async getRecord<T>(table: LocalTableName, id: string) {
    await this.init();
    return (await this.table<T>(table).get(id)) ?? null;
  }

  async listRecords<T>(
    table: LocalTableName,
    userId: string,
    options: { includeDeleted?: boolean } = {}
  ) {
    await this.init();
    const records = await this.table<T>(table).where("user_id").equals(userId).toArray();
    return records
      .filter((record) => options.includeDeleted || record.status !== "deleted")
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }

  async removeRecord(table: LocalTableName, id: string) {
    await this.init();
    await this.table(table).delete(id);
  }

  async enqueueOutbox(item: OutboxItem) {
    await this.init();
    await this.db.outbox.put(item);
  }

  async commitMutation(records: LocalMutationRecord[], item: OutboxItem) {
    await this.init();
    const tables = Array.from(new Set(records.map(({ table }) => table))).map((table) =>
      this.table(table)
    );
    await this.db.transaction("rw", [...tables, this.db.outbox], async () => {
      for (const { table, record } of records) {
        await this.table(table).put(record);
      }
      await this.db.outbox.put(item);
    });
  }

  async remapBookIdentity(request: LocalBookIdentityRemap) {
    await this.init();
    const canonicalBookId = request.canonicalBookRecord.id;
    if (!canonicalBookId || request.canonicalBookRecord.user_id !== request.userId) {
      throw new Error("Invalid local book identity remap");
    }

    const referenceTables = BOOK_REFERENCE_TABLES.map((table) => this.table(table));
    return this.db.transaction(
      "rw",
      [this.db.books, ...referenceTables, this.db.outbox, this.db.sync_state],
      async () => {
        const recordsByTable = new Map<
          (typeof BOOK_REFERENCE_TABLES)[number],
          LocalRecord[]
        >();
        for (const table of BOOK_REFERENCE_TABLES) {
          recordsByTable.set(
            table,
            await this.table(table).where("user_id").equals(request.userId).toArray(),
          );
        }
        const outboxItems = await this.db.outbox
          .where("user_id")
          .equals(request.userId)
          .toArray();

        const sourceOutbox = assertBookRemapSourceIsCurrent(request, outboxItems);
        assertBookRemapCanDiscardSourceOnly(request, recordsByTable, outboxItems);

        const rewrittenOutbox = outboxItems
          .filter(
            (item) =>
              item.id !== request.sourceOutbox?.id &&
              OUTSTANDING_OUTBOX_STATUSES.has(item.status),
          )
          .map((item) =>
            remapOutboxBookReference(item, request.staleBookId, canonicalBookId)
          );
        const hasRemainingBookMutation = rewrittenOutbox.some(
          (item) => item.entity === "books" && item.client_entity_id === canonicalBookId,
        );
        const [staleBookRecord, existingCanonicalRecord] = await Promise.all([
          this.db.books.get(request.staleBookId),
          this.db.books.get(canonicalBookId),
        ]);
        if (staleBookRecord && staleBookRecord.user_id !== request.userId) {
          throw new Error("The stale local book belongs to a different account");
        }
        if (existingCanonicalRecord && existingCanonicalRecord.user_id !== request.userId) {
          throw new Error("The canonical local book belongs to a different account");
        }
        const canonicalBookRecord = selectCanonicalBookRecord(
          request.canonicalBookRecord,
          staleBookRecord ?? null,
          existingCanonicalRecord ?? null,
          hasRemainingBookMutation,
          sourceOutbox?.entity === "books" &&
            sourceOutbox.client_entity_id === canonicalBookId,
        );

        for (const table of BOOK_REFERENCE_TABLES) {
          const rewrittenRecords = (recordsByTable.get(table) ?? [])
            .map((record) =>
              remapLocalBookReference(
                table,
                record,
                request.staleBookId,
                canonicalBookId,
              )
            )
            .filter((record): record is LocalRecord => Boolean(record));
          if (rewrittenRecords.length > 0) {
            await this.table(table).bulkPut(rewrittenRecords);
          }
        }
        if (rewrittenOutbox.length > 0) {
          await this.db.outbox.bulkPut(rewrittenOutbox);
        }

        await this.db.books.put(canonicalBookRecord);
        if (request.staleBookId !== canonicalBookId) {
          await this.db.sync_state.put(
            bookAliasState(request.userId, request.staleBookId, canonicalBookId),
          );
          await this.db.books.delete(request.staleBookId);
        }
        if (request.sourceOutbox) {
          await this.db.outbox.delete(request.sourceOutbox.id);
        }
        return canonicalBookRecord;
      },
    );
  }

  async listOutbox(userId: string, statuses: OutboxItem["status"][] = ["pending", "failed"]) {
    await this.init();
    const records = await this.db.outbox.where("user_id").equals(userId).toArray();
    return records
      .filter((record) => statuses.includes(record.status))
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }

  async updateOutbox(id: string, updates: Partial<OutboxItem>) {
    await this.init();
    await this.db.outbox.update(id, updates);
  }

  async deleteOutbox(id: string) {
    await this.init();
    await this.db.outbox.delete(id);
  }

  async getOutboxCounts(userId: string) {
    await this.init();
    const records = await this.db.outbox.where("user_id").equals(userId).toArray();
    return {
      pending: records.filter((record) => record.status === "pending").length,
      failed: records.filter((record) => record.status === "failed").length,
      syncing: records.filter((record) => record.status === "syncing").length,
    };
  }

  async getSyncState(userId: string, scope: string) {
    await this.init();
    return (await this.db.sync_state.get(`${userId}:${scope}`)) ?? null;
  }

  async setSyncState(state: SyncState) {
    await this.init();
    await this.db.sync_state.put(state);
  }
}

class SQLiteLocalDriver implements LocalDriver {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    const sqliteModule = await import("@capacitor-community/sqlite");
    this.sqlite = new sqliteModule.SQLiteConnection(sqliteModule.CapacitorSQLite);

    this.db = await this.sqlite.createConnection(
      "brack_offline",
      false,
      "no-encryption",
      1,
      false
    );
    await this.db.open();

    for (const table of ENTITY_TABLES) {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          last_synced_at TEXT
        );
      `);
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id);`);
      await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_${table}_updated_at ON ${table}(updated_at);`);
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        client_mutation_id TEXT NOT NULL,
        client_entity_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        entity TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_attempt_at TEXT
      );
    `);
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_outbox_user_status ON outbox(user_id, status);");

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        cursor TEXT,
        last_synced_at TEXT
      );
    `);
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_sync_state_user_id ON sync_state(user_id);");

    this.initialized = true;
  }

  private connection() {
    if (!this.db) throw new Error("Local SQLite database is not initialized");
    return this.db;
  }

  private serializeRecord<T>(record: LocalRecord<T>) {
    return [
      record.id,
      record.user_id,
      JSON.stringify(record.data),
      record.status,
      record.updated_at,
      record.deleted_at ?? null,
      record.last_synced_at ?? null,
    ];
  }

  private deserializeRecord<T>(row: Record<string, unknown>): LocalRecord<T> {
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      data: JSON.parse(String(row.data)) as T,
      status: row.status as LocalRecord<T>["status"],
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
      last_synced_at: (row.last_synced_at as string | null) ?? null,
    };
  }

  private async writeRecord<T>(
    table: LocalTableName,
    record: LocalRecord<T>,
    transaction = true,
  ) {
    await this.connection().run(
      `INSERT OR REPLACE INTO ${table}
       (id, user_id, data, status, updated_at, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      this.serializeRecord(record),
      transaction,
    );
  }

  private async writeOutbox(item: OutboxItem, transaction = true) {
    await this.connection().run(
      `INSERT OR REPLACE INTO outbox
       (id, client_mutation_id, client_entity_id, user_id, entity, operation, payload, status,
        attempt_count, last_error, created_at, updated_at, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.client_mutation_id,
        item.client_entity_id,
        item.user_id,
        item.entity,
        item.operation,
        JSON.stringify(item.payload),
        item.status,
        item.attempt_count,
        item.last_error ?? null,
        item.created_at,
        item.updated_at,
        item.next_attempt_at ?? null,
      ],
      transaction,
    );
  }

  private async deleteRecord(table: LocalTableName, id: string, transaction = true) {
    await this.connection().run(`DELETE FROM ${table} WHERE id = ?`, [id], transaction);
  }

  private async deleteOutboxRecord(id: string, transaction = true) {
    await this.connection().run("DELETE FROM outbox WHERE id = ?", [id], transaction);
  }

  private async writeSyncState(state: SyncState, transaction = true) {
    await this.connection().run(
      "INSERT OR REPLACE INTO sync_state (key, user_id, cursor, last_synced_at) VALUES (?, ?, ?, ?)",
      [state.key, state.user_id, state.cursor, state.last_synced_at],
      transaction,
    );
  }

  async upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>) {
    await this.init();
    await this.writeRecord(table, record);
  }

  async upsertRecords<T>(table: LocalTableName, records: LocalRecord<T>[]) {
    for (const record of records) {
      await this.upsertRecord(table, record);
    }
  }

  async getRecord<T>(table: LocalTableName, id: string) {
    await this.init();
    const result = await this.connection().query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    const row = result.values?.[0];
    return row ? this.deserializeRecord<T>(row) : null;
  }

  async listRecords<T>(
    table: LocalTableName,
    userId: string,
    options: { includeDeleted?: boolean } = {}
  ) {
    await this.init();
    const result = await this.connection().query(
      `SELECT * FROM ${table} WHERE user_id = ? ${
        options.includeDeleted ? "" : "AND status <> 'deleted'"
      } ORDER BY updated_at DESC`,
      [userId]
    );
    return (result.values ?? []).map((row) => this.deserializeRecord<T>(row));
  }

  async removeRecord(table: LocalTableName, id: string) {
    await this.init();
    await this.deleteRecord(table, id);
  }

  async enqueueOutbox(item: OutboxItem) {
    await this.init();
    await this.writeOutbox(item);
  }

  async commitMutation(records: LocalMutationRecord[], item: OutboxItem) {
    await this.init();
    const connection = this.connection();
    await connection.beginTransaction();
    try {
      for (const { table, record } of records) {
        await this.writeRecord(table, record, false);
      }
      await this.writeOutbox(item, false);
      await connection.commitTransaction();
    } catch (error) {
      try {
        await connection.rollbackTransaction();
      } catch (rollbackError) {
        console.error("Failed to roll back local mutation:", rollbackError);
      }
      throw error;
    }
  }

  async remapBookIdentity(request: LocalBookIdentityRemap) {
    await this.init();
    const canonicalBookId = request.canonicalBookRecord.id;
    if (!canonicalBookId || request.canonicalBookRecord.user_id !== request.userId) {
      throw new Error("Invalid local book identity remap");
    }

    const connection = this.connection();
    await connection.beginTransaction();
    try {
      const recordsByTable = new Map<
        (typeof BOOK_REFERENCE_TABLES)[number],
        LocalRecord[]
      >();
      for (const table of BOOK_REFERENCE_TABLES) {
        recordsByTable.set(
          table,
          await this.listRecords(table, request.userId, { includeDeleted: true }),
        );
      }
      const outboxItems = await this.listOutbox(request.userId, [
        "pending",
        "syncing",
        "failed",
      ]);

      const sourceOutbox = assertBookRemapSourceIsCurrent(request, outboxItems);
      assertBookRemapCanDiscardSourceOnly(request, recordsByTable, outboxItems);

      const rewrittenOutbox = outboxItems
        .filter((item) => item.id !== request.sourceOutbox?.id)
        .map((item) =>
          remapOutboxBookReference(item, request.staleBookId, canonicalBookId)
        );
      const hasRemainingBookMutation = rewrittenOutbox.some(
        (item) => item.entity === "books" && item.client_entity_id === canonicalBookId,
      );
      const staleBookRecord = await this.getRecord("books", request.staleBookId);
      const existingCanonicalRecord = await this.getRecord("books", canonicalBookId);
      if (staleBookRecord && staleBookRecord.user_id !== request.userId) {
        throw new Error("The stale local book belongs to a different account");
      }
      if (existingCanonicalRecord && existingCanonicalRecord.user_id !== request.userId) {
        throw new Error("The canonical local book belongs to a different account");
      }
      const canonicalBookRecord = selectCanonicalBookRecord(
        request.canonicalBookRecord,
        staleBookRecord,
        existingCanonicalRecord,
        hasRemainingBookMutation,
        sourceOutbox?.entity === "books" && sourceOutbox.client_entity_id === canonicalBookId,
      );

      for (const table of BOOK_REFERENCE_TABLES) {
        const rewrittenRecords = (recordsByTable.get(table) ?? [])
          .map((record) =>
            remapLocalBookReference(
              table,
              record,
              request.staleBookId,
              canonicalBookId,
            )
          )
          .filter((record): record is LocalRecord => Boolean(record));
        for (const record of rewrittenRecords) {
          await this.writeRecord(table, record, false);
        }
      }
      for (const item of rewrittenOutbox) {
        await this.writeOutbox(item, false);
      }

      await this.writeRecord("books", canonicalBookRecord, false);
      if (request.staleBookId !== canonicalBookId) {
        await this.writeSyncState(
          bookAliasState(request.userId, request.staleBookId, canonicalBookId),
          false,
        );
        await this.deleteRecord("books", request.staleBookId, false);
      }
      if (request.sourceOutbox) {
        await this.deleteOutboxRecord(request.sourceOutbox.id, false);
      }
      await connection.commitTransaction();
      return canonicalBookRecord;
    } catch (error) {
      try {
        await connection.rollbackTransaction();
      } catch (rollbackError) {
        console.error("Failed to roll back local book identity remap:", rollbackError);
      }
      throw error;
    }
  }

  async listOutbox(userId: string, statuses: OutboxItem["status"][] = ["pending", "failed"]) {
    await this.init();
    const placeholders = statuses.map(() => "?").join(", ");
    const result = await this.connection().query(
      `SELECT * FROM outbox WHERE user_id = ? AND status IN (${placeholders}) ORDER BY created_at ASC`,
      [userId, ...statuses]
    );

    return (result.values ?? []).map((row) => ({
      ...row,
      payload: JSON.parse(String(row.payload)),
      attempt_count: Number(row.attempt_count ?? 0),
    })) as OutboxItem[];
  }

  async updateOutbox(id: string, updates: Partial<OutboxItem>) {
    await this.init();
    const existing = await this.connection().query("SELECT * FROM outbox WHERE id = ? LIMIT 1", [id]);
    const row = existing.values?.[0];
    if (!row) return;
    await this.enqueueOutbox({
      ...(row as unknown as OutboxItem),
      payload: JSON.parse(String(row.payload)),
      attempt_count: Number(row.attempt_count ?? 0),
      ...updates,
    });
  }

  async deleteOutbox(id: string) {
    await this.init();
    await this.deleteOutboxRecord(id);
  }

  async getOutboxCounts(userId: string) {
    const records = await this.listOutbox(userId, ["pending", "failed", "syncing"]);
    return {
      pending: records.filter((record) => record.status === "pending").length,
      failed: records.filter((record) => record.status === "failed").length,
      syncing: records.filter((record) => record.status === "syncing").length,
    };
  }

  async getSyncState(userId: string, scope: string) {
    await this.init();
    const result = await this.connection().query(
      "SELECT * FROM sync_state WHERE key = ? LIMIT 1",
      [`${userId}:${scope}`]
    );
    return (result.values?.[0] as SyncState | undefined) ?? null;
  }

  async setSyncState(state: SyncState) {
    await this.init();
    await this.writeSyncState(state);
  }
}

/**
 * Capacitor SQLite transactions are connection-wide. Queue every externally
 * visible operation so no read or write can join another operation's manual
 * transaction while it is awaiting the native bridge.
 */
class SerializedLocalDriver implements LocalDriver {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly delegate: LocalDriver) {}

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  init() {
    return this.run(() => this.delegate.init());
  }

  upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>) {
    return this.run(() => this.delegate.upsertRecord(table, record));
  }

  upsertRecords<T>(table: LocalTableName, records: LocalRecord<T>[]) {
    return this.run(() => this.delegate.upsertRecords(table, records));
  }

  getRecord<T>(table: LocalTableName, id: string) {
    return this.run(() => this.delegate.getRecord<T>(table, id));
  }

  listRecords<T>(
    table: LocalTableName,
    userId: string,
    options?: { includeDeleted?: boolean },
  ) {
    return this.run(() => this.delegate.listRecords<T>(table, userId, options));
  }

  removeRecord(table: LocalTableName, id: string) {
    return this.run(() => this.delegate.removeRecord(table, id));
  }

  enqueueOutbox(item: OutboxItem) {
    return this.run(() => this.delegate.enqueueOutbox(item));
  }

  commitMutation(records: LocalMutationRecord[], item: OutboxItem) {
    return this.run(() => this.delegate.commitMutation(records, item));
  }

  remapBookIdentity(request: LocalBookIdentityRemap) {
    return this.run(() => this.delegate.remapBookIdentity(request));
  }

  listOutbox(userId: string, statuses?: OutboxItem["status"][]) {
    return this.run(() => this.delegate.listOutbox(userId, statuses));
  }

  updateOutbox(id: string, updates: Partial<OutboxItem>) {
    return this.run(() => this.delegate.updateOutbox(id, updates));
  }

  deleteOutbox(id: string) {
    return this.run(() => this.delegate.deleteOutbox(id));
  }

  getOutboxCounts(userId: string) {
    return this.run(() => this.delegate.getOutboxCounts(userId));
  }

  getSyncState(userId: string, scope: string) {
    return this.run(() => this.delegate.getSyncState(userId, scope));
  }

  setSyncState(state: SyncState) {
    return this.run(() => this.delegate.setSyncState(state));
  }
}

type DesktopLocalDbRequest = Parameters<
  NonNullable<Window["brackDesktop"]>["localDb"]["invoke"]
>[0];

class ElectronSQLiteLocalDriver implements LocalDriver {
  private initialized = false;

  async init() {
    if (this.initialized) return;
    if (!window.brackDesktop) {
      throw new Error("Brack desktop bridge is not available");
    }
    await window.brackDesktop.platform.getInfo();
    this.initialized = true;
  }

  private async invoke<T>(request: DesktopLocalDbRequest): Promise<T> {
    await this.init();
    if (!window.brackDesktop) {
      throw new Error("Brack desktop bridge is not available");
    }
    return window.brackDesktop.localDb.invoke<T>(request);
  }

  async upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>) {
    await this.invoke({ operation: "upsertRecord", table, record });
  }

  async upsertRecords<T>(table: LocalTableName, records: LocalRecord<T>[]) {
    await this.invoke({ operation: "upsertRecords", table, records });
  }

  async getRecord<T>(table: LocalTableName, id: string) {
    return this.invoke<LocalRecord<T> | null>({ operation: "getRecord", table, id });
  }

  async listRecords<T>(
    table: LocalTableName,
    userId: string,
    options: { includeDeleted?: boolean } = {}
  ) {
    return this.invoke<LocalRecord<T>[]>({
      operation: "listRecords",
      table,
      userId,
      options,
    });
  }

  async removeRecord(table: LocalTableName, id: string) {
    await this.invoke({ operation: "removeRecord", table, id });
  }

  async enqueueOutbox(item: OutboxItem) {
    await this.invoke({ operation: "enqueueOutbox", item });
  }

  async commitMutation(records: LocalMutationRecord[], item: OutboxItem) {
    await this.invoke({ operation: "commitMutation", records, item });
  }

  async remapBookIdentity(request: LocalBookIdentityRemap) {
    return this.invoke<LocalRecord<unknown>>({ operation: "remapBookIdentity", request });
  }

  async listOutbox(userId: string, statuses: OutboxItem["status"][] = ["pending", "failed"]) {
    return this.invoke<OutboxItem[]>({ operation: "listOutbox", userId, statuses });
  }

  async updateOutbox(id: string, updates: Partial<OutboxItem>) {
    await this.invoke({ operation: "updateOutbox", id, updates });
  }

  async deleteOutbox(id: string) {
    await this.invoke({ operation: "deleteOutbox", id });
  }

  async getOutboxCounts(userId: string) {
    return this.invoke<OutboxCounts>({ operation: "getOutboxCounts", userId });
  }

  async getSyncState(userId: string, scope: string) {
    return this.invoke<SyncState | null>({ operation: "getSyncState", userId, scope });
  }

  async setSyncState(state: SyncState) {
    await this.invoke({ operation: "setSyncState", state });
  }
}

const driver: LocalDriver =
  isDesktopRuntime()
    ? new ElectronSQLiteLocalDriver()
    : Capacitor.isNativePlatform()
      ? new SerializedLocalDriver(new SQLiteLocalDriver())
      : new DexieLocalDriver();

export const localDriver = driver;

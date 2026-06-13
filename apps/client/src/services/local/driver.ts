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
  | "profile_preferences";

const ENTITY_TABLES: LocalTableName[] = [
  "books",
  "reading_sessions",
  "progress_logs",
  "journal_entries",
  "goals",
  "profile_preferences",
];

export interface OutboxCounts {
  pending: number;
  failed: number;
  syncing: number;
}

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
  profile_preferences!: Table<LocalRecord, string>;
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

  async upsertRecord<T>(table: LocalTableName, record: LocalRecord<T>) {
    await this.init();
    await this.connection().run(
      `INSERT OR REPLACE INTO ${table}
       (id, user_id, data, status, updated_at, deleted_at, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      this.serializeRecord(record)
    );
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
    await this.connection().run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  async enqueueOutbox(item: OutboxItem) {
    await this.init();
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
      ]
    );
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
    await this.connection().run("DELETE FROM outbox WHERE id = ?", [id]);
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
    await this.connection().run(
      "INSERT OR REPLACE INTO sync_state (key, user_id, cursor, last_synced_at) VALUES (?, ?, ?, ?)",
      [state.key, state.user_id, state.cursor, state.last_synced_at]
    );
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
      ? new SQLiteLocalDriver()
      : new DexieLocalDriver();

export const localDriver = driver;

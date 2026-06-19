import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

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

type LocalEntityStatus = "synced" | "pending" | "failed" | "deleted";
type OutboxStatus = "pending" | "syncing" | "failed" | "synced";
type SyncOperation = "create" | "update" | "delete" | "restore";
type SyncEntity = LocalTableName;

interface LocalRecord<T = unknown> {
  id: string;
  user_id: string;
  data: T;
  status: LocalEntityStatus;
  updated_at: string;
  deleted_at?: string | null;
  last_synced_at?: string | null;
}

interface OutboxItem<TPayload = unknown> {
  id: string;
  client_mutation_id: string;
  client_entity_id: string;
  user_id: string;
  entity: SyncEntity;
  operation: SyncOperation;
  payload: TPayload;
  status: OutboxStatus;
  attempt_count: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  next_attempt_at?: string | null;
}

interface SyncState {
  key: string;
  user_id: string;
  cursor: string | null;
  last_synced_at: string | null;
}

export type LocalDbRequest =
  | { operation: "upsertRecord"; table: LocalTableName; record: LocalRecord }
  | { operation: "upsertRecords"; table: LocalTableName; records: LocalRecord[] }
  | { operation: "getRecord"; table: LocalTableName; id: string }
  | {
      operation: "listRecords";
      table: LocalTableName;
      userId: string;
      options?: { includeDeleted?: boolean };
    }
  | { operation: "removeRecord"; table: LocalTableName; id: string }
  | { operation: "enqueueOutbox"; item: OutboxItem }
  | { operation: "listOutbox"; userId: string; statuses?: OutboxStatus[] }
  | { operation: "updateOutbox"; id: string; updates: Partial<OutboxItem> }
  | { operation: "deleteOutbox"; id: string }
  | { operation: "getOutboxCounts"; userId: string }
  | { operation: "getSyncState"; userId: string; scope: string }
  | { operation: "setSyncState"; state: SyncState };

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

const ENTITY_TABLE_SET = new Set<string>(ENTITY_TABLES);
const OUTBOX_STATUS_SET = new Set<string>(["pending", "syncing", "failed", "synced"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid local database request: ${field} must be a non-empty string`);
  }
  return value;
};

const assertTable = (table: unknown): LocalTableName => {
  const value = assertString(table, "table");
  if (!ENTITY_TABLE_SET.has(value)) {
    throw new Error(`Invalid local database request: unsupported table ${value}`);
  }
  return value as LocalTableName;
};

const assertStatuses = (statuses?: unknown): OutboxStatus[] => {
  if (statuses === undefined) return ["pending", "failed"];
  if (!Array.isArray(statuses)) {
    throw new Error("Invalid local database request: statuses must be an array");
  }
  const values = statuses.map((status) => assertString(status, "status"));
  for (const status of values) {
    if (!OUTBOX_STATUS_SET.has(status)) {
      throw new Error(`Invalid local database request: unsupported outbox status ${status}`);
    }
  }
  return values as OutboxStatus[];
};

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type DbRow = Record<string, unknown>;

export class DesktopLocalDb {
  private db: Database.Database | null = null;

  constructor(private readonly dbPath: string) {}

  init() {
    if (this.db) return;

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.db?.close();
    this.db = null;
  }

  handle(request: LocalDbRequest): unknown {
    if (!isObject(request)) {
      throw new Error("Invalid local database request");
    }

    switch (request.operation) {
      case "upsertRecord":
        return this.upsertRecord(assertTable(request.table), request.record);
      case "upsertRecords":
        return this.upsertRecords(assertTable(request.table), request.records);
      case "getRecord":
        return this.getRecord(assertTable(request.table), assertString(request.id, "id"));
      case "listRecords":
        return this.listRecords(
          assertTable(request.table),
          assertString(request.userId, "userId"),
          request.options
        );
      case "removeRecord":
        return this.removeRecord(assertTable(request.table), assertString(request.id, "id"));
      case "enqueueOutbox":
        return this.enqueueOutbox(request.item);
      case "listOutbox":
        return this.listOutbox(assertString(request.userId, "userId"), assertStatuses(request.statuses));
      case "updateOutbox":
        return this.updateOutbox(assertString(request.id, "id"), request.updates);
      case "deleteOutbox":
        return this.deleteOutbox(assertString(request.id, "id"));
      case "getOutboxCounts":
        return this.getOutboxCounts(assertString(request.userId, "userId"));
      case "getSyncState":
        return this.getSyncState(
          assertString(request.userId, "userId"),
          assertString(request.scope, "scope")
        );
      case "setSyncState":
        return this.setSyncState(request.state);
      default:
        throw new Error("Invalid local database request: unsupported operation");
    }
  }

  private connection() {
    this.init();
    if (!this.db) throw new Error("Local SQLite database is not initialized");
    return this.db;
  }

  private migrate() {
    const db = this.connection();

    for (const table of ENTITY_TABLES) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          last_synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON ${table}(user_id);
        CREATE INDEX IF NOT EXISTS idx_${table}_updated_at ON ${table}(updated_at);
      `);
    }

    db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_outbox_user_status ON outbox(user_id, status);

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        cursor TEXT,
        last_synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_state_user_id ON sync_state(user_id);
    `);
  }

  private serializeRecord(record: LocalRecord) {
    return {
      id: assertString(record?.id, "record.id"),
      user_id: assertString(record?.user_id, "record.user_id"),
      data: JSON.stringify(record.data),
      status: assertString(record?.status, "record.status"),
      updated_at: assertString(record?.updated_at, "record.updated_at"),
      deleted_at: record.deleted_at ?? null,
      last_synced_at: record.last_synced_at ?? null,
    };
  }

  private deserializeRecord(row: DbRow | undefined): LocalRecord | null {
    if (!row) return null;
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      data: parseJson(row.data, null),
      status: row.status as LocalEntityStatus,
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
      last_synced_at: (row.last_synced_at as string | null) ?? null,
    };
  }

  private serializeOutbox(item: OutboxItem) {
    return {
      id: assertString(item?.id, "item.id"),
      client_mutation_id: assertString(item?.client_mutation_id, "item.client_mutation_id"),
      client_entity_id: assertString(item?.client_entity_id, "item.client_entity_id"),
      user_id: assertString(item?.user_id, "item.user_id"),
      entity: assertTable(item?.entity),
      operation: assertString(item?.operation, "item.operation"),
      payload: JSON.stringify(item.payload),
      status: assertString(item?.status, "item.status"),
      attempt_count: Number(item.attempt_count ?? 0),
      last_error: item.last_error ?? null,
      created_at: assertString(item?.created_at, "item.created_at"),
      updated_at: assertString(item?.updated_at, "item.updated_at"),
      next_attempt_at: item.next_attempt_at ?? null,
    };
  }

  private deserializeOutbox(row: DbRow): OutboxItem {
    return {
      id: String(row.id),
      client_mutation_id: String(row.client_mutation_id),
      client_entity_id: String(row.client_entity_id),
      user_id: String(row.user_id),
      entity: row.entity as SyncEntity,
      operation: row.operation as SyncOperation,
      payload: parseJson(row.payload, null),
      status: row.status as OutboxStatus,
      attempt_count: Number(row.attempt_count ?? 0),
      last_error: (row.last_error as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      next_attempt_at: (row.next_attempt_at as string | null) ?? null,
    };
  }

  private upsertRecord(table: LocalTableName, record: LocalRecord) {
    this.connection()
      .prepare(
        `INSERT INTO ${table}
          (id, user_id, data, status, updated_at, deleted_at, last_synced_at)
         VALUES
          (@id, @user_id, @data, @status, @updated_at, @deleted_at, @last_synced_at)
         ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          data = excluded.data,
          status = excluded.status,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          last_synced_at = excluded.last_synced_at`
      )
      .run(this.serializeRecord(record));
    return null;
  }

  private upsertRecords(table: LocalTableName, records: LocalRecord[]) {
    if (!Array.isArray(records)) {
      throw new Error("Invalid local database request: records must be an array");
    }
    const transaction = this.connection().transaction((items: LocalRecord[]) => {
      for (const record of items) {
        this.upsertRecord(table, record);
      }
    });
    transaction(records);
    return null;
  }

  private getRecord(table: LocalTableName, id: string) {
    const row = this.connection().prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).get(id) as
      | DbRow
      | undefined;
    return this.deserializeRecord(row);
  }

  private listRecords(
    table: LocalTableName,
    userId: string,
    options: { includeDeleted?: boolean } = {}
  ) {
    const where = options.includeDeleted ? "user_id = ?" : "user_id = ? AND status <> 'deleted'";
    const rows = this.connection()
      .prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY updated_at DESC`)
      .all(userId) as DbRow[];
    return rows.map((row) => this.deserializeRecord(row)).filter(Boolean);
  }

  private removeRecord(table: LocalTableName, id: string) {
    this.connection().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return null;
  }

  private enqueueOutbox(item: OutboxItem) {
    this.connection()
      .prepare(
        `INSERT INTO outbox
          (id, client_mutation_id, client_entity_id, user_id, entity, operation, payload, status,
           attempt_count, last_error, created_at, updated_at, next_attempt_at)
         VALUES
          (@id, @client_mutation_id, @client_entity_id, @user_id, @entity, @operation, @payload,
           @status, @attempt_count, @last_error, @created_at, @updated_at, @next_attempt_at)
         ON CONFLICT(id) DO UPDATE SET
          client_mutation_id = excluded.client_mutation_id,
          client_entity_id = excluded.client_entity_id,
          user_id = excluded.user_id,
          entity = excluded.entity,
          operation = excluded.operation,
          payload = excluded.payload,
          status = excluded.status,
          attempt_count = excluded.attempt_count,
          last_error = excluded.last_error,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          next_attempt_at = excluded.next_attempt_at`
      )
      .run(this.serializeOutbox(item));
    return null;
  }

  private listOutbox(userId: string, statuses: OutboxStatus[]) {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => "?").join(", ");
    const rows = this.connection()
      .prepare(
        `SELECT * FROM outbox
         WHERE user_id = ? AND status IN (${placeholders})
         ORDER BY created_at ASC`
      )
      .all(userId, ...statuses) as DbRow[];
    return rows.map((row) => this.deserializeOutbox(row));
  }

  private updateOutbox(id: string, updates: Partial<OutboxItem>) {
    if (!isObject(updates)) {
      throw new Error("Invalid local database request: updates must be an object");
    }
    const existing = this.connection().prepare("SELECT * FROM outbox WHERE id = ? LIMIT 1").get(id) as
      | DbRow
      | undefined;
    if (!existing) return null;
    this.enqueueOutbox({
      ...this.deserializeOutbox(existing),
      ...updates,
    });
    return null;
  }

  private deleteOutbox(id: string) {
    this.connection().prepare("DELETE FROM outbox WHERE id = ?").run(id);
    return null;
  }

  private getOutboxCounts(userId: string) {
    const rows = this.connection()
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM outbox
         WHERE user_id = ? AND status IN ('pending', 'failed', 'syncing')
         GROUP BY status`
      )
      .all(userId) as { status: string; count: number }[];

    return rows.reduce(
      (counts, row) => ({
        ...counts,
        [row.status]: Number(row.count ?? 0),
      }),
      { pending: 0, failed: 0, syncing: 0 }
    );
  }

  private getSyncState(userId: string, scope: string) {
    const row = this.connection()
      .prepare("SELECT * FROM sync_state WHERE key = ? LIMIT 1")
      .get(`${userId}:${scope}`) as DbRow | undefined;
    return row
      ? {
          key: String(row.key),
          user_id: String(row.user_id),
          cursor: (row.cursor as string | null) ?? null,
          last_synced_at: (row.last_synced_at as string | null) ?? null,
        }
      : null;
  }

  private setSyncState(state: SyncState) {
    this.connection()
      .prepare(
        `INSERT INTO sync_state (key, user_id, cursor, last_synced_at)
         VALUES (@key, @user_id, @cursor, @last_synced_at)
         ON CONFLICT(key) DO UPDATE SET
          user_id = excluded.user_id,
          cursor = excluded.cursor,
          last_synced_at = excluded.last_synced_at`
      )
      .run({
        key: assertString(state?.key, "state.key"),
        user_id: assertString(state?.user_id, "state.user_id"),
        cursor: state.cursor ?? null,
        last_synced_at: state.last_synced_at ?? null,
      });
    return null;
  }
}

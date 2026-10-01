import * as base from '../book-detail/api';
import { readAccount } from '../library-tasks/state';
import type { Book } from '../../../apps/client/src/types';
import type { LocalRecord, ProgressLogPayload, SyncOperation } from '../../../apps/client/src/services/sync/types';
import type { ProgressTrackingData, ProgressLog } from '../../../apps/client/src/services/api/progress';
import { todayDateOnly } from '../../../apps/client/src/lib/dateOnly';
export * from '../book-detail/api';

// Controlled API/repository boundaries only. This is an in-memory fixture,
// not evidence that IndexedDB, native SQLite, sync transport or storage passed.
export type CaptureOperation = 'log' | 'book' | 'history' | 'metrics' | 'upload' | 'picker' | 'correction';
export type CaptureMode = 'resolve' | 'reject' | 'defer' | 'commit-reject';
type Outcome = 'resolve' | 'reject' | 'cancel';
type StoredLog = ProgressLogPayload & { id: string };
type CaptureCall = { operation: CaptureOperation; owner: string | null; payload: unknown };
type FixtureOutbox = { entity: 'books' | 'progress_logs'; owner: string; id: string; operation: SyncOperation; payload: unknown };
type ReaderStore = { books: Map<string, LocalRecord<Book>>; logs: Map<string, LocalRecord<StoredLog>>; seeded: boolean; seeding?: Promise<void> };
const params = new URLSearchParams(location.search);
const owners = new Map<string, ReaderStore>();
const modes = new Map<CaptureOperation, CaptureMode>();
const calls: CaptureCall[] = [];
const outbox: FixtureOutbox[] = [];
const syncRequests: string[] = [];
const pending: Array<CaptureCall & { settle: (outcome: Outcome) => void }> = [];
let connected = !params.has('offline');
let sequence = 0;
export const CONNECTIVITY_STATE_EVENT = 'brack:connectivity-state';
export const getConnectivityState = () => connected ? 'online' as const : 'offline' as const;
export const isConnectivityAvailable = () => connected;
export const FIXTURE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
export const FIXTURE_IMAGE_URL = `data:image/png;base64,${FIXTURE_IMAGE_BASE64}`;

const clone = <T,>(value: T): T => structuredClone(value);
const store = (owner: string): ReaderStore => {
  let value = owners.get(owner);
  if (!value) { value = { books: new Map(), logs: new Map(), seeded: false }; owners.set(owner, value); }
  return value;
};
const record = <T extends { id: string; updated_at?: string | null; created_at?: string | null; deleted_at?: string | null }>(owner: string, data: T, status: LocalRecord<T>['status']): LocalRecord<T> => ({
  id: data.id, user_id: owner, data: clone(data), status: data.deleted_at ? 'deleted' : status,
  updated_at: data.updated_at ?? data.created_at ?? new Date().toISOString(), deleted_at: data.deleted_at ?? null,
  last_synced_at: status === 'synced' ? new Date().toISOString() : null,
});

async function initialize(owner: string) {
  const value = store(owner);
  if (value.seeded || owner !== readAccount()) return value;
  if (!value.seeding) value.seeding = (async () => {
    const initial = await base.booksRepo.list(owner);
    const books = await Promise.all(initial.map(book => base.booksRepo.get(book.id)));
    if (owner !== readAccount()) return;
    for (const book of books) if (book?.user_id === owner && !value.books.has(book.id)) {
      value.books.set(book.id, record(owner, book, 'synced'));
    }
    const logs = await base.fetchProgressLogs();
    if (owner !== readAccount()) return;
    for (const log of logs) if (log.user_id === owner && !value.logs.has(log.id)) value.logs.set(log.id, record(owner, log, 'synced'));
    value.seeded = true;
  })().finally(() => { value.seeding = undefined; });
  await value.seeding;
  return value;
}

/** Reject before a write; commit-reject lets the caller observe an ambiguous committed result. */
export async function requestCapture(operation: CaptureOperation, payload: unknown, owner = readAccount()): Promise<'resolve' | 'commit-reject' | 'cancel'> {
  const call = { operation, owner, payload: clone(payload) };
  calls.push(call);
  const mode = modes.get(operation) ?? 'resolve';
  if (mode === 'reject') throw new Error(`Fixture ${operation} failed`);
  if (mode === 'defer') {
    const outcome = await new Promise<Outcome>(resolve => pending.push({ ...call, settle: resolve }));
    if (outcome === 'reject' || (outcome === 'cancel' && operation !== 'picker')) throw new Error(`Fixture ${operation} failed`);
    return outcome === 'cancel' ? 'cancel' : 'resolve';
  }
  return mode;
}

const rejectAfterCommit = (mode: string, operation: CaptureOperation) => {
  if (mode === 'commit-reject') throw new Error(`Fixture ${operation} response failed after commit`);
};

function hydrate<T extends { id: string; updated_at?: string | null; created_at?: string | null; deleted_at?: string | null }>(
  records: Map<string, LocalRecord<T>>, owner: string, items: T[], preserve: boolean,
) {
  for (const item of items) {
    const prior = records.get(item.id);
    if (preserve && prior && prior.status !== 'synced') continue;
    records.set(item.id, record(owner, item, 'synced'));
  }
  return items.map(item => clone(records.get(item.id)!.data));
}

export const booksRepo = {
  ...base.booksRepo,
  get: async (id: string) => {
    const owner = readAccount();
    if (!owner) return null;
    const value = await initialize(owner);
    return clone(value.books.get(id)?.data ?? null);
  },
  list: async (owner: string) => [...(await initialize(owner)).books.values()].filter(item => !item.deleted_at).map(item => clone(item.data)),
  listRecords: async (owner: string) => [...(await initialize(owner)).books.values()].map(clone),
  upsertLocal: async (owner: string, book: Book, operation: SyncOperation = 'update') => {
    const mode = await requestCapture('book', { book, operation }, owner);
    store(owner).books.set(book.id, record(owner, book, 'pending'));
    outbox.push({ entity: 'books', owner, id: book.id, operation, payload: clone(book) });
    rejectAfterCommit(mode, 'book');
  },
  upsertRemote: async (owner: string, book: Book) => { hydrate(store(owner).books, owner, [book], false); },
  upsertRemoteMany: async (owner: string, books: Book[]) => { hydrate(store(owner).books, owner, books, false); },
  upsertRemoteManyPreservingLocal: async (owner: string, books: Book[]) => hydrate(store(owner).books, owner, books, true),
};

export const progressRepo = {
  get: async (id: string) => {
    // Local repository get is keyed by entity identity; ownership is validated
    // by the product caller rather than silently supplied by this boundary.
    for (const owner of owners.values()) if (owner.logs.has(id)) return clone(owner.logs.get(id)!.data);
    return null;
  },
  listRecords: async (owner: string, options?: { includeDeleted?: boolean }) => [...(await initialize(owner)).logs.values()]
    .filter(item => options?.includeDeleted || item.status !== 'deleted').map(clone),
  createPending: async (owner: string, log: StoredLog) => {
    const mode = await requestCapture('log', log, owner);
    store(owner).logs.set(log.id, record(owner, log, 'pending'));
    // Count calls durably: overwriting the same id must not hide duplicate work.
    outbox.push({ entity: 'progress_logs', owner, id: log.id, operation: 'create', payload: clone(log) });
    rejectAfterCommit(mode, 'log');
  },
  upsertRemoteMany: async (owner: string, logs: StoredLog[]) => { hydrate(store(owner).logs, owner, logs, false); },
  upsertRemoteManyPreservingLocal: async (owner: string, logs: StoredLog[]) => hydrate(store(owner).logs, owner, logs, true),
};

export const createLocalId = () => `capture-local-${++sequence}`;
export const fetchActiveBookById = async (id: string) => clone(await base.fetchActiveBookById(id));
export const fetchBookById = fetchActiveBookById;
export const fetchProgressLogs = async (bookId: string): Promise<ProgressLog[]> => {
  const owner = readAccount();
  const remote = clone(await base.fetchProgressLogs()).filter(log => log.book_id === bookId && log.user_id === owner)
    .map(log => ({ ...log, created_at: log.logged_at }));
  await requestCapture('history', { kind: 'logs', bookId }, owner);
  return remote;
};
export const fetchProgressTrackingData = async (bookId: string): Promise<ProgressTrackingData> => {
  await requestCapture('history', { kind: 'daily', bookId });
  return params.has('emptyHistory') ? { dailyProgress: [], velocityData: [], forecastData: [] } : {
    dailyProgress: [{ date: '2026-09-30', pages_read: 22, time_spent: 30 }, { date: '2026-10-01', pages_read: 20, time_spent: 25 }],
    velocityData: [{ date: '2026-09-30', pages_per_day: 22, pagesPerHour: 44, cumulative_pages: 22 }, { date: '2026-10-01', pages_per_day: 20, pagesPerHour: 48, cumulative_pages: 42 }],
    forecastData: [],
  };
};
export const getBookProgress = async (bookId: string) => {
  const owner = readAccount();
  const snapshot = await base.getBookProgress();
  await requestCapture('metrics', { bookId }, owner);
  return clone(snapshot);
};

// Mirrors the existing quick-correction service's page/status/date behavior.
// It deliberately creates no progress log, streak event or reward result.
export const updateBookQuickProgress = async (book: Book, pageNumber: number) => {
  const mode = await requestCapture('correction', { bookId: book.id, pageNumber }, book.user_id);
  const next = { ...book, current_page: pageNumber, updated_at: new Date().toISOString() };
  if (book.pages && pageNumber >= book.pages && book.status !== 'completed') {
    next.status = 'completed'; next.date_finished = todayDateOnly();
  }
  if (!book.date_started && pageNumber > 0) next.date_started = todayDateOnly();
  if (book.status === 'to_read' && pageNumber > 0 && (!book.pages || pageNumber < book.pages)) next.status = 'reading';
  store(book.user_id).books.set(book.id, record(book.user_id, next, 'pending'));
  outbox.push({ entity: 'books', owner: book.user_id, id: book.id, operation: 'update', payload: clone(next) });
  rejectAfterCommit(mode, 'correction');
  base.emitBooksChanged({ type: 'upsert', userId: book.user_id, book: next });
  if (connected) void readingCoreSync.syncUser(book.user_id);
};
export const uploadPublicStorageFile = async (bucket: string, path: string, body: Blob, options?: { contentType?: string }) => {
  const mode = await requestCapture('upload', { bucket, path, bytes: body.size, contentType: options?.contentType ?? body.type });
  rejectAfterCommit(mode, 'upload');
  return FIXTURE_IMAGE_URL;
};
export const readingCoreSync = { ...base.readingCoreSync,
  syncUser: async (owner: string) => { syncRequests.push(owner); },
  syncCurrentUser: async () => { if (readAccount()) syncRequests.push(readAccount()!); },
  getStatus: async () => ({ pending: outbox.length, failed: 0, syncing: 0 }),
};

window.readingCapture = {
  configure: (operation, mode) => { modes.set(operation, mode); },
  settle: (operation, outcome) => {
    const index = pending.findIndex(item => item.operation === operation);
    if (index < 0) throw new Error(`No pending capture operation: ${operation}`);
    pending.splice(index, 1)[0].settle(outcome);
  },
  setNetwork: available => {
    connected = available;
    window.dispatchEvent(new CustomEvent(CONNECTIVITY_STATE_EVENT, { detail: getConnectivityState() }));
  },
  patchBook: (id, patch) => {
    const owner = readAccount();
    if (!owner) throw new Error('No active fixture reader');
    const current = store(owner).books.get(id);
    if (!current) throw new Error(`No cached fixture book: ${id}`);
    store(owner).books.set(id, record(owner, { ...current.data, ...patch }, current.status));
  },
  snapshot: () => {
    const accountId = readAccount();
    const current = accountId ? store(accountId) : undefined;
    return clone({ accountId, network: connected, calls,
      books: [...(current?.books.values() ?? [])].map(item => item.data),
      logs: [...(current?.logs.values() ?? [])].map(item => item.data),
      bookRecords: [...(current?.books.values() ?? [])], logRecords: [...(current?.logs.values() ?? [])],
      outbox, outboxCounts: { books: outbox.filter(item => item.entity === 'books').length, logs: outbox.filter(item => item.entity === 'progress_logs').length },
      pending: pending.map(({ operation, owner, payload }) => ({ operation, owner, payload })), syncRequests,
    });
  },
};

for (const operation of ['history', 'metrics', 'log', 'book', 'upload', 'picker', 'correction'] as const) {
  const mode = params.get(operation);
  if (mode === 'resolve' || mode === 'reject' || mode === 'defer' || mode === 'commit-reject') modes.set(operation, mode);
}

declare global { interface Window { readingCapture: {
  configure: (operation: CaptureOperation, mode: CaptureMode) => void;
  settle: (operation: CaptureOperation, outcome: Outcome) => void;
  setNetwork: (available: boolean) => void;
  patchBook: (id: string, patch: Partial<Book>) => void;
  snapshot: () => {
    accountId: string | null; network: boolean; calls: CaptureCall[]; books: Book[]; logs: StoredLog[];
    bookRecords: LocalRecord<Book>[]; logRecords: LocalRecord<StoredLog>[];
    outbox: FixtureOutbox[]; outboxCounts: { books: number; logs: number };
    pending: CaptureCall[]; syncRequests: string[];
  };
} } }

export const applyReadingStreakFreeze = async () => { throw new Error('Outside reading capture fixture'); };
export const needsSetupPrompt = () => false;

import * as base from '../reading-progress/api';
import { readAccount } from '../library-tasks/state';
import type { Book, ReadingSession } from '../../../apps/client/src/types';
import type { LocalRecord, SyncOperation } from '../../../apps/client/src/services/sync/types';
import { BookEditorValidationError, validateEditedBook } from '../../../apps/client/src/lib/bookEditor';
import type { JournalEntry } from '../../../apps/client/src/services/api/journal';
export * from '../reading-progress/api';

// Only persistence/network boundaries are controlled. TimerProvider, timer
// arithmetic, UI owners, routing, forms and the native service consumer are real.
export type SessionOperation = 'session' | 'identity' | 'auth' | 'edit' | 'book-read' | 'journal' | 'library';
export type SessionMode = 'resolve' | 'reject' | 'defer' | 'commit-reject';
type SessionCall = { operation: SessionOperation; owner: string | null; payload: unknown };
const params = new URLSearchParams(location.search);
const modes = new Map<SessionOperation, SessionMode>();
const calls: SessionCall[] = [];
const pending: Array<SessionCall & { settle: (outcome: 'resolve' | 'reject') => void }> = [];
const sessions = new Map<string, LocalRecord<ReadingSession>>();
const outbox: Array<{ owner: string; session: ReadingSession }> = [];
const identities = new Map<string, string>();
const journals = new Map<string, LocalRecord<JournalEntry>>();
const clone = <T,>(value: T): T => structuredClone(value);
const durableKey = 'fixture:reading-session-repository';
const storedBoundary = sessionStorage.getItem(durableKey);
if (storedBoundary) {
  const restored = JSON.parse(storedBoundary) as { sessions: Array<[string, LocalRecord<ReadingSession>]>; outbox: typeof outbox; calls: SessionCall[] };
  for (const [id, record] of restored.sessions) sessions.set(id, record);
  outbox.push(...restored.outbox); calls.push(...restored.calls);
}
const persistBoundary = () => sessionStorage.setItem(durableKey, JSON.stringify({ sessions: [...sessions], outbox, calls }));

async function request(operation: SessionOperation, payload: unknown, owner = readAccount()) {
  const call = { operation, owner, payload: clone(payload) }; calls.push(call);
  const mode = modes.get(operation) ?? 'resolve';
  if (mode === 'reject') throw new Error(`Fixture ${operation} failed`);
  if (mode === 'defer') {
    const result = await new Promise<'resolve' | 'reject'>(resolve => pending.push({ ...call, settle: resolve }));
    if (result === 'reject') throw new Error(`Fixture ${operation} failed`);
  }
  return mode;
}

export const booksRepo = { ...base.booksRepo,
  get: async (id: string) => { await request('book-read', { id }); return base.booksRepo.get(id); },
  list: async (owner: string) => {
    await request('library', null, owner);
    return params.has('emptyPicker') ? [] : base.booksRepo.list(owner);
  },
  resolveIdentity: async (owner: string, id: string) => {
    await request('identity', { id }, owner); return identities.get(`${owner}:${id}`) ?? id;
  },
};
export const getCurrentAuthUser = async () => {
  const id = readAccount(); await request('auth', null, id); return id ? { id } : null;
};
export const sessionsRepo = {
  get: async (id: string) => clone(sessions.get(id)?.data ?? null),
  list: async (owner: string) => [...sessions.values()].filter(item => item.user_id === owner && !item.deleted_at).map(item => clone(item.data)),
  listRecords: async (owner: string) => [...sessions.values()].filter(item => item.user_id === owner).map(clone),
  createPending: async (owner: string, session: ReadingSession) => {
    const mode = await request('session', session, owner);
    sessions.set(session.id, { id: session.id, user_id: owner, data: clone(session), status: 'pending',
      updated_at: new Date().toISOString(), deleted_at: null, last_synced_at: null });
    outbox.push({ owner, session: clone(session) });
    persistBoundary();
    if (mode === 'commit-reject') throw new Error('Fixture session response failed after commit');
  },
  upsertRemoteMany: async (owner: string, items: ReadingSession[]) => {
    for (const item of items) if (!sessions.has(item.id)) sessions.set(item.id, { id: item.id, user_id: owner,
      data: clone(item), status: 'synced', updated_at: item.created_at ?? new Date().toISOString(),
      deleted_at: null, last_synced_at: new Date().toISOString() });
  },
};
export const fetchBookReadingSessions = async (bookId: string) => {
  const owner = readAccount();
  return owner ? (await sessionsRepo.list(owner)).filter(session => session.book_id === bookId) : [];
};
export const fetchBookById = async (id: string) => {
  await request('book-read', { id, remote: true }); return base.fetchBookById(id);
};
export const journalRepo = {
  listRecords: async (owner: string) => [...journals.values()].filter(entry => entry.user_id === owner).map(clone),
  upsertRemoteManyPreservingLocal: async (owner: string, items: JournalEntry[]) => {
    for (const entry of items) if (!journals.has(entry.id)) journals.set(entry.id, { id: entry.id, user_id: owner, data: clone(entry), status: 'synced', updated_at: entry.updated_at, deleted_at: null, last_synced_at: entry.updated_at });
    return items.map(entry => clone(journals.get(entry.id)!.data));
  },
};
export const fetchJournalEntries = async () => [];
export const updateBookStatusForActivity = async () => undefined;
export const GAMIFICATION_SHOP_ITEM_CODES = { streakFreeze: 'streak_freeze' } as const;
export const journalOperations = {
  create: async (input: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>) => {
    await request('journal', input, input.user_id);
    const stamp = new Date().toISOString();
    const entry: JournalEntry = { ...input, id: `fixture-journal-${journals.size + 1}`, created_at: stamp, updated_at: stamp };
    journals.set(entry.id, { id: entry.id, user_id: entry.user_id, data: clone(entry), status: 'pending', updated_at: stamp, deleted_at: null, last_synced_at: null });
    return clone(entry);
  },
  update: async () => { throw new Error('Journal editing is outside the session handoff fixture'); },
  delete: async () => { throw new Error('Journal deletion is outside the session handoff fixture'); },
};
export const bookOperations = { ...base.bookOperations,
  update: async (id: string, updates: Partial<Book>, options?: { expectedUserId?: string; isCurrent?: () => boolean }) => {
    const owner = readAccount();
    const mode = await request('edit', { id, updates }, owner);
    if (!owner) throw new Error('Not authenticated');
    if ((options?.expectedUserId && options.expectedUserId !== owner) || options?.isCurrent?.() === false) throw new Error('Book edit is no longer current');
    const current = await base.booksRepo.get(id);
    if (options?.isCurrent?.() === false) throw new Error('Book edit is no longer current');
    if (!current || current.user_id !== owner || current.deleted_at) throw new Error('Book unavailable');
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    if (options?.expectedUserId) {
      const errors = validateEditedBook(updated);
      if (Object.keys(errors).length) throw new BookEditorValidationError(errors, current);
    }
    await base.booksRepo.upsertLocal(owner, updated, 'update' as SyncOperation);
    base.emitBooksChanged({ type: 'upsert', userId: owner, book: updated });
    if (mode === 'commit-reject') throw new Error('Fixture edit response failed after commit');
    return { synced: false, data: updated };
  },
};
export const sessionControls = {
  configure: (operation: SessionOperation, mode: SessionMode) => { modes.set(operation, mode); },
  settle: (operation: SessionOperation, outcome: 'resolve' | 'reject') => {
    const index = pending.findIndex(item => item.operation === operation);
    if (index < 0) throw new Error(`No pending session operation: ${operation}`);
    pending.splice(index, 1)[0].settle(outcome);
  },
  remap: (owner: string, from: string, to: string) => { identities.set(`${owner}:${from}`, to); },
  snapshot: () => clone({ calls, pending: pending.map(({ operation, owner, payload }) => ({ operation, owner, payload })),
    sessions: [...sessions.values()], journals: [...journals.values()], outbox, storage: { timer: localStorage.getItem(`readingTimer:${readAccount()}`), recovery: localStorage.getItem(`readingTimerRecovery:${readAccount()}`),
      legacyTimer: localStorage.getItem('readingTimer'), legacyRecovery: localStorage.getItem('readingTimerRecovery') } }),
};
for (const operation of ['session', 'identity', 'auth', 'edit', 'book-read', 'journal', 'library'] as const) {
  const mode = params.get(operation);
  if (mode === 'resolve' || mode === 'reject' || mode === 'defer' || mode === 'commit-reject') modes.set(operation, mode);
}

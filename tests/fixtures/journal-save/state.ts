import type { JournalEntry } from '../../../apps/client/src/services/api/journal';

export const reader = { id: 'journal-fixture-reader', email: 'reader@example.invalid' };
export const bookId = 'journal-fixture-book';
export const attachmentUrl = 'http://127.0.0.1:8086/attachment.svg';

type Write = {
  kind: 'create' | 'update';
  id?: string;
  payload: Record<string, unknown>;
  state: 'pending' | 'rejected' | 'committed';
};

export interface FixtureSnapshot {
  writes: Write[];
  records: JournalEntry[];
  uploads: number;
  removals: string[][];
  fetches: number;
  statusUpdates: number;
  online: boolean;
}

const params = new URLSearchParams(window.location.search);
const original: JournalEntry = {
  id: 'journal-fixture-existing', user_id: reader.id, book_id: bookId,
  entry_type: 'note', title: 'Original journal entry', content: 'Original saved writing',
  content_format: 'plain', content_json: null, content_html: null,
  page_reference: 12, tags: ['Original tag'], photo_url: attachmentUrl,
  created_at: '2026-09-27T12:00:00Z', updated_at: '2026-09-27T12:00:00Z',
};

export const fixtureState: FixtureSnapshot = {
  writes: [], records: params.has('existing') ? [original] : [],
  uploads: 0, removals: [], fetches: 0, statusUpdates: 0,
  online: !params.has('offline'),
};
export const locallyPendingIds = new Set<string>();

let failRefresh = false;
let failLocalRead = false;
let failUpload = false;
let deferUploads = false;
let failStatus = false;
let remountSurfaces: () => void = () => { throw new Error('Fixture surfaces are not mounted'); };
const pendingWrites: Array<{ resolve: () => void; reject: () => void }> = [];
const pendingUploads: Array<{ resolve: () => void; reject: () => void }> = [];

export const registerFixtureRemount = (remount: () => void) => { remountSurfaces = remount; };

export const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const fixtureFailures = {
  refresh: () => failRefresh,
  localRead: () => failLocalRead,
  upload: () => failUpload,
  status: () => failStatus,
};

export function uploadPhoto(): Promise<string> {
  fixtureState.uploads += 1;
  const url = `${attachmentUrl}?upload=${fixtureState.uploads}`;
  if (failUpload) return Promise.reject(new Error('Fixture photo upload rejected'));
  if (!deferUploads) return Promise.resolve(url);
  return new Promise((resolve, reject) => pendingUploads.push({
    resolve: () => resolve(url),
    reject: () => reject(new Error('Fixture photo upload rejected')),
  }));
}

export function writeJournal(kind: Write['kind'], payload: Record<string, unknown>, id?: string): Promise<JournalEntry | void> {
  const write: Write = { kind, id, payload: copy(payload), state: 'pending' };
  fixtureState.writes.push(write);
  return new Promise((resolve, reject) => {
    pendingWrites.push({
      resolve: () => {
        const timestamp = new Date().toISOString();
        const entry = kind === 'create' ? {
          ...payload, id: `journal-fixture-created-${fixtureState.writes.length}`,
          user_id: reader.id, created_at: timestamp, updated_at: timestamp,
        } as JournalEntry : {
          ...fixtureState.records.find((record) => record.id === id),
          ...payload, updated_at: timestamp,
        } as JournalEntry;
        fixtureState.records = kind === 'create'
          ? [...fixtureState.records, entry]
          : fixtureState.records.map((record) => record.id === id ? entry : record);
        locallyPendingIds.add(entry.id);
        write.state = 'committed';
        resolve(kind === 'create' ? copy(entry) : undefined);
      },
      reject: () => {
        write.state = 'rejected';
        reject(new Error('Fixture local journal write rejected'));
      },
    });
  });
}

export const journalFixture = {
  snapshot: (): FixtureSnapshot => copy(fixtureState),
  remount: () => remountSurfaces(),
  resolveNext: () => {
    const pending = pendingWrites.shift();
    if (!pending) throw new Error('No pending fixture write');
    pending.resolve();
  },
  rejectNext: () => {
    const pending = pendingWrites.shift();
    if (!pending) throw new Error('No pending fixture write');
    pending.reject();
  },
  failRefresh: (value: boolean) => { failRefresh = value; },
  failLocalRead: (value: boolean) => { failLocalRead = value; },
  failUpload: (value: boolean) => { failUpload = value; },
  deferUploads: (value: boolean) => { deferUploads = value; },
  resolveUpload: () => {
    const pending = pendingUploads.shift();
    if (!pending) throw new Error('No pending fixture upload');
    pending.resolve();
  },
  rejectUpload: () => {
    const pending = pendingUploads.shift();
    if (!pending) throw new Error('No pending fixture upload');
    pending.reject();
  },
  failBookStatus: (value: boolean) => { failStatus = value; },
};

declare global {
  interface Window { journalFixture: typeof journalFixture }
}

window.journalFixture = journalFixture;

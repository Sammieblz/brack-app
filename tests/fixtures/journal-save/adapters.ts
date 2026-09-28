import { copy, fixtureFailures, fixtureState, locallyPendingIds, reader, writeJournal } from './state';

export const useAuth = () => ({ user: reader, loading: false });
export const isConnectivityAvailable = () => fixtureState.online;
export const journalRepo = {
  listRecords: async () => {
    if (fixtureFailures.localRead()) throw new Error('Fixture local journal refresh rejected');
    return fixtureState.records.map((entry) => ({
      data: copy(entry),
      status: locallyPendingIds.has(entry.id) ? 'pending' : 'synced',
      deleted_at: null,
    }));
  },
  upsertRemote: async () => undefined,
  // This fixture's remote snapshot is the same synthetic record set. Real
  // unsynced/deleted reconciliation is covered by local-adapter unit tests.
  upsertRemoteManyPreservingLocal: async () => undefined,
};
export const journalOperations = {
  create: (payload: Record<string, unknown>) => writeJournal('create', payload),
  update: (id: string, payload: Record<string, unknown>) => writeJournal('update', payload, id),
  delete: async () => { throw new Error('Deletion is outside this fixture'); },
};
export const updateBookStatusIfNeeded = async () => {
  fixtureState.statusUpdates += 1;
  if (fixtureFailures.status()) throw new Error('Fixture book status update rejected');
};
export const getApiErrorStatus = (error: unknown) => {
  return error && typeof error === 'object' && 'status' in error ? error.status : null;
};

const data = btoa('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#9b7159"/><text x="12" y="48" fill="white">Journal fixture</text></svg>');
const pickImage = async () => ({ dataUrl: `data:image/svg+xml;base64,${data}`, base64: data, format: 'svg+xml' });
export const useImagePicker = () => ({
  picking: false, pickImage, pickFromCamera: pickImage,
  pickFromPhotos: pickImage, pickWithPrompt: pickImage,
});

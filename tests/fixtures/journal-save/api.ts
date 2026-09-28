import { copy, fixtureFailures, fixtureState, reader, uploadPhoto } from './state';

export const getCurrentAuthUser = async () => reader;
export const fetchJournalEntries = async () => {
  fixtureState.fetches += 1;
  if (fixtureFailures.refresh()) throw Object.assign(new Error('Fixture refresh unavailable'), { status: 503 });
  return copy(fixtureState.records);
};
export const uploadPublicStorageFile = uploadPhoto;
export const removeStorageFiles = async (_bucket: string, paths: string[]) => {
  fixtureState.removals.push([...paths]);
};

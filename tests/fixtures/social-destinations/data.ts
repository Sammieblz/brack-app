export * from '../live-composers/data';
const calls: string[] = [];
export const actions = calls;
export const isConnectivityAvailable = () => true;
export const booksRepo = { get: async () => null, upsertRemote: async () => {} };
export const sessionsRepo = { list: async () => [] };
export const progressRepo = { listRecords: async () => [], upsertRemoteMany: async () => {} };
export const createLocalId = () => crypto.randomUUID();
export const Share = { share: async () => { throw new Error('Native share outside fixture'); } };
export const useFollowing = () => ({ followersCount: 14, followingCount: 8,
  isFollowing: false, isFollowedBy: false, isMutual: false, loading: false, messageEligibility: 'eligible',
  followUser: async () => { calls.push('follow'); }, unfollowUser: async () => { calls.push('unfollow'); } });

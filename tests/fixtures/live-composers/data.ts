/** Account, shell and unrelated feature boundaries; target screens/tasks stay real. */
export * from '../adaptive-shell/data';
const unexpected = async () => { throw new Error('This mutation is outside the live-composers fixture'); };
export const useFollowing = () => ({ followersCount: 14, followingCount: 8,
  isFollowing: true, isFollowedBy: true, isMutual: true, loading: false, messageEligibility: 'eligible',
  followUser: unexpected, unfollowUser: unexpected });

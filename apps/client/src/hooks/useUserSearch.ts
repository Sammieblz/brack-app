import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { discoverReaders, type DiscoverResults, type UserSearchResult } from "@/services/api";

export type { DiscoverResults, UserSearchResult };

const emptyResults: DiscoverResults = {
    suggestions: [],
    nearby: [],
    connections: [],
    friendsOfFriends: [],
    activeFriends: [],
    searchResults: [],
};

export const useUserSearch = (searchQuery: string = "", maxDistance: number = 50) => {
  const { user, loading: authLoading } = useAuth();
  const read = useCallback(() => discoverReaders(searchQuery, maxDistance), [searchQuery, maxDistance]);
  const resource = useRetainedReaderResource(user ? JSON.stringify([user.id, searchQuery, maxDistance]) : undefined, read);
  return {
    results: resource.data ?? emptyResults,
    loading: authLoading || resource.loading,
    refreshing: resource.refreshing,
    error: resource.error?.message ?? null,
    refetch: resource.refetch,
    hasLoaded: resource.data !== undefined,
  };
};

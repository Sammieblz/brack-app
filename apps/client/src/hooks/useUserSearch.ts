import { useState, useEffect } from "react";
import { discoverReaders, type DiscoverResults, type UserSearchResult } from "@/services/api";

export type { DiscoverResults, UserSearchResult };

export const useUserSearch = (searchQuery: string = "", maxDistance: number = 50) => {
  const [results, setResults] = useState<DiscoverResults>({
    suggestions: [],
    nearby: [],
    connections: [],
    friendsOfFriends: [],
    activeFriends: [],
    searchResults: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const discoverUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await discoverReaders(searchQuery, maxDistance);
        setResults(data);
      } catch (err: unknown) {
        console.error("Error discovering users:", err);
        setError(err instanceof Error ? err.message : "Failed to discover users");
      } finally {
        setLoading(false);
      }
    };

    discoverUsers();
  }, [searchQuery, maxDistance]);

  return { results, loading, error };
};

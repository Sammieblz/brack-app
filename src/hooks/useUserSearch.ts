import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserSearchResult {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number;
  books_read_count: number;
  distance_km?: number;
  mutual_follows?: number;
  genre_overlap?: number;
  recent_activity?: number;
  recommendation_reason: string;
  recommendation_score: number;
}

export interface DiscoverResults {
  all: UserSearchResult[];
  nearby: UserSearchResult[];
  socialConnections: UserSearchResult[];
  similarTaste: UserSearchResult[];
  activeReaders: UserSearchResult[];
}

export const useUserSearch = (searchQuery: string = "", maxDistance: number = 50) => {
  const [results, setResults] = useState<DiscoverResults>({
    all: [],
    nearby: [],
    socialConnections: [],
    similarTaste: [],
    activeReaders: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const discoverUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: functionError } = await supabase.functions.invoke(
          'discover-readers',
          {
            body: { searchQuery, maxDistance },
          }
        );

        if (functionError) throw functionError;

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

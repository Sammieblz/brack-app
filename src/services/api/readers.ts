import { invokeFunction } from "./client";

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

export const discoverReaders = async (
  searchQuery: string,
  maxDistance: number
): Promise<DiscoverResults> => {
  return invokeFunction<DiscoverResults>("discover-readers", {
    body: { searchQuery, maxDistance },
  });
};

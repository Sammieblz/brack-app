import { invokeFunction } from "./client";

export type ReaderRelationship = "none" | "following" | "follower" | "friend";

export type ReaderStatusBadge =
  | "available"
  | "reading_now"
  | "buddy_reads"
  | "looking_for_club"
  | "taking_recommendations"
  | "quiet";

export interface UserSearchResult {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number;
  books_read_count: number;
  distance_km?: number;
  mutual_follows?: number;
  mutual_friend_count: number;
  shared_club_count: number;
  genre_overlap?: number;
  recent_activity?: number;
  relationship: ReaderRelationship;
  status_badge: ReaderStatusBadge;
  is_online: boolean;
  last_seen_at: string | null;
  badges: string[];
  recommendation_reason: string;
  recommendation_score: number;
}

export interface DiscoverResults {
  suggestions: UserSearchResult[];
  nearby: UserSearchResult[];
  connections: UserSearchResult[];
  friendsOfFriends: UserSearchResult[];
  activeFriends: UserSearchResult[];
  searchResults: UserSearchResult[];
}

export const discoverReaders = async (
  searchQuery: string,
  maxDistance: number,
  limit = 24
): Promise<DiscoverResults> => {
  return invokeFunction<DiscoverResults>("discover-readers", {
    body: { searchQuery, maxDistance, limit },
  });
};

export interface UpdatePresenceResponse {
  online_enabled: boolean;
  reader_status: ReaderStatusBadge;
  last_seen_at: string | null;
}

export const updatePresence = async (
  readerStatus?: ReaderStatusBadge
): Promise<UpdatePresenceResponse> => {
  return invokeFunction<UpdatePresenceResponse>("update-presence", {
    body: readerStatus ? { reader_status: readerStatus } : {},
  });
};
